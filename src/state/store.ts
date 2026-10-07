import { create } from 'zustand'
import { cardByKey } from '../cards/registry'
import { pageSize } from '../cards/sizing'
import { mindmapParts } from '../cards/mindmapEls'
import { parseMermaid } from '../cards/mermaid'
import type { MmError, NodeShape } from '../cards/mermaid'
import { graphOfPage, membersOfPage } from '../cards/mermaidOut'
import { treeParts } from '../cards/treeEls'
import { treeShape, layoutTree, newNode, TREE_CONN } from '../cards/treeOps'
import { nextSpot, freeSpot, centeredYs, CENTER_MAX, GAP_SIDE, GAP_STACK } from '../canvas/placeNext'
import type { Side } from '../canvas/placeNext'
import type { Shape } from '../cards/treeOps'
import type { ImportedDoc } from '../import/htmlImport'
import { polish } from '../builder/polish'
import { dropHistory, popDocRedo, popDocSnap, pushDocRedo, pushDocSnap, pushDocUndoRaw } from '../canvas/history'
import { slideSpot } from './pageOrder'
import type { ThemeName } from '../design/tokens'
export type Orientation = 'portrait' | 'landscape'
export type SizePreset = 's' | 'm' | 'l'
export type PaperType = 'blank' | 'lined' | 'lined-narrow' | 'dotted' | 'grid'
// G3/G4 — 서버 planner 가 내는 이북 설계. applyPlan 이 카드로 변환한다.
export interface PlanPage { cardKey: string; fields?: Record<string, string> }
export interface BookPlan { title?: string; orientation?: Orientation; theme?: ThemeName; pages: PlanPage[] }
// G5 — 부분 수정: 대상 페이지 필드만 덮어쓰기(edits) + 새 장 끝에 추가(adds).
export interface PageEdit { pageId: number; fields: Record<string, string> }
export interface PageAdd { cardKey: string; fields?: Record<string, string> }
export interface FreeEl { id: number; type: string; x: number; y: number; w: number; h: number; text: string; color: string; fs: number; src?: string; bold?: boolean; tcolor?: string; rows?: number; cols?: number; cells?: string[][]; colw?: number[]; rowh?: number[]; merges?: { r: number; c: number; rs: number; cs: number }[]; calign?: Record<string, 'left' | 'center' | 'right'>; cvalign?: Record<string, 'top' | 'middle' | 'bottom'>; cfs?: Record<string, number>; cbg?: Record<string, string>; headRow?: boolean; wa?: boolean; italic?: boolean; underline?: boolean; rot?: number; align?: 'left' | 'center' | 'right'; gotoSeq?: number; blocks?: Block[]; flipH?: boolean; flipV?: boolean; opacity?: number; shadow?: boolean; reflect?: boolean; locked?: boolean; groupId?: number; borderColor?: string; borderWidth?: number; /** 테두리 선 모양. 없으면 실선. */ borderDash?: 'solid' | 'dashed' | 'dotted'
  /** **트리 2단계**(EVER-SKETCH1 c7effe6). 이 상자가 접혀 있다(▸). 아래쪽이 `hidden` 이 된다. */
  folded?: boolean
  /** 접힌 윗대 때문에 **편집 화면에서만** 안 보인다.
   *  내보내기·미리보기·발표는 이 값을 보지 않는다 — 낸 것과 가진 것이 달라지면 안 된다. */
  hidden?: boolean
  /** 아래 띠 머리에 **흐리게 다시 놓은 부모**. 값은 원본 상자 id.
   *  다시 앉힐 때마다 지우고 새로 만든다 — 남겨 두면 원본 글자를 고쳤을 때 안 따라간다. */
  echoOf?: number }
export interface Conn { from: number; to: number; bend?: { x: number; y: number }; kind?: 'straight' | 'ortho' | 'curve'; arrow?: 'end' | 'both' | 'none'; color?: string; width?: number; dash?: boolean
  /** 꺾은선이 **어느 변에서 나가는가**(2026-10-07 · 불편점 5번). 옆으로 붙인 선은 'h'(오른쪽 변), 아래 · 위로 붙인 선은 'v'(아래 변).
   *  없으면 트리 방향 · 자동(connPath). 적어 두는 까닭: 재정렬이 없어 자식이 여럿 쌓여도 선이 늘 같은 변에서 나가야 해서다. */
  axis?: 'h' | 'v' }
export interface Stroke { points: [number, number][]; color: string; w: number; hl?: boolean }
export type BlockType = 'h1' | 'h2' | 'h3' | 'h4' | 'text' | 'bullet' | 'numbered' | 'todo' | 'divider' | 'toggle' | 'callout'
export type CalloutTone = 'info' | 'key' | 'warn'
export interface Block { id: number; type: BlockType; text: string; bold?: boolean; italic?: boolean; done?: boolean; align?: 'left' | 'center' | 'right'; collapsed?: boolean; children?: Block[]; tone?: CalloutTone; color?: string; fs?: number }
export type PageRole = 'cover' | 'toc' | 'content' | 'back'
export interface DeckTocItem { sectionId: string; markN?: string; title: string; summary?: string; pageNo: string }
export interface Page { id: number; cardKey: string; fields: Record<string, string>; free: boolean; els: FreeEl[]; conns: Conn[]; strokes: Stroke[]; paper?: PaperType; blocks?: Block[]; detached?: string[]; bg?: string; contd?: boolean; trans?: string; role?: PageRole; sectionId?: string; pageNo?: string; tocItems?: DeckTocItem[]
  /** 이 쪽이 **마인드맵에서 펼쳐진 것**이면 중심 도형의 id(EVER-SKETCH1 8c7c812).
   *
   *  펼치고 나면 그냥 도형과 선이라 「이게 마인드맵이었다」를 알 길이 없다.
   *  그래서 「＋ 가지」를 어디에 붙일지도 모른다. 중심 id 하나만 적어 두면
   *  **표시와 붙일 자리**를 한꺼번에 해결한다. */
  mindmapCenter?: number
  /** 이 쪽이 **트리(머메이드)에서 펼쳐진 것**이면 뿌리 도형의 id. 마인드맵의 `mindmapCenter` 와 같은 몫이다. */
  treeRoot?: number
  /** **트리에 속한 상자 명단**(뿌리 목록이 아니다). 선이 하나도 없는 외톨이 —
   *  「＋ 새 뿌리」로 갓 만든 것 — 를 트리 안에 붙들어 두는 몫만 한다.
   *  누가 뿌리인지는 여기가 아니라 **선**이 정한다(treeOps.treeShape). */
  treeRoots?: number[]
  /** 그 트리가 왼→오른(LR)인가 위→아래(TD)인가. 다시 앉힐 때 필요하다. */
  treeDir?: 'LR' | 'TD'
  /** 트리를 만든 **머메이드 원문.** 그림을 고쳐도 이건 안 고친다 —
   *  「처음에 무엇을 쳤는가」의 기록이고, 다시 펼치고 싶을 때 되돌아갈 자리다. */
  treeSrc?: string }
export interface CanvasData { els: FreeEl[]; conns: Conn[]; strokes: Stroke[]; detached?: string[] }
export interface BuilderState {
  title: string; orientation: Orientation; font: string; size: SizePreset; theme: ThemeName
  pages: Page[]; selectedPageId: number | null
  /** `count` 는 마인드맵 가지 수, `src` 는 머메이드 원문 — 둘 다 카드가 아니라 **펼침**이다. */
  addCard: (cardKey: string, count?: number, src?: string) => void
  updateField: (pageId: number, key: string, value: string) => void
  removePage: (pageId: number) => void
  movePage: (pageId: number, dir: number) => void
  /** 드래그 재정렬용: from 위치의 페이지를 빼서 to 위치에 끼워 넣는다(스왑 아님). */
  reorderPage: (from: number, to: number) => void
  duplicatePage: (pageId: number) => void
  selectPage: (pageId: number) => void
  setTitle: (t: string) => void
  setOrientation: (o: Orientation) => void
  /** 쪽 목록이 바뀌기 직전을 기억한다(쪽 추가·삭제·순서). */
  snapDoc: () => void
  /** 문서 단위 되돌리기 / 다시하기 — 쪽이 생기고 없어진 일이 여기로 돌아온다. */
  undoDoc: () => void
  redoDoc: () => void
  setFont: (f: string) => void
  setSize: (s: SizePreset) => void
  setTheme: (t: ThemeName) => void
  toggleFree: (pageId: number) => void
  /** 카드로 만들어 둔 마인드맵을 옮길 수 있는 요소들로 펼친다(되돌리기 가능). */
  expandMindmap: (pageId: number) => void
  addEl: (pageId: number, el: FreeEl) => void
  updateEl: (pageId: number, elId: number, patch: Partial<FreeEl>) => void
  removeEl: (pageId: number, elId: number) => void
  addConn: (pageId: number, conn: Conn) => void
  addStroke: (pageId: number, stroke: Stroke) => void
  reorderEl: (pageId: number, elId: number, toFront: boolean) => void
  setCanvas: (pageId: number, data: CanvasData) => void
  /** 고른 상자(`elId`)에 상자 하나를 붙이고 선을 잇는다. `kind`: 자식(`right` · `down` · `up` · `left` = ＋점의 변 · Space 는 right) ·
   *  `sibling`(형제 — 같은 부모 · 고른 상자 바로 아래 · Enter) · `before`(앞 형제 · Shift+Enter) · `root`(고른 것 없이 빈 자리).
   *  **다른 상자는 안 움직인다**(2차 6번) — 다만 같은 부모의 자식 열은 일곱까지 부모 가운데에 맞춰 선다(3차). 뿌리의 형제는 선 없는 또 하나의 뿌리.
   *  새 상자는 고른 상자의 모양 · 크기 · 색을 닮는다. */
  treeAdd: (pageId: number, elId: number | null, kind: 'right' | 'down' | 'up' | 'left' | 'sibling' | 'before' | 'root') => void
  /** 머메이드 글을 고쳐 **이 쪽의 그림에 적용**한다(2026-10-07 · 추가 요청 1 「여기에서도 소스를 변경을 통해서 수정할 수 있도록」). 번호(n1 … = mermaidOut 의 순서)가
   *  같은 상자는 자리 · 모양 그대로(글 · 모양은 뽑았던 것과 다를 때만 고침) · 원문에 없는 번호는 그 상자 하나만 지움 · 새 번호는 들어오는 선의 부모 옆에(treeAdd =
   *  Space 와 같은 자리) 없으면 빈 자리의 뿌리 · 선은 글대로(있던 선의 모양은 그대로 · 새 선은 한 벌). 못 읽는 줄이 있으면 아무것도 안 바꾸고 errors 로 돌려준다.
   *  되돌리기 한 걸음(pushSnap)은 부르는 쪽이 남긴다. */
  applyMermaid: (pageId: number, src: string) => { errors: MmError[]; added: number; removed: number; changed: number }
  /** 상자를 **그 아래 가지째** 지운다(알마인드 Delete). 남은 상자는 제자리.
   *  `removeEl` 은 상자 하나와 거기 걸린 선만 지워서, 자손이 선 없는 외톨이 뿌리로 남는다. */
  treeRemove: (pageId: number, elId: number) => void
  /** 가지를 접거나 편다. 접힘은 `folded`, 안 보임은 매번 다시 계산한다. 자리는 안 옮긴다. */
  treeFold: (pageId: number, elId: number) => void
  updateConn: (pageId: number, index: number, bend: { x: number; y: number }) => void
  patchConn: (pageId: number, index: number, patch: Partial<Conn>) => void
  removeConn: (pageId: number, index: number) => void
  setBlocks: (pageId: number, blocks: Block[]) => void
  setElBlocks: (pageId: number, elId: number, blocks: Block[]) => void
  moveEls: (pageId: number, moves: { id: number; x: number; y: number }[]) => void
  updateEls: (pageId: number, ids: number[], patch: Partial<FreeEl>) => void
  transformEls: (pageId: number, items: { id: number; x?: number; y?: number; w?: number; h?: number; rot?: number }[]) => void
  detachField: (pageId: number, key: string, box: { x: number; y: number; w: number; h: number; text: string; fs: number; tcolor?: string; bold?: boolean; align?: 'left' | 'center' | 'right' }) => number
  detachBox: (pageId: number, key: string, box: { x: number; y: number; w: number; h: number; text: string; fs: number; tcolor?: string; bold?: boolean; align?: 'left' | 'center' | 'right'; fill?: string; borderColor?: string; borderWidth?: number }) => number
  groupEls: (pageId: number, ids: number[]) => void
  ungroupEls: (pageId: number, ids: number[]) => void
  setPageBg: (pageId: number, bg: string) => void
  setPaper: (pageId: number, paper: PaperType) => void
  setPageTrans: (pageId: number, trans: string) => void
  importDoc: (doc: ImportedDoc) => void
  importDeckSlides: (urls: string[], title: string) => void
  importPages: (pages: Page[], title?: string) => void
  applyPlan: (plan: BookPlan) => void
  applyPageEdits: (edits: PageEdit[], adds?: PageAdd[]) => void
  polishAll: () => void
  setCard: (pageId: number, cardKey: string, fields: Record<string, string>) => void
  summarizeNotes: () => Promise<{ ok: boolean; error?: string; count?: number }>
}
let blockUid = 1
export const newBlock = (type: BlockType = 'text', text = ''): Block => ({ id: blockUid++, type, text })
let uid = 1
let elUid = 100000
// 자유 캔버스 요소 id 단일 발급원(mkFreeEl 포함 모두 여기서). reseedUids가 로드 때 이 카운터를 끌어올림.
export function nextElId(): number { return elUid++ }
/**
 * **번호표를 이미 쓴 번호 위로 올린다**(2026-10-06).
 *
 * 트리를 다시 앉힐 때 생기는 echo(아래 띠 머리에 다시 놓은 부모)는 번호표를 안 뽑고 `가장 큰 id + 1` 로
 * 번호를 받는다(treeOps.layoutTree — 순수 함수라 번호표를 모른다). 번호표가 그대로면 다음에 뽑는 번호가
 * **echo 와 같아진다.** 「＋ 자식」 이 그 번호를 받으면 layoutTree 가 그 상자로 가는 선을 「echo 로 들어가는 선」
 * 으로 읽고 버려서, 새 상자가 **선 없이 왼쪽 위에 뿌리와 포개졌다**(2026-10-02 화면에서 재현).
 * 그래서 트리를 앉힌 뒤에는 늘 이걸 부른다.
 */
/**
 * 가지를 붙인 뒤 **줄기(고른 상자 → 뿌리)의 열들을 다시 세운다**(2026-10-07 4차 · 사용자: 「child1 계층에서 A,B,C,D,E 를 만들었고 B 에서 child2,
 * C 에서 child2 계층을 만든 경우 얘네 둘이 겹쳐보이는 때가 있음 … 처음 만들때부터 겹치지 않도록 — B,C 사이 간격을 늘인다거나」).
 * · 부모 옆 열(nextSpot 이 놓는 x)에 선 상자만 **열 안**으로 친다. 열 안 상자의 **자손 범위**(열 안 자식들까지 합친 높이 = extent)만큼 형제 사이를
 *   띄우고, 각 상자는 제 범위 가운데에 — 그래서 자식들은 부모 가운데에(3차), 자손이 있는 형제는 그만큼 벌어진다. 일곱(CENTER_MAX)까지는 부모 가운데,
 *   여덟부터는 맨 위를 고정하고 쌓는다.
 * · 줄기는 「자식이 부모의 열에 서 있는 동안」 만 올라간다 — 손으로 옮긴 상자(열 밖)와 그 아래는 안 건드리고 **장애물**로만 본다. 뿌리(줄기 맨 위)는
 *   안 움직인다. 새 자리가 장애물(열 밖 상자 · 다른 그림 · 접힌 것 말고 보이는 것)과 겹치면 통째로 그만두고 고른 상자의 열만 다시 세운다(arrangeColumn).
 * · 왜 위에서 아래로 한 번에 두나: 열 하나씩 고치면 아직 안 비킨 이웃(B 의 둘째 자식)에 막혀 C 의 자식이 가운데 맞춤을 포기하고 밑으로 처진다.
 */
function tidyUp(els: FreeEl[], shape: Shape, hub: FreeEl, side: 'right' | 'left', order: FreeEl[]): FreeEl[] {
  const byId = new Map(els.map((e) => [e.id, e]))
  const inCol = (P: FreeEl, k: FreeEl) => (side === 'right' ? Math.abs(k.x - (P.x + P.w + GAP_SIDE)) <= 1 : Math.abs(k.x + k.w - (P.x - GAP_SIDE)) <= 1)
  const colKids = (P: FreeEl): FreeEl[] => (P.id === hub.id ? order
    : (shape.kids.get(P.id) || []).map((k) => byId.get(k)).filter((k): k is FreeEl => !!k && !k.hidden && inCol(P, k)).sort((a, b) => a.y - b.y))
  let top = hub
  for (let n = 0; n < 99; n++) { const pid = shape.parent.get(top.id); const P = pid != null ? byId.get(pid) : undefined; if (!P || P.hidden || !inCol(P, top)) break; top = P }
  const ext = new Map<number, number>()
  const extent = (k: FreeEl): number => {
    const m = ext.get(k.id); if (m != null) return m
    const ks = colKids(k); const v = Math.max(k.h, ks.reduce((s, c) => s + extent(c), 0) + GAP_STACK * Math.max(0, ks.length - 1)); ext.set(k.id, v); return v
  }
  const subTop = (k: FreeEl): number => Math.min(k.y, ...colKids(k).map(subTop))
  const ys = new Map<number, number>()
  const place = (P: FreeEl, cy: number) => {
    const ks = colKids(P); if (!ks.length) return
    const hs = ks.map(extent)
    let starts: number[]
    if (ks.length <= CENTER_MAX) starts = centeredYs(cy, hs)
    else { let y = Math.min(...ks.map(subTop)); starts = hs.map((h) => { const v = y; y += h + GAP_STACK; return v }) }
    ks.forEach((k, i) => { const y = starts[i] + Math.round((hs[i] - k.h) / 2); ys.set(k.id, y); place(k, y + k.h / 2) })
  }
  place(top, top.y + top.h / 2)
  if (![...ys].some(([id, y]) => byId.get(id)!.y !== y)) return els
  const next = els.map((e) => (ys.has(e.id) ? { ...e, y: ys.get(e.id)! } : e))
  const still = next.filter((e) => !ys.has(e.id) && !e.hidden)
  const placed = next.filter((e) => ys.has(e.id))
  const clash = placed.some((m) => still.some((o) => m.x < o.x + o.w && o.x < m.x + m.w && m.y < o.y + o.h && o.y < m.y + m.h))
  return clash ? arrangeColumn(els, shape, hub, order) : next
}
/**
 * (대비책 — tidyUp 이 장애물에 막혔을 때) 고른 상자 옆 열의 자식들만 `order` 순서로 다시 세운다(2026-10-07 3차). 일곱(CENTER_MAX)까지는
 * **부모 가운데**에 맞추고(centeredYs), 그게 남과 겹치거나 여덟 이상이면 **맨 위를 고정**하고 아래로 쌓는다. 그것도 겹치면 그대로 둔다
 * (새 상자는 이미 열 끝에 있다). 자식이 움직이면 그 자손도 같은 만큼 따라간다. 부모는 안 움직인다.
 */
function arrangeColumn(els: FreeEl[], shape: Shape, hub: FreeEl, order: FreeEl[]): FreeEl[] {
  if (order.length < 2) return els
  const hs = order.map((k) => k.h)
  const attempt = (ys: number[]): FreeEl[] | null => {
    const dy = new Map<number, number>()
    const walk = (eid: number, d: number) => { if (dy.has(eid)) return; dy.set(eid, d); for (const c of shape.kids.get(eid) || []) walk(c, d) }
    order.forEach((k, i) => { if (ys[i] !== k.y) walk(k.id, ys[i] - k.y) })
    if (!dy.size) return els
    const moved = els.filter((e) => dy.has(e.id)).map((e) => ({ ...e, y: e.y + (dy.get(e.id) || 0) }))
    const still = els.filter((e) => !dy.has(e.id) && e.id !== hub.id && !e.hidden)
    const clash = moved.some((m) => still.some((o) => m.x < o.x + o.w && o.x < m.x + m.w && m.y < o.y + o.h && o.y < m.y + m.h))
    return clash ? null : els.map((e) => (dy.has(e.id) ? { ...e, y: e.y + (dy.get(e.id) || 0) } : e))
  }
  if (order.length <= CENTER_MAX) { const r = attempt(centeredYs(hub.y + hub.h / 2, hs)); if (r) return r }
  const top = Math.min(...order.map((k) => k.y))
  const stacked: number[] = []; let y = top; for (const h of hs) { stacked.push(y); y += h + GAP_STACK }
  return attempt(stacked) ?? els
}
/** 머메이드 모양(`[ ]` box · `( )` round · `{ }` dec)을 상자 종류로 — 이미 그 모양이면(둥근 상자든 타원이든) 안 건드린다. */
function typePatch(shape: NodeShape, el: FreeEl): Partial<FreeEl> {
  const now: NodeShape = el.type === 'diamond' ? 'dec' : el.type === 'round' || el.type === 'ellipse' ? 'round' : 'box'
  return now === shape ? {} : { type: shape === 'dec' ? 'diamond' : shape === 'round' ? 'round' : 'box' }
}
function claimIds(els: FreeEl[]): void { for (const e of els) if (e && e.id >= elUid) elUid = e.id + 1 }
// 새 페이지의 필드는 빈칸으로 시작한다.
// registry 의 example 을 그대로 넣으면 같은 카드를 두 번 추가했을 때 글자까지 똑같은 페이지가 나오고,
// 지우지 않은 예시 문구가 그대로 내보내기까지 따라간다.
// 빈칸은 PageView 의 data-ph 자리표시자가 안내하므로 화면이 비어 보이지도 않는다.
// (AI 경로 buildPlanPage 도 같은 이유로 빈칸을 쓴다 — 정책을 하나로 맞춘 것)
function defaultsFor(cardKey: string): Record<string, string> {
  const c = cardByKey(cardKey); const f: Record<string, string> = {}
  if (c) c.fields.forEach((fd) => { f[fd.key] = '' })
  return f
}
// (G4/G5 공유) planner/editor 의 페이지 스펙 한 장을 실제 Page 로 만든다.
// 미채운 필드는 예시 대신 빈칸(근거 없는 수치/문구 주입 방지). note 는 제목 블록으로.
function buildPlanPage(sp: PlanPage | PageAdd): Page {
  const cardKey = sp.cardKey
  const given = sp.fields || {}
  if (cardKey === 'note') {
    const title = (given.title || '새 페이지').toString()
    return { id: uid++, cardKey: 'note', fields: {}, free: false, els: [], conns: [], strokes: [], blocks: [{ ...newBlock('h1', title), bold: true }], bg: '' }
  }
  const empties: Record<string, string> = {}
  const c = cardByKey(cardKey)
  if (c) c.fields.forEach((fd) => { empties[fd.key] = '' })
  const fields = { ...empties, ...given }
  return { id: uid++, cardKey, fields, free: false, els: [], conns: [], strokes: [] }
}
const isPlannablePage = (cardKey: string) => cardKey === 'note' || cardKey === 'slide' || !!cardByKey(cardKey)
const mapPage = (pages: Page[], id: number, fn: (p: Page) => Page) => pages.map((p) => (p.id === id ? fn(p) : p))
function clonePageWithNewIds(src: Page): Page {
  const copy: Page = JSON.parse(JSON.stringify(src))
  copy.id = uid++
  const idMap = new Map<number, number>()
  copy.els = copy.els.map((el) => {
    const nextId = elUid++
    idMap.set(el.id, nextId)
    return { ...el, id: nextId }
  })
  copy.conns = copy.conns.flatMap((conn) => {
    const from = idMap.get(conn.from)
    const to = idMap.get(conn.to)
    return from && to ? [{ ...conn, from, to }] : []
  })
  return copy
}
// 저장된 프로젝트를 로드할 때, 그 안의 id들이 모듈 카운터(uid/elUid/blockUid)보다 크면
// 새로 추가하는 요소가 기존 id와 충돌한다. 로드 직후 카운터를 최대 id 다음으로 끌어올린다.
export function reseedUids(pages: Page[]): void {
  let maxP = 0, maxEl = 0, maxBlk = 0
  const walk = (bs?: Block[]) => { for (const b of bs || []) { if (b.id > maxBlk) maxBlk = b.id; walk(b.children) } }
  for (const p of pages || []) {
    if (p.id > maxP) maxP = p.id
    for (const e of p.els || []) { if (e.id > maxEl) maxEl = e.id; walk(e.blocks) }
    walk(p.blocks)
  }
  if (maxP >= uid) uid = maxP + 1
  if (maxEl >= elUid) elUid = maxEl + 1
  if (maxBlk >= blockUid) blockUid = maxBlk + 1
  // 기존 데이터 치유: 한 페이지 안에서 중복된 요소 id는 새 id로 분리(2번째부터). 겹쳐 쌓이던 도형이 풀린다.
  for (const p of pages || []) {
    const seen = new Set<number>()
    for (const e of p.els || []) {
      if (seen.has(e.id)) e.id = elUid++
      seen.add(e.id)
    }
  }
  // 기존 데이터 치유(2026-10-07 2차 4번): 옛 트리 선(연한 #b9c2d4 · 1.5 — 머메이드 · 아래 띠 이음)을 지금의 한 벌(TREE_CONN)로 맞춘다.
  // 사용자: 「머메이드라고 되어있는 부분 또한 화살표의 굵기 및 색상을 현재의 화살표등에 맞게」. 마인드맵(방사형)의 선은 다른 그림이라 둔다.
  for (const p of pages || []) {
    for (const c of p.conns || []) if (c && c.color === '#b9c2d4') { c.color = TREE_CONN.color; c.width = TREE_CONN.width }
  }
}

/** 문서 단위 되돌리기가 기억하는 **한 문서의 모습**.
 *  쪽 안의 이력(canvas/history.ts 의 쪽별 스택)과 달리 쪽 목록 자체를 통째로 든다. */
function docSnap(pages: Page[], selectedPageId: number | null): string {
  return JSON.stringify({ pages, selectedPageId })
}

export const useBuilder = create<BuilderState>((set, get) => ({
  title: '유니에버 AX 사업모델', orientation: 'portrait', font: 'auto', size: 'm', theme: 'light',
  pages: [], selectedPageId: null,
  // 쪽이 **생기고·없어지고·자리를 바꾸는** 길에는 모두 문서 이력을 남긴다(EVER-SKETCH1 9eabded).
  // 쪽별 이력(canvas/history.ts)으로는 쪽 자체를 되돌릴 수 없어 ⌘Z 가 죽어 보였다.
  addCard: (cardKey, count, src) => {
    const g = get(); pushDocSnap(docSnap(g.pages, g.selectedPageId))
    return set((s) => {
    // 슬라이드 = 빈 캔버스 편집 페이지(구글 슬라이드식). 블록편집기 없이 요소로 직접 편집.
    if (cardKey === 'slide') {
      const sp: Page = { id: uid++, cardKey: 'slide', fields: {}, free: true, els: [], conns: [], strokes: [], blocks: [], bg: '' }
      /**
       * **고른 쪽 바로 뒤에 끼운다**(EVER-SKETCH1 90e7439 · 원본 사용자 결정).
       *
       * 전에는 늘 **맨 끝**에 붙었다. 3장짜리에서 가운데(2번째)를 골라 놓고 「＋ 슬라이드」를
       * 눌러도 **4번째**로 갔다 — 만들고 나서 손으로 끌어 올려야 했다. 파워포인트·키노트와 같게 맞춘다.
       * **슬라이드만 그렇게 한다.** 다른 카드는 맨 끝 그대로다(아래 갈래).
       */
      const next = slideSpot(s.pages, s.selectedPageId)
      return { pages: [...s.pages.slice(0, next), sp, ...s.pages.slice(next)], selectedPageId: sp.id }
    }
    // 마인드맵은 **카드로 두지 않고 그 자리에서 요소로 펼친다**(EVER-SKETCH1 68a5627).
    // 카드로 두면 그림이 SVG 한 덩어리라 가지 하나를 잡을 수가 없다 —
    // 「마인드맵 위치 이동 및 사이즈 조정 안됨」이 이것이다. 자세한 이유는 cards/mindmapEls.ts.
    if (cardKey === 'mindmap') {
      const { W, H } = pageSize(s.orientation)
      const { els, conns } = mindmapParts(defaultsFor('mindmap'), W, H, nextElId, count)
      // 중심은 제목 다음(제목이 없으면 첫째)이다 — 가지들이 여기로 이어져 있다.
      const center = conns.length ? conns[0].from : undefined
      const mp: Page = { id: uid++, cardKey: 'slide', fields: {}, free: true,
                         els, conns, strokes: [], blocks: [], bg: '', mindmapCenter: center }
      return { pages: [...s.pages, mp], selectedPageId: mp.id }
    }
    // 머메이드(트리)도 마인드맵처럼 **그 자리에서 요소로 펼친다**(EVER-SKETCH1 2b6abf0 · c7effe6).
    // 카드로 두면 SVG 한 덩어리가 되어 상자 하나를 못 잡는다 — 마인드맵을 카드에서 뺀 것과 같은 이유다.
    if (cardKey === 'tree') {
      const { W, H } = pageSize(s.orientation)
      const g = parseMermaid(src || '')
      const dir = g.dir
      const { els, conns, rootId } = treeParts(g, W, H, nextElId, dir)
      // **뿌리를 전부 적는다.** 글에 줄기를 둘 쓰면 부모 없는 상자가 둘 나온다 —
      // 하나만 적어 두면 둘째 줄기를 앱이 모른 채로 남는다.
      const roots = treeShape(els, conns).roots
      const rs = roots.length ? roots : [rootId]
      // **처음 펼칠 때부터 접어 넣는다.** treeParts 는 한 띠만 알아서, 깊은 그림을
      // 넣으면 눕히거나 간격을 줄여 버틴다. 같은 종이 아래 띠로 이어 그리는 편이 읽기 쉽다.
      // **쓴 방향을 준다**(`dir`) — 사람이 쓴 방향이 우선이고, 실제로 앉힌 방향을 적는다.
      const laid = layoutTree(els, conns, W, H, dir, rs)
      claimIds(laid.els)
      const tp: Page = { id: uid++, cardKey: 'slide', fields: {}, free: true,
                         els: laid.els, conns: laid.conns, strokes: [], blocks: [], bg: '',
                         treeRoot: rootId, treeRoots: rs,
                         treeDir: laid.dir, treeSrc: src || '' }
      return { pages: [...s.pages, tp], selectedPageId: tp.id }
    }
    const p: Page = { id: uid++, cardKey, fields: defaultsFor(cardKey), free: false, els: [], conns: [], strokes: [] }
    if (cardKey === 'note') {
      // 빈 제목 블록 + 빈 본문 블록. 안내 문구를 값으로 넣으면 페이지마다 같은 글이 박히고,
      // 지우지 않으면 그대로 내보내진다. 사용법 안내는 블록 자리표시자가 맡는다.
      p.blocks = [
        { ...newBlock('h1', ''), bold: true },
        newBlock('text', ''),
      ]
      p.bg = ''
    }
      return { pages: [...s.pages, p], selectedPageId: p.id }
    })
  },
  updateField: (pageId, key, value) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, fields: { ...p.fields, [key]: value } })) })),
  removePage: (pageId) => set((s) => {
    if (!s.pages.some((p) => p.id === pageId)) return {} as Partial<BuilderState>
    // **지우기 전을 기억한다.** 지운 쪽의 쪽별 이력은 아래 dropHistory 로 사라지지만,
    // 쪽이 통째로 돌아오는 것은 문서 이력이 맡는다.
    pushDocSnap(docSnap(s.pages, s.selectedPageId))
    dropHistory(pageId)
    const at = s.pages.findIndex((p) => p.id === pageId)
    const pages = s.pages.filter((p) => p.id !== pageId)
    // 지운 자리의 다음(없으면 이전) 페이지로. 무조건 1페이지로 튀면 여러 장 정리할 때
    // 매번 원래 보던 곳까지 다시 스크롤해 내려와야 한다.
    let sel = s.selectedPageId
    if (s.selectedPageId === pageId) {
      sel = pages.length ? pages[Math.min(at, pages.length - 1)].id : null
    }
    return { pages, selectedPageId: sel }
  }),
  movePage: (pageId, dir) => set((s) => { const i = s.pages.findIndex((p) => p.id === pageId); const j = i + dir; if (i < 0 || j < 0 || j >= s.pages.length) return {} as Partial<BuilderState>; pushDocSnap(docSnap(s.pages, s.selectedPageId)); const pages = [...s.pages]; const tmp = pages[i]; pages[i] = pages[j]; pages[j] = tmp; return { pages } }),
  // movePage 는 인접 스왑이라 임의 위치 이동을 표현할 수 없다(28→3 이면 25번 눌러야 한다).
  // 드래그 재정렬은 잘라내서 끼워 넣는 방식이어야 중간 페이지들의 상대 순서가 유지된다.
  reorderPage: (from, to) => set((s) => {
    const n = s.pages.length
    if (from < 0 || from >= n) return {} as Partial<BuilderState>
    const dest = Math.max(0, Math.min(n - 1, to))
    if (dest === from) return {} as Partial<BuilderState>
    pushDocSnap(docSnap(s.pages, s.selectedPageId))
    const pages = [...s.pages]
    const [moved] = pages.splice(from, 1)
    pages.splice(dest, 0, moved)
    return { pages }
  }),
  duplicatePage: (pageId) => set((s) => {
    const i = s.pages.findIndex((p) => p.id === pageId); if (i < 0) return {} as Partial<BuilderState>
    pushDocSnap(docSnap(s.pages, s.selectedPageId))
    const src = s.pages[i]
    const copy = clonePageWithNewIds(src)
    const pages = [...s.pages]; pages.splice(i + 1, 0, copy)
    return { pages, selectedPageId: copy.id }
  }),
  selectPage: (pageId) => set({ selectedPageId: pageId }),
  setTitle: (t) => set({ title: t }),
  setOrientation: (o) => set({ orientation: o }),
  /** 쪽이 생기고·없어지고·자리를 바꾸기 **직전**의 문서를 기억한다. */
  snapDoc: () => { const s = get(); pushDocSnap(docSnap(s.pages, s.selectedPageId)) },
  undoDoc: () => set((s) => {
    const back = popDocSnap()
    if (back == null) return {} as Partial<BuilderState>
    pushDocRedo(docSnap(s.pages, s.selectedPageId))
    return JSON.parse(back) as Partial<BuilderState>
  }),
  redoDoc: () => set((s) => {
    const fwd = popDocRedo()
    if (fwd == null) return {} as Partial<BuilderState>
    pushDocUndoRaw(docSnap(s.pages, s.selectedPageId))
    return JSON.parse(fwd) as Partial<BuilderState>
  }),
  setFont: (fv) => set({ font: fv }),
  setSize: (sz) => set({ size: sz }),
  setTheme: (t) => set({ theme: t }),
  toggleFree: (pageId) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, free: !p.free })) })),

  // 이미 **카드로 만들어 둔** 마인드맵을 요소로 펼친다(EVER-SKETCH1 68a5627).
  //
  // 새로 넣는 것은 addCard 가 처음부터 펼쳐서 주지만, 그 전에 만든 자료는 카드 그대로
  // 남아 있다. 열 때 자동으로 바꾸지는 않는다 — 잠금 플래그 하나 떼는 것과 달리
  // **내용을 통째로 다시 쓰는 일**이고, 필드를 정성껏 채워 둔 사람의 자료다.
  // 사람이 누를 때만 바꾸고, 잘못 눌렀으면 실행 취소로 되돌린다.
  //
  // (ebook_html) 원본과 다르게 한 것 둘:
  //  · 원본은 여기서 `mindmapCenter` 를 안 적어, 펼친 뒤에 「＋ 가지」가 안 떴다.
  //    새로 넣는 길(addCard)과 같게 중심 id 를 적어 둔다.
  //  · 원본은 누르기 전에 **쪽 이력**(pushSnap)만 남겼다. 쪽 이력은 요소·선만 들고 있어서
  //    ⌘Z 를 누르면 요소는 사라지는데 `cardKey`·`fields` 는 안 돌아와 **마인드맵이 통째로 빈 쪽**이
  //    됐다(스모크로 확인). 카드 종류가 바뀌는 일이므로 **문서 이력**에 남긴다(removePage 와 같다).
  expandMindmap: (pageId) => set((s) => {
    const src = s.pages.find((p) => p.id === pageId)
    if (!src || src.cardKey !== 'mindmap') return {} as Partial<BuilderState>
    pushDocSnap(docSnap(s.pages, s.selectedPageId))
    const { W, H } = pageSize(s.orientation)
    const { els, conns } = mindmapParts(src.fields || {}, W, H, nextElId)
    const center = conns.length ? conns[0].from : undefined
    return { pages: mapPage(s.pages, pageId, (p) => ({
      ...p, cardKey: 'slide', fields: {}, free: true,
      els: [...(p.els || []), ...els], conns: [...(p.conns || []), ...conns],
      mindmapCenter: center,
    })) }
  }),
  addEl: (pageId, el) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, els: [...p.els, el] })) })),
  updateEl: (pageId, elId, patch) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, els: p.els.map((e) => (e.id === elId ? { ...e, ...patch } : e)) })) })),
  removeEl: (pageId, elId) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, els: p.els.filter((e) => e.id !== elId), conns: p.conns.filter((c) => c.from !== elId && c.to !== elId) })) })),
  addConn: (pageId, conn) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, conns: [...p.conns, conn] })) })),
  addStroke: (pageId, stroke) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, strokes: [...p.strokes, stroke] })) })),
  reorderEl: (pageId, elId, toFront) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => { const i = p.els.findIndex((e) => e.id === elId); if (i < 0) return p; const els = [...p.els]; const e = els.splice(i, 1)[0]; if (toFront) els.push(e); else els.unshift(e); return { ...p, els } }) })),
  setCanvas: (pageId, data) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, els: data.els, conns: data.conns, strokes: data.strokes, ...(data.detached !== undefined ? { detached: data.detached } : {}) })) })),
  treeAdd: (pageId, elId, kind) => set((s) => {
    const { W, H } = pageSize(s.orientation)
    return { pages: mapPage(s.pages, pageId, (p) => {
      const known = p.treeRoots || (p.treeRoot != null ? [p.treeRoot] : [])
      const like = elId != null ? p.els.find((e) => e.id === elId) : undefined
      const id = nextElId()
      // **새 상자는 고른 상자를 닮는다**(2026-10-07) — 모양 · 크기 · 색 · 글자. 고른 것이 없으면 트리 기본 상자.
      const fresh = newNode(id, kind === 'root' ? '새 뿌리' : '새 상자')
      const node: FreeEl = like ? { ...fresh, type: like.type, w: like.w, h: like.h, color: like.color, fs: like.fs, tcolor: like.tcolor,
        bold: like.bold, italic: like.italic, underline: like.underline, align: like.align, borderColor: like.borderColor,
        borderWidth: like.borderWidth, borderDash: like.borderDash, opacity: like.opacity, shadow: like.shadow } : fresh
      const visible = p.els.filter((e) => !e.hidden)
      const shape0 = treeShape(p.els, p.conns, known)
      const sibling = kind === 'sibling' || kind === 'before'
      const parentId = sibling && like ? shape0.parent.get(like.id) : undefined
      const parent = parentId != null ? p.els.find((e) => e.id === parentId) : undefined
      if (!like || kind === 'root' || (sibling && !parent)) {
        // 고른 것 없이 「＋ 새 상자」 — 빈 자리에. **뿌리의 형제** 는 선 없는 또 하나의 뿌리(사용자 결정 2026-10-07) — 고른 상자 바로 아래(앞 형제면 위).
        // 둘 다 명단에 적어야 트리 쪽으로 남는다(선이 없으니 달리 알 길이 없다).
        const at = like && kind !== 'root' ? nextSpot(like, kind === 'before' ? 'up' : 'down', visible, { w: node.w, h: node.h })
          : freeSpot(visible, { w: node.w, h: node.h }, W, H)
        node.x = at.x; node.y = at.y
        const roots = [...known, id]
        return { ...p, els: [...p.els, node], treeRoots: roots, treeRoot: roots[0], treeDir: p.treeDir || 'LR' }
      }
      // 누구에게 붙이나 — 자식(right · down · up · left = ＋점의 변)은 고른 상자에, **형제는 그 부모에**(알마인드 · 3차 「엔터는 형제」).
      // 형제는 고른 상자가 부모의 어느 쪽에 있는지 따라 같은 열(줄)에 선다.
      const hub = sibling ? parent! : like
      const side: Side = sibling
        ? (like.x >= hub.x + hub.w ? 'right' : like.x + like.w <= hub.x ? 'left' : like.y >= hub.y + hub.h ? 'down' : 'up')
        : kind
      // **고른 상자 기준으로만 놓는다 — 다른 상자는 안 움직인다**(2026-10-07 2차 5·6번 · canvas/placeNext). 전에는 붙일 때마다 트리를
      // 다시 앉혔다(seatTree) — 사용자: 「도형을 어느 위치로 이동 후 다시 스페이스나 엔터를 누르면 재정렬됨. 그런 현상은 없도록」.
      const at = nextSpot(hub, side, visible, { w: node.w, h: node.h })
      node.x = at.x; node.y = at.y
      // 선은 부모에서 새 상자로 — 옆으로 붙였으면 가로 축, 아래 · 위로 붙였으면 세로 축에서 늘 나간다(connPath · 불편점 5번).
      // **형제는 고른 상자의 선 바로 뒤(앞 형제는 바로 앞)에 끼운다** — 줄 순서는 선 순서를 따른다(방향키 옮겨 가기 · 열 순서 · treeShape.kids).
      const nc: Conn = { from: hub.id, to: id, ...TREE_CONN, axis: side === 'right' || side === 'left' ? 'h' : 'v' }
      const at0 = sibling ? p.conns.findIndex((c) => c && c.to === like.id) : -1
      const cut = at0 < 0 ? p.conns.length : kind === 'before' ? at0 : at0 + 1
      const conns: Conn[] = [...p.conns.slice(0, cut), nc, ...p.conns.slice(cut)]
      // 선이 하나도 없던 상자에서 시작했으면 명단에 적는다 — 그래야 이 쪽이 트리 쪽으로 읽혀(isTreePage) 방향키 · 가지째 지우기 · 접기 키가 듣는다.
      const member = known.includes(hub.id) || shape0.members.includes(hub.id)
      const roots = member ? known : [...known, hub.id]
      // 명단이 비어 있으면(손으로 이은 쪽에서 처음 붙였다) 지금의 뿌리를 적는다 — 그래야 이 쪽이 트리 쪽으로 읽힌다.
      const marked = roots.length ? roots : treeShape([...p.els, node], conns, known).roots
      let els = [...p.els, node]
      // **같은 열의 자식들은 부모 가운데에**(2026-10-07 3차 · 사용자: 「자식 7개 정도까지는 가능한한 중간에 위치 … 지금은 축 쳐져서 밑으로 내려가는 느낌」),
      // **자손이 생기면 형제 사이가 그만큼 벌어진다**(4차 · tidyUp — 줄기의 열들을 위에서 아래로 다시 세운다).
      // 부모 옆 열(nextSpot 이 놓는 x)에 선 자식들(새 상자 포함)만 — 손으로 다른 데로 옮긴 자식은 안 건드린다. 형제는 고른 상자 **바로 뒤**(앞 형제는 바로 앞)에 끼운다.
      if (side === 'right' || side === 'left') {
        const shape2 = treeShape(els, conns, known)
        const byId = new Map(els.map((e) => [e.id, e]))
        const inCol = (k: FreeEl) => (side === 'right' ? Math.abs(k.x - (hub.x + hub.w + GAP_SIDE)) <= 1 : Math.abs(k.x + k.w - (hub.x - GAP_SIDE)) <= 1)
        const col = (shape2.kids.get(hub.id) || []).map((kid) => byId.get(kid)).filter((k): k is FreeEl => !!k && !k.hidden && inCol(k) && k.id !== id).sort((x, y) => x.y - y.y)
        const i = col.findIndex((k) => k.id === like.id)
        const order = kind === 'sibling' && i >= 0 ? [...col.slice(0, i + 1), node, ...col.slice(i + 1)]
          : kind === 'before' && i >= 0 ? [...col.slice(0, i), node, ...col.slice(i)]
          : [...col, node]
        els = tidyUp(els, shape2, hub, side, order)
      }
      return { ...p, els, conns, treeRoots: marked, treeRoot: marked[0] ?? p.treeRoot, treeDir: p.treeDir || 'LR' }
    }) }
  }),
  applyMermaid: (pageId, src) => {
    const g = parseMermaid(src)
    const none = { added: 0, removed: 0, changed: 0 }
    if (g.errors.length) return { errors: g.errors, ...none }
    const page0 = get().pages.find((p) => p.id === pageId)
    if (!page0) return { errors: [{ line: 0, text: '쪽이 없다' }], ...none }
    const before = graphOfPage(page0)
    const elOf = new Map<string, number>()
    membersOfPage(page0).forEach((e, i) => elOf.set('n' + (i + 1), e.id))
    const pageNow = () => get().pages.find((p) => p.id === pageId)!
    let added = 0, removed = 0, changed = 0
    // ① 원문에 없는 번호 — 그 상자 하나(와 흐린 상자 · 그 선)만 걷는다. 가지째가 아니다 — 자식은 원문이 정한 대로 남는다.
    const gone = new Set<number>()
    for (const [id, elId] of [...elOf]) if (!g.nodes[id]) { gone.add(elId); elOf.delete(id); removed++ }
    if (gone.size) set((s) => ({ pages: mapPage(s.pages, pageId, (p) => {
      for (const e of p.els) if (e.echoOf != null && gone.has(e.echoOf)) gone.add(e.id)
      const known = (p.treeRoots || []).filter((r) => !gone.has(r))
      return { ...p, els: p.els.filter((e) => !gone.has(e.id)), conns: p.conns.filter((c) => c && !gone.has(c.from) && !gone.has(c.to)), treeRoots: known, treeRoot: known[0] }
    }) }))
    // ② 새 번호 — 원문 순서대로. 들어오는 선의 from 이 아는 상자면 그 옆에(treeAdd = Space 와 같은 자리 · 닮기 · 열 다시 세우기), 아니면 빈 자리의 뿌리.
    const side = page0.treeDir === 'TD' ? 'down' : 'right'
    for (const id of g.order) {
      if (elOf.has(id)) continue
      const pe = g.edges.find((e) => e.to === id && e.from !== id && elOf.has(e.from))
      const had = new Set(pageNow().els.map((e) => e.id))
      get().treeAdd(pageId, pe ? elOf.get(pe.from)! : null, pe ? side : 'root')
      const made = pageNow().els.find((e) => !had.has(e.id) && e.echoOf == null)
      if (!made) continue
      elOf.set(id, made.id); added++
      get().updateEl(pageId, made.id, { text: g.nodes[id].label, ...typePatch(g.nodes[id].shape, made) })
    }
    // ③ 글 · 모양 — **뽑았던 것과 다를 때만**(괄호를 전각으로 바꿔 뽑으므로, 안 고친 상자의 반각 괄호가 전각으로 바뀌면 안 된다).
    for (const [id, elId] of elOf) {
      const n = g.nodes[id], b = before.nodes[id]; if (!n || !b) continue
      const el = pageNow().els.find((e) => e.id === elId); if (!el) continue
      const patch: Partial<FreeEl> = { ...(n.shape !== b.shape ? typePatch(n.shape, el) : {}) }
      if (n.label !== b.label) patch.text = n.label
      if (Object.keys(patch).length) { get().updateEl(pageId, elId, patch); changed++ }
    }
    // ④ 선 — 원문의 선은 있게(있던 선은 모양 그대로 · 새 선은 한 벌), 원문에 없는 선(두 끝이 다 그림 상자인 것)은 없게. 그림 밖 선(이미지 등)은 그대로.
    //    선 없는 상자(외톨이)는 명단에 적어 트리 쪽에 남긴다(treeShape 의 known).
    set((s) => ({ pages: mapPage(s.pages, pageId, (p) => {
      const org = new Map<number, number>(); for (const e of p.els) if (e.echoOf != null) org.set(e.id, e.echoOf)
      const ids = new Set(elOf.values())
      const want = new Set(g.edges.filter((e) => e.from !== e.to && elOf.has(e.from) && elOf.has(e.to)).map((e) => elOf.get(e.from) + '>' + elOf.get(e.to)))
      const have = new Set<string>()
      const conns = p.conns.filter((c) => {
        if (!c) return false
        const a = org.get(c.from) ?? c.from, b = org.get(c.to) ?? c.to
        if (!ids.has(a) || !ids.has(b)) return true
        const k = a + '>' + b
        if (!want.has(k) || have.has(k)) return false
        have.add(k); return true
      })
      const byId = new Map(p.els.map((e) => [e.id, e]))
      for (const k of want) {
        if (have.has(k)) continue
        const [a, b] = k.split('>').map(Number); const A = byId.get(a), B = byId.get(b); if (!A || !B) continue
        conns.push({ from: a, to: b, ...TREE_CONN, axis: B.x >= A.x + A.w || B.x + B.w <= A.x ? 'h' : 'v' })
      }
      const linked = new Set<number>(); for (const c of conns) { linked.add(org.get(c.from) ?? c.from); linked.add(org.get(c.to) ?? c.to) }
      const roots = [...(p.treeRoots || [])]
      for (const id of ids) if (!linked.has(id) && !roots.includes(id)) roots.push(id)
      const marked = roots.length ? roots : treeShape(p.els, conns, roots).roots
      return { ...p, conns, treeRoots: marked, treeRoot: marked[0] ?? p.treeRoot, treeDir: p.treeDir || 'LR' }
    }) }))
    return { errors: [], added, removed, changed }
  },
  treeRemove: (pageId, elId) => set((s) => {
    return { pages: mapPage(s.pages, pageId, (p) => {
      const known = p.treeRoots || (p.treeRoot != null ? [p.treeRoot] : [])
      const shape = treeShape(p.els, p.conns, known)
      const gone = new Set<number>()
      const walk = (id: number) => { if (gone.has(id)) return; gone.add(id); (shape.kids.get(id) || []).forEach(walk) }
      walk(elId)
      // 지워지는 상자를 아래 띠에 다시 놓은 것(echo)도 같이 걷는다 — 선이 그리로 걸려 있다.
      for (const e of p.els) if (e.echoOf != null && gone.has(e.echoOf)) gone.add(e.id)
      const els = p.els.filter((e) => !gone.has(e.id))
      const conns = p.conns.filter((c) => !gone.has(c.from) && !gone.has(c.to))
      const roots = known.filter((id) => !gone.has(id))
      // 다시 앉히지 않는다(2026-10-07 2차 6번 「재정렬 없음」) — 남은 상자는 제자리.
      return { ...p, els, conns, treeRoots: roots, treeRoot: roots[0] }
    }) }
  }),
  treeFold: (pageId, elId) => set((s) => {
    return { pages: mapPage(s.pages, pageId, (p) => {
      const known = p.treeRoots || (p.treeRoot != null ? [p.treeRoot] : [])
      const els = p.els.map((e) => (e.id === elId ? { ...e, folded: !e.folded } : e))
      // **자리는 안 옮긴다 — 접힘 표시와 숨김만 다시 쓴다**(2026-10-07 · 불편점 10번 · 2차 6번 「재정렬 없음」). 머메이드로 펼쳤든
      // 손으로 이었든 같다 — 다시 앉히면 손으로 놓은 자리(= 그림)가 망가진다.
      const shape = treeShape(els, p.conns, known)
      // 아래 띠의 흐린 상자(echo)는 제 원본을 따른다 — 원본이 숨거나 접히면 같이 숨는다(그 아래가 다 숨었는데 혼자 남으면 고아처럼 보인다).
      // 전에는 다시 앉히면서 echo 를 새로 만들어 이 일이 저절로 됐다.
      const byId = new Map(els.map((e) => [e.id, e]))
      const hid = (e: FreeEl) => {
        if (e.echoOf == null) return shape.hidden.has(e.id)
        const o = byId.get(e.echoOf)
        return !o || shape.hidden.has(o.id) || !!o.folded
      }
      return { ...p, els: els.map((e) => (!!e.hidden === hid(e) ? e : { ...e, hidden: hid(e) || undefined })) }
    }) }
  }),
  updateConn: (pageId, index, bend) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, conns: p.conns.map((c, i) => (i === index ? { ...c, bend } : c)) })) })),
  patchConn: (pageId, index, patch) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, conns: p.conns.map((c, i) => (i === index ? { ...c, ...patch } : c)) })) })),
  removeConn: (pageId, index) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, conns: p.conns.filter((_, i) => i !== index) })) })),
  setBlocks: (pageId, blocks) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, blocks })) })),
  setElBlocks: (pageId, elId, blocks) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, els: p.els.map((e) => (e.id === elId ? { ...e, blocks } : e)) })) })),
  moveEls: (pageId, moves) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, els: p.els.map((e) => { const m = moves.find((x) => x.id === e.id); return m ? { ...e, x: m.x, y: m.y } : e }) })) })),
  updateEls: (pageId, ids, patch) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, els: p.els.map((e) => (ids.includes(e.id) ? { ...e, ...patch } : e)) })) })),
  transformEls: (pageId, items) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, els: p.els.map((e) => { const m = items.find((x) => x.id === e.id); if (!m) return e; const patch: Partial<FreeEl> = {}; if (m.x != null) patch.x = m.x; if (m.y != null) patch.y = m.y; if (m.w != null) patch.w = m.w; if (m.h != null) patch.h = m.h; if (m.rot != null) patch.rot = m.rot; return { ...e, ...patch } }) })) })),
  // 카드 항목을 그 자리 그대로 자유 텍스트 객체로 떼어낸다(템플릿에선 그 칸을 숨김).
  detachField: (pageId, key, box) => {
    const id = nextElId()
    const el: FreeEl = { id, type: 'text', x: box.x, y: box.y, w: box.w, h: box.h, text: box.text, color: 'transparent', fs: box.fs, tcolor: box.tcolor, bold: box.bold, align: box.align }
    set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, els: [...p.els, el], detached: [...(p.detached || []), key] })) }))
    return id
  },
  // 스타일 박스(플로우 단계·dsection 카드·스티키 등)를 배경·테두리째 통째로 떼어낸다.
  detachBox: (pageId, key, box) => {
    const id = nextElId()
    const el: FreeEl = { id, type: 'box', x: box.x, y: box.y, w: box.w, h: box.h, text: box.text, color: box.fill && box.fill !== 'transparent' ? box.fill : 'transparent', fs: box.fs, tcolor: box.tcolor, bold: box.bold, align: box.align, borderColor: box.borderColor, borderWidth: box.borderWidth }
    set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, els: [...p.els, el], detached: [...(p.detached || []), key] })) }))
    return id
  },
  groupEls: (pageId, ids) => set((s) => { const gid = nextElId(); return { pages: mapPage(s.pages, pageId, (p) => ({ ...p, els: p.els.map((e) => (ids.includes(e.id) ? { ...e, groupId: gid } : e)) })) } }),
  ungroupEls: (pageId, ids) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, els: p.els.map((e) => (ids.includes(e.id) ? { ...e, groupId: undefined } : e)) })) })),
  setPageBg: (pageId, bg) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, bg })) })),
  setPaper: (pageId, paper) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, paper })) })),
  setPageTrans: (pageId, trans) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, trans })) })),
  importDoc: (doc) => set(() => {
    const mk = (cardKey: string, fields: Record<string, string>, extra: Partial<Page> = {}): Page =>
      ({ id: uid++, cardKey, fields, free: false, els: [], conns: [], strokes: [], ...extra })
    const pages: Page[] = [
      mk('cover', { title: doc.cover.title, sub: doc.cover.sub }),
      mk('toc', {}),
    ]
    for (const s of doc.sections) {
      const blocks: Block[] = [{ ...newBlock('h1', s.title), bold: true }]
      for (const b of s.blocks) { const nb = newBlock(b.type, b.text); if (b.tone) nb.tone = b.tone; blocks.push(nb) }
      pages.push(mk('note', { title: s.title }, { blocks, bg: '', contd: s.contd }))
    }
    return { pages, selectedPageId: pages[0] ? pages[0].id : null, title: doc.title || '가져온 이북' }
  }),
  // 변환한 덱 슬라이드(이미지 URL)를 각각 한 페이지로 캔버스에 채운다.
  importDeckSlides: (urls, title) => set(() => {
    const pages: Page[] = urls.map((u) => ({
      id: uid++, cardKey: 'deckslide', fields: { img: u },
      free: false, els: [], conns: [], strokes: [],
    }))
    return { pages, selectedPageId: pages[0] ? pages[0].id : null, title: title || '가져온 덱' }
  }),
  // 덱 IR을 편집 가능한 요소로 변환해 만든 페이지들을 로드(구글 슬라이드식 편집).
  importPages: (pgs, title) => set((s) => {
    const pages = pgs.map((p) => ({ ...p, id: uid++ }))
    return { pages, selectedPageId: pages[0] ? pages[0].id : null, title: title || s.title }
  }),
  // (G4) 서버 planner 의 BookPlan 을 실제 카드로 변환해 전체 교체(빈 이북에서 한 번에 초안 완성).
  applyPlan: (plan) => set((s) => {
    const valid = (plan.pages || []).filter((sp) => sp && isPlannablePage(sp.cardKey))
    const pages: Page[] = valid.map(buildPlanPage)
    return {
      pages,
      selectedPageId: pages.length ? pages[0].id : null,
      title: plan.title || s.title,
      orientation: plan.orientation || s.orientation,
      theme: plan.theme || s.theme,
    }
  }),
  // (G5) 부분 수정: 대상 페이지의 '주어진 필드 키'만 덮어쓰고(나머지 값·다른 페이지는 그대로), adds 는 끝에 추가.
  // diff 기반 — 되돌리기(undo)로 안전망. edits 는 존재하는 페이지에만 적용(환각 pageId 무시).
  applyPageEdits: (edits, adds) => set((s) => {
    let pages = s.pages
    if (edits && edits.length) {
      const byId = new Map(edits.map((e) => [e.pageId, e.fields || {}]))
      pages = pages.map((p) => (byId.has(p.id) ? { ...p, fields: { ...p.fields, ...byId.get(p.id) } } : p))
    }
    let sel = s.selectedPageId
    if (adds && adds.length) {
      const newPages = adds.filter((a) => a && isPlannablePage(a.cardKey)).map(buildPlanPage)
      if (newPages.length) {
        pages = [...pages, ...newPages]
        sel = newPages[0].id  // 추가한 첫 장으로 이동(결과를 바로 확인)
      }
    }
    return { pages, selectedPageId: sel }
  }),
  polishAll: () => set((s) => ({
    pages: s.pages.map((p) => ({
      ...p,
      fields: Object.fromEntries(Object.entries(p.fields).map(([k, v]) => [k, polish(v)])),
      blocks: p.blocks ? p.blocks.map((b) => ({ ...b, text: polish(b.text) })) : p.blocks,
    })),
  })),
  setCard: (pageId, cardKey, fields) => set((s) => ({
    pages: mapPage(s.pages, pageId, (p) => ({ ...p, cardKey, fields: { ...p.fields, ...fields } })),
  })),
  // (B) 본문(note) 페이지들을 LLM으로 요약해 EVER-PEAK식 카드로 치환. 실패 섹션은 원문 유지(폴백).
  summarizeNotes: async () => {
    const st = get()
    const targets = st.pages.filter((p) => {
      const c = cardByKey(p.cardKey)
      return !(c && c.kind) && !!(p.blocks && p.blocks.length)
    })
    if (!targets.length) return { ok: false, error: '요약할 본문 페이지가 없어요(먼저 HTML을 가져오세요).' }
    const sections = targets.map((p) => ({
      title: p.fields.title || '',
      text: (p.blocks || []).map((b) => b.text).filter(Boolean).join('\n'),
    }))
    let data: { ok?: boolean; error?: string; results?: Array<{ headline?: string; bullets?: string[] }> }
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections }),
      })
      data = await res.json()
    } catch {
      return { ok: false, error: '서버(/api/summarize) 연결 실패 — 서버가 떠 있는지 확인하세요.' }
    }
    if (!data || !data.ok || !data.results) return { ok: false, error: data?.error || '요약 실패' }
    const results = data.results
    let applied = 0
    set((s) => ({
      pages: s.pages.map((p) => {
        const idx = targets.findIndex((t) => t.id === p.id)
        if (idx < 0) return p
        const r = results[idx]
        if (!r || !r.bullets || !r.bullets.length) return p   // 실패 섹션 → 원문(A) 유지
        applied++
        const headline = r.headline || p.fields.title || '요약'
        const blocks: Block[] = [{ ...newBlock('h1', headline), bold: true }]
        r.bullets.forEach((b) => blocks.push(newBlock('bullet', b)))
        return { ...p, blocks, fields: { ...p.fields, title: headline } }
      }),
    }))
    return applied ? { ok: true, count: applied } : { ok: false, error: 'LLM 응답을 받지 못했어요(연결·모델 설정 확인).' }
  },
}))
