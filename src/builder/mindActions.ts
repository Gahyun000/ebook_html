// 가지 키가 **하는 일**(2026-10-07 · 3차로 다시 씀). 「어느 키인가」 는 mindKeys.ts, 여기는 그 다음이다.
//
// 붙이는 길이 넷이라 한 곳에 둔다 — 상자를 고른 채 누를 때(Hotkeys) · 방금 붙인 상자의 글칸에서 아무것도 안 친 채 이어 누를 때(FreeLayer) ·
// ＋점을 누르기만 할 때(FreeLayer.onNodeDown) · 오른쪽 패널 단추(RightPanel). 따로 있으면 한쪽만 되돌리기를 빠뜨린다.
//
// **알마인드식**(사용자 3차 「엔터는 형제가 만들어지게, 스페이스는 자식이 만들어지게 재셋팅」): Space = 고른 상자의 자식(오른쪽) ·
// Enter = 고른 상자의 **형제**(같은 부모 · 바로 아래) · Shift+Enter = 앞 형제. 붙인 상자는 고른 채로 남아 — 글을 치고 Enter 로 끝낸 뒤
// 또 Enter 면 그 상자의 형제, Space 면 그 상자의 자식이다(2차에 잠깐 두었던 「허브로 돌아오기」 는 뺐다).
// 자리 규칙(재정렬 없음 · 같은 부모의 자식 열은 일곱까지 부모 가운데에)은 canvas/placeNext + store.treeAdd 가 한다.
import { useBuilder } from '../state/store'
import { useCanvasUI } from '../state/canvasUI'
import { pushSnap } from '../canvas/model'
import type { Side } from '../canvas/placeNext'

/** 자식(오른쪽 · 아래 · 위 · 왼쪽 — ＋점의 변) · 형제 · 앞 형제. */
export type NextKind = Side | 'sibling' | 'before'

/**
 * 고른 상자 `id` 에 `kind` 로 상자를 붙이고, **붙인 상자를 고른 채 글 편집을 연다.** 붙인 상자의 id 를 돌려준다.
 * 되돌리기 한 걸음을 남기고, 접힌 상자에 자식을 붙일 때는 먼저 편다(안 그러면 붙이자마자 안 보인다).
 */
export function addNext(pageId: number, id: number, kind: NextKind): number | null {
  const bs = useBuilder.getState(), ui = useCanvasUI.getState()
  const page = bs.pages.find((p) => p.id === pageId)
  if (!page || !page.els.some((x) => x.id === id)) return null
  pushSnap(page.id, JSON.stringify({ els: page.els, conns: page.conns, strokes: page.strokes }))
  if (kind !== 'sibling' && kind !== 'before' && page.els.some((x) => x.id === id && x.folded)) bs.treeFold(page.id, id)
  const had = new Set(page.els.map((x) => x.id))
  bs.treeAdd(page.id, id, kind)
  const now = useBuilder.getState().pages.find((p) => p.id === pageId)
  const made = now ? now.els.find((x) => !had.has(x.id) && x.echoOf == null) : undefined
  if (!made) return null
  ui.setSel(made.id); ui.requestEdit(made.id); ui.setReveal(made.id)
  return made.id
}
