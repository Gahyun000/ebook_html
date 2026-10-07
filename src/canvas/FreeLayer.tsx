import type React from 'react'
import { Fragment, useState, useEffect, useMemo, useRef } from 'react'
import { flushSync } from 'react-dom'
import { selectWordOrCaretAtPoint } from '../lib/wordSelect'
import { isComposingKey } from '../lib/ime'
import { intakeImage } from '../builder/imageIntake'
import type { CSSProperties } from 'react'
import type { Page, FreeEl } from '../state/store'
import { useBuilder } from '../state/store'
import { useCanvasUI } from '../state/canvasUI'
import type { Tool } from '../state/canvasUI'
import { mkFreeEl, pushSnap, NO_CPT } from './model'
import { edgePoint, connPath } from './connPath'
import type { Pt } from './connPath'
import { CLIPPED, SHAPE_RADIUS, dashArray, polyClip, polyPoints } from './shapePaths'
import { overlayOpen } from '../ui/overlay'
import NoteBlocks from '../builder/NoteBlocks'
import { bandRange, coveredSet, dragTrack, growToMerges, mergeCovering, sizeTracks, trackSizes } from './tableOps'
import { cellBackground, cellTextColor } from './cellColor'
import { treeShape, descendantCount, knownOf, isTreePage, TREE_CONN } from '../cards/treeOps'
import { mindKey, navTarget } from '../builder/mindKeys'
import { addNext } from '../builder/mindActions'

interface Props { page: Page; W: number; H: number; SC: number; interactive: boolean }
const ADDABLE = ['box', 'round', 'ellipse', 'diamond', 'triangle', 'hexagon', 'pentagon', 'parallelogram', 'chevron', 'arrowR', 'arrowL', 'arrowU', 'arrowD', 'star5', 'star4', 'banner', 'callout', 'text', 'sticky', 'image', 'icon', 'table', 'wordart', 'note']
/** ＋점의 변 → 붙이는 쪽(placeNext.Side). 오른쪽 점 = Space 와 같고, 아래 점 = Enter 와 같다. */
const SIDE = { r: 'right', b: 'down', t: 'up', l: 'left' } as const
// 도구별 커서 — 펜=펜촉, 형광펜=마커(핫스팟은 팁), 지우개=크기 반영 원형(핫스팟 중앙).
const PEN_SVG = "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='#2462eb' stroke='#ffffff' stroke-width='1.3' stroke-linejoin='round'><path d='M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z'/></svg>"
const HL_SVG = "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='#8a6d00' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='m9 11-6 6v3h9l3-3'/><path d='m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4Z' fill='#ffd600'/></svg>"
const PEN_CUR = 'url("data:image/svg+xml,' + encodeURIComponent(PEN_SVG) + '") 3 20, crosshair'
const HL_CUR = 'url("data:image/svg+xml,' + encodeURIComponent(HL_SVG) + '") 3 20, crosshair'
function eraserCur(w: number): string {
  const d = Math.max(8, Math.round(w)); const s = d + 4; const h = Math.round(s / 2)
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='" + s + "' height='" + s + "'><circle cx='" + h + "' cy='" + h + "' r='" + (d / 2) + "' fill='rgba(120,124,134,0.18)' stroke='#555' stroke-width='1.5'/></svg>"
  return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '") ' + h + ' ' + h + ', crosshair'
}
// 연결선의 길(edgePoint · connPath)은 ./connPath 로 옮겼다(2026-10-07) — 순수 함수라 노드에서 검사한다(conn_axis.test.mjs).

// ③ 스마트 스냅: 모서리·중심·캔버스중앙 정렬 + 두 이웃 사이 등간격. 가이드 좌표(v/h)도 반환.
function computeSnap(w: number, h: number, rawX: number, rawY: number, others: FreeEl[], CW: number, CH: number) {
  const TH = 6
  let nx = rawX, ny = rawY
  const xsC = [CW / 2]; const ysC = [CH / 2]
  for (const o of others) { xsC.push(o.x, o.x + o.w / 2, o.x + o.w); ysC.push(o.y, o.y + o.h / 2, o.y + o.h) }
  const offX = [0, w / 2, w], offY = [0, h / 2, h]
  let bestX = 0, gotX = false
  for (const off of offX) for (const c of xsC) { const d = c - (nx + off); if (Math.abs(d) <= TH && (!gotX || Math.abs(d) < Math.abs(bestX))) { bestX = d; gotX = true } }
  if (gotX) nx += bestX
  let bestY = 0, gotY = false
  for (const off of offY) for (const c of ysC) { const d = c - (ny + off); if (Math.abs(d) <= TH && (!gotY || Math.abs(d) < Math.abs(bestY))) { bestY = d; gotY = true } }
  if (gotY) ny += bestY
  // 등간격: 정렬 스냅이 없던 축에서만, 같은 행/열의 두 이웃 사이 gap 동일하면 가운데로.
  if (!gotX) {
    let L: FreeEl | null = null, R: FreeEl | null = null
    for (const o of others) { if (!(ny < o.y + o.h && ny + h > o.y)) continue; if (o.x + o.w <= nx) { if (!L || o.x + o.w > L.x + L.w) L = o } else if (o.x >= nx + w) { if (!R || o.x < R.x) R = o } }
    if (L && R) { const gapL = nx - (L.x + L.w), gapR = R.x - (nx + w); if (Math.abs(gapL - gapR) <= TH) nx += (gapR - gapL) / 2 }
  }
  if (!gotY) {
    let T: FreeEl | null = null, B: FreeEl | null = null
    for (const o of others) { if (!(nx < o.x + o.w && nx + w > o.x)) continue; if (o.y + o.h <= ny) { if (!T || o.y + o.h > T.y + T.h) T = o } else if (o.y >= ny + h) { if (!B || o.y < B.y) B = o } }
    if (T && B) { const gT = ny - (T.y + T.h), gB = B.y - (ny + h); if (Math.abs(gT - gB) <= TH) ny += (gB - gT) / 2 }
  }
  const gv: number[] = [], gh: number[] = []
  for (const off of offX) for (const c of xsC) if (Math.abs(c - (nx + off)) < 0.5 && !gv.includes(c)) gv.push(c)
  for (const off of offY) for (const c of ysC) if (Math.abs(c - (ny + off)) < 0.5 && !gh.includes(c)) gh.push(c)
  return { x: nx, y: ny, v: gv, h: gh }
}

/**
 * 되돌리기가 기억하는 **한 쪽의 모습**(EVER-SKETCH1 e6bc1d2). 한 글로 만들어 두면
 * 「고친 게 있나」를 글자끼리 견주기만 하면 된다.
 */
function snapOf(pg: Page): string {
  return JSON.stringify({ els: pg.els, conns: pg.conns, strokes: pg.strokes, detached: pg.detached })
}

export default function FreeLayer({ page, W, H, interactive }: Props) {
  // ── 접기는 **편집 화면에서만** 듣는다 (EVER-SKETCH1 c7effe6 · 원본 사용자 결정) ──────
  //
  // `hidden` 은 문서에 그대로 들어 있다. 여기서만 안 그린다.
  // 미리보기·발표·내보내기(ExportLayer · exportPptx)는 `interactive={false}` 라
  // **저절로 다 펴진다.** 작성자가 접어 둔 걸 잊어도 보는 사람이 덜 보는 일이 없다 —
  // 원본에서는 「승인본이 작업본보다 적으면 안 된다」가 이 규칙의 이유였다(결재자가 덜 보는 일이 없다).
  //
  // 처음엔 「보이는 대로 내보내기」를 제안했다가 사용자가 「트리를 만든 데는 이유가
  // 있는데 왜 접어서 나가나」라고 물어 뒤집었다.
  const hiddenIds = new Set<number>()
  if (interactive) for (const e of page.els) if (e && e.hidden) hiddenIds.add(e.id)
  const shownEls = hiddenIds.size ? page.els.filter((e) => !hiddenIds.has(e.id)) : page.els
  const shownConn = (c: { from: number; to: number }) => !hiddenIds.has(c.from) && !hiddenIds.has(c.to)
  const treeFold = useBuilder((st) => st.treeFold)
  /**
   * **트리 모양은 interactive 와 무관하게 읽는다**(2026-10-07 · 불편점 5번). 부모→자식 선의 축(axisOf)이 여기서 나오는데,
   * 내보내기(interactive=false)에서 다르게 그리면 이북 PNG 의 선이 편집 화면과 달라진다. 호버 때마다 다시 그리므로 memo.
   */
  const tshapeAll = useMemo(
    () => (page.mindmapCenter == null && isTreePage(page) ? treeShape(page.els, page.conns, knownOf(page)) : null),
    [page.els, page.conns, page.treeRoots, page.treeRoot, page.mindmapCenter])
  const tshape = interactive ? tshapeAll : null
  /** 트리 부모→자식 선이면 성장 방향의 축 — 자식이 여럿 쌓여도 **늘 같은 변**에서 나간다(connPath). echo 는 원본으로 되돌려 본다. */
  const axisOf = (c: { from: number; to: number; axis?: 'h' | 'v' }): 'h' | 'v' | undefined => {
    if (c.axis) return c.axis                       // 붙일 때 적어 둔 변(2026-10-07 2차) — 재정렬이 없어도 늘 같은 변에서 나간다
    if (!tshapeAll) return undefined
    const org = (id: number) => { const e = page.els.find((x) => x.id === id); return e && e.echoOf != null ? e.echoOf : id }
    return tshapeAll.parent.get(org(c.to)) === org(c.from) ? (page.treeDir === 'TD' ? 'v' : 'h') : undefined
  }
  /**
   * **선으로 이어진 그림의 모양**(2026-10-07) — 접기 손잡이(불편점 10번)와 글칸의 Enter · 가지 키(2차 4번 「머메이드와 도형은 별개가 아님」)가 본다.
   * 머메이드로 펼쳤든 키 · ＋점 · 「→ 연결」 로 이었든 같다. 마인드맵(방사형) 쪽은 제외.
   */
  const graphShape = interactive && page.mindmapCenter == null
    ? (tshapeAll ?? (page.conns.length ? treeShape(page.els, page.conns, knownOf(page)) : null)) : null

  const tool = useCanvasUI((s) => s.tool)
  /**
   * **지금 무언가를 놓는 중인가**(도형·글상자·표·아이콘… · EVER-SKETCH1 46f155c).
   *
   * 원본 사용자 지적: 「텍스트 상자랑 맞물리면 도형이 생성이 안 돼. 사용자 입장에선 왜 안 되지?」
   * 빈 곳을 누르면 그려지는데 **기존 요소 위를 누르면 아무 일도 안 일어났다.** 커서는 십자 그대로고,
   * 엉뚱하게 그 요소가 골라진다. **막을 까닭이 없다** — 파워포인트도 키노트도 도형 도구를 든 채로는
   * 기존 개체 위에 그냥 그려진다.
   *
   * 그래서 이 값을 **세 자리가 같이 본다**(레이어 · 요소 · 표 칸). 한 곳만 고치면
   * 「글상자 위에는 되는데 표 위에는 안 되는」 식으로 갈라진다.
   * 연결선·펜·형광펜·지우개는 요소 위 클릭이 **뜻이 있으므로** 여기 안 넣는다.
   */
  const adding = ADDABLE.indexOf(tool) >= 0
  const setTool = useCanvasUI((s) => s.setTool)
  const selEl = useCanvasUI((s) => s.selEl)
  const selEls = useCanvasUI((s) => s.selEls)
  const setSel = useCanvasUI((s) => s.setSel)
  const setReveal = useCanvasUI((s) => s.setReveal)
  const toggleSel = useCanvasUI((s) => s.toggleSel)
  const setSelMany = useCanvasUI((s) => s.setSelMany)
  const connSrc = useCanvasUI((s) => s.connSrc)
  const setConnSrc = useCanvasUI((s) => s.setConnSrc)
  const selConn = useCanvasUI((s) => s.selConn)
  const setSelConn = useCanvasUI((s) => s.setSelConn)
  const tableSel = useCanvasUI((s) => s.tableSel)
  const setTableSel = useCanvasUI((s) => s.setTableSel)
  const lastColor = useCanvasUI((s) => s.lastColor)
  const penWidth = useCanvasUI((s) => s.penWidth)
  const penColor = useCanvasUI((s) => s.penColor)
  const hlColor = useCanvasUI((s) => s.hlColor)
  const hlWidth = useCanvasUI((s) => s.hlWidth)
  const eraserWidth = useCanvasUI((s) => s.eraserWidth)
  const spell = useCanvasUI((s) => s.spell)
  const addEl = useBuilder((s) => s.addEl)
  const updateEl = useBuilder((s) => s.updateEl)
  const setElBlocks = useBuilder((s) => s.setElBlocks)
  const moveEls = useBuilder((s) => s.moveEls)
  const transformEls = useBuilder((s) => s.transformEls)
  const addConn = useBuilder((s) => s.addConn)
  const addStroke = useBuilder((s) => s.addStroke)
  const updateConn = useBuilder((s) => s.updateConn)
  const patchConn = useBuilder((s) => s.patchConn)
  const removeConn = useBuilder((s) => s.removeConn)
  const setCanvas = useBuilder((s) => s.setCanvas)

  const [editing, setEditing] = useState<number | null>(null)
  // 편집 중인 노드와 "지금 값을 스토어에 반영하는 함수"를 들고 있는다.
  // 텍스트 저장은 onBlur 하나뿐인데, Esc·빈 곳 클릭은 setEditing(null) 로 요소를 먼저 언마운트해
  // onBlur 가 아예 안 붙은 상태로 사라진다 → 방금 친 글자가 통째로 유실된다.
  // 그래서 편집을 끝내는 모든 경로가 endEditing() 을 거치게 하고, 거기서 먼저 커밋한다.
  const editRef = useRef<{ id: number; node: HTMLElement; commit: () => void } | null>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  /**
   * **칸에 들어가기 직전의 모습**(EVER-SKETCH1 e6bc1d2). 나올 때 **달라졌으면** 되돌리기에 넣는다.
   *
   * 도형을 옮기거나 색을 칠할 때는 되돌릴 자리를 찍는데(`snap()`), 칸 글자에는 아무것도 안
   * 찍고 있었다. 그래서 칸을 고치고 나온 뒤 ⌘Z 를 눌러도 아무 일도 안 일어났다.
   * 들어갈 때 바로 찍지 않고 **나올 때 견주는** 까닭: 들어갔다 그냥 나온 것까지 세면
   * ⌘Z 를 눌러도 화면이 안 바뀌는 헛걸음이 쌓인다.
   */
  const editSnapRef = useRef<string | null>(null)
  function commitEditing() {
    const cur = editRef.current
    if (!cur) return
    editRef.current = null
    const before = editSnapRef.current
    editSnapRef.current = null
    cur.commit()
    if (before == null) return
    // 스토어가 방금 바뀌었으므로 **지금 값**을 다시 읽는다 — 이 함수가 들고 있는 `page` 는 옛것이다.
    const now = useBuilder.getState().pages.find((p) => p.id === page.id)
    if (now && snapOf(now) !== before) pushSnap(page.id, before)
  }
  // 글을 끝내도 고른 것은 그 상자다(알마인드 · 3차) — 이어서 Enter 면 그 상자의 형제, Space 면 자식. (2차의 「허브로 돌아오기」 는 뺐다.)
  function endEditing() { commitEditing(); setEditing(null) }
  // 더블클릭한 화면 좌표. 편집을 켠 뒤 그 자리에 커서를 놓는 데 쓴다 —
  // contentEditable 은 다음 렌더에야 켜지므로 브라우저가 놓아 준 커서는 남지 않는다.
  const editAtRef = useRef<{ x: number; y: number } | null>(null)
  function startEditing(id: number, at?: { x: number; y: number }) {
    if (editRef.current && editRef.current.id !== id) commitEditing()
    if (editSnapRef.current == null) editSnapRef.current = snapOf(page)
    editAtRef.current = at || null
    setEditing(id)
  }
  // **캔버스 밖에서 온 편집 부탁**(2026-10-06 · 단축키로 가지를 붙였을 때). 편집 상태가 여기 안에 있어
  // 밖에서는 직접 못 연다. 한 번 받고 비운다.
  const editReq = useCanvasUI((s) => s.editReq)
  const requestEdit = useCanvasUI((s) => s.requestEdit)
  // **방금 키로 붙여 연 글칸 — 아직 아무것도 안 쳤다**(2026-10-07). 이 동안은 Space · Enter · 방향키가 글이 아니라
  // 가지 키로 듣는다(알마인드). 그래야 빈 곳을 누르고 도형을 다시 고르지 않고도 이어 붙인다. 글이 들어오면 푼다.
  const pristineRef = useRef<number | null>(null)
  useEffect(() => {
    if (!interactive || editReq == null) return
    if (page.els.some((e) => e.id === editReq)) { startEditing(editReq); pristineRef.current = editReq }
    requestEdit(null)
  }, [editReq])
  const [penPts, setPenPts] = useState<[number, number][] | null>(null)
  const [mouse, setMouse] = useState<Pt | null>(null)
  const [bending, setBending] = useState<Pt | null>(null)
  const [nodeDrag, setNodeDrag] = useState<{ fromId: number; x: number; y: number } | null>(null)
  const [guides, setGuides] = useState<{ v: number[]; h: number[] } | null>(null)
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [hoverId, setHoverId] = useState<number | null>(null)
  const connKeyRef = useRef<{ selConn: number | null; editing: number | null; pageId: number }>({ selConn: null, editing: null, pageId: page.id })
  connKeyRef.current = { selConn, editing, pageId: page.id }
  useEffect(() => {
    if (!interactive) return
    const onKey = (e: KeyboardEvent) => {
      // **위가 덮여 있으면 아래는 키를 안 건드린다**(EVER-SKETCH1 bab224b · ui/overlay 참고).
      if (overlayOpen()) return
      if (e.key === 'Escape') {
        // **글을 고치는 중이면 편집만 끝내고 상자는 고른 채 둔다**(2026-10-07 · EverSketch 불편점 1번). 전에는 선택까지 풀려서
        // 「도형을 만든 직후 빠져나오려면 다른 곳을 눌러야」 했다. 한 번 더 누르면 아래 줄(선택 해제 · 도구 취소)로 간다.
        // 한글 조합을 끊는 Esc 는 입력기 몫이다(lib/ime 와 같은 판정 — 창에 직접 단 리스너라 네이티브 값을 본다).
        const ed = connKeyRef.current.editing; if (ed != null) { if (e.isComposing) return; pristineRef.current = null; endEditing(); setSel(ed); return }
        setSel(null); setConnSrc(null); setSelConn(null); endEditing(); setMarquee(null); setTool('select'); return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const st = connKeyRef.current
        if (st.selConn == null || st.editing != null) return
        const t = e.target as HTMLElement | null
        if (t && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
        e.preventDefault()
        pushSnap(st.pageId, JSON.stringify({ els: page.els, conns: page.conns, strokes: page.strokes, detached: page.detached }))
        removeConn(st.pageId, st.selConn); setSelConn(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [interactive, setSel, setConnSrc, setTool, setSelConn, removeConn, page])

  // 메뉴 '삽입 → 이미지' 는 파워포인트처럼 곧바로 파일창이 떠야 한다.
  // 도구만 켜두면 "캔버스를 한 번 더 클릭해야 한다"는 걸 모르는 사람이 아무 반응 없다고 느낀다.
  useEffect(() => {
    if (!interactive) return
    const onInsert = () => {
      const el = mkFreeEl('image', Math.round(W / 2) - 130, Math.round(H / 2) - 90)
      addEl(page.id, el)
      setSel(el.id)
      setTool('select')
      pickImage(el, true)
    }
    window.addEventListener('ebook:insert-image', onInsert)
    return () => window.removeEventListener('ebook:insert-image', onInsert)
  })

  /**
   * **고르면 무장 → 빈 곳을 찍으면 그 자리에**(2026-10-07 · EverSketch 불편점 6번 · 사용자 결정: 텍스트·표·글맵시까지 전부).
   *
   * 지난 결정(EVER-SKETCH1 e4dfbfd 도형 · 90e7439 글상자·표·글맵시)은 「고르면 곧바로 한가운데에 놓는다」 였다 — 「도구만 켜두면
   * 한 번 더 클릭해야 하는 걸 모르는 사람이 아무 반응 없다고 느낀다」 는 까닭이었다. 사용자가 뒤집었다: 「메뉴바에서 도형을 클릭하면
   * 바로 도형이 생겨버림 → 도형을 클릭 후 마우스로 사용자가 화면에 찍으면 그 곳에 생기도록」. 그 걱정은 **안내 띠**(conn-hint)가 맡는다.
   *
   * **놓는 규칙은 여전히 한 곳**(onLayerDown · 찍은 점이 상자 가운데) — 도구줄·메뉴는 그대로 이 이벤트를 쏘고, 무장은 여기서 한다.
   * 단축키(r·o·d·t)와 같은 길이다. 되돌리기(snap)도 그 한 곳에서 남는다.
   */
  useEffect(() => {
    if (!interactive) return
    const onPlace = (ev: Event) => {
      const type = (ev as CustomEvent<{ type?: string }>).detail?.type
      // 모르는 이름이 오면 **아무 일도 하지 않는다.** mkFreeEl 은 모르는 갈래를
      // 조용히 네모(DEFS.box)로 바꾸므로, 안 막으면 오타가 네모로 둔갑해서 나온다.
      if (!type || ADDABLE.indexOf(type) < 0) return
      // 무장만 한다 — 같은 것을 또 고르면 내려놓는다. 놓는 일은 onLayerDown(빈 곳을 찍은 자리)이 한다.
      const cur = useCanvasUI.getState().tool; setTool(cur === type ? 'select' : type as Tool)
    }
    window.addEventListener('ebook:place', onPlace)
    return () => window.removeEventListener('ebook:place', onPlace)
  })

  // 작업면(종이 밖)에서 시작한 끌어 고르기 — Preview 가 화면 좌표를 넘긴다(2026-10-07 · 불편점 4번).
  useEffect(() => {
    if (!interactive) return
    const onMarquee = (ev: Event) => {
      const d = (ev as CustomEvent<{ x: number; y: number }>).detail
      if (!d || useCanvasUI.getState().tool !== 'select') return
      beginMarquee(d.x, d.y)
    }
    window.addEventListener('ebook:marquee', onMarquee)
    return () => window.removeEventListener('ebook:marquee', onMarquee)
  })

  // 도구줄의 「이 도형에서 연결」(2026-10-07 2차 3번 — 떠 있던 서식 막대를 도구줄로 옮겼다). 고른 도형에서 연결 모드를 시작한다.
  useEffect(() => {
    if (!interactive) return
    const onFrom = () => { const id = useCanvasUI.getState().selEl; if (id != null && page.els.some((e) => e.id === id)) startConnectFrom(id) }
    window.addEventListener('ebook:connect-from', onFrom)
    return () => window.removeEventListener('ebook:connect-from', onFrom)
  })

  // 편집 중일 때, 편집 중인 요소 "밖"을 누르면 값을 저장하고 편집을 끝낸다.
  // 카드 페이지는 레이어가 pointer-events:none 이라 onLayerDown 이 안 오므로 여기서 받는다.
  useEffect(() => {
    if (!interactive) return
    const onDown = (e: PointerEvent) => {
      const cur = editRef.current
      if (cur == null) return
      const t = e.target as Node | null
      if (!t) return
      const host = cur.node.closest('.fel')
      if (host && host.contains(t)) return          // 편집 중인 요소 안 → 그대로
      const page = layerRef.current?.parentElement
      if (!page || !page.contains(t)) return        // 툴바·패널 클릭은 native blur 가 처리
      endEditing()
    }
    window.addEventListener('pointerdown', onDown, true)
    return () => window.removeEventListener('pointerdown', onDown, true)
  }, [interactive])
  const active = interactive

  // 종이는 Preview 가 CSS transform 으로 배율을 곱해 그린다(맞춤·사람이 정한 배율).
  // 그때 마우스가 지나간 **화면 픽셀은 페이지 좌표와 다르다.** 배율로 나누지 않으면
  // 드래그·크기조절·회전이 전부 커서와 어긋난다(EVER-SKETCH1 b721df0 zoomOf).
  // rect.width 는 이미 배율이 반영된 값이라 논리 폭 W 로 나누면 그게 곧 현재 배율이다.
  const zoomOf = (r: { width: number }) => (r.width > 0 ? r.width / W : 1)
  const layerZoom = (from: Element) => {
    const n = from.closest('.freelayer') as HTMLElement | null
    return n ? zoomOf(n.getBoundingClientRect()) : 1
  }
  const markerId = 'fah' + page.id
  const markerStartId = 'fas' + page.id

  function snap() { pushSnap(page.id, snapOf(page)) }

  /**
   * 칸 범위를 잡는다. **병합 칸에 닿으면 그 칸 전체를 품도록 넓힌다**(tableOps.growToMerges · EVER-SKETCH1 e38d357).
   *
   * 사람이 고른 범위는 **모두 이 문으로 들어온다** — 끌기·클릭·Shift 클릭·방향키·Tab·Enter.
   * 한 군데라도 `setTableSel` 을 직접 부르면 거기서만 옛 결함(병합에 닿으면 범위가 줄어듦)이 산다.
   */
  function pickRange(el: FreeEl, r0: number, c0: number, r1: number, c1: number) {
    const g = growToMerges(el.merges, r0, c0, r1, c1)
    setTableSel({ elId: el.id, r0: g.r0, c0: g.c0, r1: g.r1, c1: g.c1 })
  }

  /**
   * 머리 띠를 눌러 **줄·열을 통째로** 고른다(EVER-SKETCH1 e38d357).
   * **`growToMerges` 를 쓰지 않는다** — 넓히면 양옆의 2행 병합이 딸려 와 그 줄만 고를 수 없다.
   */
  function pickBand(el: FreeEl, axis: 'row' | 'col', i: number) {
    const r = bandRange(el, axis, i)
    if (!r) return
    setTableSel({ elId: el.id, r0: r.r0, c0: r.c0, r1: r.r1, c1: r.c1 })
  }

  /** 머리 띠를 **끌면** 여러 줄이 이어서 골라진다. 두 띠의 범위를 합친다. */
  function startBandDrag(el: FreeEl, axis: 'row' | 'col', i0: number, from: Element) {
    pickBand(el, axis, i0)
    const layer = from.closest('.freelayer')
    let last = i0
    const move = (ev: PointerEvent) => {
      const node = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
      const band = node ? (node.closest('[data-band]') as HTMLElement | null) : null
      if (!band || band.dataset.band !== axis || band.dataset.bel !== String(el.id)) return
      if (!layer || !layer.contains(band)) return
      const i = Number(band.dataset.bi)
      if (!Number.isFinite(i) || i === last) return
      last = i
      const a = bandRange(el, axis, i0), b = bandRange(el, axis, i)
      if (!a || !b) return
      setTableSel({ elId: el.id,
        r0: Math.min(a.r0, b.r0), c0: Math.min(a.c0, b.c0),
        r1: Math.max(a.r1, b.r1), c1: Math.max(a.c1, b.c1) })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // ── 표 셀 키보드 조작 ──────────────────────────────────────────────
  // 칸을 고른 상태에서 바로 글자를 치면 그 칸이 갈아끼워지고, Tab·방향키로 칸을 옮긴다.
  function focusCell(elId: number, r: number, c: number, mode: 'all' | 'end') {
    const n = layerRef.current?.querySelector(`[data-el-id="${elId}"] [data-rc="${r}_${c}"]`) as HTMLElement | null
    if (!n) return
    n.focus()
    const s = window.getSelection(); if (!s) return
    const rg = document.createRange(); rg.selectNodeContents(n)
    if (mode === 'end') rg.collapse(false)
    s.removeAllRanges(); s.addRange(rg)
  }
  function editCellNow(el: FreeEl, r: number, c: number, mode: 'all' | 'end') {
    // flushSync 로 편집 상태를 즉시 DOM 에 반영해야 이어지는 키 입력이 그 칸으로 들어간다.
    flushSync(() => {
      if (editRef.current && editRef.current.id !== el.id) commitEditing()
      // 여기도 **같은 자리**를 찍는다(EVER-SKETCH1 e6bc1d2). 키보드로 칸에 들어오는 길이 따로 있어서,
      // 한쪽만 찍어 두면 「더블클릭으로 고치면 되돌아가고 키보드로 고치면 안 되는」 꼴이 된다.
      if (editSnapRef.current == null) editSnapRef.current = snapOf(page)
      editAtRef.current = null
      setEditing(el.id)
    })
    focusCell(el.id, r, c, mode)
  }
  function clearCells(el: FreeEl, ts: { r0: number; c0: number; r1: number; c1: number }) {
    const R = el.rows || 2, C = el.cols || 2
    const R0 = Math.max(0, Math.min(ts.r0, ts.r1)), R1 = Math.min(R - 1, Math.max(ts.r0, ts.r1))
    const C0 = Math.max(0, Math.min(ts.c0, ts.c1)), C1 = Math.min(C - 1, Math.max(ts.c0, ts.c1))
    const cells = (el.cells || []).map((row) => row.slice())
    while (cells.length < R) cells.push([])
    for (let r = R0; r <= R1; r++) { while (cells[r].length < C) cells[r].push(''); for (let c = C0; c <= C1; c++) cells[r][c] = '' }
    snap(); updateEl(page.id, el.id, { cells })
  }
  // capture 단계로 잡아야 Hotkeys 의 한 글자 도구 단축키·방향키 이동보다 먼저 처리된다.
  useEffect(() => {
    if (!active || editing != null || tool !== 'select' || !tableSel) return
    const onKey = (e: KeyboardEvent) => {
      // **여기가 발표 Esc 를 먹던 자리다**(EVER-SKETCH1 bab224b). 이 리스너는 window 의 capture 라
      // 제일 먼저 불리고, Escape 를 「고른 칸 풀기」로 삼아 stopPropagation 한다.
      // 위에 전체 화면이 덮여 있으면 그 키는 애초에 내 것이 아니다.
      if (overlayOpen()) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const ts = useCanvasUI.getState().tableSel
      if (!ts) return
      const el = page.els.find((x) => x.id === ts.elId)
      if (!el || el.type !== 'table' || el.locked) return
      const R = el.rows || 2, C = el.cols || 2
      const r = Math.max(0, Math.min(R - 1, ts.r1)), c = Math.max(0, Math.min(C - 1, ts.c1))
      const eat = () => { e.preventDefault(); e.stopPropagation() }
      const k = e.key
      if (k === 'Escape') { eat(); setTableSel(null); return }
      if (k === 'Tab') { eat(); const nc = Math.max(0, Math.min(C - 1, c + (e.shiftKey ? -1 : 1))); pickRange(el, r, nc, r, nc); return }
      if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') {
        eat()
        const dr = k === 'ArrowUp' ? -1 : k === 'ArrowDown' ? 1 : 0
        const dc = k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : 0
        if (e.shiftKey) {   // Shift+방향키 = 잡은 범위를 넓히거나 좁힌다
          const nr = Math.max(0, Math.min(R - 1, ts.r1 + dr)), nc = Math.max(0, Math.min(C - 1, ts.c1 + dc))
          pickRange(el, ts.r0, ts.c0, nr, nc); return
        }
        const nr = Math.max(0, Math.min(R - 1, r + dr)), nc = Math.max(0, Math.min(C - 1, c + dc))
        pickRange(el, nr, nc, nr, nc); return
      }
      if (k === 'Enter' || k === 'F2') { eat(); editCellNow(el, r, c, 'end'); return }
      if (k === 'Delete' || k === 'Backspace') { eat(); clearCells(el, ts); return }
      // 글자 입력 → 그 칸을 통째로 갈아끼우며 편집 시작. preventDefault 를 하지 않는 게 핵심이다:
      // 눌린 키가 방금 포커스를 준 칸으로 그대로 들어가야 한글 조합도 첫 글자가 안 씹힌다.
      if (k === 'Process' || e.isComposing || (k.length === 1 && !e.repeat)) {
        e.stopPropagation()
        editCellNow(el, r, c, 'all')
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })
  // 연결점을 안 띄우는 갈래(NO_CPT)는 model.ts 한 곳에서 온다 — 도구줄 · 머메이드 뽑기와 같은 목록.
  function startConnectFrom(id: number) { setSelConn(null); setConnSrc(id); setTool('connect') }
  // 그룹이면 그 그룹 전체 id, 아니면 자기 id
  function expandGroupIds(id: number): number[] {
    const e = page.els.find((x) => x.id === id)
    if (!e || e.groupId == null) return [id]
    return page.els.filter((x) => x.groupId === e.groupId).map((x) => x.id)
  }
  // 사진의 원래 비율에 맞춰 상자 크기를 정한다. 긴 변을 base 로 맞추고 페이지를 넘지 않게 한다.
  function fitBox(iw: number, ih: number, base = 260): { w: number; h: number } {
    if (!iw || !ih) return { w: base, h: Math.round(base * 0.68) }
    const k = base / Math.max(iw, ih)
    let w = Math.round(iw * k), h = Math.round(ih * k)
    const maxW = Math.round(W * 0.9), maxH = Math.round(H * 0.9)
    const s2 = Math.min(1, maxW / w, maxH / h)
    if (s2 < 1) { w = Math.round(w * s2); h = Math.round(h * s2) }
    return { w: Math.max(24, w), h: Math.max(24, h) }
  }
  // fit=true 면 사진 비율대로 상자를 다시 잡는다(새로 넣을 때).
  // 교체(더블클릭)에서는 false — 사용자가 맞춰 둔 상자를 멋대로 바꾸지 않는다.
  function pickImage(el: FreeEl, fit = false) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'
    // 문서에 붙이지 않은 input 은 브라우저에 따라 .click() 해도 파일 창이 안 뜬다
    // (Safari 계열에서 특히). 화면에 안 보이게 붙였다가 쓰고 나서 치운다.
    inp.style.position = 'fixed'; inp.style.left = '-9999px'; inp.style.opacity = '0'
    document.body.appendChild(inp)
    const cleanup = () => { if (inp.parentNode) inp.parentNode.removeChild(inp) }
    inp.onchange = () => {
      const f = inp.files && inp.files[0]
      if (!f) { cleanup(); return }
      // 원본 그대로 넣으면 자동저장이 매번 수십 MB 를 통째로 올린다 — 넣기 전에 줄인다.
      intakeImage(f)
        .then((r) => {
          snap()
          const patch: Partial<FreeEl> = { src: r.src }
          if (fit && r.w && r.h) Object.assign(patch, fitBox(r.w, r.h))
          updateEl(page.id, el.id, patch)
        })
        .catch(() => { /* 읽기 실패: 빈 이미지 상자로 남는다 */ })
        .finally(cleanup)
    }
    // 사용자가 파일 창을 그냥 닫은 경우에도 정리한다.
    inp.addEventListener('cancel', cleanup)
    inp.click()
  }

  // 칸 끌기 선택 — 끌고 지나간 칸까지 범위를 넓힌다(EVER-SKETCH1 b721df0).
  //
  // 좌표로 계산하지 않고 **elementFromPoint 로 실제 칸을 짚는다.**
  // 열 너비(colw)·행 높이(rowh)·병합·화면 배율이 섞이면 좌표 산술로는 어느 칸인지 못 맞춘다.
  // 병합에 덮인 자리는 앵커 칸이 그 영역을 차지하므로 앵커 좌표가 그대로 나온다.
  function startCellDrag(el: FreeEl, r0: number, c0: number, from: Element) {
    const elId = el.id
    // 같은 쪽이 필름 미리보기에도 그려진다 — 거기 칸들도 data-tel 이 같다.
    // 레이어를 확인하지 않으면 커서가 미리보기 위를 지나는 순간 엉뚱한 칸이 잡힌다.
    const layer = from.closest('.freelayer')
    let last = r0 + '_' + c0
    const move = (ev: PointerEvent) => {
      const node = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
      const cell = node ? (node.closest('[data-tel]') as HTMLElement | null) : null
      if (!cell || cell.dataset.tel !== String(elId)) return
      if (!layer || !layer.contains(cell)) return
      const r = Number(cell.dataset.r), c = Number(cell.dataset.c)
      if (!Number.isFinite(r) || !Number.isFinite(c)) return
      const key = r + '_' + c
      if (key === last) return
      last = key
      // **병합을 반영해 넓힌다**(EVER-SKETCH1 e38d357). 이 한 줄이 빠지면 2행 높이로 병합된
      // 칸에 닿는 순간 범위가 0행으로 줄어들며 그 아래 줄이 통째로 빠진다.
      pickRange(el, r0, c0, r, c)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  /**
   * **끌어 고르기**(마퀴). 종이 안 빈 곳(onLayerDown)에서도, **종이 밖 회색 작업면**(Preview 가 `ebook:marquee` 로 넘김 ·
   * 2026-10-07 · 불편점 4번)에서도 같은 길이다. 화면 좌표를 받아 레이어 좌표로 바꾼다 — 종이 밖에서 시작하면 음수가 나오지만 상관없다.
   */
  function beginMarquee(clientX: number, clientY: number) {
    const node = layerRef.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const z = zoomOf(rect)
    const x = (clientX - rect.left) / z, y = (clientY - rect.top) / z
    setSel(null); setConnSrc(null); setSelConn(null); endEditing()
    const s0 = { x, y }
    setMarquee({ x, y, w: 0, h: 0 })
    const mv = (ev: PointerEvent) => { const cx = (ev.clientX - rect.left) / z, cy = (ev.clientY - rect.top) / z; setMarquee({ x: Math.min(s0.x, cx), y: Math.min(s0.y, cy), w: Math.abs(cx - s0.x), h: Math.abs(cy - s0.y) }) }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up)
      const cx = (ev.clientX - rect.left) / z, cy = (ev.clientY - rect.top) / z
      const mx = Math.min(s0.x, cx), my = Math.min(s0.y, cy), mw = Math.abs(cx - s0.x), mh = Math.abs(cy - s0.y)
      setMarquee(null)
      // 가로 · 세로 중 **하나만** 4px 넘으면 고른다(2026-10-07 · 「어디서든 드래그」). 납작하게 가로로만 끌어도 지나간 상자가 골라진다.
      if (mw > 4 || mh > 4) {
        const hit = page.els.filter((e2) => e2.x < mx + mw && e2.x + e2.w > mx && e2.y < my + mh && e2.y + e2.h > my).map((e2) => e2.id)
        const ids = new Set<number>()
        for (const id of hit) for (const g of expandGroupIds(id)) ids.add(g)
        if (ids.size) setSelMany([...ids])
      }
    }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up)
  }

  function onLayerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!active) return
    // 이 줄은 원래 **요소를 끌 때 마퀴 선택이 같이 시작되는 것**을 막으려고 있다.
    // 무언가를 놓는 중일 때는 그 걱정이 없다 — 위에 그리는 것이 맞는 동작이다(EVER-SKETCH1 46f155c).
    if (e.target !== e.currentTarget && !adding) return
    const rect = e.currentTarget.getBoundingClientRect()
    const z = zoomOf(rect)
    const x = (e.clientX - rect.left) / z, y = (e.clientY - rect.top) / z
    if (tool === 'eraser') {
      e.preventDefault()
      let cur = page.strokes.slice()
      let did = false
      const R = eraserWidth
      const erase = (px: number, py: number) => {
        const keep = cur.filter((st) => !st.points.some(([sx, sy]) => Math.hypot(sx - px, sy - py) <= R / 2 + (st.w || 2) / 2))
        if (keep.length !== cur.length) { if (!did) { snap(); did = true } cur = keep; setCanvas(page.id, { els: page.els, conns: page.conns, strokes: cur }) }
      }
      erase(x, y)
      const move = (ev: PointerEvent) => erase((ev.clientX - rect.left) / z, (ev.clientY - rect.top) / z)
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); return
    }
    if (tool === 'pen' || tool === 'highlighter') {
      e.preventDefault(); snap()
      const isHl = tool === 'highlighter'
      const pts: [number, number][] = [[x, y]]; setPenPts([...pts])
      const move = (ev: PointerEvent) => { pts.push([(ev.clientX - rect.left) / z, (ev.clientY - rect.top) / z]); setPenPts([...pts]) }
      const up = () => {
        // 펜=자유 잉크 획만(도형/화살표 자동 변환 없음 → 지우개로 지워짐). 형광펜도 획.
        if (isHl) addStroke(page.id, { points: pts, color: hlColor, w: hlWidth, hl: true })
        else addStroke(page.id, { points: pts, color: penColor, w: penWidth })
        setPenPts(null); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); return
    }
    // stopPropagation 이 없으면 부모(PageWithCanvas)의 onPointerDown 이 곧바로 setSel(null) 로 덮어써서
    // 방금 그린 도형에 핸들·서식 바가 안 뜨고 Delete 도 안 먹는다.
    // **찍은 점이 상자의 가운데**(2026-10-07 · 불편점 6번 · 종이 왼쪽 · 위로는 안 나간다). 글을 담는 것(글상자 · 글맵시 · 메모)은
    // 커서까지 — 좌표 없이 열어 기본 글자가 통째로 골라진다(90e7439 의 손놀림). 표는 칸이 여럿이라 커서를 안 넣는다.
    // `preventDefault` 가 없으면 **방금 연 글칸의 초점을 브라우저가 도로 뺏는다** — pointerdown 안에서 글칸이 초점을 받은 뒤 mousedown 의
    // 기본 동작(누른 곳으로 초점 이동)이 body 로 돌려놓아 onBlur 가 편집을 끝냈다(2026-10-07 화면 확인 · 요소를 끄는 갈래와 같은 처리).
    if (ADDABLE.indexOf(tool) >= 0) { e.stopPropagation(); snap(); e.preventDefault(); const el = mkFreeEl(tool, 0, 0); el.x = Math.max(0, Math.round(x - el.w / 2)); el.y = Math.max(0, Math.round(y - el.h / 2)); addEl(page.id, el); setSel(el.id); setTool('select'); if (tool === 'image') pickImage(el, true); if (tool === 'text' || tool === 'wordart' || tool === 'note') startEditing(el.id); return }
    if (tool === 'select') { beginMarquee(e.clientX, e.clientY); return }
    // 연결 도구로 빈 곳을 눌렀다 — **모드도 푼다**(2026-10-07 · 불편점 7번). 전에는 첫 상자만 풀리고 「이을 도형을 클릭하세요」 가
    // 그대로 남아 「무조건 다른 도형을 찍어야 하는」 꼴이었다. Esc 와 같은 결과다.
    setSel(null); setConnSrc(null); endEditing()
    if (tool === 'connect') setTool('select')
  }
  function onLayerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!active || tool !== 'connect' || connSrc === null) { if (mouse) setMouse(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    const z = zoomOf(rect)
    setMouse({ x: (e.clientX - rect.left) / z, y: (e.clientY - rect.top) / z })
  }
  function onElDown(e: React.PointerEvent<HTMLDivElement>, el: FreeEl) {
    if (!active) return
    if (tool === 'connect') {
      e.preventDefault(); e.stopPropagation()
      if (connSrc === null) setConnSrc(el.id)
      else if (connSrc !== el.id) { snap(); addConn(page.id, { from: connSrc, to: el.id, ...TREE_CONN }); setConnSrc(null); setMouse(null); setTool('select') }
      return
    }
    if (tool === 'pen' || tool === 'highlighter' || tool === 'eraser') { e.stopPropagation(); return }
    // **놓는 중이면 손대지 않는다.** 여기서 stopPropagation 하면 레이어가 못 받아
    // 도형이 안 생긴다 — 그게 「왜 안 되지」의 정체였다(EVER-SKETCH1 46f155c).
    if (adding) return
    e.preventDefault(); e.stopPropagation()
    // 다른 요소를 편집 중이었으면 값을 저장하고 끝낸다(안 그러면 편집 모드가 계속 남아 Delete 가 먹통).
    //
    // **표는 제 것이어도 끝낸다**(EVER-SKETCH1 미커밋 2026-09-21 · 시안 ㄷ 「둘 다 편집 풀기」).
    // 표 칸은 편집 중 누름을 칸에서 멈추므로 여기까지 오는 것은 **테두리나 ⠿ 손잡이**뿐이다 —
    // 곧 「표를 옮기겠다」는 뜻이다. 전에는 테두리로 끌면 편집이 남고(커서가 칸에 그대로)
    // ⠿ 로 끌면 풀려서, 같은 「옮기기」가 잡는 자리에 따라 달랐다. 편집이 남은 줄 모르고
    // Delete 를 누르면 칸 글자가 지워졌다. 도형 글자는 이 경로로 오지 않는다(편집 중 누름을 글자에서 멈춘다).
    if (editRef.current && (editRef.current.id !== el.id || el.type === 'table')) endEditing()
    // preventDefault 때문에 native 포커스 이동이 없다 → 카드 텍스트칸이 포커스를 계속 쥐고 있으면
    // Hotkeys 의 '입력 중' 가드가 Delete 를 통째로 삼킨다. 여기서 직접 떼어 준다(그 칸의 onBlur 로 값도 저장됨).
    if (editRef.current == null) {
      const ae = document.activeElement as HTMLElement | null
      if (ae && ae !== document.body && (ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) ae.blur()
    }
    if (el.locked) { setSel(el.id); return }   // 잠금: 선택만, 이동 없음
    if (e.shiftKey) { toggleSel(el.id); return }   // Shift 클릭: 선택 토글(이동 없음)
    // 선택 대상 결정: 이미 다중 선택된 요소를 잡으면 그 세트 전체를, 아니면 이 요소(그룹이면 그룹 전체)를
    const group = expandGroupIds(el.id)
    const already = selEls.includes(el.id)
    const dragIds = (already && selEls.length > 1) ? selEls : group
    if (!(already && selEls.length > 1)) setSelMany(dragIds)
    const single = dragIds.length === 1
    const movableIds = dragIds.filter((id) => { const d = page.els.find((x) => x.id === id); return d && !d.locked })
    const starts = movableIds.map((id) => { const d = page.els.find((x) => x.id === id); return { id, x: d ? d.x : 0, y: d ? d.y : 0 } })
    const sx = e.clientX, sy = e.clientY; let moved = false
    const lz = layerZoom(e.currentTarget)
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / lz, dy = (ev.clientY - sy) / lz
      if (Math.abs(dx) + Math.abs(dy) > 4) { if (!moved) snap(); moved = true }
      if (single) {
        const s0 = starts[0]
        const sr = computeSnap(el.w, el.h, s0.x + dx, s0.y + dy, page.els.filter((o) => o.id !== el.id), W, H)
        setGuides(sr.v.length || sr.h.length ? { v: sr.v, h: sr.h } : null)
        updateEl(page.id, el.id, { x: sr.x, y: sr.y })
      } else {
        moveEls(page.id, starts.map((s0) => ({ id: s0.id, x: s0.x + dx, y: s0.y + dy })))
      }
    }
    const up = () => { setGuides(null); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); if (!moved && already && selEls.length > 1) setSel(el.id) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  /**
   * 열 너비 · 행 높이 끌기 — **경계선 하나**를 옮긴다(EVER-SKETCH1 6817694).
   *
   * 합을 그대로 두므로 **표 전체 크기는 안 변한다** — 한쪽이 넓어지면 옆이 좁아진다.
   * 표를 키우는 것은 모서리 손잡이가 할 일이다. 둘을 한 동작에 섞으면 열 하나
   * 넓히려다 표가 종이 밖으로 나간다.
   */
  function onTrackDown(e: React.PointerEvent<HTMLDivElement>, el: FreeEl,
                       axis: 'col' | 'row', i: number) {
    e.preventDefault(); e.stopPropagation()
    const n = axis === 'col' ? (el.cols || 1) : (el.rows || 1)
    const base = trackSizes(axis === 'col' ? el.colw : el.rowh, n)
    const px = axis === 'col' ? el.w : el.h
    const lz = layerZoom(e.currentTarget)
    const s0 = axis === 'col' ? e.clientX : e.clientY
    let did = false
    const move = (ev: PointerEvent) => {
      if (!did) { snap(); did = true }
      const d = ((axis === 'col' ? ev.clientX : ev.clientY) - s0) / lz
      const next = dragTrack(base, i, d, px)
      updateEl(page.id, el.id, axis === 'col' ? { colw: next } : { rowh: next })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function onResizeDown(e: React.PointerEvent<HTMLDivElement>, el: FreeEl, dir: string) {
    e.preventDefault(); e.stopPropagation()
    const layer = (e.currentTarget as HTMLElement).closest('.freelayer') as HTMLElement | null
    const rect = layer ? layer.getBoundingClientRect() : null
    if (!rect) return
    const th = (el.rot || 0) * Math.PI / 180, cos = Math.cos(th), sin = Math.sin(th)
    const R = (px: number, py: number) => ({ x: px * cos - py * sin, y: px * sin + py * cos })
    const z = zoomOf(rect)
    const ow = el.w, oh = el.h, cx0 = el.x + ow / 2, cy0 = el.y + oh / 2
    const signX = dir.indexOf('e') >= 0 ? 1 : dir.indexOf('w') >= 0 ? -1 : 0
    const signY = dir.indexOf('s') >= 0 ? 1 : dir.indexOf('n') >= 0 ? -1 : 0
    const al = R(-signX * ow / 2, -signY * oh / 2)   // 반대편(고정) 앵커의 중심기준 오프셋(회전 반영)
    const Ax = cx0 + al.x, Ay = cy0 + al.y
    const MINW = 20, MINH = 16; let did = false
    const move = (ev: PointerEvent) => {
      if (!did) { snap(); did = true }
      const wx = (ev.clientX - rect.left) / z - Ax, wy = (ev.clientY - rect.top) / z - Ay
      const lx = wx * cos + wy * sin, ly = -wx * sin + wy * cos
      const nw = signX !== 0 ? Math.max(MINW, Math.abs(lx)) : ow
      const nh = signY !== 0 ? Math.max(MINH, Math.abs(ly)) : oh
      const off = R(signX * nw / 2, signY * nh / 2)
      const ncx = Ax + off.x, ncy = Ay + off.y
      updateEl(page.id, el.id, { x: Math.round(ncx - nw / 2), y: Math.round(ncy - nh / 2), w: Math.round(nw), h: Math.round(nh) })
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  // 캔버스 회전 손잡이 — 중심 기준 각도. Shift=15도 스냅.
  function onRotateDown(e: React.PointerEvent<HTMLDivElement>, el: FreeEl) {
    if (!active) return
    e.preventDefault(); e.stopPropagation()
    const layer = (e.currentTarget as HTMLElement).closest('.freelayer') as HTMLElement | null
    const rect = layer ? layer.getBoundingClientRect() : null
    if (!rect) return
    const z = zoomOf(rect)
    const cx = el.x + el.w / 2, cy = el.y + el.h / 2; let did = false
    const move = (ev: PointerEvent) => {
      if (!did) { snap(); did = true }
      const px = (ev.clientX - rect.left) / z, py = (ev.clientY - rect.top) / z
      let ang = Math.atan2(py - cy, px - cx) * 180 / Math.PI + 90
      ang = ((Math.round(ang) % 360) + 360) % 360
      if (ev.shiftKey) ang = Math.round(ang / 15) * 15 % 360
      updateEl(page.id, el.id, { rot: ang })
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  // 다중 선택 그룹: 바운딩 박스 크기조절(스케일)
  function onGroupResizeDown(e: React.PointerEvent<HTMLDivElement>, dir: string) {
    e.preventDefault(); e.stopPropagation()
    const sel0 = page.els.filter((el) => selEls.includes(el.id) && !el.locked)
    if (!sel0.length) return
    const bx = Math.min(...sel0.map((el) => el.x)), by = Math.min(...sel0.map((el) => el.y))
    const bx2 = Math.max(...sel0.map((el) => el.x + el.w)), by2 = Math.max(...sel0.map((el) => el.y + el.h))
    const BW = Math.max(1, bx2 - bx), BH = Math.max(1, by2 - by)
    const ax = dir.indexOf('w') >= 0 ? bx2 : bx
    const ay = dir.indexOf('n') >= 0 ? by2 : by
    const starts = sel0.map((el) => ({ id: el.id, x: el.x, y: el.y, w: el.w, h: el.h }))
    const gz = layerZoom(e.currentTarget)
    const sx0 = e.clientX, sy0 = e.clientY; let did = false
    const move = (ev: PointerEvent) => {
      if (!did) { snap(); did = true }
      const dx = (ev.clientX - sx0) / gz, dy = (ev.clientY - sy0) / gz
      let nBW = BW, nBH = BH
      if (dir.indexOf('e') >= 0) nBW = Math.max(20, BW + dx)
      if (dir.indexOf('w') >= 0) nBW = Math.max(20, BW - dx)
      if (dir.indexOf('s') >= 0) nBH = Math.max(16, BH + dy)
      if (dir.indexOf('n') >= 0) nBH = Math.max(16, BH - dy)
      const scX = (dir.indexOf('e') >= 0 || dir.indexOf('w') >= 0) ? nBW / BW : 1
      const scY = (dir.indexOf('n') >= 0 || dir.indexOf('s') >= 0) ? nBH / BH : 1
      transformEls(page.id, starts.map((m0) => ({ id: m0.id, x: ax + (m0.x - ax) * scX, y: ay + (m0.y - ay) * scY, w: m0.w * scX, h: m0.h * scY })))
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  // 다중 선택 그룹: 중심 기준 회전(각 요소 위치·각도 함께)
  function onGroupRotateDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault(); e.stopPropagation()
    const layer = (e.currentTarget as HTMLElement).closest('.freelayer') as HTMLElement | null
    const rect = layer ? layer.getBoundingClientRect() : null
    if (!rect) return
    const sel0 = page.els.filter((el) => selEls.includes(el.id) && !el.locked)
    if (!sel0.length) return
    const bx = Math.min(...sel0.map((el) => el.x)), by = Math.min(...sel0.map((el) => el.y))
    const bx2 = Math.max(...sel0.map((el) => el.x + el.w)), by2 = Math.max(...sel0.map((el) => el.y + el.h))
    const z = zoomOf(rect)
    const gcx = (bx + bx2) / 2, gcy = (by + by2) / 2
    const starts = sel0.map((el) => ({ id: el.id, cx: el.x + el.w / 2, cy: el.y + el.h / 2, w: el.w, h: el.h, rot: el.rot || 0 }))
    const a0 = Math.atan2((e.clientY - rect.top) / z - gcy, (e.clientX - rect.left) / z - gcx); let did = false
    const move = (ev: PointerEvent) => {
      if (!did) { snap(); did = true }
      const a = Math.atan2((ev.clientY - rect.top) / z - gcy, (ev.clientX - rect.left) / z - gcx)
      const d = a - a0, dd = d * 180 / Math.PI
      transformEls(page.id, starts.map((m0) => {
        const rxp = m0.cx - gcx, ryp = m0.cy - gcy
        const ncx = gcx + rxp * Math.cos(d) - ryp * Math.sin(d)
        const ncy = gcy + rxp * Math.sin(d) + ryp * Math.cos(d)
        return { id: m0.id, x: ncx - m0.w / 2, y: ncy - m0.h / 2, rot: ((Math.round(m0.rot + dd) % 360) + 360) % 360 }
      }))
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  // ① draw-from-node: 선택 도형의 4방향 핸들에서 끌면 새 상자+연결 생성(기존 도형 위면 그 도형과 연결)
  function onNodeDown(e: React.PointerEvent<HTMLDivElement>, el: FreeEl, dir: 't' | 'r' | 'b' | 'l') {
    if (!active) return
    e.preventDefault(); e.stopPropagation()
    const layer = (e.currentTarget as HTMLElement).closest('.freelayer') as HTMLElement | null
    const rect = layer ? layer.getBoundingClientRect() : null
    if (!rect) return
    const z = zoomOf(rect)
    const move = (ev: PointerEvent) => { setNodeDrag({ fromId: el.id, x: (ev.clientX - rect.left) / z, y: (ev.clientY - rect.top) / z }) }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up)
      setNodeDrag(null)
      const x = (ev.clientX - rect.left) / z, y = (ev.clientY - rect.top) / z
      const target = page.els.find((t) => t.id !== el.id && x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h)
      // **끌었나**는 포인터 이동량으로 본다(2026-10-07). 전에는 상자 중심에서 40px 안이면 「누르기만」 이었는데, 가로 120 상자의
      // 좌우 점은 중심에서 60 이라 누르기만 해도 「끈 것」 이 되어 그 자리에 포개진 상자가 생겼다.
      const moved = Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) > 6
      const tid = el.echoOf ?? el.id
      // **누르기만** 하면 그 변 쪽에 붙인다(2026-10-07 · 1·8번 · 2차 5·6번) — Space · Enter 와 같은 자리 규칙(addNext → treeAdd → nextSpot ·
      // 재정렬 없음). 어느 쪽(머메이드 · 손으로 그린 것)에서든 같다. 되돌리기는 addNext 가 남긴다.
      if (!moved && !target) { addNext(page.id, tid, SIDE[dir]); return }
      snap()
      if (target) { addConn(page.id, { from: el.id, to: target.id, ...TREE_CONN }); setSel(target.id); return }
      const NW = el.w, NH = el.h
      const nx = x - NW / 2, ny = y - NH / 2
      // 끌어 놓은 새 상자도 고른 상자를 닮는다 — 모양 · 크기 · 색 · 글자(treeAdd 와 같은 규칙 · 2026-10-07).
      const nb = mkFreeEl(el.type, Math.max(0, Math.round(nx)), Math.max(0, Math.round(ny)))
      nb.w = el.w; nb.h = el.h; nb.color = el.color; nb.fs = el.fs; nb.tcolor = el.tcolor
      nb.text = ''
      addEl(page.id, nb)
      addConn(page.id, { from: el.id, to: nb.id, ...TREE_CONN })
      setSel(nb.id); startEditing(nb.id); setReveal(nb.id)
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  function onLineDown(e: React.PointerEvent<SVGPathElement>, i: number) {
    if (!active) return
    e.preventDefault(); e.stopPropagation()
    // **고르지 않은 선에서 끌면 끌어 고르기**(2026-10-07 · 사용자: 「도형이나 선을 선택하지 않은 이상 어디서든 드래그가 되도록」).
    // 선의 누름 영역은 보이는 선보다 넓어서(16px) 빈 곳으로 보이는 데를 눌러도 선이 잡혀 **휘기**가 시작됐다 — 마인드맵처럼 선이 많으면
    // 「되는 곳도 있고 안 되는 곳도 있음」 으로 보인다. 이제 누르기만 하면 그 선을 고르고, 끌면 끌어 고르기다. 휘기는 **고른 선**을 끌 때만.
    if (selConn !== i) {
      const sx = e.clientX, sy = e.clientY
      beginMarquee(sx, sy)
      const up = (ev: PointerEvent) => { window.removeEventListener('pointerup', up); if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) <= 4) setSelConn(i) }
      window.addEventListener('pointerup', up)
      return
    }
    const svg = e.currentTarget.ownerSVGElement
    if (!svg) return
    const rect = svg.getBoundingClientRect(); const z = zoomOf(rect); let did = false, moved = false
    const sx = e.clientX, sy = e.clientY
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) <= 4) return
      moved = true
      const x = (ev.clientX - rect.left) / z, y = (ev.clientY - rect.top) / z
      if (!did) { snap(); did = true } updateConn(page.id, i, { x, y }); setBending({ x, y })
    }
    const up = () => { setBending(null); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); if (!moved) setSelConn(i) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }

  const conns = page.conns.map((c, i) => {
    if (!shownConn(c)) return null
    const a = page.els.find((e) => e.id === c.from); const b = page.els.find((e) => e.id === c.to)
    if (!a || !b) return null
    const d = connPath(a, b, c, axisOf(c))
    const stroke = c.color || '#8b93a5'
    const w = c.width || 2
    const arrow = c.arrow || 'end'
    const dash = c.dash ? '6 5' : undefined
    const sel = active && selConn === i
    return (
      <g key={'c' + i}>
        {sel ? <path d={d} fill="none" stroke="#2462EB" strokeOpacity={0.28} strokeWidth={w + 6} strokeLinecap="round" /> : null}
        <path d={d} fill="none" stroke={stroke} strokeWidth={w} strokeDasharray={dash} strokeLinecap="round" strokeLinejoin="round"
          markerEnd={arrow === 'none' ? undefined : 'url(#' + markerId + ')'} markerStart={arrow === 'both' ? 'url(#' + markerStartId + ')' : undefined} />
      </g>
    )
  })
  const hits = active ? page.conns.map((c, i) => {
    if (!shownConn(c)) return null
    const a = page.els.find((e) => e.id === c.from); const b = page.els.find((e) => e.id === c.to)
    if (!a || !b) return null
    return <path key={'hit' + i} d={connPath(a, b, c, axisOf(c))} fill="none" stroke="transparent" strokeWidth={16} style={{ pointerEvents: 'stroke', cursor: 'pointer' }} onPointerDown={(e) => onLineDown(e, i)} />
  }) : null
  const hlStrokes = page.strokes.map((st, i) => {
    if (!st.hl || st.points.length < 2) return null
    const d = 'M ' + st.points.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L ')
    return <path key={'h' + i} d={d} fill="none" stroke={st.color} strokeWidth={st.w} strokeLinecap="round" strokeLinejoin="round" opacity={0.4} style={{ mixBlendMode: 'multiply' }} />
  })
  const strokes = page.strokes.map((st, i) => {
    if (st.hl || st.points.length < 2) return null
    const d = 'M ' + st.points.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L ')
    return <path key={'s' + i} d={d} fill="none" stroke={st.color} strokeWidth={st.w} strokeLinecap="round" strokeLinejoin="round" />
  })
  const penPath = penPts && penPts.length > 1
    ? <path d={'M ' + penPts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L ')} fill="none" stroke={tool === 'highlighter' ? hlColor : penColor} strokeWidth={tool === 'highlighter' ? hlWidth : penWidth} strokeLinecap="round" opacity={tool === 'highlighter' ? 0.4 : 1} style={tool === 'highlighter' ? { mixBlendMode: 'multiply' } : undefined} />
    : null
  let rubber = null
  if (active && tool === 'connect' && connSrc !== null && mouse) {
    const src = page.els.find((e) => e.id === connSrc)
    if (src) { const s = edgePoint(src, mouse.x, mouse.y); rubber = <line x1={s.x} y1={s.y} x2={mouse.x} y2={mouse.y} stroke="#f0a020" strokeWidth={2} strokeDasharray="5 4" /> }
  }
  let nodeRubber = null
  if (active && nodeDrag) {
    const src = page.els.find((e) => e.id === nodeDrag.fromId)
    if (src) { const s = edgePoint(src, nodeDrag.x, nodeDrag.y); nodeRubber = <line x1={s.x} y1={s.y} x2={nodeDrag.x} y2={nodeDrag.y} stroke="#2462EB" strokeWidth={2} strokeDasharray="5 4" /> }
  }
  const guideEls = active && guides ? [
    ...guides.v.map((x, i) => <line key={'gv' + i} x1={x} y1={0} x2={x} y2={H} stroke="#f0389d" strokeWidth={1} strokeDasharray="4 3" />),
    ...guides.h.map((y, i) => <line key={'gh' + i} x1={0} y1={y} x2={W} y2={y} stroke="#f0389d" strokeWidth={1} strokeDasharray="4 3" />),
  ] : null

  return (
    <div ref={layerRef} className={'freelayer' + (active ? '' : ' off') + (active && tool === 'select' && !page.free ? ' passthru' : '')} style={{ width: W, height: H, cursor: !active ? undefined : tool === 'pen' ? PEN_CUR : tool === 'highlighter' ? HL_CUR : tool === 'eraser' ? eraserCur(eraserWidth) : ADDABLE.indexOf(tool) >= 0 ? 'crosshair' : undefined }} onPointerDown={onLayerDown} onPointerMove={active ? onLayerMove : undefined}>
      <svg className="freeconn" width={W} height={H}>
        <defs>
          <marker id={markerId} markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="context-stroke" /></marker>
          <marker id={markerStartId} markerWidth="10" markerHeight="10" refX="0" refY="3" orient="auto"><path d="M8,0 L0,3 L8,6 Z" fill="context-stroke" /></marker>
        </defs>
        {hlStrokes}{conns}{strokes}{penPath}{rubber}{nodeRubber}{guideEls}{hits}
        {bending ? <circle cx={bending.x} cy={bending.y} r={6} fill="#fff" stroke="#8b93a5" strokeWidth={2} /> : null}
      </svg>
      {active && marquee ? <div className="marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} /> : null}
      {active && adding ? <div className="conn-hint">점선 안의 빈 곳을 눌러 놓을 자리를 정하세요 · Esc 취소</div> : null}
      {active && tool === 'connect' ? <div className="conn-hint">{connSrc === null ? '이을 도형을 클릭하세요 (첫 번째) · Esc 취소' : '이어줄 다른 도형을 클릭하세요 (두 번째) · Esc 취소'}</div> : null}
      {shownEls.map((el) => {
        const isImg = el.type === 'image'
        const isTable = el.type === 'table'
        const isNote = el.type === 'note'
        const style: CSSProperties = { left: el.x, top: el.y, width: el.w, height: el.h }
        if (isNote) { style.height = 'auto'; style.minHeight = el.h }
        const tf: string[] = []
        if (el.rot) tf.push('rotate(' + el.rot + 'deg)')
        if (el.flipH) tf.push('scaleX(-1)')
        if (el.flipV) tf.push('scaleY(-1)')
        if (tf.length) { style.transform = tf.join(' '); style.transformOrigin = 'center' }
        if (el.opacity != null && el.opacity < 1) style.opacity = el.opacity
        if (el.shadow) style.filter = 'drop-shadow(0 3px 7px rgba(0,0,0,.32))'
        if (el.reflect) (style as React.CSSProperties & { WebkitBoxReflect?: string }).WebkitBoxReflect = 'below 2px linear-gradient(transparent 45%, rgba(0,0,0,.28))'
        if (!isImg && !isTable && el.color !== 'transparent') style.background = el.color
        if (el.color === '#111318') style.borderColor = '#111318'
        if (el.borderColor) style.borderColor = el.borderColor
        if (el.borderWidth != null) style.borderWidth = el.borderWidth
        // 선 모양(실선·파선·점선 · EVER-SKETCH1 f586a7b). 안 적혀 있으면 실선 — 옛 자료가 그대로 보인다.
        if (el.borderDash) style.borderStyle = el.borderDash
        /**
         * **오려 만드는 갈래**(EVER-SKETCH1 518611b). 오리는 규칙을 CSS 가 아니라 여기서 입힌다 —
         * 꼭짓점 한 벌(shapePaths)로 **오리고 또 그리려면** 두 곳이 같은 숫자를 봐야 한다.
         *
         * 상자 테두리는 **아예 끈다.** 오릴 때 같이 잘려서 꼭짓점에 자국만 남기 때문이다.
         * 선은 밑에서 SVG 로 그린다.
         */
        const clipped = CLIPPED.includes(el.type)
        if (clipped) {
          style.clipPath = polyClip(el.type)
          style.borderRadius = SHAPE_RADIUS[el.type] ?? 0
          style.borderWidth = 0
        }
        const txtStyle: CSSProperties = { fontSize: el.fs }
        if (el.bold) txtStyle.fontWeight = 800
        if (el.tcolor) txtStyle.color = el.tcolor
        else if (el.color === '#111318') txtStyle.color = '#fff'
        if (el.wa) { txtStyle.fontWeight = 900; txtStyle.letterSpacing = '0.01em'; txtStyle.textShadow = '0 1px 0 rgba(0,0,0,.18)' }
        if (el.italic) txtStyle.fontStyle = 'italic'
        if (el.underline) txtStyle.textDecoration = 'underline'
        if (el.align) txtStyle.textAlign = el.align
        const cls = 'fel ' + el.type + (selEls.includes(el.id) ? ' sel' : '') + (connSrc === el.id ? ' connsrc' : '')
          + (el.type === 'image' && el.src ? ' filled' : '')
        const editingThis = editing === el.id
        return (
          <div key={el.id} className={cls} style={style}
            data-el-id={el.id}
            data-goto-seq={el.gotoSeq || undefined}
            onPointerDown={active ? (e) => onElDown(e, el) : undefined}
            onPointerEnter={active && tool === 'select' ? () => setHoverId(el.id) : undefined}
            onPointerLeave={active && tool === 'select' ? () => setHoverId((h) => (h === el.id ? null : h)) : undefined}
            onDoubleClick={active ? (e) => {
              if (isImg) { pickImage(el); return }
              // **이미 편집 중인데 글자 칸 바깥(도형 안쪽 여백)을 더블클릭한 경우.** 그대로
              // startEditing 으로 흘리면 좌표만 적어 두고 아무 일도 안 해서, 브라우저가 고른
              // 마지막 낱말이 남는다. 글자 칸 안을 누른 것과 같은 규칙(낱말 아니면 커서)으로 맞춘다.
              if (editing === el.id && editRef.current?.node) {
                selectWordOrCaretAtPoint(editRef.current.node, e.clientX, e.clientY); return
              }
              startEditing(el.id, { x: e.clientX, y: e.clientY })
            } : undefined}>
            {/* **오려 만든 갈래의 테두리**(EVER-SKETCH1 518611b). 상자에 그릴 수 없으니 그 위에 선을 얹는다.
                굵기를 두 배로 그리면 바깥 절반이 오리는 규칙에 잘려 **딱 제 굵기**만 남고,
                선이 모양 안쪽에 정확히 붙는다. (SVG 에는 「안쪽 선」이 따로 없다.) */}
            {clipped && (el.borderWidth ?? 1.5) > 0 ? (
              <svg className="fel-outline" viewBox={`0 0 ${el.w} ${el.h}`} aria-hidden="true">
                <polygon points={polyPoints(el.type, el.w, el.h)} fill="none"
                  stroke={el.borderColor || '#cfd5e2'}
                  strokeWidth={(el.borderWidth ?? 1.5) * 2}
                  strokeDasharray={dashArray(el.borderDash, el.borderWidth ?? 1.5)}
                  strokeLinecap={el.borderDash === 'dotted' ? 'round' : undefined} />
              </svg>
            ) : null}
            {isNote
              ? (<div className="note-inner" style={{ pointerEvents: editingThis ? 'auto' : 'none' }}
                  onPointerDown={editingThis ? (e) => e.stopPropagation() : undefined}
                  onDoubleClick={editingThis ? (e) => e.stopPropagation() : undefined}>
                  <NoteBlocks blocks={el.blocks || []} onChange={(b) => setElBlocks(page.id, el.id, b)} compact />
                </div>)
              : isTable
              ? (() => {
                  const R = el.rows || 2, C = el.cols || 2
                  const cov = coveredSet(el.merges)
                  const border = el.borderColor || '#cfd5e2', bw = el.borderWidth ?? 1
                  const head = el.headRow !== false
                  const tableActive = selEls.includes(el.id)
                  const ts = (tableSel && tableSel.elId === el.id) ? tableSel : null
                  const inSel = (r: number, c: number) => !!ts && r >= Math.min(ts.r0, ts.r1) && r <= Math.max(ts.r0, ts.r1) && c >= Math.min(ts.c0, ts.c1) && c <= Math.max(ts.c0, ts.c1)
                  return (
                    <div className="feltable" style={{ display: 'grid', gridTemplateColumns: sizeTracks(el.colw, C), gridTemplateRows: sizeTracks(el.rowh, R), width: '100%', height: '100%', position: 'relative' }}>
                      {Array.from({ length: R * C }).map((_, k) => {
                        const r = Math.floor(k / C), c = k % C
                        if (cov.has(r + '_' + c)) return null
                        const m = mergeCovering(el.merges, r, c)
                        const val = (el.cells && el.cells[r] && el.cells[r][c]) || ''
                        const al = (el.calign && el.calign[r + '_' + c]) || undefined
                        const va = (el.cvalign && el.cvalign[r + '_' + c]) || undefined
                        const cfs = (el.cfs && el.cfs[r + '_' + c]) || el.fs
                        // 편집 중에는 칸 선택 하이라이트를 걷는다 — 글자와 겹쳐 읽기 어렵다.
                        const sel = !editingThis && inSel(r, c)
                        const isHead = head && r === 0
                        // 칸 색(cbg). 고른 칸 하이라이트가 늘 이긴다. 색 규칙은 PPT 내보내기와 같은 함수.
                        const bg = el.cbg && el.cbg[r + '_' + c]
                        const cellBg = sel ? '#dbe7ff'
                          : (bg ? cellBackground(bg) : (isHead ? '#f2f5fa' : '#fff'))
                        return (
                          <div key={k} className={'feltd' + (sel ? ' cellsel' : '')} suppressContentEditableWarning
                            data-tel={el.id} data-r={r} data-c={c} data-rc={r + '_' + c}
                            style={{ border: bw + 'px ' + (el.borderDash || 'solid') + ' ' + border, fontSize: cfs, padding: '3px 5px', overflow: 'hidden', background: cellBg, color: sel ? undefined : cellTextColor(bg), fontWeight: isHead ? 700 : 400, textAlign: al, gridColumn: m ? `${c + 1} / span ${m.cs}` : `${c + 1}`, gridRow: m ? `${r + 1} / span ${m.rs}` : `${r + 1}`, userSelect: editingThis ? 'text' : 'none', cursor: editingThis ? 'text' : 'default', ...(va ? { display: 'flex', flexDirection: 'column' as const, justifyContent: va === 'middle' ? 'center' : va === 'bottom' ? 'flex-end' : 'flex-start' } : null) }}
                            contentEditable={editingThis}
                            onKeyDown={editingThis ? (e) => {
                              // 값은 endEditing() 이 먼저 커밋한다. 칸을 옮기기 전에 반드시 거쳐야 한다.
                              const to = (nr: number, nc: number) => { e.preventDefault(); e.stopPropagation(); endEditing(); pickRange(el, nr, nc, nr, nc) }
                              if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); endEditing(); return }
                              // 한글 조합 중의 Enter 로는 칸을 옮기지 않는다 — 확정 뒤 Enter 가 한 번 더 와서
                              // 아래 칸이 편집 상태로 열리던 것(lib/ime). Escape · Tab 은 그대로다.
                              if (e.key === 'Enter' && !e.shiftKey && !isComposingKey(e)) { to(Math.min(R - 1, r + 1), c); return }
                              if (e.key === 'Tab') { to(r, e.shiftKey ? Math.max(0, c - 1) : Math.min(C - 1, c + 1)) }
                            } : undefined}
                            onPointerDown={(e) => {
                              // 표 칸도 놓는 중이면 흘려보낸다(EVER-SKETCH1 46f155c). 여기만 빼 두면
                              // 「글상자 위에는 그려지는데 표 위에는 안 되는」 반쪽이 된다.
                              if (adding) return
                              // **편집 중에 다른 칸을 누르면 거기서 빠져나온다**(EVER-SKETCH1 미커밋 2026-09-18 · 사용자 신고).
                              //
                              // 사용자: 「표 클릭했을때 밖에 클릭해야 글씨 풀리는 게 불편함 /
                              // 드래그 하려면 밖에 클릭해야 해서 귀찮음」. 편집이 **칸이 아니라 표 전체**에
                              // 걸려 있어서(`editing = el.id`) 편집 중에는 어느 칸을 눌러도 여기서 그냥
                              // 돌아섰다 — 글자 커서만 칸 사이를 옮겨 다니고, 칸 범위 끌기도 살아나지 않았다.
                              //
                              // 엑셀·파워포인트와 같게 한다. **같은 칸**을 누른 것은 글자 사이로 커서를
                              // 옮기는 중이니 브라우저에 맡기고, **다른 칸**을 누르면 값을 저장하고 편집을
                              // 끈 뒤 그 칸을 고른다 — 그때부터 끌면 범위 선택이다.
                              if (editingThis) {
                                e.stopPropagation()
                                const cur = editRef.current
                                if (cur && cur.node === e.currentTarget) return   // 같은 칸 → 커서 이동은 그대로
                                // 새 칸에 글자 커서가 꽂히면 안 된다 — 여기서부터는 '칸 고르기'다.
                                e.preventDefault()
                                const ae = document.activeElement as HTMLElement | null
                                endEditing()                      // 값부터 커밋하고 편집을 끈다
                                // preventDefault 때문에 native 포커스 이동이 없다 → 옛 칸이 포커스를
                                // 쥔 채 남으면 Hotkeys 의 '입력 중' 가드가 Delete 를 통째로 삼킨다.
                                if (ae && ae.isContentEditable) ae.blur()
                                if (!tableActive) setSel(el.id)
                                if (e.shiftKey && ts) { pickRange(el, ts.r0, ts.c0, r, c); return }
                                pickRange(el, r, c, r, c)
                                startCellDrag(el, r, c, e.currentTarget)
                                return
                              }
                              if (el.locked || tool !== 'select') return
                              if (e.shiftKey && ts && tableActive) { e.stopPropagation(); pickRange(el, ts.r0, ts.c0, r, c); return }
                              // Shift/⌘ 는 요소 여러 개 고르기용이라 그대로 위로 흘려보낸다.
                              if (e.shiftKey || e.metaKey || e.ctrlKey) return
                              e.stopPropagation()
                              e.preventDefault()
                              // **다른 요소를 편집 중이었으면 거기서 끝낸다**(EVER-SKETCH1 8cb80f5).
                              // 칸의 onBlur 는 값만 커밋하고 `editing` 은 그대로 둔다 — 그러면 옛 표가
                              // 계속 편집 모드로 남고, editing 을 보는 겹(손잡이 등)도 계속 숨는다.
                              if (editing != null && editing !== el.id) endEditing()
                              // 칸 위 누름은 **칸 선택**이다. 표를 이 자리에서 옮기지 않는다 —
                              // 누르자마자 끄는 사람에게 표가 통째로 움직이면 '드래그가 안 되는' 것으로 보인다.
                              // 표 이동은 ⠿ 손잡이(.tbl-move)가 맡는다.
                              if (!tableActive) setSel(el.id)
                              pickRange(el, r, c, r, c)
                              startCellDrag(el, r, c, e.currentTarget)
                            }}
                            onDoubleClick={(e) => {
                              // 더블클릭한 **그 칸**에 커서를 놓는다(EVER-SKETCH1 b721df0).
                              // 예전엔 표 전체가 편집 모드로 바뀌기만 해서, 글자를 쓰려면 한 번 더 눌러야 했다.
                              // 편집 중이면 누른 낱말을 고른다(EVER-SKETCH1 미커밋 wordSelect · 2026-09-21) —
                              // 브라우저 기본(ICU 낱말)에 맡기면 기준이 띄어쓰기가 아니라 「성번02_.」 가 쪼개진다.
                              // 여기서 멈춰야 바깥 .fel 의 더블클릭(글상자용 갈래)으로 새지 않는다.
                              if (editingThis) { e.stopPropagation(); selectWordOrCaretAtPoint(e.currentTarget, e.clientX, e.clientY); return }
                              if (!active || el.locked || tool !== 'select') return
                              e.stopPropagation()
                              startEditing(el.id)          // 이전 편집분을 먼저 저장하고 시작
                              const node = e.currentTarget
                              // 좌표는 **지금** 잡아 둔다 — 두 프레임 뒤에는 이벤트가 이미 재활용된 뒤다.
                              const x = e.clientX, y = e.clientY
                              requestAnimationFrame(() => requestAnimationFrame(() => {
                                node.focus()
                                selectWordOrCaretAtPoint(node, x, y)   // 켜자마자 누른 낱말까지(빈 곳이면 그 자리 커서)
                              }))
                            }}
                            onFocus={editingThis ? (e) => {
                              const n = e.currentTarget
                              editRef.current = { id: el.id, node: n, commit: () => {
                                const cells = (el.cells || []).map((row) => row.slice())
                                while (cells.length < R) cells.push([])
                                while (cells[r].length < C) cells[r].push('')
                                cells[r][c] = n.textContent || ''
                                updateEl(page.id, el.id, { cells })
                              } }
                            } : undefined}
                            onBlur={editingThis ? () => { commitEditing() } : undefined}
                          >{val}</div>
                        )
                      })}
                      {ts && ts.elId === el.id && !editingThis ? (() => {
                        const R0 = Math.min(ts.r0, ts.r1), R1 = Math.max(ts.r0, ts.r1)
                        const C0 = Math.min(ts.c0, ts.c1), C1 = Math.max(ts.c0, ts.c1)
                        return <div className="feltsel" style={{ gridColumn: `${C0 + 1} / ${C1 + 2}`, gridRow: `${R0 + 1} / ${R1 + 2}`, border: '2px solid #2f6df6', margin: -1, borderRadius: 2, pointerEvents: 'none', zIndex: 3 }} />
                      })() : null}
                    </div>
                  )
                })()
              : isImg
              ? (el.src
                  ? <img src={el.src} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
                  : <div className="feltext" style={{ fontSize: 11, color: '#8a93a5' }}>더블클릭해서 이미지 올리기</div>)
              : (editingThis
                  ? <div className="feltext" contentEditable suppressContentEditableWarning spellCheck={spell} style={txtStyle}
                      ref={(n) => {
                        // 인라인 ref 는 렌더마다 다시 붙는다. 같은 노드면 아무 것도 하지 않는다 —
                        // 예전처럼 매번 focus() 하면 마우스를 움직이기만 해도 포커스를 되훔쳐
                        // 다른 도형을 골라 Delete 했을 때 엉뚱하게 이 텍스트가 지워진다.
                        if (!n) return
                        if (editRef.current && editRef.current.node === n) return
                        editRef.current = { id: el.id, node: n, commit: () => updateEl(page.id, el.id, { text: n.textContent || '' }) }
                        // 브라우저가 멋대로 굴리지 않게 한다 — 화면을 옮기는 일은 Preview 가 `revealId` 로 한다.
                        n.focus({ preventScroll: true })
                      }}
                      onFocus={(e) => { const n = e.currentTarget; requestAnimationFrame(() => {
                        const sel = window.getSelection(); if (!sel) return
                        const at = editAtRef.current; editAtRef.current = null
                        // **더블클릭으로 켰으면 우리 규칙이 이긴다**(띄어쓰기 기준 낱말, 빈 곳이면 커서).
                        // (EVER-SKETCH1 lib/wordSelect · 2026-09-21)
                        //
                        // 전에는 맨 앞에서 「이미 뭔가 골라져 있으면 손대지 않는다」로 빠져나갔다.
                        // 그런데 두 번째 누름에서 **브라우저가 먼저** 편집 전 글자의 낱말을 골라 두므로
                        // 거의 늘 여기서 빠져나갔고, 결과는 우리 규칙이 아니라 브라우저 규칙이었다.
                        if (at) { selectWordOrCaretAtPoint(n, at.x, at.y); return }
                        // 좌표 없이 켜진 경우(새 글상자를 놓자마자 등)는 예전처럼 전체 선택 —
                        // 다른 길이 이미 골라 둔 것이 있으면 존중한다.
                        if (!sel.isCollapsed) return
                        const r = document.createRange(); r.selectNodeContents(n)
                        sel.removeAllRanges(); sel.addRange(r)
                      }) }}
                      // **편집 중인 글자 위의 누름은 글자의 것이다.**
                      // 여기서 멈추지 않으면 바깥 `.fel` 의 onElDown 까지 올라가 preventDefault 하고
                      // **도형 끌기**를 시작한다. 그러면 편집 중에 글자를 끌어 고르면 글자 대신 도형이
                      // 움직이고, 세 번 눌러 전체 고르기도 먹지 않는다. 메모(note-inner)는 이미 이렇게 막고 있었다.
                      onPointerDown={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => {
                        // 편집 중 더블클릭도 **같은 기준**으로. 브라우저 기본(ICU 낱말)에 맡기면
                        // 「성번02_.」 가 쪼개진다. 바깥(.fel)의 더블클릭까지 올라가면
                        // startEditing 이 좌표를 다시 적어 두어, 다음 편집이 엉뚱한 자리를 고른다.
                        e.stopPropagation()
                        selectWordOrCaretAtPoint(e.currentTarget, e.clientX, e.clientY)
                      }}
                      // **가지 상자에서는 Enter 가 글을 끝낸다**(알마인드 · 2026-10-06). 그래야 「Space → 글 → Enter →
                      // Enter(형제)」 로 손을 안 떼고 이어 간다. 줄바꿈은 Shift+Enter. 트리 밖 도형은 예전 그대로다.
                      onKeyDown={(e) => {
                        if (isComposingKey(e)) return
                        const tid = el.echoOf ?? el.id
                        // 선으로 이어진 상자(머메이드 · 키 · ＋점 가리지 않고 · 2차 4번)와 방금 키로 붙인 상자만 — 그 밖의 글상자는 Enter 가 줄바꿈이다.
                        const inGraph = !!(graphShape && graphShape.members.includes(tid))
                        if (!inGraph && pristineRef.current !== el.id) return
                        // 붙인 뒤 아무것도 안 쳤으면 **가지 키가 그대로 듣는다**(알마인드) — Space 자식(오른쪽) · Enter 형제 · Shift+Enter 앞 형제, 방향키는 옮겨 가기.
                        if (pristineRef.current === el.id) {
                          const act = mindKey(e.nativeEvent)
                          if (act === 'child' || act === 'sibling' || act === 'before') {
                            e.preventDefault(); e.stopPropagation()
                            if (e.repeat) return
                            pristineRef.current = null
                            endEditing(); addNext(page.id, tid, act === 'child' ? 'right' : act)
                            return
                          }
                          if (!e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey && e.key.startsWith('Arrow')) {
                            e.preventDefault(); e.stopPropagation()
                            pristineRef.current = null
                            const to = tshape ? navTarget(tshape, page.treeDir || 'LR', tid, e.key) : null
                            endEditing()
                            if (to != null) { setSel(to); setReveal(to) }
                            return
                          }
                        }
                        if (e.key !== 'Enter' || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return
                        e.preventDefault(); e.stopPropagation()
                        endEditing()
                      }}
                      onInput={() => { pristineRef.current = null }}
                      onCompositionStart={() => { pristineRef.current = null }}
                      onMouseDown={() => { pristineRef.current = null }}
                      // 자기 글칸이 아직 편집 대상일 때만 끝낸다 — 앞 상자의 늦은 blur 가 방금 연 새 상자의 편집을 끄지 않게.
                      onBlur={(e) => { if (!editRef.current || editRef.current.node === e.currentTarget) endEditing() }}>{el.text}</div>
                  : <div className="feltext" style={txtStyle}>{el.text}</div>)}
            {active && isNote && editingThis ? <div className="note-drag" title="드래그해서 이동">⠿</div> : null}
          </div>
        )
      })}
      {/* **가지 접기 손잡이**(EVER-SKETCH1 c7effe6). 상자 **밖**에 그린다 — `.fel` 이 `overflow:hidden` 이라
          안에 넣으면 왼쪽으로 삐져나온 손잡이가 통째로 잘린다.
          자식이 있는 상자에만, 그리고 **편집 화면에서만** 나온다.
          접힌 상자 오른쪽의 「+N」은 **접어서 안 보이는 상자 수**다 — 몇 개를 덮었는지
          모르면 접은 걸 잊는다. */}
      {graphShape ? shownEls.map((el) => {
        if (el.echoOf != null) return null
        const kids = (graphShape.kids.get(el.id) || []).length
        if (!kids) return null
        const n = el.folded ? descendantCount(graphShape, el.id) : 0
        return (
          <Fragment key={'fold' + el.id}>
            {/* **상자 왼쪽 아래 모서리**에 붙인다. 원본에서 화면을 보고 두 번 옮겼다 —
                왼쪽 가운데는 **들어오는 화살촉**과 겹쳤고, 위쪽은 요소 도구막대 자리다. */}
            <button className="tree-fold" title={el.folded ? '펴기' : '접기'}
              style={{ left: el.x + 1, top: el.y + el.h + 2 }}
              onPointerDown={(e) => { e.stopPropagation() }}
              onClick={(e) => { e.stopPropagation(); pushSnap(page.id, JSON.stringify({ els: page.els, conns: page.conns, strokes: page.strokes, detached: page.detached })); treeFold(page.id, el.id) }}>
              {el.folded ? '▸' : '▾'}
            </button>
            {el.folded ? (
              <span className="tree-plusn" aria-hidden="true" style={{ left: el.x + el.w + 6, top: el.y + el.h - 17 }}>+{n}</span>
            ) : null}
          </Fragment>
        )
      }) : null}

      {/* 크기 손잡이(EVER-SKETCH1 6817694 · 자리는 f2ce117).
          예전에는 「그 표의 칸이 골라져 있으면」 숨겼다. 그런데 표는 **한 번만 눌러도
          칸이 골라진다**(그게 맞는 동작이다). 그래서 손잡이를 보려면 Esc 를 눌러야 했고,
          아무도 그걸 모른다 — 「크기 조절이 안 된다」로 보인다.
          숨긴 이유는 손잡이가 표 가장자리 칸 위에 겹쳐 칸 고르기를 가로채기 때문이었다.
          그러면 숨길 게 아니라 **칸 밖으로 밀어내면 된다.** */}
      {active && selEls.length === 1 && selEl != null && editing == null && tool === 'select' ? (() => {
        const se = page.els.find((e) => e.id === selEl)
        if (!se || se.locked) return null
        const w = se.w, h = se.h
        const isTbl = se.type === 'table'
        // 표는 손잡이를 칸 **밖**으로 낸다. 칸 위에 겹치면 칸 고르기를 가로챈다.
        // 20px 이나 나가는 이유: 표에는 바로 바깥에 열·행 경계선 손잡이 띠가 한 겹 더 있어서,
        // 가운데 변 손잡이(n·w)가 그 띠의 경계선과 겹친다(2열짜리 표에서는 정확히 같은 자리).
        // **종이 가장자리에 붙은 표에서는 그만큼 안으로 들인다.** 밖으로만 내면 종이 밖에 그려져
        // 잘리고, 아래쪽에 딱 붙은 표는 크기를 바꿀 방법이 아예 없어진다.
        const pad0 = isTbl ? 20 : 0
        const room = (v: number) => Math.max(0, Math.min(pad0, Math.round(v)))
        const padL = room(se.x), padT = room(se.y)
        const padR = room(W - (se.x + w)), padB = room(H - (se.y + h))
        // 띠(열·행 경계선)도 같은 이유로 자리가 없으면 안쪽에 붙인다.
        const bandT = se.y >= 15 ? -14 : 1
        const bandL = se.x >= 15 ? -14 : 1
        const HS: { d: string; x: number; y: number; cur: string }[] = [
          { d: 'nw', x: -padL, y: -padT, cur: 'nwse-resize' },
          { d: 'n', x: w / 2, y: -padT, cur: 'ns-resize' },
          { d: 'ne', x: w + padR, y: -padT, cur: 'nesw-resize' },
          { d: 'e', x: w + padR, y: h / 2, cur: 'ew-resize' },
          { d: 'se', x: w + padR, y: h + padB, cur: 'nwse-resize' },
          { d: 's', x: w / 2, y: h + padB, cur: 'ns-resize' },
          { d: 'sw', x: -padL, y: h + padB, cur: 'nesw-resize' },
          { d: 'w', x: -padL, y: h / 2, cur: 'ew-resize' },
        ]
        return (
          <div style={{ position: 'absolute', left: se.x, top: se.y, width: w, height: h, transform: se.rot ? `rotate(${se.rot}deg)` : undefined, transformOrigin: 'center', pointerEvents: 'none', zIndex: 6 }}>
            <div style={{ position: 'absolute', left: w / 2, top: -22, width: 1, height: 22, background: '#2462EB' }} />
            <div title="회전(Shift=15°)" style={{ position: 'absolute', left: w / 2 - 7, top: -29, width: 14, height: 14, borderRadius: '50%', background: '#fff', border: '2px solid #2462EB', boxShadow: '0 1px 3px rgba(0,0,0,.25)', cursor: 'grab', pointerEvents: 'auto' }} onPointerDown={(e) => onRotateDown(e, se)} />
            {/* 손잡이에 이름을 준다 — 브라우저 검사가 「오른쪽 아래를 끌었다」를 말할 수 있게. */}
            {HS.map((hh) => (
              <div key={'rh' + hh.d} className={'rs-h rs-' + hh.d} data-rs={hh.d}
                style={{ position: 'absolute', left: hh.x - 5, top: hh.y - 5, width: 10, height: 10, borderRadius: 2, background: '#fff', border: '1.5px solid #2462EB', boxShadow: '0 1px 2px rgba(0,0,0,.25)', cursor: hh.cur, pointerEvents: 'auto' }}
                onPointerDown={(e) => onResizeDown(e, se, hh.d)} />
            ))}
            {/* 열·행 경계선 손잡이와 머리 띠 — 표를 골랐을 때만 나온다(EVER-SKETCH1 6817694 · e38d357).
                표 **밖**(위쪽 띠 · 왼쪽 띠)에 두므로 칸 고르기와 부딪히지 않는다. */}
            {isTbl ? (() => {
              const C = se.cols || 1, R = se.rows || 1
              const cw = trackSizes(se.colw, C), rh = trackSizes(se.rowh, R)
              const cT = cw.reduce((a, b) => a + b, 0), rT = rh.reduce((a, b) => a + b, 0)
              const out: React.ReactNode[] = []
              // ── 머리 띠(누르면 그 줄·열 통째로) ───────────────────────
              // **경계 손잡이보다 먼저** 그린다 — 뒤에 그린 손잡이가 위에 얹혀,
              // 경계에서는 크기 조절이 이긴다. 띠 하나가 두 가지 일을 한다.
              let bacc = 0
              for (let i = 0; i < C; i++) {
                const x0 = bacc; bacc += cw[i]
                out.push(<div key={'cb' + i} className="trk-band trk-band-col"
                  data-band="col" data-bi={i} data-bel={se.id}
                  title="눌러서 이 열 통째로 고르기 (끌면 여러 열)"
                  style={{ left: (x0 / cT) * 100 + '%', width: (cw[i] / cT) * 100 + '%', top: bandT }}
                  onPointerDown={(ev) => { ev.preventDefault(); ev.stopPropagation(); startBandDrag(se, 'col', i, ev.currentTarget) }} />)
              }
              bacc = 0
              for (let i = 0; i < R; i++) {
                const y0 = bacc; bacc += rh[i]
                out.push(<div key={'rb' + i} className="trk-band trk-band-row"
                  data-band="row" data-bi={i} data-bel={se.id}
                  title="눌러서 이 줄 통째로 고르기 (끌면 여러 줄)"
                  style={{ top: (y0 / rT) * 100 + '%', height: (rh[i] / rT) * 100 + '%', left: bandL }}
                  onPointerDown={(ev) => { ev.preventDefault(); ev.stopPropagation(); startBandDrag(se, 'row', i, ev.currentTarget) }} />)
              }
              let acc = 0
              for (let i = 0; i < C - 1; i++) {
                acc += cw[i]
                out.push(<div key={'cg' + i} className="trk-grip trk-col" title="끌어서 열 너비 조절"
                  style={{ left: (acc / cT) * 100 + '%', top: bandT }}
                  onPointerDown={(ev) => onTrackDown(ev, se, 'col', i)} />)
              }
              acc = 0
              for (let i = 0; i < R - 1; i++) {
                acc += rh[i]
                out.push(<div key={'rg' + i} className="trk-grip trk-row" title="끌어서 행 높이 조절"
                  style={{ top: (acc / rT) * 100 + '%', left: bandL }}
                  onPointerDown={(ev) => onTrackDown(ev, se, 'row', i)} />)
              }
              return <>{out}</>
            })() : null}
          </div>
        )
      })() : null}
      {active && selEls.length >= 2 && editing == null && tool === 'select' ? (() => {
        const sel0 = page.els.filter((el) => selEls.includes(el.id))
        if (sel0.length < 2) return null
        const bx = Math.min(...sel0.map((el) => el.x)), by = Math.min(...sel0.map((el) => el.y))
        const bx2 = Math.max(...sel0.map((el) => el.x + el.w)), by2 = Math.max(...sel0.map((el) => el.y + el.h))
        const bw = bx2 - bx, bh = by2 - by
        const HS: { d: string; x: number; y: number; cur: string }[] = [
          { d: 'nw', x: bx, y: by, cur: 'nwse-resize' },
          { d: 'n', x: bx + bw / 2, y: by, cur: 'ns-resize' },
          { d: 'ne', x: bx2, y: by, cur: 'nesw-resize' },
          { d: 'e', x: bx2, y: by + bh / 2, cur: 'ew-resize' },
          { d: 'se', x: bx2, y: by2, cur: 'nwse-resize' },
          { d: 's', x: bx + bw / 2, y: by2, cur: 'ns-resize' },
          { d: 'sw', x: bx, y: by2, cur: 'nesw-resize' },
          { d: 'w', x: bx, y: by + bh / 2, cur: 'ew-resize' },
        ]
        return (<>
          <div style={{ position: 'absolute', left: bx, top: by, width: bw, height: bh, border: '1.5px dashed #2462EB', borderRadius: 3, pointerEvents: 'none', zIndex: 5 }} />
          <div style={{ position: 'absolute', left: bx + bw / 2, top: by - 22, width: 1, height: 22, background: '#2462EB', zIndex: 5, pointerEvents: 'none' }} />
          <div title="그룹 회전(Shift=15°)" style={{ position: 'absolute', left: bx + bw / 2 - 7, top: by - 29, width: 14, height: 14, borderRadius: '50%', background: '#fff', border: '2px solid #2462EB', boxShadow: '0 1px 3px rgba(0,0,0,.25)', cursor: 'grab', zIndex: 6, pointerEvents: 'auto' }} onPointerDown={onGroupRotateDown} />
          {HS.map((h) => (
            <div key={'grh' + h.d} style={{ position: 'absolute', left: h.x - 5, top: h.y - 5, width: 10, height: 10, borderRadius: 2, background: '#fff', border: '1.5px solid #2462EB', boxShadow: '0 1px 2px rgba(0,0,0,.25)', cursor: h.cur, zIndex: 6, pointerEvents: 'auto' }}
              onPointerDown={(e) => onGroupResizeDown(e, h.d)} />
          ))}
        </>)
      })() : null}
      {/* 표 이동 손잡이(⠿) — 자기 겹에 따로 그린다(EVER-SKETCH1 b721df0 · 자리는 8cb80f5).
          표는 칸을 잡으면 **칸 선택**이 되므로 표 자체를 끌 곳이 따로 필요하다.
          표 안(.feltable)에 두면 `.fel` 의 overflow:hidden 에 잘리고 첫 칸을 덮는다.
          크기 손잡이 겹은 editing == null 일 때만 떠서 칸을 편집하는 동안 사라진다.
          그래서 표의 왼쪽 위 **모서리 바깥**에, 자기 겹으로 선다. */}
      {active && tool === 'select' && selEls.length === 1 && selEl != null ? (() => {
        const se = page.els.find((e) => e.id === selEl)
        if (!se || se.type !== 'table' || se.locked) return null
        return (
          <div style={{ position: 'absolute', left: se.x, top: se.y, width: se.w, height: se.h,
                        pointerEvents: 'none', zIndex: 8 }}>
            <div className="tbl-move" title="드래그해서 표 이동"
              onPointerDown={(e) => { e.stopPropagation(); onElDown(e, se) }}>⠿</div>
          </div>
        )
      })() : null}
      {/* **＋점**(끌어 잇기 · 누르면 가지). 올린 도형에는 변 가운데에, **고른 도형에는 변 밖 16px 에 늘**(2026-10-07 · 불편점 1번) —
          고른 도형은 변 가운데가 크기 손잡이 자리라 밖으로 내고, 호버에 기대지 않는다(점까지 16px 틈을 지나면 호버가 풀린다).
          전에는 고른 도형에서는 점이 안 떠서, Esc 로 편집을 끝낸 뒤 이을 길이 없었다. 떠 있던 서식 막대는 도구줄로 옮겼다(2차 3번) —
          그래서 위쪽 점도 가려지지 않는다. */}
      {active && tool === 'select' && editing == null ? (() => {
        const dotEl = (hoverId != null && !selEls.includes(hoverId)) ? hoverId
          : (selEls.length === 1 && selEl != null && !(tableSel && tableSel.elId === selEl) ? selEl : null)
        if (dotEl == null) return null
        const he = page.els.find((e) => e.id === dotEl)
        if (!he || he.locked || NO_CPT.includes(he.type)) return null
        const out = dotEl === selEl && selEls.length === 1 ? 16 : 0
        const pts: { d: 't' | 'r' | 'b' | 'l'; x: number; y: number }[] = [
          { d: 't', x: he.x + he.w / 2, y: he.y - out },
          { d: 'r', x: he.x + he.w + out, y: he.y + he.h / 2 },
          { d: 'b', x: he.x + he.w / 2, y: he.y + he.h + out },
          { d: 'l', x: he.x - out, y: he.y + he.h / 2 },
        ]
        return (<>{pts.map((pt) => (
          <div key={'cpt' + pt.d} className="cpt" title={out ? '누르면 가지 · 끌면 그 자리에 새 상자 · 다른 도형에 놓으면 연결' : '끌어서 다른 도형에 연결'}
            style={{ position: 'absolute', left: pt.x - 6, top: pt.y - 6, width: 12, height: 12, borderRadius: '50%', background: '#2462EB', border: '2px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,.3)', cursor: 'crosshair', pointerEvents: 'auto', zIndex: 7 }}
            onPointerEnter={() => setHoverId(he.id)}
            onPointerLeave={() => setHoverId((h) => (h === he.id ? null : h))}
            onPointerDown={(e) => onNodeDown(e, he, pt.d)} />
        ))}</>)
      })() : null}
    </div>
  )
}
