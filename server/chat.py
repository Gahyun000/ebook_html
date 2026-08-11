"""ebook_html 채팅 코어 (P2) — Agentic-PM chat_engine의 '재사용 코어'만 이식하고
PM 도메인 계층(recipes·navigation·ui_actions)은 중립화한 대화형 엔진.

- 설정된 LLM이 있으면 실제 호출(OpenAI 호환 / Anthropic), 없으면 친절한 폴백 응답.
- ChatAnswer 계약(answer/answer_kind/status/session_id/suggested_questions/...)은 원본과 동일.
- 세션 히스토리는 로컬 단일 사용자용으로 메모리에 보관(재시작 시 초기화).
- ebook 액션(ui_action)으로 화면을 대신 조작하는 건 P5(브리지)에서 켠다.
"""
from __future__ import annotations

import json
import urllib.request
import urllib.error
from typing import Iterator, Optional

from server.settings_store import load_llm_settings, llm_endpoint
from server.intent import orchestrator

# 세션별 대화 히스토리(메모리). 로컬 단일 사용자 전제.
_SESSIONS: dict[str, list[dict]] = {}
_SEQ = {"n": 0}

# 세션별 문서(이북) 스냅샷 — G1 문서 컨텍스트 계약.
# 프론트가 매 턴 보낸 현재 이북 상태를 보관만 한다. LLM 프롬프트 주입은 G3에서 켠다.
_DOC: dict[str, dict] = {}


def get_doc(session_id: str) -> Optional[dict]:
    """세션에 보관된 최신 이북 스냅샷(없으면 None). G3/G5 생성·수정 레인이 소비한다."""
    return _DOC.get(session_id)


def _remember_doc(sid: str, book_state: Optional[dict]) -> None:
    """프론트가 보낸 현재 이북 스냅샷을 세션에 보관하고, 매 턴 페이지 목록을 로그한다."""
    if not book_state:
        return
    _DOC[sid] = book_state
    pages = book_state.get("pages") or []
    titles = ", ".join(
        f"{i + 1}.{(p.get('title') or p.get('cardKey') or '?')}" for i, p in enumerate(pages)
    )
    print(
        f"[book_state] sid={sid} pages={len(pages)} "
        f"theme={book_state.get('theme')} orient={book_state.get('orientation')} :: {titles}",
        flush=True,
    )

SYSTEM_PROMPT = (
    "당신은 'ebook_html' 틀 빌더의 친절한 도우미입니다. 사용자는 디지털에 익숙하지 않을 수 있는 "
    "경영진입니다. 카드로 사업모델 이북을 만들고, 자유 캔버스로 도형·화살표를 그리고, 발표 모드로 "
    "넘겨보고, '이북 만들기'로 실제 이북을 생성합니다. 항상 쉽고 짧게, 한국어로 답하세요. "
    "슬라이드 추가·도형/표/글맵시 삽입·배경 전환·발표·이북 만들기 같은 명령은 제가 화면을 직접 조작해 실행합니다."
)

DEFAULT_SUGGESTIONS = orchestrator.SUGGESTIONS

# ── P5: 챗 액션 브리지 (스캐폴드) ─────────────────────────────────────────
# 안전한 몇 가지 인텐트만 ui_action으로 변환한다(플래그로 on/off). 나머지는 대화.
ACTIONS_ENABLED = True

# (키워드, cardKey, 라벨) — 더 구체적인 것을 앞에 둔다. (BMC 9블록 제외)
CARD_KEYWORDS: list[tuple[str, str, str]] = [
    ("빈 페이지", "note", "빈 페이지"), ("토글", "note", "빈 페이지"), ("블록", "note", "빈 페이지"),
    ("표지", "cover", "표지"), ("목차", "toc", "목차"), ("마무리", "closing", "마무리"),
    ("요약", "summary", "한 줄 요약"),
    ("성과", "kpi", "성과·KPI"), ("kpi", "kpi", "성과·KPI"), ("지표", "kpi", "성과·KPI"),
    ("로드맵", "roadmap", "로드맵"), ("시장", "market", "시장·경쟁"), ("경쟁", "market", "시장·경쟁"),
    ("프로세스", "flow", "프로세스"), ("플로우", "flow", "프로세스"), ("마인드맵", "mindmap", "마인드맵"),
    ("스티키", "sticky", "스티키 메모"), ("메모 보드", "board", "자유 메모 보드"),
]
_ADD_VERBS = ("추가", "넣어", "넣기", "만들", "생성")
_PENDING: dict[str, dict] = {}


def detect_action(msg: str):
    """(type, payload, say) 또는 None. 카드추가 > 방향전환 > 이북만들기 순."""
    s = (msg or "").strip()
    low = s.lower()
    has_add = any(v in s for v in _ADD_VERBS)
    # 1) 특정 카드 추가
    for kw, ck, label in CARD_KEYWORDS:
        if kw.lower() in low and (has_add or "카드" in s):
            return ("add_card", {"cardKey": ck, "label": label}, f"‘{label}’ 카드를 추가했어요. 오른쪽에서 내용을 채워보세요.")
    # 2) 방향 전환
    if "가로" in s and any(v in s for v in ("바꿔", "전환", "변경", "로", "으로", "해")):
        return ("set_orientation", {"orientation": "landscape"}, "가로 덱으로 바꿨어요.")
    if "세로" in s and any(v in s for v in ("바꿔", "전환", "변경", "로", "으로", "해")):
        return ("set_orientation", {"orientation": "portrait"}, "세로 이북으로 바꿨어요.")
    # 3) 일반 '카드 추가' (특정 없음) → 표지
    if "카드" in s and has_add:
        return ("add_card", {"cardKey": "cover", "label": "표지"}, "‘표지’ 카드를 추가했어요. 다른 카드도 이름만 말씀해 주세요.")
    # 4) 이북 만들기 (확인 필요)
    if "이북" in s and any(v in s for v in ("만들", "생성", "출간", "제작", "뽑")):
        return ("make_ebook", {}, "지금 페이지로 이북을 만들까요? 아래 ‘확인’을 누르면 진행할게요.")
    return None


def _pack(sid: str, answer: str, answer_kind: str = "chat", status=None, pending_action_id=None, ui_action=None) -> dict:
    return {
        "answer": answer, "answer_kind": answer_kind, "status": status, "session_id": sid,
        "suggested_questions": DEFAULT_SUGGESTIONS, "pending_action_id": pending_action_id, "ui_action": ui_action,
    }


def _reply(sid: str, answer: str, **kw) -> dict:
    _SESSIONS.setdefault(sid, []).append({"role": "assistant", "content": answer})
    return _pack(sid, answer, **kw)


def _new_session_id() -> str:
    _SEQ["n"] += 1
    return f"s{_SEQ['n']}"


def ensure_session(session_id: Optional[str]) -> str:
    if session_id and session_id in _SESSIONS:
        return session_id
    sid = session_id or _new_session_id()
    _SESSIONS.setdefault(sid, [])
    return sid


def _fallback_reply(message: str) -> str:
    m = (message or "").strip().lower()
    def has(*ks): return any(k in m for k in ks)
    if not m:
        return "무엇을 도와드릴까요? 이북 만드는 법을 안내해 드릴 수 있어요."
    if has("안녕", "하이", "hi", "hello", "ㅎㅇ", "반가"):
        return ("안녕하세요! **ebook_html 도우미**예요. 😊\n\n"
                "왼쪽에서 카드를 고르고 오른쪽에서 내용을 채운 뒤, 오른쪽 위 **이북 만들기**를 누르면 "
                "사업모델 이북 한 권이 만들어져요. 무엇부터 해볼까요?")
    if has("이북", "만들", "생성", "출간"):
        return ("이북은 이렇게 만들어요:\n\n"
                "1. 왼쪽 **카드 고르기**에서 표지·성과·로드맵·빈 페이지 같은 카드를 클릭해 추가\n"
                "2. 오른쪽 **내용 채우기**에서 예시 문구를 고쳐 쓰기\n"
                "3. 오른쪽 위 **이북 만들기 →** 클릭\n\n"
                "못 채운 칸이 있어도 이북은 만들어지니 편하게 시작하세요.")
    if has("카드"):
        return ("**카드**는 이북의 한 장(페이지) 틀이에요. 표지·목차·마무리·성과(KPI)·로드맵·시장/경쟁·"
                "한 줄 요약·빈 페이지(블록·토글)와 프로세스·마인드맵 같은 다이어그램 카드가 준비돼 있어요. 왼쪽에서 클릭하면 추가됩니다.")
    if has("발표", "프레젠", "슬라이드"):
        return ("상단 **▷ 발표** 를 누르면 전체화면 슬라이드로 넘겨볼 수 있어요. "
                "→/Space 다음, ← 이전, Esc 로 종료합니다.")
    if has("캔버스", "화살표", "도형", "연결", "펜"):
        return ("아래 **자유 캔버스** 도구에서 도형을 클릭해 추가하고, **⤳ 연결**로 도형 두 개를 차례로 "
                "클릭하면 화살표가 생겨요. 선을 잡아 끌면 원하는 곳에서 꺾입니다. **✎ 펜**으로 자유선도 그릴 수 있어요.")
    if has("단축키", "키보드"):
        return ("되돌리기 ⌘/Ctrl+Z, 복제 ⌘/Ctrl+D, 삭제 Delete, 이북 만들기 ⌘/Ctrl+S 예요. "
                "상단 **도움말**에 전체 단축키 표가 있어요.")
    if has("환경설정", "llm", "설정", "api"):
        return ("상단 **⚙ 환경설정**에서 LLM(provider·주소·API Key·모델)을 등록하면, 제가 더 똑똑하게 "
                "답할 수 있어요. 지금은 기본 안내만 드리고 있어요.")
    return ("아직 LLM이 연결되지 않아 기본 안내만 드릴 수 있어요. 상단 **⚙ 환경설정**에서 LLM을 등록하면 "
            "자유롭게 대화할 수 있습니다. 그동안에도 '이북 만드는 법', '카드', '발표', '자유 캔버스'는 안내해 드려요.")


def _call_llm(messages: list[dict], s: dict) -> Optional[str]:
    """설정된 LLM을 1회 호출해 답변 텍스트를 반환. 실패 시 None."""
    provider = (s.get("provider") or "self").lower()
    url = llm_endpoint(provider, s.get("base_url") or "")
    api_key = s.get("api_key") or ""
    model = s.get("model") or ""
    user_id = s.get("user_id") or ""
    timeout = min(float(s.get("timeout") or 45), 60.0)
    headers = {"Content-Type": "application/json"}
    if provider == "anthropic":
        headers["x-api-key"] = api_key
        headers["anthropic-version"] = "2023-06-01"
        sys_txt = SYSTEM_PROMPT
        conv = [m for m in messages if m["role"] != "system"]
        body = {"model": model, "max_tokens": 800, "system": sys_txt, "messages": conv}
    else:
        headers["Authorization"] = f"Bearer {api_key}"
        if user_id:
            headers["X-User-Id"] = user_id
        body = {"model": model, "max_tokens": 800, "messages": messages}
    req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            j = json.loads(resp.read().decode("utf-8", "replace"))
            if provider == "anthropic":
                return (j.get("content", [{}])[0] or {}).get("text", "") or None
            return (((j.get("choices") or [{}])[0]).get("message") or {}).get("content", "") or None
    except Exception:
        return None


def respond(message: str, session_id: Optional[str], confirm: Optional[bool] = None,
            confirm_action_id: Optional[str] = None, book_state: Optional[dict] = None) -> dict:
    """한 번의 대화 응답. ChatAnswer 계약과 동일한 dict 반환.

    book_state: 프론트가 보낸 현재 이북 스냅샷(G1). 세션에 보관만 하고 이번 턴 응답 로직에는 아직 쓰지 않는다.
    """
    sid = ensure_session(session_id)
    _remember_doc(sid, book_state)  # G1: 매 턴 현재 이북 상태 보관·로그
    hist = _SESSIONS[sid]

    # 확인/취소 (대기 중 액션)
    if confirm is not None:
        pend = _PENDING.get(sid)
        if confirm and pend and confirm_action_id in (None, pend.get("id")):
            _PENDING.pop(sid, None)
            ui = pend.get("ui") or {"type": pend.get("type"), "auto_apply": True}
            msg = "이북을 만들게요! 오른쪽 위 진행 상태를 확인해 주세요. 📖" if ui.get("type") == "make_ebook" else "네, 진행할게요."
            return _reply(sid, msg, ui_action=ui)
        _PENDING.pop(sid, None)
        return _reply(sid, "네, 취소했어요. 다른 걸 도와드릴까요?")

    hist.append({"role": "user", "content": message})

    s = load_llm_settings()
    # 모호할 때만 쓰는 동기 LLM 분류기(미설정이면 None → 규칙만, mock 폴백)
    llm_fn = (lambda msgs: _call_llm(msgs, s)) if s.get("configured") else None

    # 의도 엔진(HELIX 재조준 이식) → ui_action / 되묻기
    if ACTIONS_ENABLED:
        res = orchestrator.route(message, llm_fn=llm_fn)
        ui = res.action.as_ui_action()
        if ui is not None:
            if res.needs_confirm:
                pid = f"pa{len(hist)}_{sid}"
                _PENDING[sid] = {"id": pid, "type": ui["type"], "ui": ui}
                return _reply(sid, res.reply, status="confirm_required", pending_action_id=pid)
            return _reply(sid, res.reply, ui_action=ui)
        if res.clarify and res.reply:
            return _reply(sid, res.reply)  # 되묻기(확신 낮음/필수 슬롯 없음)
        # 액션 없음(help/smalltalk/fallback) → 대화형으로 진행

    # 대화형 (LLM 또는 폴백)
    answer = None
    if s.get("configured"):
        msgs = [{"role": "system", "content": SYSTEM_PROMPT}] + hist[-12:]
        answer = _call_llm(msgs, s)
    if not answer:
        answer = _fallback_reply(message)
    hist.append({"role": "assistant", "content": answer})
    return _pack(sid, answer)


def _chunks(text: str, size: int = 3) -> Iterator[str]:
    for i in range(0, len(text), size):
        yield text[i:i + size]


def sse_stream(message: str, session_id: Optional[str], confirm: Optional[bool] = None,
               confirm_action_id: Optional[str] = None, book_state: Optional[dict] = None) -> Iterator[bytes]:
    """meta → token* → done. (LLM은 한 번에 받아 조각내어 타이핑 효과로 전송)"""
    ans = respond(message, session_id, confirm, confirm_action_id, book_state)
    meta = {k: v for k, v in ans.items() if k != "answer"}
    yield f"event: meta\ndata: {json.dumps(meta, ensure_ascii=False)}\n\n".encode("utf-8")
    for ch in _chunks(ans["answer"]):
        yield f"event: token\ndata: {json.dumps({'t': ch}, ensure_ascii=False)}\n\n".encode("utf-8")
    yield b"event: done\ndata: {}\n\n"
