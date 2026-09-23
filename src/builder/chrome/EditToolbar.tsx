import { useCanvasUI } from '../../state/canvasUI'
import { useKey } from '../../ui/keyLabel'
import type { Tool } from '../../state/canvasUI'
import { useSelEl } from '../useSelEl'
import ColorPicker from './ColorPicker'
import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Pen, Highlighter, Eraser } from 'lucide-react'
import { useAutosave } from '../../persistence/autosave'
import { useBuilder, type PaperType } from '../../state/store'
import { PAPER_OPTIONS } from '../../cards/paper'
import type { FreeEl } from '../../state/store'
import { mergeCovering, mergeRange, unmergeAt } from '../../canvas/tableOps'

let FMT: Partial<FreeEl> | null = null

const TEXT_COLORS = ['#1a1a1a', '#2a78d6', '#0f9d58', '#c5501f', '#4a3aa7', '#ffffff']
const PEN_COLORS = ['#111318', '#2462EB', '#e0483d', '#0f9d58']
const HL_COLORS = ['#ffd600', '#8ef58a', '#ff9ecb', '#9ad7ff']


// 갤러리에 노출하는 도형 목록. star4·banner·callout 은 "목록에서만" 뺀 것이라
// Tool 타입 / .fel.* 렌더러 / exportPptx 매핑은 그대로 둔다 — 기존 문서가 깨지면 안 되므로.
const SHAPE_CATS: { cat: string; items: { t: Tool; label: string }[] }[] = [
  { cat: '기본', items: [
    { t: 'box', label: '사각형' },
    { t: 'round', label: '둥근 사각형' },
    { t: 'ellipse', label: '원' },
    { t: 'diamond', label: '마름모' },
    { t: 'triangle', label: '삼각형' },
    { t: 'hexagon', label: '육각형' },
    { t: 'pentagon', label: '오각형' },
    { t: 'parallelogram', label: '평행사변형' },
    { t: 'star5', label: '별' },
  ] },
  { cat: '화살표', items: [
    { t: 'arrowR', label: '오른쪽 화살표' },
    { t: 'arrowL', label: '왼쪽 화살표' },
    { t: 'arrowU', label: '위 화살표' },
    { t: 'arrowD', label: '아래 화살표' },
    { t: 'chevron', label: '갈매기(진행)' },
  ] },
]
const SHAPES: { t: Tool; label: string }[] = SHAPE_CATS.flatMap((c) => c.items)

// 도형 버튼 — PowerPoint 식. 아이콘은 항상 같은 심볼이고, 버튼 어디를 눌러도 갤러리가 열린다.
// 셀 미리보기는 index.css 의 clip-path 를 재사용하므로 캔버스에 그려지는 모양과 동일하다.
// 도형 무장 중이라는 신호는 버튼의 .on 하이라이트뿐 — 해제는 Esc(Hotkeys) 또는 다른 도구 선택.
function ShapeTool() {
  const tool = useCanvasUI((s) => s.tool)
  const setTool = useCanvasUI((s) => s.setTool)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const ref = useRef<HTMLButtonElement>(null)
  const active = SHAPES.some((sh) => sh.t === tool)
  const toggle = () => {
    if (open) { setOpen(false); return }
    const r = ref.current?.getBoundingClientRect()
    if (r) setPos({ x: r.left, y: r.bottom + 6 })
    setOpen(true)
  }
  return (
    <span className="shp-wrap">
      <button ref={ref} className={'ib shp-btn' + (active ? ' on' : '')} title="도형" onClick={toggle}>
        <svg className="shp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden>
          <circle cx="9.5" cy="8.5" r="5.2" />
          <rect x="9" y="10" width="10.5" height="10.5" rx="2.2" />
        </svg>
      </button>
      {open && pos ? createPortal(
        <>
          <div className="shp-back" onClick={() => setOpen(false)} />
          <div className="shp-pop cats" style={{ left: pos.x, top: pos.y }}>
            {SHAPE_CATS.map((c) => (
              <div key={c.cat} className="shp-cat">
                <div className="shp-cat-h">{c.cat}</div>
                <div className="shp-grid">
                  {c.items.map((sh) => (
                    <button key={sh.t} className={'shp-cell' + (tool === sh.t ? ' on' : '')} title={sh.label}
                      onClick={() => { setTool(sh.t); setOpen(false) }}>
                      <span className={'shp-sh ' + sh.t} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>, document.body) : null}
    </span>
  )
}

/**
 * 표 도구 — 도구줄 둘째 줄(EVER-SKETCH1 b721df0 TableTools, 양식 슬롯·로드맵 안내는 뺐다).
 *
 * **표를 안 골랐을 때도 사라지지 않는다.** 고르는 순간 묶음이 새로 생기면 도구줄이 높아지고,
 * 그만큼 아래 문서가 통째로 내려간다(원본 실측 42px). 칸을 끌던 사람은 한 줄 아래까지 고르게 된다.
 * 끌어 고른 범위가 몇 칸인지도 여기서 말해 준다.
 */
function TableTools() {
  const { el, patch } = useSelEl()
  const tableSel = useCanvasUI((s) => s.tableSel)
  const table = el && el.type === 'table' ? el : null

  if (!table) {
    return (
      <span className="ax-grp gs off">
        <span className="lab">표</span>
        <button className="tbtn" disabled title="표를 고르면 쓸 수 있어요">⤢ 병합</button>
        <button className="tbtn" disabled title="표를 고르면 쓸 수 있어요">⤡ 해제</button>
        <span className="tbtn-hint">표의 칸을 고르세요</span>
      </span>
    )
  }

  const ts = tableSel && tableSel.elId === table.id ? tableSel : null
  const rows = ts ? Math.abs(ts.r1 - ts.r0) + 1 : 0
  const cols = ts ? Math.abs(ts.c1 - ts.c0) + 1 : 0
  const ranged = rows * cols > 1
  const onMerged = !!ts && !!mergeCovering(table.merges, ts.r1, ts.c1)
  const why = !ts ? '표 안에서 칸을 클릭하세요'
    : !ranged ? '두 칸 이상을 끌어서 고르세요'
    : `${rows}행 ${cols}열을 하나로 합칩니다`

  return (
    <span className="ax-grp gs">
      <span className="lab">표</span>
      <button className="tbtn" title={why} disabled={!ranged}
        onClick={() => { if (ts) patch(mergeRange(table, ts.r0, ts.c0, ts.r1, ts.c1)) }}>⤢ 병합</button>
      <button className="tbtn" title={onMerged ? '이 칸의 병합을 풉니다' : '병합된 칸을 고르세요'}
        disabled={!onMerged}
        onClick={() => { if (ts) patch(unmergeAt(table, ts.r1, ts.c1)) }}>⤡ 해제</button>
      <span className="tbtn-hint">
        {ts ? (ranged ? `${rows}×${cols} 선택` : `${Math.min(ts.r0, ts.r1) + 1}행 ${Math.min(ts.c0, ts.c1) + 1}열`)
          : '칸을 끌어서 선택'}
      </span>
    </span>
  )
}

export default function EditToolbar() {
  const K = useKey()
  const tool = useCanvasUI((s) => s.tool)
  const setTool = useCanvasUI((s) => s.setTool)
  const penWidth = useCanvasUI((s) => s.penWidth)
  const penColor = useCanvasUI((s) => s.penColor)
  const hlColor = useCanvasUI((s) => s.hlColor)
  const setPenWidth = useCanvasUI((s) => s.setPenWidth)
  const setPenColor = useCanvasUI((s) => s.setPenColor)
  const setHlColor = useCanvasUI((s) => s.setHlColor)
  const hlWidth = useCanvasUI((s) => s.hlWidth)
  const setHlWidth = useCanvasUI((s) => s.setHlWidth)
  const eraserWidth = useCanvasUI((s) => s.eraserWidth)
  const setEraserWidth = useCanvasUI((s) => s.setEraserWidth)
  const openPicker = useCanvasUI((s) => s.openPicker)
  const selectedPageId = useBuilder((s) => s.selectedPageId)
  const setPaper = useBuilder((s) => s.setPaper)
  const curPaper = useBuilder((s) => { const pg = s.pages.find((x) => x.id === s.selectedPageId); return (pg && pg.paper) || 'blank' })
  const { el, patch } = useSelEl()
  const emit = (name: string) => window.dispatchEvent(new CustomEvent(name))
  const saveStatus = useAutosave((s) => s.status)
  const savedAt = useAutosave((s) => s.savedAt)
  const error = useAutosave((s) => s.error)
  const saveNow = useAutosave((s) => s.saveNow)
  const saveTitle = saveStatus === 'error' ? (error || '저장 실패') : savedAt ? `마지막 저장: ${new Date(savedAt).toLocaleString()}` : '자동 저장'
  const [flash, setFlash] = useState(false)
  const flashRef = useRef<number | undefined>(undefined)
  const doSave = () => {
    void saveNow()
    setFlash(false)
    requestAnimationFrame(() => setFlash(true))   // 연속 클릭에도 매번 펄스
    if (flashRef.current) window.clearTimeout(flashRef.current)
    flashRef.current = window.setTimeout(() => setFlash(false), 520)
  }
  const saveLabel = saveStatus === 'saving' ? '저장 중'
    : saveStatus === 'dirty' ? '저장 안 됨'
    : saveStatus === 'error' ? '저장 실패'
    : '저장됨'

  const gsTools: { t: Tool; icon: string; title: string }[] = [
    { t: 'select', icon: '▣', title: '선택' },
    { t: 'text', icon: 'T', title: '텍스트' },
    { t: 'connect', icon: '→', title: '화살표 연결' },
    { t: 'table', icon: '▦', title: '표' },
    { t: 'wordart', icon: '🅰', title: '글맵시' },
  ]
  // (여기 있던 size/setSize 는 아무도 안 쓰는 죽은 코드였다(EVER-SKETCH1 3b4846c) —
  //  남겨 두면 누가 다시 연결하면서 「한 글자마다 깎는」 그 버그를 되살린다.)
  function cycleColor() {
    if (!el) return
    const i = TEXT_COLORS.indexOf(el.tcolor || '#1a1a1a')
    patch({ tcolor: TEXT_COLORS[(i + 1) % TEXT_COLORS.length] })
  }

  return (
    /* 두 줄로 나눈다(EVER-SKETCH1 b721df0).
       첫 줄 = **늘 쓰는 만들기 도구**(그리기·도형·펜). 무엇을 골랐든 그대로다.
       둘째 줄 = **고른 것에 따라 달라지는 도구**(지금은 표). 고른 게 없어도 자리를 지킨다 —
       있다가 없어지면 도구줄 높이가 변하고 그만큼 아래 문서가 움직인다.
       (PPT 식 글자·채우기 도구는 4단계에서 이 줄에 들어온다.) */
    <div className="ax-tb">
     <div className="ax-tbrow">
      <button className="ib" title={`실행취소 (${K('mod+Z')})`} onClick={() => emit('ebook:undo')}>↺</button>
      <button className="ib" title={`다시실행 (${K('mod+shift+Z')})`} onClick={() => emit('ebook:redo')}>↻</button>
      <button className={'ib save-tb state-' + saveStatus + (flash ? ' flash' : '')} title={saveTitle} aria-label="지금 저장" onClick={doSave}>
        <svg className="save-ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
      </button>
      <span className={'save-lab state-' + saveStatus}>{saveLabel}</span>
      <span className="dv" />

      <span className="ax-grp gs">
        <span className="lab">구글 슬라이드</span>
        {gsTools.map((g) => (
          <button key={g.t} className={'ib' + (tool === g.t ? ' on' : '')} title={g.title} onClick={() => setTool(tool === g.t ? 'select' : g.t)}>{g.icon}</button>
        ))}
        <ShapeTool />
        <button className="ib" title="이모지·아이콘·이미지" onClick={openPicker}>😀</button>
      </span>

      <span className="ax-grp gs note-grp">
        <span className="lab">노트</span>
        <select className="ax-fsel" value={curPaper} title="종이 템플릿(이 페이지)" onChange={(e) => { if (selectedPageId != null) setPaper(selectedPageId, e.target.value as PaperType) }}>
          {PAPER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button className={'ib' + (tool === 'pen' ? ' on' : '')} title="펜(두께·색) — 다시 누르면 끔" onClick={() => setTool(tool === 'pen' ? 'select' : 'pen')}><Pen size={16} /></button>
        <select className="ax-fsel" value={penWidth} title="펜 두께" onChange={(e) => setPenWidth(Number(e.target.value))}>
          <option value={1.5}>얇게</option>
          <option value={2.5}>보통</option>
          <option value={5}>굵게</option>
        </select>
        {PEN_COLORS.map((c) => <button key={c} className={'ax-dot' + (penColor === c ? ' on' : '')} style={{ background: c }} title="펜 색" onClick={() => setPenColor(c)} />)}
        <button className={'ib' + (tool === 'highlighter' ? ' on' : '')} title="형광펜 — 다시 누르면 끔" onClick={() => setTool(tool === 'highlighter' ? 'select' : 'highlighter')}><Highlighter size={16} /></button>
        <select className="ax-fsel" value={hlWidth} title="형광펜 두께" onChange={(e) => setHlWidth(Number(e.target.value))}>
          <option value={10}>얇게</option>
          <option value={16}>보통</option>
          <option value={26}>굵게</option>
        </select>
        {HL_COLORS.map((c) => <button key={c} className={'ax-dot' + (hlColor === c ? ' on' : '')} style={{ background: c }} title="형광펜 색" onClick={() => setHlColor(c)} />)}
        <button className={'ib' + (tool === 'eraser' ? ' on' : '')} title="지우개(획 삭제) — 다시 누르면 끔" onClick={() => setTool(tool === 'eraser' ? 'select' : 'eraser')}><Eraser size={16} /></button>
        <select className="ax-fsel" value={eraserWidth} title="지우개 크기" onChange={(e) => setEraserWidth(Number(e.target.value))}>
          <option value={14}>작게</option>
          <option value={22}>보통</option>
          <option value={36}>크게</option>
        </select>
      </span>
     </div>

     <div className="ax-tbrow ctx">
      <TableTools />
     </div>
    </div>
  )
}
