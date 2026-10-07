// 알마인드식 가지 키가 **하는 일**(2026-10-07). 「어느 키인가」 는 mindKeys.ts, 여기는 그 다음이다.
//
// 붙이는 길이 둘이라 한 곳에 둔다 — 상자를 고른 채 누를 때(Hotkeys)와, 방금 붙인 상자의 글칸에서
// 아무것도 안 친 채 이어 누를 때(FreeLayer). 둘이 따로 있으면 한쪽만 되돌리기를 빠뜨리거나 편집을 안 연다.
import { useBuilder } from '../state/store'
import { useCanvasUI } from '../state/canvasUI'
import { pushSnap } from '../canvas/model'

/**
 * 상자 `id` 에 가지를 붙이고, **붙인 상자를 고른 채 글 편집을 연다.** 붙인 상자의 id 를 돌려준다.
 * 되돌리기 한 걸음을 남기고, 접힌 상자에 자식을 붙일 때는 먼저 편다(안 그러면 붙이자마자 안 보인다).
 */
export function addTopic(pageId: number, id: number, kind: 'child' | 'sibling' | 'before'): number | null {
  const bs = useBuilder.getState(), ui = useCanvasUI.getState()
  const page = bs.pages.find((p) => p.id === pageId)
  if (!page) return null
  pushSnap(page.id, JSON.stringify({ els: page.els, conns: page.conns, strokes: page.strokes }))
  if (kind === 'child' && page.els.some((x) => x.id === id && x.folded)) bs.treeFold(page.id, id)
  const had = new Set(page.els.map((x) => x.id))
  bs.treeAdd(page.id, id, kind)
  const now = useBuilder.getState().pages.find((p) => p.id === pageId)
  const made = now ? now.els.find((x) => !had.has(x.id) && x.echoOf == null) : undefined
  if (!made) return null
  ui.setSel(made.id); ui.requestEdit(made.id); ui.setReveal(made.id)
  return made.id
}
