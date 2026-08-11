"""G4 생성 레인 검증 — chat.respond 가 브리프를 감지해 apply_book_plan 액션을 내는가.
planner.make_plan 을 목(mock)으로 대체하고 LLM 미설정으로 네트워크를 차단한다."""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from server import chat  # noqa: E402
import server.intent.planner as planner_mod  # noqa: E402

chat.load_llm_settings = lambda: {"configured": False}

CANNED = {
    "title": "유니에버 AI팩토리 소개", "orientation": "portrait", "theme": "dark",
    "pages": [
        {"cardKey": "cover", "fields": {"title": "유니에버 AI팩토리"}},
        {"cardKey": "toc", "fields": {}},
        {"cardKey": "kpi", "fields": {"title": "기대 성과", "k1": "불량률:-30%"}},
        {"cardKey": "closing", "fields": {}},
    ],
}
_warns = {"v": []}
planner_mod.make_plan = lambda brief, llm_fn, book_state=None, retries=2: {
    "ok": True, "plan": CANNED, "warnings": _warns["v"], "source": "llm"}

fails = []


def check(cond, label):
    print(("✓ " if cond else "✗ ") + label)
    if not cond:
        fails.append(label)


# ── 트리거 감지 ──
d = chat._detect_create_brief
check(d("유니에버 AI팩토리 소개 이북 만들어줘", {"pages": []}) is not None, "빈 이북 + '이북 만들어' → 생성")
check(d("이북 만들어줘", {"pages": [1, 2, 3]}) is None, "내용 있는 이북 + '이북 만들어' → 생성 아님(PDF 빌드로)")
check(d("초안 짜줘", {"pages": [1, 2, 3]}) is not None, "'초안' 명시 → 내용 있어도 생성")
check(d("품질 AI 이북 기획해줘", {"pages": []}) is not None, "'기획해' → 생성")
check(d("안녕", {"pages": []}) is None, "인사 → 생성 아님")
check(d("도형 넣어줘", {"pages": []}) is None, "편집 명령 → 생성 아님")

# ── respond 생성 경로 → apply_book_plan ──
_warns["v"] = []
r = chat.respond("유니에버 AI팩토리 소개 이북 만들어줘", None, book_state={"pages": []})
ui = r.get("ui_action")
check(bool(ui) and ui["type"] == "apply_book_plan", "생성 요청 → ui_action apply_book_plan")
check(ui["payload"]["plan"] == CANNED, "payload 에 plan 동봉")
check("초안" in r["answer"] and "4장" in r["answer"], f"답변에 '초안'·장수 안내: {r['answer'][:40]}")

# ── 경고가 있으면 답변에 노출 ──
_warns["v"] = ["[kpi] 수치 '불량률:-30%' 는 브리프에 없는 값 — 예시일 수 있으니 확인 필요"]
r2 = chat.respond("품질 AI 소개 이북 만들어줘", None, book_state={"pages": []})
check("⚠" in r2["answer"], "경고 있으면 답변에 ⚠ 노출")

# ── 충돌 회피: 내용 있는 이북의 '이북 만들어' → make_ebook(확인), apply_book_plan 아님 ──
r3 = chat.respond("이북 만들어줘", None, book_state={"pages": [{"cardKey": "cover"}, {"cardKey": "kpi"}]})
check((r3.get("ui_action") or {}).get("type") != "apply_book_plan", "내용 있는 이북 '이북 만들어' → apply_book_plan 아님")
check(r3.get("status") == "confirm_required", "→ make_ebook 확인 요청으로 라우팅")

# ── 편집 명령은 그대로 ──
r4 = chat.respond("도형 넣어줘", None, book_state={"pages": []})
check((r4.get("ui_action") or {}).get("type") == "insert_element", "편집 명령 '도형' → insert_element(생성 레인 안 탐)")

if fails:
    print(f"\n{len(fails)} FAIL: {fails}")
    sys.exit(1)
print("\nALL PASS")
