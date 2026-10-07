// **그린 도식을 머메이드 글로 뽑는다**(2026-10-07 · 사용자 2차 요청 4번).
//
// 사용자: 「머메이드라고 한것과 도형으로 그리는건 별개가 아님. 둘다 왔다 갔다 가능해야 … 어떤 도식화를 하면 그것의 머메이드 소스를 볼 수 있도록」.
// 머메이드로 펼쳤든 키 · ＋점 · 「→ 연결」 로 그렸든 **지금 그림(요소와 선)이 진실**이다 — 쪽에 적어 둔 옛 원문(treeSrc)이 아니라 그림에서 뽑는다.
// 글로 만드는 일은 mermaid.toMermaid 가 한다(글 → 그림 → 글이 같아야 한다 — 파서와 짝). 상자 번호는 n1 · n2 … 순서대로.

import type { Page, FreeEl } from '../state/store'
import type { MmGraph, MmNode, NodeShape } from './mermaid'
import { toMermaid } from './mermaid'
import { NO_CPT } from '../canvas/model'

/** 머메이드 라벨 안에서 뜻이 있는 글자는 전각으로 — `A[기획 (초안)]` 이 깨지지 않게. 글 → 그림으로 돌아올 때도 그대로 읽힌다. */
const SAFE: Record<string, string> = { '[': '［', ']': '］', '(': '（', ')': '）', '{': '｛', '}': '｝', '|': '｜' }
const label = (e: FreeEl) => (e.text || '').replace(/\s+/g, ' ').trim().replace(/[\[\](){}|]/g, (c) => SAFE[c])
const shapeOf = (e: FreeEl): NodeShape => (e.type === 'diamond' ? 'dec' : e.type === 'round' || e.type === 'ellipse' ? 'round' : 'box')

/** 쪽의 도식(선을 달 수 있는 갈래 전부 + 그 사이 선)을 머메이드 그래프로. 아래 띠의 흐린 상자(echo)는 원본으로 되돌려 읽는다. */
export function graphOfPage(page: Pick<Page, 'els' | 'conns' | 'treeDir'>): MmGraph {
  const org = new Map<number, number>()
  for (const e of page.els) if (e && e.echoOf != null) org.set(e.id, e.echoOf)
  const members = page.els.filter((e) => e && e.echoOf == null && !NO_CPT.includes(e.type) && e.type !== 'image')
  const idOf = new Map<number, string>()
  const nodes: Record<string, MmNode> = {}
  const order: string[] = []
  members.forEach((e, i) => {
    const id = 'n' + (i + 1)
    idOf.set(e.id, id); order.push(id)
    nodes[id] = { id, label: label(e), shape: shapeOf(e) }
  })
  const edges: MmGraph['edges'] = []
  const seen = new Set<string>()
  for (const c of page.conns) {
    if (!c) continue
    const a = idOf.get(org.get(c.from) ?? c.from), b = idOf.get(org.get(c.to) ?? c.to)
    if (!a || !b || a === b || seen.has(a + '>' + b)) continue
    seen.add(a + '>' + b)
    edges.push({ from: a, to: b, label: '' })
  }
  return { dir: page.treeDir === 'TD' ? 'TD' : 'LR', order, nodes, edges, errors: [] }
}

export function mermaidOfPage(page: Pick<Page, 'els' | 'conns' | 'treeDir'>): string {
  return toMermaid(graphOfPage(page))
}
