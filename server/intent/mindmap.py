"""AI 마인드맵 하네스 — 자료(글) → 계층 개요(JSON) · 가지 설명.

노트북LM 의 마인드맵처럼, 올려 둔 자료를 읽어 「주제 → 큰 가지 → 하위 가지」 로 정리한다(2026-10-08).
planner.py 와 같은 틀이다: **LLM 함수를 주입받는 순수 하네스**라 네트워크 없이 검증한다(test_mindmap.py).

원칙
- **LLM 출력을 그대로 믿지 않는다.** JSON 하나만 꺼내고, 깊이 · 가지 수 · 전체 수 · 제목 길이를 한도로 정리한다.
- **가짜 지도를 지어내지 않는다.** LLM 이 없거나 형식을 끝내 못 맞추면 ok:false 로 사유를 돌려준다.
  (planner 는 최소 골격으로 대체하지만, 여기서 골격을 내면 「자료를 읽고 정리한 것」 처럼 보인다.)
- **긴 자료를 말없이 버리지 않는다.** 조각내 요점을 뽑아 모으고, 한도를 넘어 못 읽은 부분은 stats.truncated 로 알린다.
- 호출 수는 한도 안이다: 조각(최대 MAX_CHUNKS) + 개요 1 + 재시도.
"""
from __future__ import annotations

import json
import re
from typing import Callable, Optional

LlmFn = Callable[[list], Optional[str]]

MAX_DEPTH = 4          # 뿌리 포함
MAX_CHILDREN = 7       # 한 가지의 자식
MAX_NODES = 60         # 전체
MAX_TITLE = 40         # 글자
SINGLE_MAX = 12000     # 이 길이까지는 한 번에 읽는다
CHUNK_SIZE = 8000
MAX_CHUNKS = 8         # 8 × 8,000 = 64,000자까지 읽는다
DIGEST_MAX = 12000     # 가지를 물을 때 근거로 쓰는 글
# 출력 한도(max_tokens). **「생각」 몫까지 넉넉히 준다** — 추론형 모델은 답을 쓰기 전에 보이지 않는 생각에 토큰을 쓰고,
# 한도가 모자라면 본문이 빈 채 finish_reason=length 로 끝난다(2026-10-08 실측 · gemma4:26b: 한 문장 답에 1,108토큰,
# 개요는 2,000 에서 세 번 다 빈 답 · 4,000 에서 정상). 다만 **너무 크게 잡지 않는다** — 생각이 끝없이 이어지는 때가 있어
# (8,000 을 다 쓰고 66초 만에 빈 답), 한도가 곧 실패 한 번의 값이다. 잘리면 다시 부른다(is_fatal 참고).
OUTLINE_TOKENS = 6000
ASK_TOKENS = 4000
LLM_WAIT = 150         # 초 — 한 번 부를 때 기다리는 시간(개요 하나에 19초가 걸렸다 · 긴 자료는 더 걸린다)

OUTLINE_SYS = (
    "너는 자료를 마인드맵으로 정리하는 편집자다. 아래 자료를 읽고 계층 개요를 JSON 하나로만 출력한다.\n"
    "규칙:\n"
    "- **자료에 있는 내용만** 쓴다. 자료에 없는 사실 · 수치 · 고유명사를 지어내지 않는다.\n"
    "- 뿌리(title)는 자료 전체의 주제 한 줄. 그 아래 큰 가지 3~7개, 가지마다 하위 가지 2~6개. 깊이는 뿌리 포함 4단까지.\n"
    "- 제목은 짧은 명사구(20자 안팎). 문장으로 쓰지 않는다. 같은 단에서 겹치지 않게 한다.\n"
    "- 한국어. 설명 · 말머리 · 코드펜스 없이 JSON 객체 하나만 출력한다.\n"
    '형식: {"title": "주제", "children": [{"title": "큰 가지", "children": [{"title": "하위 가지"}]}]}'
)
_RETRY_NUDGE = (
    "JSON 형식이 아니었어요. 설명 없이 반드시 "
    '{"title":"주제","children":[{"title":"큰 가지","children":[{"title":"하위 가지"}]}]} '
    "형태의 JSON 객체 하나만 출력하세요."
)
POINTS_SYS = (
    "너는 긴 자료의 한 부분을 읽고 핵심만 뽑는 편집자다. 아래 글에서 **핵심 요점을 12줄 이내**의 글머리표로 뽑는다.\n"
    "- 글에 있는 내용만. 지어내지 않는다. 수치 · 고유명사는 글에 적힌 그대로 옮긴다.\n"
    "- 한 줄에 요점 하나. 한국어. 머리말 · 맺음말 없이 글머리표만 출력한다."
)
ASK_SYS = (
    "너는 자료를 바탕으로 마인드맵의 한 가지를 설명하는 도우미다.\n"
    "- **아래 자료에 근거해서만** 답한다. 자료에 없는 내용은 지어내지 말고 「자료에 그 내용은 없습니다」 라고 말한다.\n"
    "- 3~6문장. 한국어. 필요하면 글머리표를 쓴다."
)


def is_fatal(code) -> bool:
    """다시 불러도 소용없는 오류. 403(금지어)은 명세가 **같은 글로 재시도하지 말라**고 못박는다.
    "length"(한도에서 잘려 빈 답)는 넣지 않는다 — 생각이 길어지는 것은 그때그때 달라 다시 부르면 되는 일이 많다
    (실측: 같은 글이 19초에 되기도, 한도를 다 쓰고 잘리기도 했다). 재시도 횟수는 하네스가 묶는다."""
    return code in (401, 403)


def explain_error(code, detail: str) -> str:
    """게이트웨이 오류를 사용자에게 보일 말로(API_INTERFACE_SPEC §2 오류 표)."""
    d = detail or ""
    if code is None:
        return "LLM 이 연결되어 있지 않아요. 환경설정에서 LLM 주소 · 키 · 사용자 ID · 모델을 넣어 주세요."
    if code == 401:
        return "LLM 키가 없거나 맞지 않아요. 환경설정의 API 키를 확인해 주세요."
    if code == 403:
        if "금지어" in d:
            return "자료에 사내 금지어가 들어 있어 LLM 이 거절했어요. 해당 표현을 고친 뒤 다시 만들어 주세요."
        return "LLM 키의 사용자 정보가 맞지 않아요. 환경설정의 사용자 ID 를 확인해 주세요."
    if code == "length":
        return ("LLM 의 답이 길이 한도에서 잘려 내용이 비었어요. 자료를 줄여 다시 해 보시고, "
                "계속되면 관리자에게 모델의 출력 한도를 확인해 달라고 알려 주세요.")
    if code == 413:
        return "자료가 너무 커요. 줄여서 다시 만들어 주세요."
    if code == 502:
        return "LLM 서버가 꺼져 있거나 응답하지 않아요. 잠시 뒤 다시 해 보시고, 계속되면 관리자에게 알려 주세요."
    if code == 504:
        return "LLM 응답 시간이 넘었어요. 자료를 줄이거나 잠시 뒤 다시 해 주세요."
    return "LLM 을 부르지 못했어요(%s). 잠시 뒤 다시 해 주세요." % (code or "연결 실패")


def _extract_json(text: str):
    """코드펜스 · 앞뒤 잡글을 걷어 내고 첫 JSON 객체를 읽는다(planner 와 같은 전략)."""
    t = (text or "").strip()
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z]*\s*", "", t).rstrip("`").strip()
    m = re.search(r"\{.*\}", t, re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


def split_chunks(text: str) -> list[str]:
    """줄 경계에서 CHUNK_SIZE 이하로 자른다. MAX_CHUNKS 를 넘는 뒷부분은 버린다(부르는 쪽이 truncated 로 알린다)."""
    chunks: list[str] = []
    cur = ""
    for line in (text or "").splitlines(keepends=True):
        while len(line) > CHUNK_SIZE:                     # 줄바꿈 없는 아주 긴 줄
            if cur:
                chunks.append(cur)
                cur = ""
            chunks.append(line[:CHUNK_SIZE])
            line = line[CHUNK_SIZE:]
        if len(cur) + len(line) > CHUNK_SIZE and cur:
            chunks.append(cur)
            cur = ""
        cur += line
    if cur.strip():
        chunks.append(cur)
    return chunks[:MAX_CHUNKS]


def _title_of(raw) -> str:
    if isinstance(raw, str):
        t = raw
    elif isinstance(raw, dict):
        t = raw.get("title") or raw.get("name") or raw.get("text") or raw.get("label") or ""
    else:
        return ""
    t = re.sub(r"\s+", " ", str(t)).strip()
    return t[:MAX_TITLE]


def validate_outline(raw, warnings: Optional[list[str]] = None):
    """LLM 원출력을 한도 안의 개요로 정리한다. 뿌리 제목이 없거나 가지가 하나도 없으면 None."""
    if warnings is None:
        warnings = []
    if not isinstance(raw, dict):
        return None
    title = _title_of(raw)
    if not title:
        return None
    budget = [MAX_NODES - 1]
    cut = {"depth": False, "children": False, "nodes": False}

    def kids_of(node, level: int) -> list[dict]:
        src = node.get("children") if isinstance(node, dict) else None
        if not isinstance(src, list) or not src:
            return []
        if level >= MAX_DEPTH:
            cut["depth"] = True
            return []
        out: list[dict] = []
        seen: set[str] = set()
        for c in src:
            t = _title_of(c)
            if not t or t in seen:
                continue
            if len(out) >= MAX_CHILDREN:
                cut["children"] = True
                break
            if budget[0] <= 0:
                cut["nodes"] = True
                break
            seen.add(t)
            budget[0] -= 1
            out.append({"title": t, "_raw": c})
        # 너비 먼저 자리를 준 뒤에 아래로 내려간다 — 앞 가지 하나가 예산을 다 먹지 않게.
        for item in out:
            item["children"] = kids_of(item.pop("_raw"), level + 1)
        return out

    children = kids_of(raw, 1)
    if not children:
        return None
    if cut["depth"]:
        warnings.append("깊이를 %d단으로 줄였어요." % MAX_DEPTH)
    if cut["children"]:
        warnings.append("한 가지의 하위를 %d개로 줄였어요." % MAX_CHILDREN)
    if cut["nodes"]:
        warnings.append("전체 가지를 %d개로 줄였어요." % MAX_NODES)
    return {"title": title, "children": children}


def _digest(text: str, llm_fn: LlmFn, warnings: list[str]) -> tuple[Optional[str], dict]:
    """개요를 만들 글과 통계. 짧으면 원문 그대로, 길면 조각마다 요점을 뽑아 모은다. 전부 실패면 None."""
    total = len(text)
    if total <= SINGLE_MAX:
        return text, {"chars_total": total, "chars_used": total, "chunks": 1, "truncated": False}
    chunks = split_chunks(text)
    used = sum(len(c) for c in chunks)
    points: list[str] = []
    for i, c in enumerate(chunks):
        got = llm_fn([{"role": "system", "content": POINTS_SYS},
                      {"role": "user", "content": "[자료 %d/%d]\n%s" % (i + 1, len(chunks), c)}])
        if got and got.strip():
            points.append(got.strip())
        else:
            warnings.append("자료 조각 %d/%d 를 읽지 못해 건너뛰었어요." % (i + 1, len(chunks)))
    stats = {"chars_total": total, "chars_used": used, "chunks": len(chunks), "truncated": used < total}
    if stats["truncated"]:
        warnings.append("자료가 길어 앞 %s자만 읽었어요(전체 %s자)." % (format(used, ","), format(total, ",")))
    if not points:
        return None, stats
    return "\n".join(points)[:DIGEST_MAX], stats


def make_mindmap(text: str, llm_fn: Optional[LlmFn], title_hint: str = "", retries: int = 2) -> dict:
    """자료 → 검증된 개요. 반환: {ok, outline, digest, stats, warnings, reason}.
    reason: empty | llm_unavailable | bad_format"""
    warnings: list[str] = []
    text = (text or "").strip()
    fail = {"ok": False, "outline": None, "digest": "", "stats": {}, "warnings": warnings}
    if not text:
        return {**fail, "reason": "empty"}
    if not llm_fn:
        return {**fail, "reason": "llm_unavailable"}

    digest, stats = _digest(text, llm_fn, warnings)
    if digest is None:
        return {**fail, "stats": stats, "reason": "llm_unavailable"}

    hint = ("\n(문서 제목: %s)" % title_hint.strip()) if (title_hint or "").strip() else ""
    messages = [{"role": "system", "content": OUTLINE_SYS},
                {"role": "user", "content": "[자료]%s\n%s\n\n위 자료를 마인드맵 개요 JSON 하나로만 출력." % (hint, digest)}]
    answered = False
    for _ in range(max(1, retries + 1)):
        got = llm_fn(messages)
        if got:
            answered = True
            outline = validate_outline(_extract_json(got), warnings)
            if outline:
                return {"ok": True, "outline": outline, "digest": digest[:DIGEST_MAX], "stats": stats,
                        "warnings": warnings, "reason": None}
        messages = messages + [{"role": "user", "content": _RETRY_NUDGE}]
    return {**fail, "stats": stats, "reason": "bad_format" if answered else "llm_unavailable"}


def ask_branch(digest: str, path: list, llm_fn: Optional[LlmFn]) -> dict:
    """마인드맵의 한 가지(뿌리부터의 경로)를 근거 글에 비추어 설명한다. 반환: {ok, answer, reason}."""
    names = [str(p).strip() for p in (path or []) if str(p).strip()]
    if not names:
        return {"ok": False, "answer": "", "reason": "empty"}
    if not llm_fn:
        return {"ok": False, "answer": "", "reason": "llm_unavailable"}
    user = "[자료]\n%s\n\n[가지] %s\n\n위 자료에 근거해 「%s」 를 설명해 줘." % (
        (digest or "").strip()[:DIGEST_MAX], " › ".join(names), names[-1])
    got = llm_fn([{"role": "system", "content": ASK_SYS}, {"role": "user", "content": user}])
    if not got or not got.strip():
        return {"ok": False, "answer": "", "reason": "llm_unavailable"}
    return {"ok": True, "answer": got.strip(), "reason": None}
