"""AI 마인드맵 하네스 단위검증 — mindmap.make_mindmap / ask_branch (가짜 llm_fn, 네트워크 없음).

실행: server/.venv/bin/python server/test_mindmap.py
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from server.intent import mindmap  # noqa: E402

fails = []


def check(cond, label, extra=""):
    print(("✓ " if cond else "✗ ") + label + ((" — " + str(extra)) if (extra and not cond) else ""))
    if not cond:
        fails.append(label)


class MockLLM:
    """정해 둔 답을 차례로 준다. 받은 메시지를 남겨 프롬프트를 검사한다."""

    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = 0
        self.seen = []

    def __call__(self, msgs):
        self.calls += 1
        self.seen.append(msgs)
        return self.responses.pop(0) if self.responses else None


def count(node):
    return 1 + sum(count(c) for c in node.get("children", []))


def depth(node):
    return 1 + max([depth(c) for c in node.get("children", [])] or [0])


GOOD = {"title": "스마트 공장", "children": [
    {"title": "설비", "children": [{"title": "성형기"}, {"title": "공조"}]},
    {"title": "품질", "children": [{"title": "불량률"}]},
    {"title": "인력"},
]}
TEXT = "스마트 공장은 설비와 품질과 인력으로 나뉜다. 설비에는 성형기와 공조가 있고 품질은 불량률로 본다."

# ── 1. 바른 답 ────────────────────────────────────────────
llm = MockLLM([json.dumps(GOOD, ensure_ascii=False)])
r = mindmap.make_mindmap(TEXT, llm)
check(r["ok"] and r["outline"]["title"] == "스마트 공장", "바른 JSON → 개요", r)
check(count(r["outline"]) == 7 and llm.calls == 1, "노드 일곱 · 호출 한 번", (count(r.get("outline") or {}), llm.calls))
check(r["digest"] == TEXT and r["stats"]["chunks"] == 1 and not r["stats"]["truncated"], "짧은 자료는 원문이 곧 근거 글(digest)")
sys_txt = llm.seen[0][0]["content"]
check("JSON" in sys_txt and "자료" in sys_txt, "프롬프트가 「자료에 있는 것만 · JSON 하나만」 을 시킨다")
check(TEXT in llm.seen[0][-1]["content"], "자료가 프롬프트에 들어간다")

# ── 2. 코드펜스 · 잡글이 섞인 답 ──────────────────────────────
llm = MockLLM(["네, 정리했습니다.\n```json\n" + json.dumps(GOOD, ensure_ascii=False) + "\n```\n도움이 되었길 바랍니다."])
r = mindmap.make_mindmap(TEXT, llm)
check(r["ok"] and count(r["outline"]) == 7, "코드펜스 · 앞뒤 잡글을 걷어 낸다")

# ── 3. 한도로 정리 — LLM 출력을 그대로 믿지 않는다 ───────────────────
deep = {"title": "T", "children": [{"title": "a", "children": [{"title": "b", "children": [{"title": "c", "children": [
    {"title": "d", "children": [{"title": "e"}]}]}]}]}]}
r = mindmap.make_mindmap(TEXT, MockLLM([json.dumps(deep)]))
check(r["ok"] and depth(r["outline"]) == mindmap.MAX_DEPTH, "깊이 6 → 한도(%d)까지만" % mindmap.MAX_DEPTH, depth(r.get("outline") or {}))
wide = {"title": "T", "children": [{"title": "가지%d" % i} for i in range(12)]}
r = mindmap.make_mindmap(TEXT, MockLLM([json.dumps(wide, ensure_ascii=False)]))
check(len(r["outline"]["children"]) == mindmap.MAX_CHILDREN, "자식 12 → 한도(%d)까지만" % mindmap.MAX_CHILDREN)
check(any("줄였" in w or "잘랐" in w for w in r["warnings"]), "줄였으면 경고로 알린다", r["warnings"])
big = {"title": "T", "children": [{"title": "가%d" % i, "children": [{"title": "나%d-%d" % (i, j), "children": [
    {"title": "다%d-%d-%d" % (i, j, k)} for k in range(7)]} for j in range(7)]} for i in range(7)]}
r = mindmap.make_mindmap(TEXT, MockLLM([json.dumps(big, ensure_ascii=False)]))
check(r["ok"] and count(r["outline"]) <= mindmap.MAX_NODES, "전체 노드 한도(%d)" % mindmap.MAX_NODES, count(r.get("outline") or {}))
messy = {"title": "  제목  ", "children": [{"title": ""}, {"title": "같음"}, {"title": "같음"}, {"title": "긴" * 80}, "글자만", {"name": "이름키"}, 7]}
r = mindmap.make_mindmap(TEXT, MockLLM([json.dumps(messy, ensure_ascii=False)]))
ts = [c["title"] for c in r["outline"]["children"]]
check(r["outline"]["title"] == "제목" and "" not in ts and ts.count("같음") == 1, "빈 제목 · 중복 형제를 걷는다", ts)
check(all(len(t) <= mindmap.MAX_TITLE for t in ts), "제목 길이 한도(%d)" % mindmap.MAX_TITLE)
check("글자만" in ts and "이름키" in ts, "글자만 온 가지 · name 키도 받아 준다", ts)

# ── 4. 형식이 틀린 답 — 재시도 ────────────────────────────────
llm = MockLLM(["죄송합니다 JSON 이 아닙니다", json.dumps(GOOD, ensure_ascii=False)])
r = mindmap.make_mindmap(TEXT, llm, retries=2)
check(r["ok"] and llm.calls == 2, "형식이 틀리면 다시 시킨다(두 번째에 성공)")
check(any("JSON" in m["content"] for m in llm.seen[1] if m["role"] == "user" and m is llm.seen[1][-1]), "재시도에는 형식을 다시 못박는다")
llm = MockLLM(["아님", "또 아님", "계속 아님", "끝까지"])
r = mindmap.make_mindmap(TEXT, llm, retries=2)
check(not r["ok"] and r["reason"] == "bad_format" and llm.calls == 3, "끝내 안 되면 ok:false — **가짜 지도를 지어내지 않는다**", r)
r = mindmap.make_mindmap(TEXT, MockLLM([json.dumps({"title": "뿌리만"})]), retries=0)
check(not r["ok"] and r["reason"] == "bad_format", "가지가 하나도 없는 개요는 실패로 본다")

# ── 5. LLM 이 없거나 답이 없다 ────────────────────────────────
r = mindmap.make_mindmap(TEXT, None)
check(not r["ok"] and r["reason"] == "llm_unavailable", "LLM 미설정 → ok:false")
llm = MockLLM([None, None, None])
r = mindmap.make_mindmap(TEXT, llm, retries=2)
check(not r["ok"] and r["reason"] == "llm_unavailable", "답이 한 번도 안 오면 llm_unavailable", r)
r = mindmap.make_mindmap("   ", MockLLM([json.dumps(GOOD)]))
check(not r["ok"] and r["reason"] == "empty", "빈 자료 → empty(LLM 을 부르지 않는다)")

# ── 6. 긴 자료 — 조각내 요점을 뽑고, 요점으로 개요를 만든다 ───────────────
long_text = ("가" * 999 + "\n") * 13                      # 13,000자
n_chunks = len(mindmap.split_chunks(long_text))
llm = MockLLM(["- 요점 %d" % i for i in range(n_chunks)] + [json.dumps(GOOD, ensure_ascii=False)])
r = mindmap.make_mindmap(long_text, llm)
check(n_chunks >= 2 and r["ok"] and llm.calls == n_chunks + 1, "13,000자 → 조각마다 요점 + 개요 한 번", (n_chunks, llm.calls))
check(r["stats"]["chunks"] == n_chunks and "요점 0" in r["digest"] and len(r["digest"]) <= mindmap.DIGEST_MAX, "근거 글(digest) = 모은 요점")
check("요점 0" in llm.seen[-1][-1]["content"], "개요는 **요점**에서 만든다")
huge = ("나" * 999 + "\n") * 70                           # 70,000자
n2 = len(mindmap.split_chunks(huge))
llm = MockLLM(["- 요점"] * n2 + [json.dumps(GOOD, ensure_ascii=False)])
r = mindmap.make_mindmap(huge, llm)
check(n2 == mindmap.MAX_CHUNKS and r["ok"] and r["stats"]["truncated"], "70,000자 → 조각 한도(%d) · truncated 로 알린다" % mindmap.MAX_CHUNKS, (n2, r.get("stats")))
check(r["stats"]["chars_used"] <= mindmap.MAX_CHUNKS * mindmap.CHUNK_SIZE and r["stats"]["chars_total"] == len(huge.strip()), "읽은 글자 수 · 전체 글자 수를 돌려준다")
check(llm.calls <= mindmap.MAX_CHUNKS + 3, "호출 한도 안", llm.calls)
# 조각 하나가 실패해도 나머지로 만든다(전부 실패면 실패)
llm = MockLLM([None] + ["- 요점"] * (n_chunks - 1) + [json.dumps(GOOD, ensure_ascii=False)])
r = mindmap.make_mindmap(long_text, llm)
check(r["ok"] and any("조각" in w for w in r["warnings"]), "조각 하나가 실패하면 경고하고 나머지로 만든다", r.get("warnings"))
r = mindmap.make_mindmap(long_text, MockLLM([None] * 20))
check(not r["ok"] and r["reason"] == "llm_unavailable", "조각이 전부 실패하면 실패")

# ── 7. 가지를 묻는다 ───────────────────────────────────────
llm = MockLLM(["성형기는 설비의 하나입니다."])
a = mindmap.ask_branch("근거 글 본문", ["스마트 공장", "설비", "성형기"], llm)
check(a["ok"] and a["answer"] == "성형기는 설비의 하나입니다.", "가지 설명을 돌려준다")
u = llm.seen[0][-1]["content"]
check("근거 글 본문" in u and "스마트 공장" in u and "성형기" in u, "근거 글과 경로가 프롬프트에 들어간다")
check("없" in llm.seen[0][0]["content"], "자료에 없으면 없다고 답하게 시킨다")
check(not mindmap.ask_branch("근거", ["가"], None)["ok"], "LLM 미설정 → ok:false")
check(not mindmap.ask_branch("근거", [], MockLLM(["답"]))["ok"], "경로가 비면 묻지 않는다")
check(not mindmap.ask_branch("근거", ["가"], MockLLM([None]))["ok"], "답이 없으면 ok:false")

# ── 8. 게이트웨이 오류를 사람 말로 (API_INTERFACE_SPEC §2 오류 표) ─────────────
check("환경설정" in mindmap.explain_error(None, ""), "미설정 → 환경설정 안내")
check("키" in mindmap.explain_error(401, ""), "401 → 키")
check("금지어" in mindmap.explain_error(403, '{"detail":"금지어가 포함되어 있습니다"}') and "다시" in mindmap.explain_error(403, "금지어"), "403 금지어 → 글을 고쳐 다시")
check("사용자" in mindmap.explain_error(403, "API 키의 사용자 정보가 일치하지 않습니다"), "403 사용자 불일치 → 사용자 ID")
check("꺼져" in mindmap.explain_error(502, "") or "응답하지" in mindmap.explain_error(502, ""), "502 → LLM 이 꺼짐")
check("시간" in mindmap.explain_error(504, ""), "504 → 시간 초과")
check(mindmap.is_fatal(401) and mindmap.is_fatal(403) and not mindmap.is_fatal(504) and not mindmap.is_fatal(502), "401 · 403 은 **같은 글로 다시 부르지 않는다**")
# 2026-10-08 실측(gemma4:26b): 답을 쓰기 전 「생각」 에 토큰을 써서, 한도가 모자라면 본문이 빈 채 finish_reason=length 로 끝난다.
# 한도 2,000 에서 세 번 다 빈 답(58초) · 4,000 에서 19초 만에 정상. 「연결 안 됨」 이 아니라 **한도에서 잘렸다**고 말해야 한다.
check("잘" in mindmap.explain_error("length", "") and "연결되어 있지" not in mindmap.explain_error("length", ""), "한도에서 잘려 빈 답 → 그대로 말한다(「연결 안 됨」 이 아니다)", mindmap.explain_error("length", ""))
# 같은 글이 19초에 되기도, 한도 8,000 을 다 쓰고 66초 만에 잘리기도 했다(실측) — 생각이 길어지는 것은 그때그때 다르다.
# 그래서 **포기하지 않고 다시 불러 본다**(하네스의 재시도 한도 안에서). 생각을 끄는 옵션은 게이트웨이를 거치면 안 통했다.
check(not mindmap.is_fatal("length"), "한도에서 잘린 답은 **다시 불러 본다**(그때그때 다르다)")
cut = MockLLM([None, json.dumps(GOOD, ensure_ascii=False)])
r = mindmap.make_mindmap(TEXT, cut, retries=2)
check(r["ok"] and cut.calls == 2, "한 번 잘려도(None) 다음 답으로 만든다")
check(mindmap.OUTLINE_TOKENS >= 6000 and mindmap.ASK_TOKENS >= 3000, "출력 한도는 「생각」 몫까지 넉넉히", (mindmap.OUTLINE_TOKENS, mindmap.ASK_TOKENS))

print("\n%d failed" % len(fails))
sys.exit(1 if fails else 0)
