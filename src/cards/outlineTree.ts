// **개요(JSON) → 트리 요소**(2026-10-08 · AI 마인드맵). 서버 하네스(server/intent/mindmap.py)가 LLM 답을 검증해 준
// `{ title, children }` 을 상자와 선으로 펼친다(outline_tree.test.mjs).
//
// 지금 규칙은 「가지를 붙이거나 접어도 자리를 다시 앉히지 않는다」(2026-10-07) 이다. 그래서 **처음 펼칠 때 접힌 하위까지
// 모두 겹치지 않는 자리**를 잡아 둔다 — 펴는 순간 겹치면 안 된다. 자리 규칙은 손으로 붙일 때와 같다(canvas/placeNext):
// 자식은 부모 오른쪽 `GAP_SIDE` 옆 열에, 형제 사이는 `GAP_STACK`, 부모는 자식들의 가운데 높이에.
//
// 노트북LM 처럼 **큰 가지까지만 보이고 그 아래는 접힌 채** 시작한다(접기 손잡이 · Shift+Alt+＋ 로 편다).
import type { FreeEl, Conn } from '../state/store'
import { newNode, TREE_CONN } from './treeOps'
import { PAD_X } from './treeEls'
import { GAP_SIDE, GAP_STACK } from '../canvas/placeNext'

export interface Outline { title: string; children?: Outline[] }

/** 가지 상자. 제목이 한 줄(약 11자)을 넘으면 두 줄이 들어가게 높인다. */
const NODE_W = 160, ONE_LINE = 38, TWO_LINES = 54, LINE_CHARS = 11
const TOP = 24

export function outlineParts(outline: Outline, id: () => number): { els: FreeEl[]; conns: Conn[]; rootId: number } {
  const els: FreeEl[] = []
  const conns: Conn[] = []
  interface N { el: FreeEl; kids: N[]; ext: number }
  const build = (o: Outline, depth: number, hidden: boolean): N => {
    const text = (o.title || '').trim()
    const el: FreeEl = { ...newNode(id(), text), w: NODE_W, h: text.length > LINE_CHARS ? TWO_LINES : ONE_LINE, x: PAD_X + depth * (NODE_W + GAP_SIDE) }
    const src = (o.children || []).filter((c) => c && (c.title || '').trim())
    if (depth === 0) el.bold = true
    if (depth === 1 && src.length) el.folded = true
    if (hidden) el.hidden = true
    els.push(el)
    const kids = src.map((c) => build(c, depth + 1, hidden || depth >= 1))
    for (const k of kids) conns.push({ from: el.id, to: k.el.id, ...TREE_CONN, axis: 'h' })
    const ext = Math.max(el.h, kids.reduce((s, k) => s + k.ext, 0) + GAP_STACK * Math.max(0, kids.length - 1))
    return { el, kids, ext }
  }
  const place = (n: N, top: number) => {
    n.el.y = Math.round(top + (n.ext - n.el.h) / 2)
    // 자식 묶음이 제 범위보다 작으면(자식 하나가 부모보다 낮을 때) 가운데로 내린다.
    const need = n.kids.reduce((s, k) => s + k.ext, 0) + GAP_STACK * Math.max(0, n.kids.length - 1)
    let y = top + (n.ext - need) / 2
    for (const k of n.kids) { place(k, y); y += k.ext + GAP_STACK }
  }
  const root = build(outline, 0, false)
  place(root, TOP)
  return { els, conns, rootId: root.el.id }
}
