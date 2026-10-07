// 한글처럼 **조합해서 치는 글자**가 아직 확정되지 않았을 때의 키인가(2026-10-04).
//
// ── 왜 따로 두나 ─────────────────────────────────
// 맥 크롬은 한글을 조합하는 중에 Enter 를 누르면 keydown 을 **두 번** 보낸다.
//   ① 조합 중 — `isComposing = true`, keyCode 229
//   ② 입력기가 글자를 확정한 뒤 — `isComposing = false`, keyCode 13
// ① 을 Enter 로 받아 줄을 나누거나 초점을 옮기면, 입력기가 확정한 글자가 **옮겨 간 자리에 한 번 더**
// 들어가고, ② 가 또 Enter 로 처리된다. 2026-10-02 화면 기록에서 메모장이 「ㅌ + Enter」 한 번에 줄을
// 둘 만들고 같은 글자를 두 번 찍은 것이 이것이다. 같은 모양이 블록 편집기 · 챗봇 입력창(마지막 글자를
// 한 번 더 보냄) · 표 칸 · 카드 글자 칸에도 있었다. 고치는 법은 하나다 — **① 은 입력기 몫으로 둔다.**
//
// ── keyCode 229 는 보지 않는다 ──────────────────────
// 사파리는 조합을 **먼저** 끝내고(compositionend) 그 뒤에 keydown(229)을 하나만 보낸다. 그 키는 진짜
// Enter 다 — 229 까지 막으면 사파리에서는 Enter 를 두 번 눌러야 줄이 바뀐다.

/** React 이벤트(`e.nativeEvent.isComposing`)도, 창에 직접 단 DOM 이벤트(`e.isComposing`)도 받는다. */
export function isComposingKey(e: { isComposing?: boolean; nativeEvent?: { isComposing?: boolean } }): boolean {
  return !!(e.nativeEvent ? e.nativeEvent.isComposing : e.isComposing)
}
