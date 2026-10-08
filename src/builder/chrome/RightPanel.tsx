import { useEffect, useState } from 'react'
import { openSections, rememberOpenSections } from '../../persistence/prefs'
import NumInput from './NumInput'
import { BRANCH_MAX, BRANCH_BOX, nextBranchSpot } from '../../cards/mindmapEls'
import { treeShape, descendantCount, knownOf, isTreePage } from '../../cards/treeOps'
import { useKey } from '../../ui/keyLabel'
import { useBuilder, nextElId } from '../../state/store'
import type { PaperType } from '../../state/store'
import { useCanvasUI } from '../../state/canvasUI'
import { useSelEl } from '../useSelEl'
import Editor from '../Editor'
import ColorPicker from './ColorPicker'
import { pageSize } from '../../cards/sizing'
import { PAPER_OPTIONS } from '../../cards/paper'
import { FCOLORS, NO_CPT } from '../../canvas/model'
import { addNext } from '../mindActions'
import { SHAPES } from './EditToolbar'
import { polyClip, SHAPE_RADIUS } from '../../canvas/shapePaths'
import Modal from '../../ui/Modal'
import { mermaidOfPage } from '../../cards/mermaidOut'
import { parseMermaid } from '../../cards/mermaid'
import { pushSnap } from '../../canvas/model'
import type { FreeEl } from '../../state/store'
import { addRow, delRow, addCol, delCol, setAlignRange, setVAlignRange, setCellFsRange, setCellBgRange } from '../../canvas/tableOps'
import { cellBackground, cellColors } from '../../canvas/cellColor'
import { ALIGN_LABEL, AlignIcon, VALIGN_LABEL, VAlignIcon } from '../../ui/alignIcons'

const TRANS: [string, string][] = [['', '없음'], ['fade', '페이드'], ['slide', '밀기'], ['zoom', '확대'], ['flip', '넘기기']]
const cap: React.CSSProperties = { fontSize: 11, color: '#98a1b2', display: 'block', marginTop: 6 }
const PRESETS: { name: string; color: string; tcolor: string }[] = [
  { name: '기본', color: '#ffffff', tcolor: '#1a1a1a' },
  { name: '주황', color: '#e0553c', tcolor: '#ffffff' },
  { name: '회색', color: '#8a93a5', tcolor: '#ffffff' },
  { name: '크림', color: '#f6ddc2', tcolor: '#5a4327' },
  { name: '파랑', color: '#2a78d6', tcolor: '#ffffff' },
  { name: '초록', color: '#2fa37a', tcolor: '#ffffff' },
]
/** 묶음 이름은 **할 일**로 짓는다(EVER-SKETCH1 93ecb00 C-3, 사용자 결정 ㄴ).
 *
 *  예전에는 옛 탭 이름 그대로였다 — 표 · 스타일 · 텍스트 · 정렬.
 *  그러면 「크기」를 바꾸려면 **정렬**을 열어야 하고, 표 칸 글자를 키우려면
 *  「셀 글자 크기」(표)인지 「글자 크기」(텍스트)인지 **먼저 정해야** 했다.
 *
 *  `text` 만 옛 이름을 그대로 쓴다 — 뜻이 안 바뀌었다. */
type Tab = 'cell' | 'row' | 'stage' | 'look' | 'text' | 'geom' | 'extra' | 'border'
/** 기억할 이름들. 여기 없는 이름은 `openSections` 가 버린다. */
const SECS: readonly Tab[] = ['cell', 'row', 'stage', 'look', 'text', 'geom', 'extra', 'border']

/**
 * **접이식 한 묶음**(EVER-SKETCH1 22dd552 · 93ecb00). 열 군데가 같은 모양이라 한 곳으로 모았다.
 *
 * ── 왜 **파일 맨 바깥**에 있나 (EVER-SKETCH1 2846b9a) ──────────────
 *
 * `RightPanel` **안에** 선언하면 화면을 다시 그릴 때마다 `Acc` 가 **새 부품**이 된다.
 * 리액트는 「자리는 같은데 부품이 바뀌었다」고 보고 고쳐 그리는 대신 **묶음을 통째로
 * 버리고 새로 만든다.** 그러면 패널 스크롤이 **맨 위로 튀고**(내용이 잠깐 비어 브라우저가
 * 0 으로 깎는다), 치던 숫자 칸이 **손에서 떨어진다** — ▲를 두 번 연달아 못 누른다.
 *
 * **그래서 부품은 바깥에 두고, 안에서 오는 것은 값으로 받는다.** 값이 바뀌면
 * 고쳐 그릴 뿐 버리지 않는다. 이 자리에 부품을 다시 선언하면 같은 증상이 돌아온다
 * (inner_component.test.mjs 가 지킨다).
 */
function Acc({ k, t, sub, sec, onToggle, children }: {
  k: Tab; t: string; sub?: string
  sec: Record<Tab, boolean>; onToggle: (k: Tab) => void
  children: React.ReactNode
}) {
  const open = sec[k]
  return (<>
    <button className={'insp-acc' + (open ? ' on' : '')}
      onClick={() => onToggle(k)} aria-expanded={open}>
      <span className="ch">{open ? '▾' : '▸'}</span>
      <span className="t">{t}</span>
      {sub ? <span className="sub">{sub}</span> : null}
    </button>
    {open ? <>{children}</> : null}
  </>)
}

/** 처음 여는 사람에게 **자주 쓰는 것만** 펴 준다(시안 그대로).
 *  표는 칸·행·채우기, 그 밖은 모양·글자. 나머지는 접힌 줄에 지금 값이 적혀 있어
 *  열지 않아도 읽힌다 — 그게 접이식으로 바꾼 이유다. */
const DEFAULT_OPEN: Record<Tab, boolean> = {
  cell: true, row: true, stage: true, look: true, text: true,
  geom: false, extra: false, border: false,
}

/** 고른 것의 이름 — 생김새 이름(3c07f77). 여기 없는 갈래는 「도형」이다.
 *  (원본은 표준 양식이면 문서 안의 이름표를 읽는다. 이 저장소에는 양식 슬롯이 없다.) */
const EL_NAME: Record<string, string> = {
  table: '표', text: '글상자', icon: '아이콘', wordart: '꾸민 글자', note: '메모',
  image: '그림', sticky: '쪽지', connect: '연결선', pen: '펜 자국',
}

// 우측 인스펙터 — PPT/키노트식. 요소를 고르면 할 일별 접이식 묶음, 연결선이면 선 설정, 아무것도 없으면 페이지 설정.
export default function RightPanel() {
  const pages = useBuilder((s) => s.pages)
  const selId = useBuilder((s) => s.selectedPageId)
  const orientation = useBuilder((s) => s.orientation)
  const setOrientation = useBuilder((s) => s.setOrientation)
  const setPageBg = useBuilder((s) => s.setPageBg)
  const setPaper = useBuilder((s) => s.setPaper)
  const setPageTrans = useBuilder((s) => s.setPageTrans)
  const addCard = useBuilder((s) => s.addCard)
  const duplicatePage = useBuilder((s) => s.duplicatePage)
  const expandMindmap = useBuilder((s) => s.expandMindmap)
  const setCanvas = useBuilder((s) => s.setCanvas)
  const [mmOpen, setMmOpen] = useState(false)
  // 머메이드 창의 글 — 열 때 지금 그림에서 뽑고, 고쳐서 「적용」 하면 그림이 따라온다(2026-10-07 추가 요청 1 · store.applyMermaid).
  const [mmText, setMmText] = useState('')
  const [mmNote, setMmNote] = useState<{ err?: string; ok?: string } | null>(null)
  const openMm = () => { if (!page) return; setMmText(mermaidOfPage(page)); setMmNote(null); setMmOpen(true) }
  const applyMm = () => {
    if (!page) return
    const g = parseMermaid(mmText)
    if (g.errors.length) { setMmNote({ err: `${g.errors[0].line}째 줄을 못 읽었어요: ${g.errors[0].text.trim()}` }); return }
    pushSnap(page.id, JSON.stringify({ els: page.els, conns: page.conns, strokes: page.strokes, detached: page.detached }))
    const r = useBuilder.getState().applyMermaid(page.id, mmText)
    if (r.errors.length) { setMmNote({ err: `${r.errors[0].line}째 줄을 못 읽었어요: ${r.errors[0].text.trim()}` }); return }
    const pg = useBuilder.getState().pages.find((x) => x.id === page.id)
    if (pg) setMmText(mermaidOfPage(pg))
    setMmNote({ ok: `적용했어요 — 상자 +${r.added} · −${r.removed} · 글/모양 고침 ${r.changed}` })
  }
  const treeFold = useBuilder((s) => s.treeFold)
  const K = useKey()
  const removePage = useBuilder((s) => s.removePage)
  const groupEls = useBuilder((s) => s.groupEls)
  const ungroupEls = useBuilder((s) => s.ungroupEls)
  const { el, patch } = useSelEl()
  const updateEl = useBuilder((s) => s.updateEl)
  const tableSel = useCanvasUI((s) => s.tableSel)
  const setTableSel = useCanvasUI((s) => s.setTableSel)
  const selElId = useCanvasUI((s) => s.selEl)
  const selEls = useCanvasUI((s) => s.selEls)
  const selConn = useCanvasUI((s) => s.selConn)
  const setSelConn = useCanvasUI((s) => s.setSelConn)
  const patchConn = useBuilder((s) => s.patchConn)
  const removeConn = useBuilder((s) => s.removeConn)
  /** **탭이 아니라 접이식이다**(EVER-SKETCH1 22dd552).
   *  탭은 「지금 어느 탭인지」를 사람이 기억해야 하고, 찾는 것이 다른 탭에 있으면
   *  네 번을 눌러 봐야 안다. 접이식은 **묶음이 늘 한 화면에** 있고, 접힌 줄에 지금 값이
   *  적혀 있어 열지 않아도 읽힌다. 여러 개를 함께 펴 둘 수 있다.
   *  **접고 편 상태는 기억한다**(C-2) — 안 그러면 고를 때마다 처음으로 돌아간다. */
  const [openSec, setOpenSec] = useState<Record<Tab, boolean>>(
    () => openSections(SECS, DEFAULT_OPEN))
  const toggle = (k: Tab) => setOpenSec((o) => {
    const next = { ...o, [k]: !o[k] }
    rememberOpenSections(next)
    return next
  })
  const page = pages.find((p) => p.id === selId)
  const conn = (selConn != null && page) ? page.conns[selConn] : undefined
  function patchC(pt: Partial<import('../../state/store').Conn>) {
    if (!page || selConn == null) return
    pushSnap(page.id, JSON.stringify({ els: page.els, conns: page.conns, strokes: page.strokes, detached: page.detached }))
    patchConn(page.id, selConn, pt)
  }
  /** 이 쪽을 통째로 되돌릴 자리를 찍는다 — ⌘Z 한 번에 통째로 돌아간다. */
  function snapPage() {
    if (!page) return
    pushSnap(page.id, JSON.stringify({ els: page.els, conns: page.conns, strokes: page.strokes, detached: page.detached }))
  }

  /** 펼쳐진 마인드맵에서 중심에 이어진 가지 수(EVER-SKETCH1 8c7c812). */
  const branchCount = page && page.mindmapCenter != null
    ? page.conns.filter((c) => c.from === page.mindmapCenter || c.to === page.mindmapCenter).length
    : 0

  /** 가장 넓게 벌어진 틈에 가지 하나를 얹는다. **있던 것은 안 건드린다.** */
  function addBranch() {
    if (!page || page.mindmapCenter == null) return
    const center = page.els.find((e) => e.id === page.mindmapCenter)
    if (!center || branchCount >= BRANCH_MAX) return
    const ids = new Set(page.conns
      .filter((c) => c.from === center.id || c.to === center.id)
      .map((c) => (c.from === center.id ? c.to : c.from)))
    const branches = page.els.filter((e) => ids.has(e.id))
    const { W, H } = pageSize(orientation)
    const spot = nextBranchSpot(center, branches, W, H)
    // 번호는 **번호표(nextElId)** 에서 받는다(2026-10-06). 전에는 `가장 큰 id + 1` 이라 번호표가 그대로였고,
    // 가지를 붙인 뒤 놓은 도형이 **같은 번호**를 받았다 — 하나를 옮기면 다른 하나도 따라 움직인다.
    const nid = nextElId()
    snapPage()
    setCanvas(page.id, {
      els: [...page.els, {
        id: nid, type: 'round', x: spot.x, y: spot.y, w: BRANCH_BOX.w, h: BRANCH_BOX.h,
        text: `가지 ${branchCount + 1}`, color: '#eaf0ff', fs: 13, tcolor: '#1c2433',
      }],
      // 화살표가 아니라 **선**이다 — 마인드맵의 가지에 방향이 없다(mindmapEls 와 같은 규칙).
      conns: [...page.conns, { from: center.id, to: nid, kind: 'straight', arrow: 'none', color: '#c3cbdb', width: 1.5 }],
      strokes: page.strokes,
      detached: page.detached,
    })
    // **새 가지를 고르지 않는다.** 고르면 패널이 요소 쪽으로 넘어가면서
    // 「＋ 가지」가 화면에서 사라진다 — 둘째 가지를 붙이려면 빈 데를 한 번 눌러야 한다.
    // 가지는 대개 두셋을 이어 붙이므로, **단추가 그 자리에 남아 있는 편**이 낫다.
  }

  /** 트리(EVER-SKETCH1 c7effe6). **뿌리는 선에서 센다** — 저장된 값이 아니라.
   *  그래서 사람이 선을 하나 그어 뿌리를 자식으로 만들어도 단추가 바로 따라온다. */
  /** 선으로 이어진 그림의 모양(2026-10-07 2차 4번 「머메이드와 도형은 별개가 아님」) — 머메이드로 펼쳤든 키 · ＋점으로 이었든 같이 본다. 마인드맵(방사형)은 제외. */
  const tree = page && page.mindmapCenter == null && (isTreePage(page) || page.conns.length > 0)
    ? treeShape(page.els, page.conns, knownOf(page)) : null
  /** 이어 붙이기 단추가 뜨는 상자 — 선을 달 수 있는 갈래면 선이 아직 없어도 뜬다(첫 가지를 여기서 붙일 수 있게). */
  const elCanBranch = !!(el && page && page.mindmapCenter == null && el.echoOf == null && !NO_CPT.includes(el.type) && el.type !== 'image')
  const elKids = tree && selElId != null ? (tree.kids.get(selElId) || []).length : 0
  const elFolded = !!(el && el.folded)
  const hiddenN = tree && selElId != null ? descendantCount(tree, selElId) : 0

  const dark = !!(page && page.bg)
  const curPaper: PaperType = (page && page.paper) || 'blank'
  const { W, H: PAGE_H } = pageSize(orientation)

  /**
   * 행이 늘어 표가 커질 때 **종이 밖으로 밀려나지 않게** 자른다(EVER-SKETCH1 bc8baa1).
   *
   * addRow 는 「행 높이는 그대로, 표 높이가 따라간다」만 안다 — 종이가 얼마나 큰지는
   * 모른다(순수 함수라 그래야 한다). 종이를 아는 것은 여기다.
   * 자를 때 y 도 같이 올린다. 높이만 자르면 아래쪽에 있던 표가 종이 끝에 걸린 채
   * 위로 자라지 못해, 결국 행 높이가 다시 줄어든다.
   * (원본은 양식 슬롯 표에만 걸었다. 이 저장소에는 슬롯이 없어 모든 표에 건다.)
   */
  function fitPage(cur: FreeEl, pt: Partial<FreeEl>): Partial<FreeEl> {
    if (pt.h == null || cur.type !== 'table') return pt
    const h = Math.min(pt.h, PAGE_H)
    const y = Math.min(Math.max(0, cur.y), Math.max(0, PAGE_H - h))
    return { ...pt, h, y }
  }
  /** 이 표가 **종이 높이를 다 쓴** 상태인가 — 여기서 행을 더 넣으면 줄 높이가 줄어든다.
   *  「표 아래끝이 종이 아래끝에 닿았는가」로 재면 안 된다. 위가 비어 있으면 fitPage 가
   *  표를 위로 밀어 올려 계속 커질 수 있다. 진짜 천장은 종이 높이 자체다. */
  const tableAtCeiling = !!el && el.type === 'table' && el.h >= PAGE_H - 1

  /** 선택이 바뀌면 종류에 맞는 묶음을 **펴 준다**(편집 중엔 안 튐 — id 변화에만 반응).
   *
   *  **나머지는 안 건드린다**(C-2). 넷을 다 닫고 하나만 열면 사람이 펴 둔 것이
   *  **고를 때마다 도로 접힌다.** 이 자동 펴기는 기억에 안 적는다 — 저장은 사람이 누를 때만. */
  useEffect(() => {
    if (!el) return
    const shapeLike = ['box', 'round', 'ellipse', 'diamond', 'triangle', 'sticky', 'image', 'icon', 'table', 'wordart']
    const k: Tab = el.type === 'table' ? 'cell' : shapeLike.includes(el.type) ? 'look' : 'text'
    setOpenSec((o) => (o[k] ? o : { ...o, [k]: true }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selElId])

  function setBg(d: boolean) { if (page) setPageBg(page.id, d ? '#0e1c30' : '') }
  const emit = (n: string) => window.dispatchEvent(new CustomEvent(n))

  // 툴바/메뉴/단축키에서 오는 커스텀 이벤트를 선택 요소/현재 페이지 기준으로 처리(호환 유지).
  useEffect(() => {
    const TC = ['#1a1a1a', '#2a78d6', '#0f9d58', '#c5501f', '#4a3aa7']
    const AL: ('left' | 'center' | 'right')[] = ['left', 'center', 'right']
    const handlers: Record<string, () => void> = {
      'ebook:bg-toggle': () => setBg(!dark),
      'ebook:fmt-bold': () => { if (el) patch({ bold: !el.bold }) },
      'ebook:fmt-italic': () => { if (el) patch({ italic: !el.italic }) },
      'ebook:fmt-underline': () => { if (el) patch({ underline: !el.underline }) },
      'ebook:fmt-color': () => { if (!el) return; const i = TC.indexOf(el.tcolor || '#1a1a1a'); patch({ tcolor: TC[(i + 1) % TC.length] }) },
      'ebook:fmt-clear': () => { if (el) patch({ bold: false, italic: false, underline: false, tcolor: undefined, align: undefined }) },
      'ebook:align-left': () => { if (el) patch({ align: 'left' }) },
      'ebook:align-center': () => { if (el) patch({ align: 'center' }) },
      'ebook:align-right': () => { if (el) patch({ align: 'right' }) },
      'ebook:align-cycle': () => { if (!el) return; const i = AL.indexOf(el.align || 'left'); patch({ align: AL[(i + 1) % 3] }) },
      'ebook:bullet': () => { if (el) patch({ text: /^[•\-]\s/.test(el.text) ? el.text : '• ' + el.text }) },
      'ebook:el-rotate': () => { if (el) patch({ rot: ((el.rot || 0) + 15) % 360 }) },
      'ebook:el-center': () => { if (el) patch({ x: Math.round((W - el.w) / 2) }) },
      'ebook:trans-cycle': () => { if (!page) return; const ks = TRANS.map((t) => t[0]); const i = ks.indexOf(page.trans || ''); setPageTrans(page.id, ks[(i + 1) % ks.length]) },
    }
    const bound = Object.entries(handlers).map(([k, fn]) => { const g = () => fn(); window.addEventListener(k, g); return [k, g] as const })
    return () => bound.forEach(([k, g]) => window.removeEventListener(k, g))
  })

  // 숫자 칸은 전부 NumInput 을 쓴다 — 치는 도중에 값을 깎지 않는다(EVER-SKETCH1 3b4846c).
  // 예전에는 한 글자마다 깎아서, 60 을 50 으로 고치려 하면 5 가 6 으로 박히고
  // 칸을 비울 수조차 없었다(NumInput.tsx 의 설명 참고).
  const numRow = (label: string, val: number, on: (n: number) => void, min = -9999): React.ReactNode => (
    <label className="insp-num"><span>{label}</span>
      <NumInput value={val} onCommit={on} min={min} ariaLabel={label} /></label>
  )

  // 선택한 사진의 실제 비율을 읽어 상자를 다시 잡는다. 자동으로 하지 않고 사용자가 누를 때만 —
  // 일부러 잘라 쓰던 구도를 멋대로 바꾸면 안 되기 때문.
  function fitImageBox() {
    if (!page || !el || el.type !== 'image' || !el.src) return
    const img = new Image()
    img.onload = () => {
      const iw = img.naturalWidth, ih = img.naturalHeight
      if (!iw || !ih) return
      const base = Math.max(el.w, el.h)          // 지금 크기감을 유지한 채 비율만 교정
      const k = base / Math.max(iw, ih)
      pushSnap(page.id, JSON.stringify({ els: page.els, conns: page.conns, strokes: page.strokes, detached: page.detached }))
      updateEl(page.id, el.id, { w: Math.max(24, Math.round(iw * k)), h: Math.max(24, Math.round(ih * k)) })
    }
    img.src = el.src
  }

  function patchTable(pt: Partial<FreeEl>) {
    if (!page || !el) return
    pushSnap(page.id, JSON.stringify({ els: page.els, conns: page.conns, strokes: page.strokes, detached: page.detached }))
    updateEl(page.id, el.id, fitPage(el, pt))
    // 행/열이 줄었으면 활성 셀을 새 범위 안으로 당겨 준다.
    // 안 그러면 마지막 행을 두 번 지울 때 두 번째 삭제가 범위 밖을 가리켜 표가 어긋난다.
    const nr = pt.rows, ncl = pt.cols
    if ((nr != null || ncl != null) && tableSel && tableSel.elId === el.id) {
      const maxR = (nr != null ? nr : Infinity) - 1
      const maxC = (ncl != null ? ncl : Infinity) - 1
      const cl = (v: number, m: number) => Math.max(0, Math.min(m, v))
      setTableSel({
        elId: el.id,
        r0: cl(tableSel.r0, maxR), c0: cl(tableSel.c0, maxC),
        r1: cl(tableSel.r1, maxR), c1: cl(tableSel.c1, maxC),
      })
    }
  }
  const ts = (tableSel && el && tableSel.elId === el.id) ? tableSel : null
  const ar = ts ? ts.r1 : 0, ac = ts ? ts.c1 : 0
  // 선택 범위(없으면 활성 셀 한 칸). 정렬·크기 버튼이 전부 이 네 값을 쓴다.
  const rng = (): [number, number, number, number] => (ts ? [ts.r0, ts.c0, ts.r1, ts.c1] : [ar, ac, ar, ac])
  const cellFs = (el && ts && el.cfs && el.cfs[Math.min(ts.r0, ts.r1) + '_' + Math.min(ts.c0, ts.c1)]) || (el ? el.fs : 12)
  const selCount = ts ? (Math.abs(ts.r1 - ts.r0) + 1) * (Math.abs(ts.c1 - ts.c0) + 1) : 0

  const curBg = (el?.cbg && ts) ? el.cbg[Math.min(ts.r0, ts.r1) + '_' + Math.min(ts.c0, ts.c1)] : undefined

  /** 접힌 줄에 적을 **지금 값**(EVER-SKETCH1 22dd552 · 93ecb00).
   *  이게 접이식의 값어치다 — 열어 보지 않아도 읽힌다.
   *  열어야만 알 수 있으면 이름만 바뀐 탭이다. */
  const secSub: Record<Tab, string> = {
    cell: el && el.type === 'table'
      ? [ts ? `${Math.min(ts.r0, ts.r1) + 1}행 ${Math.min(ts.c0, ts.c1) + 1}열` : '칸 안 고름',
         cellFs ? `${Math.round(cellFs)}pt` : ''].filter(Boolean).join(' · ') : '',
    row: el && el.type === 'table' ? `${el.rows ?? 0}행 ${el.cols ?? 0}열` : '',
    stage: curBg ? '칠함' : '없음',
    look: el ? [el.color && el.color !== 'transparent' ? '채움' : '',
                el.borderWidth ? `테두리 ${el.borderWidth}` : ''].filter(Boolean).join(' · ') || '기본' : '',
    text: el ? [`${Math.round(el.fs || 0)}pt`, el.bold ? '굵게' : '', el.italic ? '기울임' : '',
                el.underline ? '밑줄' : ''].filter(Boolean).join(' · ') : '',
    geom: el ? [`${Math.round(el.w)}×${Math.round(el.h)}`,
                `(${Math.round(el.x)}, ${Math.round(el.y)})`,
                el.rot ? `${Math.round(el.rot)}°` : '',
                el.locked ? '잠김' : ''].filter(Boolean).join(' · ') : '',
    extra: el ? [el.shadow ? '그림자' : '', el.reflect ? '반사' : ''].filter(Boolean).join(' · ') || '없음' : '',
    border: el && el.type === 'table'
      ? [el.borderWidth === 0 ? '없음' : el.borderWidth === 0.5 ? '얇게' : el.borderWidth === 2 ? '굵게' : '보통',
         el.borderDash === 'dashed' ? '파선' : el.borderDash === 'dotted' ? '점선' : '',
         el.headRow !== false ? '머리행' : ''].filter(Boolean).join(' · ') : '',
  }

  // **무엇을 고치는 중인가**(3c07f77) — 여기는 도구가 늘어선 자리라 정작 어느 것을
  // 고치고 있는지는 화면 가운데를 봐야 알 수 있었다.
  const whoLabel = el ? (EL_NAME[el.type] || '도형') : ''
  const whoSub = selCount > 1 ? `${selCount}칸 고름` : selEls.length > 1 ? `${selEls.length}개 고름` : ''
  return (
    <div className="ax-inspector">
      {el ? (
        <>
          {/* **무엇을 골랐는지 먼저 말한다**(3c07f77). 묶음보다 위라 늘 보인다. */}
          <div className="insp-who" title={whoLabel}>
            <span className="insp-who-t">{whoLabel}</span>
            {whoSub ? <span className="insp-who-s">{whoSub}</span> : null}
          </div>
          <div className="insp-body">
            {/* **트리 칸은 맨 위**(EVER-SKETCH1 c7effe6). 「＋ 자식」은 **어느 상자에** 붙이느냐가 곧 구조라
                고른 것이 있어야 뜬다 — 마인드맵의 「＋ 가지」가 쪽 칸에 있는 것과 다른 이유다.
                **뿌리를 골랐을 때는 「＋ 형제」가 「＋ 새 뿌리」로 바뀐다.** 뿌리는 부모가 없어서
                「형제」라는 말이 틀리는데, 하는 일은 같다 — 부모 없는 줄기를 하나 더 만든다. */}
            {/* **이어 붙이기**(2026-10-07 2차 → 3차 「엔터는 형제, 스페이스는 자식」). 자식은 고른 상자 오른쪽(Space), 형제는 같은 부모 아래(Enter).
                **다른 상자는 안 움직인다**(같은 부모의 자식 열만 일곱까지 부모 가운데에). 머메이드로 펼친 상자든 손으로 놓은 상자든 같다. */}
            {elCanBranch ? (<>
              <div className="insp-sec">이어 붙이기</div>
              <div className="insp-row">
                <button className="insp-pill" title="고른 상자 오른쪽에 자식을 붙입니다 (Space)"
                  onClick={() => { if (!page || selElId == null) return; addNext(page.id, selElId, 'right') }}>＋ 자식</button>
                <button className="insp-pill" title={`고른 상자 바로 아래에 형제를 붙입니다 — 같은 부모 (${K('enter')}) · 뿌리면 선 없는 또 하나의 뿌리`}
                  onClick={() => { if (!page || selElId == null) return; addNext(page.id, selElId, 'sibling') }}>＋ 형제</button>
                {elKids > 0 ? (
                  <button className="insp-pill" title={elFolded ? '아래를 다시 폅니다' : `아래 ${hiddenN}개를 숨깁니다`}
                    onClick={() => { if (!page || selElId == null) return; snapPage(); treeFold(page.id, selElId) }}>
                    {elFolded ? '▸ 펴기' : '▾ 접기'}</button>
                ) : null}
                {tree ? <button className="insp-pill" title="이 그림을 머메이드 글로 봅니다 — 고쳐서 적용할 수도 있어요" onClick={openMm}>머메이드 보기</button> : null}
              </div>
              {/* **가지를 챗봇에 묻는다**(2026-10-08 · AI 마인드맵). 근거 글(`mindSrc`)이 있는 쪽 — AI 로 만든 지도 — 에서만 나온다.
                  뿌리부터 이 상자까지의 경로를 보내고, 챗봇이 그 근거 글에 비추어 설명한다(ChatPanel 의 ebook:mind-ask). */}
              {page && page.mindSrc && tree ? (
                <div className="insp-row">
                  <button className="insp-pill mm-ask" title="이 가지를 자료에 근거해 설명해 달라고 챗봇에 묻습니다"
                    onClick={() => {
                      const path: string[] = []
                      for (let id: number | undefined = el.echoOf ?? el.id, n = 0; id != null && n < 50; id = tree.parent.get(id), n++) {
                        const t = (page.els.find((e) => e.id === id)?.text || '').trim()
                        if (t) path.unshift(t)
                      }
                      if (path.length) window.dispatchEvent(new CustomEvent('ebook:mind-ask', { detail: { path, digest: page.mindSrc } }))
                    }}>💬 챗봇에 묻기</button>
                </div>
              ) : null}
              <span style={cap}>같은 부모의 자식들은 <b>일곱까지 부모 가운데에</b> 맞춰 서고 자손이 있는 형제는 그만큼 벌어집니다 — 열 밖으로 옮긴 상자는 안 움직여요. {K('mod+Z')} 로 되돌립니다.
                {elKids > 0 ? <> 접은 것은 <b>편집 화면에서만</b> 숨고, 미리보기·발표·내보내기에는 다 펴져 나갑니다.</> : null}</span>
            </>) : null}
            {el.echoOf != null ? (<>
              <div className="insp-sec">트리</div>
              <div className="insp-hint">이 상자는 <b>아래 띠 머리에 다시 놓은 부모</b>입니다.
                고치려면 위 띠의 원본을 고치세요 — 여기 것은 앉힐 때마다 새로 그려집니다.</div>
            </>) : null}
            {/* **묶음을 일 단위로 다시 나눴다**(93ecb00, 시안 그대로 · 사용자 결정 ㄴ).
                표 = 칸 · 행 · 채우기 · 표 전체 글자 · 크기·자리 · 테두리·머리글,
                그 밖 = 모양·색 · 글자 · 크기·자리 · 효과·순서.
                **조각은 안 고쳤다** — 자리만 옮겼다(4단계에서 더한 채우기 · 테두리 없음 · 선 모양 · 정렬 그림 포함). */}
            {el.type === 'table' ? (<>
              <Acc k="cell" t="칸" sub={secSub.cell} sec={openSec} onToggle={toggle}>
              <div className="insp-sec">활성 셀 {ts ? `(${Math.min(ts.r0, ts.r1) + 1}행, ${Math.min(ts.c0, ts.c1) + 1}열)` : '— 표에서 셀 클릭'}</div>
              <div className="insp-sec">셀 정렬{selCount > 1 ? ` (${selCount}칸)` : ''}</div>
              {/* **그림도 말도 파워포인트·한글을 따른다**(EVER-SKETCH1 b1911d3). */}
              <div className="insp-row seg">
                {(['left', 'center', 'right'] as const).map((d) => (
                  <button key={d} title={ALIGN_LABEL[d]}
                    onClick={() => patchTable(setAlignRange(el, ...rng(), d))}><AlignIcon dir={d} /></button>
                ))}
              </div>
              <div className="insp-row seg">
                {(['top', 'middle', 'bottom'] as const).map((d) => (
                  <button key={d} title={VALIGN_LABEL[d]}
                    onClick={() => patchTable(setVAlignRange(el, ...rng(), d))}><VAlignIcon dir={d} /></button>
                ))}
              </div>
              <div className="insp-sec">셀 글자 크기</div>
              <div className="insp-row">
                <label className="insp-num sm"><span>크기</span>
                  <NumInput value={cellFs} min={6} max={200} ariaLabel="셀 글자 크기"
                    onCommit={(n) => patchTable(setCellFsRange(el, ...rng(), n))} /></label>
                <button className="insp-pill" onClick={() => patchTable(setCellFsRange(el, ...rng(), null))}>표 기본으로</button>
              </div>
              {/* **병합은 위 툴바에 있다**(3c07f77). 여기에도 있어서 두 곳이었다.
                  툴바 쪽이 본체다 — 왜 못 누르는지 알려 주는 말까지 붙어 있다.
                  여기 있던 것은 그런 것이 없는 맨 버튼 둘이었고, 「병합 해제」는
                  병합 안 된 칸에서도 눌렸다. 그 자리는 「채우기」 묶음의 안내 문장이 알려 준다. */}
              </Acc>
              <Acc k="row" t="행" sub={secSub.row} sec={openSec} onToggle={toggle}>
              <div className="insp-sec">행</div>
              <div className="insp-row">
                <button className="insp-pill" onClick={() => patchTable(addRow(el, ar))}>↑ 위에 추가</button>
                <button className="insp-pill" onClick={() => patchTable(addRow(el, ar + 1))}>↓ 아래 추가</button>
                <button className="insp-pill danger" onClick={() => patchTable(delRow(el, ar))}>🗑 행 삭제</button>
              </div>
              {/* 천장에 닿았을 때만 말한다. 늘 띄워 두면 아무도 안 읽는다. */}
              {tableAtCeiling ? (
                <div className="insp-hint warn">이 표가 종이 아래끝까지 찼어요. 여기서 행을 더 넣으면
                  <b> 줄 높이가 줄어듭니다.</b> 표를 위로 옮기거나, 다음 장에 이어 적어 주세요.</div>
              ) : (
                <div className="insp-hint">행을 넣으면 <b>줄 높이는 그대로</b> 두고 표가 그만큼 커져요.</div>
              )}
              <div className="insp-sec">열</div>
              <div className="insp-row">
                <button className="insp-pill" onClick={() => patchTable(addCol(el, ac))}>← 왼쪽 추가</button>
                <button className="insp-pill" onClick={() => patchTable(addCol(el, ac + 1))}>→ 오른쪽 추가</button>
                <button className="insp-pill danger" onClick={() => patchTable(delCol(el, ac))}>🗑 열 삭제</button>
              </div>
              </Acc>
              {/* **보통 표에도 채우기**(EVER-SKETCH1 b1911d3 · 73b6825). 이름은 도구줄·도형과 같은
                  「채우기」다. (원본의 양식 표 「진행 표시」 색·이름표는 이 저장소에 없다 — 자유 색 여덟만.) */}
              <Acc k="stage" t="채우기" sub={secSub.stage} sec={openSec} onToggle={toggle}>
              <div className="insp-sec">채우기</div>
              <div className="insp-row es-cbg-row">
                {cellColors().map((color) => (
                  <button key={color} type="button"
                    className={'es-cbg' + (curBg === color ? ' on' : '')}
                    style={{ background: cellBackground(color) }}
                    title={color}
                    disabled={!ts}
                    onClick={() => { if (ts) patchTable(setCellBgRange(el, ts.r0, ts.c0, ts.r1, ts.c1, color)) }} />
                ))}
                <button type="button" className="es-cbg clear" title="색 지우기" disabled={!ts}
                  onClick={() => { if (ts) patchTable(setCellBgRange(el, ts.r0, ts.c0, ts.r1, ts.c1, null)) }}>✕</button>
                {/* 목록에 없는 색도 쓴다 — 여기만 막아 두면 「그 색은 왜 안 되나」가 된다. */}
                <span className="es-cbg-more" title="다른 색">
                  <ColorPicker value={curBg}
                    disabled={!ts}
                    onChange={(c) => { if (ts) patchTable(setCellBgRange(el, ts.r0, ts.c0, ts.r1, ts.c1, c)) }} />
                </span>
              </div>
              <div className="insp-hint">칸을 끌어 여러 칸을 한 번에 칠할 수 있어요. 위 도구줄의 <b>채우기</b>도 같은 일을 합니다.
                병합도 같은 방식이에요 — 위 툴바의 <b>표 ⤢ 병합</b>.</div>
              </Acc>
              <Acc k="text" t="표 전체 글자" sub={secSub.text} sec={openSec} onToggle={toggle}>
              <div className="insp-sec">글자</div>
              <div className="insp-row">
                <button className={'insp-b' + (el.bold ? ' on' : '')} onClick={() => patch({ bold: !el.bold })}><b>B</b></button>
                <button className={'insp-b' + (el.italic ? ' on' : '')} onClick={() => patch({ italic: !el.italic })}><i>I</i></button>
                <button className={'insp-b' + (el.underline ? ' on' : '')} onClick={() => patch({ underline: !el.underline })}><u>U</u></button>
                <label className="insp-num sm"><span>크기</span>
                  <NumInput value={el.fs} min={6} max={200} ariaLabel="글자 크기"
                    onCommit={(n) => patch({ fs: n })} /></label>
                <ColorPicker value={el.tcolor || '#1a1a1a'} onChange={(c) => patch({ tcolor: c })} />
              </div>
              <div className="insp-sec">정렬</div>
              <div className="insp-row seg">
                {(['left', 'center', 'right'] as const).map((d) => (
                  <button key={d} className={(el.align || 'left') === d ? 'on' : ''} title={ALIGN_LABEL[d]}
                    onClick={() => patch({ align: d })}><AlignIcon dir={d} /></button>
                ))}
              </div>
              <div className="insp-row">
                <button className="insp-pill" onClick={() => emit('ebook:bullet')}>글머리표</button>
                <button className="insp-pill" onClick={() => emit('ebook:fmt-clear')}>서식 지우기</button>
              </div>
              </Acc>
              <Acc k="geom" t="크기 · 자리" sub={secSub.geom} sec={openSec} onToggle={toggle}>
              <div className="insp-sec">크기</div>
              <div className="insp-row">{numRow('너비', el.w, (n) => patch({ w: Math.max(10, n) }), 10)}{numRow('높이', el.h, (n) => patch({ h: Math.max(10, n) }), 10)}</div>
              <div className="insp-sec">위치</div>
              <div className="insp-row">{numRow('X', el.x, (n) => patch({ x: n }))}{numRow('Y', el.y, (n) => patch({ y: n }))}</div>
              <div className="insp-sec">회전</div>
              <div className="insp-row">{numRow('각도', el.rot || 0, (n) => patch({ rot: ((n % 360) + 360) % 360 }))}<button className="insp-pill" onClick={() => emit('ebook:el-center')}>가로 중앙</button></div>
              <div className="insp-sec">뒤집기</div>
              <div className="insp-row">
                <button className={'insp-pill' + (el.flipH ? ' on' : '')} onClick={() => patch({ flipH: !el.flipH })}>↔ 좌우</button>
                <button className={'insp-pill' + (el.flipV ? ' on' : '')} onClick={() => patch({ flipV: !el.flipV })}>↕ 상하</button>
              </div>
              <div className="insp-sec">잠금</div>
              <div className="insp-row">
                <button className={'insp-pill' + (el.locked ? ' on' : '')} onClick={() => patch({ locked: !el.locked })}>{el.locked ? '🔒 잠금 해제' : '🔓 잠금'}</button>
              </div>
              <div className="insp-row" style={{ marginTop: 10 }}>
                <button className="insp-pill" onClick={() => emit('ebook:dup')}>⧉ 복제</button>
                <button className="insp-pill danger" onClick={() => emit('ebook:del')}>🗑 삭제</button>
              </div>
              <div className="insp-sec">그룹</div>
              <div className="insp-row">
                <button className="insp-pill" disabled={selEls.length < 2} onClick={() => { if (page && selEls.length >= 2) groupEls(page.id, selEls) }}>⧉ 그룹화</button>
                <button className="insp-pill" disabled={el.groupId == null} onClick={() => { if (page && el.groupId != null) ungroupEls(page.id, page.els.filter((x) => x.groupId === el.groupId).map((x) => x.id)) }}>그룹 해제</button>
              </div>
              <span style={cap}>여러 요소를 Shift+클릭하거나 빈 곳을 드래그해 함께 고른 뒤 그룹화하세요.</span>
              </Acc>
              <Acc k="border" t="테두리 · 머리글" sub={secSub.border} sec={openSec} onToggle={toggle}>
              <div className="insp-sec">테두리 · 헤더</div>
              <div className="insp-row">
                <ColorPicker value={el.borderColor || '#cfd5e2'} onChange={(c) => patchTable({ borderColor: c })} />
                <select className="insp-sel" style={{ width: 'auto' }} value={el.borderWidth ?? 1} onChange={(e) => patchTable({ borderWidth: Number(e.target.value) })}>
                  {/* **「없음」을 넣는다**(EVER-SKETCH1 8927a75). 0 이면 그리는 쪽에서 `0px solid` 가 되어 선이 사라진다. */}
                  <option value={0}>없음</option>
                  <option value={0.5}>얇게</option><option value={1}>보통</option><option value={2}>굵게</option>
                </select>
                {/* 선 모양 — 도구줄의 도형 테두리와 **같은 값**(`borderDash` · EVER-SKETCH1 f586a7b)을 쓴다. */}
                <select className="insp-sel" style={{ width: 'auto' }} title="선 모양"
                  value={el.borderDash || 'solid'}
                  onChange={(e) => patchTable({ borderDash: e.target.value as 'solid' | 'dashed' | 'dotted' })}>
                  <option value="solid">실선</option>
                  <option value="dashed">파선</option>
                  <option value="dotted">점선</option>
                </select>
                <label className="insp-check"><input type="checkbox" checked={el.headRow !== false} onChange={(e) => patchTable({ headRow: e.target.checked })} /> 헤더행</label>
              </div>
              <span style={cap}>셀을 드래그하면 범위가 잡힙니다(Shift+클릭도 범위). 표 위쪽·왼쪽 띠를 누르면 열·줄 통째로, 띠의 경계선을 끌면 열 너비·행 높이가 바뀝니다. 글자 수정은 칸을 더블클릭. 표 자체를 옮길 땐 왼쪽 위 모서리의 ⠿ 손잡이를 끄세요.</span>
              </Acc>
            </>) : (<>
              <Acc k="look" t="모양 · 색" sub={secSub.look} sec={openSec} onToggle={toggle}>
              {el.type === 'image' && el.src ? (<>
                <div className="insp-sec">사진</div>
                <div className="insp-row">
                  <button className="insp-pill" onClick={() => fitImageBox()}>⤢ 사진 비율 맞추기</button>
                </div>
                <div className="insp-hint">상자를 사진 원래 비율로 맞춰 위아래 여백을 없앱니다.</div>
              </>) : null}
              {/* **모양 바꾸기**(2026-10-07 2차 2번) — 도구줄 팝업과 같은 갈래 · 같은 꼭짓점. 크기 · 색 · 글자는 그대로 두고 갈래만 바꾼다. */}
              {SHAPES.some((sh) => sh.t === el.type) ? (<>
                <div className="insp-sec">모양</div>
                <div className="shp-grid insp-shapes">
                  {SHAPES.map((sh) => (
                    <button key={sh.t} className={'shp-cell' + (el.type === sh.t ? ' on' : '')} title={sh.label}
                      onClick={() => patch({ type: sh.t })}>
                      <span className={'shp-sh ' + sh.t} style={{ clipPath: polyClip(sh.t), borderRadius: SHAPE_RADIUS[sh.t] }} />
                    </button>
                  ))}
                </div>
              </>) : null}
              <div className="insp-sec">프리셋 스타일</div>
              <div className="insp-sw">{PRESETS.map((ps) => (<span key={ps.name} className="insp-preset" title={ps.name} style={{ background: ps.color, color: ps.tcolor }} onClick={() => patch({ color: ps.color, tcolor: ps.tcolor })}>가</span>))}</div>
              <div className="insp-sec">채우기</div>
              <div className="insp-row"><ColorPicker value={el.color} onChange={(c) => patch({ color: c })} allowTransparent /><span style={{ fontSize: 12, color: '#5b6270' }}>도형 색</span></div>
              <div className="insp-sw">{FCOLORS.map((c) => (<span key={c} className={'insp-chip' + (el.color === c ? ' on' : '')} style={{ background: c === 'transparent' ? 'repeating-conic-gradient(#ccc 0 25%,#fff 0 50%) 50%/8px 8px' : c }} onClick={() => patch({ color: c })} />))}</div>
              <div className="insp-sec">테두리</div>
              <div className="insp-row"><ColorPicker value={el.borderColor || '#cfd5e2'} onChange={(c) => patch({ borderColor: c })} allowTransparent /><select className="insp-sel" style={{ width: 'auto' }} value={el.borderWidth ?? 1.5} onChange={(e) => patch({ borderWidth: Number(e.target.value) })}><option value={0}>없음</option><option value={1}>얇게</option><option value={1.5}>보통</option><option value={3}>굵게</option></select><select className="insp-sel" style={{ width: 'auto' }} title="선 모양" value={el.borderDash || 'solid'} onChange={(e) => patch({ borderDash: e.target.value as 'solid' | 'dashed' | 'dotted' })}><option value="solid">실선</option><option value="dashed">파선</option><option value="dotted">점선</option></select></div>
              <div className="insp-sec">불투명도</div>
              <div className="insp-row"><input className="insp-range" type="range" min={0} max={100} value={Math.round((el.opacity ?? 1) * 100)} onChange={(e) => patch({ opacity: Number(e.target.value) / 100 })} /><span style={{ fontSize: 12, color: '#5b6270', width: 42, textAlign: 'right' }}>{Math.round((el.opacity ?? 1) * 100)}%</span></div>
              </Acc>
              <Acc k="text" t="글자" sub={secSub.text} sec={openSec} onToggle={toggle}>
              <div className="insp-sec">글자</div>
              <div className="insp-row">
                <button className={'insp-b' + (el.bold ? ' on' : '')} onClick={() => patch({ bold: !el.bold })}><b>B</b></button>
                <button className={'insp-b' + (el.italic ? ' on' : '')} onClick={() => patch({ italic: !el.italic })}><i>I</i></button>
                <button className={'insp-b' + (el.underline ? ' on' : '')} onClick={() => patch({ underline: !el.underline })}><u>U</u></button>
                <label className="insp-num sm"><span>크기</span>
                  <NumInput value={el.fs} min={6} max={200} ariaLabel="글자 크기"
                    onCommit={(n) => patch({ fs: n })} /></label>
                <ColorPicker value={el.tcolor || '#1a1a1a'} onChange={(c) => patch({ tcolor: c })} />
              </div>
              <div className="insp-sec">정렬</div>
              <div className="insp-row seg">
                {(['left', 'center', 'right'] as const).map((d) => (
                  <button key={d} className={(el.align || 'left') === d ? 'on' : ''} title={ALIGN_LABEL[d]}
                    onClick={() => patch({ align: d })}><AlignIcon dir={d} /></button>
                ))}
              </div>
              <div className="insp-row">
                <button className="insp-pill" onClick={() => emit('ebook:bullet')}>글머리표</button>
                <button className="insp-pill" onClick={() => emit('ebook:fmt-clear')}>서식 지우기</button>
              </div>
              </Acc>
              <Acc k="geom" t="크기 · 자리" sub={secSub.geom} sec={openSec} onToggle={toggle}>
              <div className="insp-sec">크기</div>
              <div className="insp-row">{numRow('너비', el.w, (n) => patch({ w: Math.max(10, n) }), 10)}{numRow('높이', el.h, (n) => patch({ h: Math.max(10, n) }), 10)}</div>
              <div className="insp-sec">위치</div>
              <div className="insp-row">{numRow('X', el.x, (n) => patch({ x: n }))}{numRow('Y', el.y, (n) => patch({ y: n }))}</div>
              <div className="insp-sec">회전</div>
              <div className="insp-row">{numRow('각도', el.rot || 0, (n) => patch({ rot: ((n % 360) + 360) % 360 }))}<button className="insp-pill" onClick={() => emit('ebook:el-center')}>가로 중앙</button></div>
              <div className="insp-sec">뒤집기</div>
              <div className="insp-row">
                <button className={'insp-pill' + (el.flipH ? ' on' : '')} onClick={() => patch({ flipH: !el.flipH })}>↔ 좌우</button>
                <button className={'insp-pill' + (el.flipV ? ' on' : '')} onClick={() => patch({ flipV: !el.flipV })}>↕ 상하</button>
              </div>
              </Acc>
              <Acc k="extra" t="효과 · 순서" sub={secSub.extra} sec={openSec} onToggle={toggle}>
              <div className="insp-sec">효과</div>
              <div className="insp-row">
                <label className="insp-check"><input type="checkbox" checked={!!el.shadow} onChange={(e) => patch({ shadow: e.target.checked })} /> 그림자</label>
                <label className="insp-check"><input type="checkbox" checked={!!el.reflect} onChange={(e) => patch({ reflect: e.target.checked })} /> 반사</label>
              </div>
              <div className="insp-sec">순서</div>
              <div className="insp-row">
                <button className="insp-pill" onClick={() => emit('ebook:z-front')}>맨 앞으로</button>
                <button className="insp-pill" onClick={() => emit('ebook:z-back')}>맨 뒤로</button>
              </div>
              <div className="insp-sec">잠금</div>
              <div className="insp-row">
                <button className={'insp-pill' + (el.locked ? ' on' : '')} onClick={() => patch({ locked: !el.locked })}>{el.locked ? '🔒 잠금 해제' : '🔓 잠금'}</button>
              </div>
              <div className="insp-row" style={{ marginTop: 10 }}>
                <button className="insp-pill" onClick={() => emit('ebook:dup')}>⧉ 복제</button>
                <button className="insp-pill danger" onClick={() => emit('ebook:del')}>🗑 삭제</button>
              </div>
              <div className="insp-sec">그룹</div>
              <div className="insp-row">
                <button className="insp-pill" disabled={selEls.length < 2} onClick={() => { if (page && selEls.length >= 2) groupEls(page.id, selEls) }}>⧉ 그룹화</button>
                <button className="insp-pill" disabled={el.groupId == null} onClick={() => { if (page && el.groupId != null) ungroupEls(page.id, page.els.filter((x) => x.groupId === el.groupId).map((x) => x.id)) }}>그룹 해제</button>
              </div>
              <span style={cap}>여러 요소를 Shift+클릭하거나 빈 곳을 드래그해 함께 고른 뒤 그룹화하세요.</span>
              </Acc>
            </>)}
          </div>
        </>
      ) : conn ? (
        <div className="insp-body">
          <div className="insp-h">연결선</div>
          <div className="insp-sec">종류</div>
          <div className="insp-row seg">
            <button className={(conn.kind || 'ortho') === 'straight' ? 'on' : ''} onClick={() => patchC({ kind: 'straight' })}>직선</button>
            <button className={(conn.kind || 'ortho') === 'ortho' ? 'on' : ''} onClick={() => patchC({ kind: 'ortho' })}>직각</button>
            <button className={(conn.kind || 'ortho') === 'curve' ? 'on' : ''} onClick={() => patchC({ kind: 'curve' })}>곡선</button>
          </div>
          <div className="insp-sec">화살촉</div>
          <div className="insp-row seg">
            <button className={(conn.arrow || 'end') === 'none' ? 'on' : ''} onClick={() => patchC({ arrow: 'none' })}>없음</button>
            <button className={(conn.arrow || 'end') === 'end' ? 'on' : ''} onClick={() => patchC({ arrow: 'end' })}>한쪽</button>
            <button className={(conn.arrow || 'end') === 'both' ? 'on' : ''} onClick={() => patchC({ arrow: 'both' })}>양쪽</button>
          </div>
          <div className="insp-sec">두께 · 점선</div>
          <div className="insp-row">
            <select className="insp-sel" style={{ width: 'auto' }} value={conn.width || 2} onChange={(e) => patchC({ width: Number(e.target.value) })}>
              <option value={1}>얇게</option><option value={2}>보통</option><option value={3.5}>굵게</option><option value={5}>매우 굵게</option>
            </select>
            <label className="insp-check"><input type="checkbox" checked={!!conn.dash} onChange={(e) => patchC({ dash: e.target.checked })} /> 점선</label>
          </div>
          <div className="insp-sec">색</div>
          <div className="insp-row"><ColorPicker value={conn.color || '#8b93a5'} onChange={(c) => patchC({ color: c })} /></div>
          <div className="insp-sw">{['#8b93a5', '#1a1a1a', '#2a78d6', '#e0553c', '#2fa37a', '#7a5af8'].map((c) => (<span key={c} className={'insp-chip' + ((conn.color || '#8b93a5') === c ? ' on' : '')} style={{ background: c }} onClick={() => patchC({ color: c })} />))}</div>
          <div className="insp-row" style={{ marginTop: 10 }}>
            <button className="insp-pill danger" onClick={() => { if (page && selConn != null) { pushSnap(page.id, JSON.stringify({ els: page.els, conns: page.conns, strokes: page.strokes, detached: page.detached })); removeConn(page.id, selConn); setSelConn(null) } }}>🗑 연결선 삭제</button>
          </div>
          <span style={cap}>연결선을 클릭해 선택하고, 가운데를 드래그하면 꺾을 수 있어요.</span>
        </div>
      ) : (
        <div className="insp-body">
          <div className="insp-h">페이지</div>
          <div className="insp-row">
            <button className="insp-pill" onClick={() => addCard('slide')}>＋ 슬라이드</button>
            <button className="insp-pill" onClick={() => { if (selId != null) duplicatePage(selId) }}>⧉ 복제</button>
            <button className="insp-pill danger" onClick={() => { if (selId != null) removePage(selId) }}>🗑 삭제</button>
          </div>
          {/* 이미 카드로 만들어 둔 마인드맵에만 나온다(EVER-SKETCH1 68a5627). 새로 넣는 것은 처음부터
              요소로 펼쳐져 나오므로 이 단추가 필요 없다.
              열 때 자동으로 바꾸지 않는 이유: 잠금 플래그 하나 떼는 것과 달리
              **내용을 통째로 다시 쓰는 일**이고, 필드를 정성껏 채워 둔 사람의 자료다. */}
          {page && page.cardKey === 'mindmap' ? (<>
            <div className="insp-row">
              <button className="insp-pill" onClick={() => { if (selId != null) expandMindmap(selId) }}>
                ⤢ 요소로 펼치기
              </button>
            </div>
            <span style={cap}>가지를 하나씩 옮기고 크기를 바꿀 수 있게 됩니다.
              대신 오른쪽 칸으로 한 번에 고치는 건 그때부터 안 돼요 — 잘못 눌렀으면 {K('mod+Z')} 로 되돌립니다.</span>
          </>) : null}

          {/* **＋ 새 뿌리**(EVER-SKETCH1 c7effe6). 아무것도 안 골랐을 때 여기 있다 —
              마인드맵의 「＋ 가지」와 같은 자리라 손이 기억한다.
              글로 줄기를 둘 쓰는 길도 그대로 열려 있고, 그렇게 들어온 뿌리도 여기 수에 잡힌다. */}
          {tree ? (<>
            <div className="insp-sec">도식</div>
            <div className="insp-row">
              <button className="insp-pill" title="빈 자리에 선 없는 상자를 하나 만듭니다"
                onClick={() => { if (!page) return; snapPage(); useBuilder.getState().treeAdd(page.id, null, 'root') }}>＋ 새 상자</button>
              {/* **머메이드 보기**(2026-10-07 2차 4번) — 「어떤 도식화를 하면 그것의 머메이드 소스를 볼 수 있도록」. 지금 그림에서 뽑는다. */}
              <button className="insp-pill" title="이 그림을 머메이드 글로 봅니다 — 고쳐서 적용할 수도 있어요" onClick={openMm}>머메이드 보기</button>
              <span className="insp-hint" style={{ margin: 0 }}>지금 뿌리 {tree.roots.length}개</span>
            </div>
            <span style={cap}>상자를 고르면 <b>＋ 자식 · ＋ 형제 · 접기</b>가 나옵니다. 붙여도 있던 상자는 안 움직여요(같은 부모의 자식들만 가운데 맞춤).</span>
          </>) : null}

          {/* **＋ 가지**(EVER-SKETCH1 8c7c812). 펼쳐진 마인드맵에만 나온다 —
              `mindmapCenter` 가 중심 도형 id 를 들고 있어 「이게 마인드맵이다」와
              「어디에 이을까」를 한꺼번에 알려 준다.
              **있던 가지는 안 건드린다.** 가장 넓게 벌어진 틈에 하나 얹을 뿐이라,
              사람이 옮겨 둔 자리가 흐트러지지 않는다. */}
          {page && page.mindmapCenter != null && page.els.some((e) => e.id === page.mindmapCenter) ? (<>
            <div className="insp-sec">마인드맵</div>
            <div className="insp-row">
              <button className="insp-pill" disabled={branchCount >= BRANCH_MAX}
                title={branchCount >= BRANCH_MAX
                  ? `가지는 ${BRANCH_MAX}개까지예요 — 더 늘리면 선이 얼룩처럼 보입니다`
                  : '가장 넓게 벌어진 자리에 하나 붙입니다'}
                onClick={addBranch}>＋ 가지</button>
              <span className="insp-hint" style={{ margin: 0 }}>지금 {branchCount}개</span>
            </div>
            <span style={cap}>있던 가지는 안 건드려요. 빈 자리에 하나 얹습니다.</span>
          </>) : null}

          <div className="insp-sec">배경</div>
          <div className="insp-row seg">
            <button className={!dark ? 'on' : ''} onClick={() => setBg(false)}>밝게</button>
            <button className={dark ? 'on' : ''} onClick={() => setBg(true)}>어둡게</button>
          </div>
          <div className="insp-sec">종이</div>
          <div className="insp-row"><select className="insp-sel" value={curPaper} onChange={(e) => { if (page) setPaper(page.id, e.target.value as PaperType) }}>{PAPER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
          <div className="insp-sec">전환</div>
          <div className="insp-row wrap">{TRANS.map(([k, lab]) => (<button key={k || 'none'} className={'insp-pill' + ((page?.trans || '') === k ? ' on' : '')} onClick={() => page && setPageTrans(page.id, k)}>{lab}</button>))}</div>
          <div className="insp-sec">방향</div>
          <div className="insp-row seg">
            <button className={orientation === 'portrait' ? 'on' : ''} onClick={() => setOrientation('portrait')}>세로</button>
            <button className={orientation === 'landscape' ? 'on' : ''} onClick={() => setOrientation('landscape')}>가로</button>
          </div>
          <div className="insp-sec">내용</div>
          <div className="ax-editwrap"><Editor /></div>
        </div>
      )}
      {/* 머메이드 소스 창(2026-10-07 2차 4번 → 추가 요청 1) — 지금 그림에서 뽑은 글(cards/mermaidOut)을 **고쳐서 「적용」 하면 그림이 따라온다**(store.applyMermaid).
          번호(n1 …)가 같은 상자는 자리 · 모양 그대로 · 뺀 번호는 그 상자만 지움 · 새 번호는 부모 옆에 · 선은 글대로. 못 읽는 줄이 있으면 적용하지 않고 몇째 줄인지 말한다. */}
      {mmOpen && page ? (() => {
        const dirty = mmText.trim() !== mermaidOfPage(page).trim()
        return (
          <Modal title="머메이드 소스" onClose={() => setMmOpen(false)} cancel="closeX" size="sm" className="mm-view"
            footer={<>
              <button className="insp-pill" onClick={() => { void navigator.clipboard?.writeText(mmText) }}>복사</button>
              <button className="insp-pill" disabled={!dirty} title={dirty ? '고친 글대로 그림을 바꿉니다' : '아직 고친 데가 없어요'} onClick={applyMm}>적용</button>
            </>}>
            <textarea className="mm-src" value={mmText} spellCheck={false} onChange={(e) => { setMmText(e.target.value); setMmNote(null) }}
              rows={Math.min(18, Math.max(6, mmText.split('\n').length + 1))}
              style={{ width: '100%', fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 12, lineHeight: 1.5, resize: 'vertical' }} />
            <span className="mm-note" style={{ ...cap, color: mmNote && mmNote.err ? '#c0392b' : undefined }}>
              {mmNote ? (mmNote.err || mmNote.ok) : <>지금 그림에서 뽑은 글이에요. 고쳐서 「적용」 하면 그림이 따라와요 — 같은 번호(n1 …)는 자리 그대로 · 새 번호는 부모 옆에 · 뺀 번호는 지워져요. 되돌리기는 {K('mod+Z')}.</>}
            </span>
          </Modal>
        )
      })() : null}
    </div>
  )
}
