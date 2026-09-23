import { useCanvasUI } from '../../state/canvasUI'
import { useKey } from '../../ui/keyLabel'
import type { Tool } from '../../state/canvasUI'
import { useSelEl } from '../useSelEl'
import ColorPicker from './ColorPicker'
import { NO_FILL } from '../../canvas/model'
import { SHAPE_RADIUS, polyClip } from '../../canvas/shapePaths'
import { cellColors } from '../../canvas/cellColor'
import { ALIGN_LABEL, AlignIcon } from '../../ui/alignIcons'
import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Pen, Highlighter, Eraser } from 'lucide-react'
import { useAutosave } from '../../persistence/autosave'
import { useBuilder, type PaperType } from '../../state/store'
import { PAPER_OPTIONS } from '../../cards/paper'
import type { FreeEl } from '../../state/store'
import { mergeCovering, mergeRange, setCellBgRange, unmergeAt } from '../../canvas/tableOps'

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

/** **고르면 바로 놓는 것**(EVER-SKETCH1 90e7439). 고르기·연결선은 여기 없다 — 그 둘은 누를 자리가 뜻이 있다. */
const PLACE_TOOLS: Tool[] = ['text', 'table', 'wordart']

// 도형 버튼 — PowerPoint 식. 아이콘은 항상 같은 심볼이고, 버튼 어디를 눌러도 갤러리가 열린다.
// 셀 미리보기는 canvas/shapePaths 의 꼭짓점으로 오리므로 캔버스에 그려지는 모양과 동일하다.
//
// **갤러리에서 고르면 도구를 무장하지 않고 곧바로 놓는다**(EVER-SKETCH1 e4dfbfd). 그래서 여기에는
// setTool 이 없다 — 있으면 「골랐는데 커서는 십자」인 옛 동작이 슬그머니 되살아난다.
// 버튼의 .on 하이라이트는 남겨 둔다: 단축키(r·o·d)로 든 도형은 여전히 무장 상태이고,
// 그때 지금 무엇을 들고 있는지 알려 주는 표시가 이것뿐이다.
function ShapeTool() {
  const tool = useCanvasUI((s) => s.tool)
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
  /**
   * **메뉴의 「삽입 → 도형」이 이 팝업을 연다**(EVER-SKETCH1 b1911d3).
   *
   * 전에는 그 메뉴가 사각형 하나를 무장시켰다. 그런데 이 팝업에는 열네 가지가 있어서,
   * **같은 이름이 두 곳에서 다른 말을 했다.** 목록을 메뉴에도 복사하지 않는다 —
   * 두 벌이 되면 도형을 하나 더할 때 한쪽만 는다.
   */
  useEffect(() => {
    const open_ = () => {
      const r = ref.current?.getBoundingClientRect()
      if (r) setPos({ x: r.left, y: r.bottom + 6 })
      setOpen(true)
    }
    window.addEventListener('ebook:pick-shape', open_)
    return () => window.removeEventListener('ebook:pick-shape', open_)
  }, [])
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
                      onClick={() => {
                        // **고르면 곧바로 놓는다**(EVER-SKETCH1 e4dfbfd). 놓는 일은 캔버스가 한다 —
                        // 규칙이 한 곳이어야 되돌리기가 빠지지 않는다(FreeLayer 의 ebook:place).
                        setOpen(false)
                        window.dispatchEvent(new CustomEvent('ebook:place', { detail: { type: sh.t } }))
                      }}>
                      {/* 미리보기도 **같은 꼭짓점**으로 오린다(EVER-SKETCH1 518611b). */}
                      <span className={'shp-sh ' + sh.t}
                        style={{ clipPath: polyClip(sh.t), borderRadius: SHAPE_RADIUS[sh.t] }} />
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
 * **툴바 둘째 줄이 고른 것을 따라간다**(EVER-SKETCH1 a48539f C-1 — 4단계 도구줄의 바탕이라 같이 옮겼다).
 *
 * 둘째 줄은 「표」 하나만 알았다. 글상자·도형을 골라 놓고 색을 바꾸려면 오른쪽 패널로
 * 손을 옮겨야 했다. **자리는 고정, 내용만 바뀐다** — 줄이 생겼다 없어지면 도구줄 높이가 변하고
 * 그만큼 아래 문서가 움직인다.
 *
 * **글자 · 글자 색 · 채우기 · 테두리 — 넷을 이름 붙여 나란히 둔다**(EVER-SKETCH1 8927a75).
 * 파워포인트는 **채우기 · 윤곽선 · 글꼴 색**이 각각 이름 붙은 단추이고, 단추 밑에 지금 색이
 * 띠로 보인다. 그냥 누르면 **띠에 보이는 그 색**이 칠해지고, ▾ 를 눌러야 팔레트가 열린다 —
 * 색을 새로 고르는 일보다 **같은 색을 여러 번 쓰는 일**이 훨씬 잦아서다. 같은 나눔을 쓴다.
 */
function TextTools() {
  const { el } = useSelEl()
  if (!el) return null
  return (<><FontTools /><InkTools /></>)
}

function FontTools() {
  const { el, patch } = useSelEl()
  if (!el) return null
  const fs = el.fs || 13
  return (
    <span className="ax-grp gs">
      <span className="lab">글자</span>
      <button className={'ib' + (el.bold ? ' on' : '')} title="굵게"
        onClick={() => patch({ bold: !el.bold })}><b>B</b></button>
      <button className={'ib' + (el.italic ? ' on' : '')} title="기울임"
        onClick={() => patch({ italic: !el.italic })}><i>I</i></button>
      <button className={'ib' + (el.underline ? ' on' : '')} title="밑줄"
        onClick={() => patch({ underline: !el.underline })}><u>U</u></button>
      {/* 한 단계씩. 슬라이더를 툴바에 두면 끌다가 캔버스를 놓친다. */}
      <button className="ib" title="글자 작게" onClick={() => patch({ fs: Math.max(6, fs - 1) })}>−</button>
      <span className="tbtn-hint fs-val" title="글자 크기">{fs}</span>
      <button className="ib" title="글자 크게" onClick={() => patch({ fs: Math.min(96, fs + 1) })}>＋</button>
      <span className="dv" />
      {/* 표 칸과 **같은 그림**을 쓴다(EVER-SKETCH1 b1911d3). */}
      {(['left', 'center', 'right'] as const).map((a) => (
        <button key={a} className={'ib' + ((el.align || 'left') === a ? ' on' : '')}
          title={ALIGN_LABEL[a]} onClick={() => patch({ align: a })}>
          <AlignIcon dir={a} />
        </button>
      ))}
    </span>
  )
}

const ICON_TEXT = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M6 19 12 5l6 14M8.7 14.2h6.6" /></svg>
)
const ICON_FILL = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12 12 5l7 7-7 7z" /><path d="M19.5 15.5c0 1.4 1.2 2.4 1.2 2.4" /></svg>
)
const ICON_BORDER = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
    strokeWidth="2" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" /></svg>
)

/** 선 모양 그림 — 실선 · 파선 · 점선(EVER-SKETCH1 f586a7b). 글자(─ ┄ ┈)로 그리면 글꼴마다 굵기가 달라 안 맞는다. */
const DASH_LABEL: Record<'solid' | 'dashed' | 'dotted', string> = {
  solid: '실선', dashed: '파선', dotted: '점선',
}
const DASH_PAT: Record<'solid' | 'dashed' | 'dotted', string | undefined> = {
  solid: undefined, dashed: '5 3', dotted: '1.5 2.5',
}
function DashIcon({ kind }: { kind: 'solid' | 'dashed' | 'dotted' }) {
  return (
    <svg viewBox="0 0 22 12" width="18" height="12" aria-hidden="true">
      <line x1="1.5" y1="6" x2="20.5" y2="6" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeDasharray={DASH_PAT[kind]} />
    </svg>
  )
}

/**
 * 색 단추 하나. **그림 + 지금 색 띠 + ▾.**
 *
 * 그냥 누르면 띠 색을 칠하고, ▾ 는 고르개를 연다. 띠가 보여 주는 것은 **마지막에 쓴 색**이지
 * 고른 것의 색이 아니다 — 파워포인트와 같다. 「이 도형이 무슨 색인가」는 고르개를 열면
 * 그 색에 표시가 붙어 있고, 오른쪽 패널에도 그대로 있다.
 */
function InkBtn({ label, icon, color, onApply, onPick, allowTransparent, extra }: {
  label: string
  icon: React.ReactNode
  color: string
  onApply: () => void
  onPick: (c: string) => void
  allowTransparent?: boolean
  extra?: React.ReactNode
}) {
  const shown = color === 'transparent'
    ? 'repeating-conic-gradient(#ccc 0 25%,#fff 0 50%) 50%/6px 6px' : color
  return (
    <span className="ax-grp gs" title={label}>
      <span className="lab">{label}</span>
      <button className="ax-ink" onClick={onApply} title={label + ' — ' + color + ' 을 칠합니다'}>
        {icon}
        <span className="ax-inkbar" style={{ background: shown }} />
      </button>
      <ColorPicker value={color} onChange={onPick} allowTransparent={allowTransparent}
        caret title={label + ' — 다른 색'} />
      {extra}
    </span>
  )
}

function InkTools() {
  const { el, patch } = useSelEl()
  const inkText = useCanvasUI((s) => s.inkText)
  const inkFill = useCanvasUI((s) => s.inkFill)
  const inkBorder = useCanvasUI((s) => s.inkBorder)
  const setInk = useCanvasUI((s) => s.setInk)
  if (!el) return null
  // 속이 없는 갈래(글상자·아이콘·그림 …)와 표에는 채우기·테두리를 안 띄운다 —
  // 그 판단은 `NO_FILL` 한 곳에서만 한다(표는 칸마다 색이 따로다).
  const canFill = !NO_FILL.includes(el.type)
  return (<>
    <InkBtn label="글자 색" icon={ICON_TEXT} color={inkText}
      onApply={() => patch({ tcolor: inkText })}
      onPick={(c) => { setInk('text', c); patch({ tcolor: c }) }} />
    {canFill ? (<>
      <InkBtn label="채우기" icon={ICON_FILL} color={inkFill} allowTransparent
        onApply={() => patch({ color: inkFill })}
        onPick={(c) => { setInk('fill', c); patch({ color: c }) }} />
      <InkBtn label="테두리" icon={ICON_BORDER} color={inkBorder} allowTransparent
        onApply={() => patch({ borderColor: inkBorder })}
        onPick={(c) => { setInk('border', c); patch({ borderColor: c }) }}
        extra={(<>
          <select className="ax-fsel" title="테두리 두께" value={el.borderWidth ?? 1.5}
            onChange={(e) => patch({ borderWidth: Number(e.target.value) })}>
            <option value={0}>없음</option>
            <option value={1}>얇게</option>
            <option value={1.5}>보통</option>
            <option value={3}>굵게</option>
          </select>
          {/* 선 모양. 파워포인트의 「대시 종류」다. 고르개보다 단추가 낫다 —
              셋뿐이고, 한 번에 바뀐다. */}
          {(['solid', 'dashed', 'dotted'] as const).map((d) => (
            <button key={d} className={'ib' + ((el.borderDash || 'solid') === d ? ' on' : '')}
              title={DASH_LABEL[d]} onClick={() => patch({ borderDash: d })}>
              <DashIcon kind={d} />
            </button>
          ))}
        </>)} />
    </>) : null}
  </>)
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

  // ── 채우기 (EVER-SKETCH1 8513fe1 · 73b6825) ──
  //
  // **오른쪽 패널에만 두면 안 된다.** 도형은 도구줄에서 바로 칠하는데 표만 패널을 열어야 하면,
  // 같은 일을 하는 길이 둘로 갈라진다. 표는 요소 하나가 아니라 **고른 칸 범위**에 칠하므로
  // 채우기(`NO_FILL`)와는 다른 자리에 둔다 — 표 도구 옆, 병합과 같은 「고른 칸에 하는 일」 묶음이다.
  //
  // **이름은 「채우기」로 맞춘다.** 도형만 「채우기」, 표는 「칸 색」이면 같은 일에 이름이 둘이다.
  // 그림만 표 칸 모양으로 남긴다 — **무엇에** 칠하는지는 그림이 말한다.
  //
  // **「칸을 안 골랐으면 표 전체」는 넣지 않는다**(원본 사용자 판단). 칠하는 규칙은
  // 「끌어 고른 데를 칠한다」 하나로 족하다.
  //
  // 색 목록은 `cellColors()` 가 한 군데서 정한다 — 패널과 어긋나면 안 된다.
  // (원본은 양식 표의 「진행 표시」 색과 이름표를 앞줄에 세운다. 이 저장소에는 양식 슬롯이 없다.)
  const curBg = (table.cbg && ts) ? table.cbg[Math.min(ts.r0, ts.r1) + '_' + Math.min(ts.c0, ts.c1)] : undefined
  const cbgWhy = !ts ? '표 안에서 칸을 고르면 칠할 수 있어요'
    : ranged ? `고른 ${rows}×${cols} 칸을 칠합니다`
    : '고른 칸을 칠합니다'

  return (
    <>
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

    <span className="ax-grp gs">
      <span className="lab">채우기</span>
      <span className="ax-cp" title={cbgWhy}>
        {/* 아이콘은 **무엇의 색인지**를 말한다 — 도형 채우기(◇)와 헷갈리지 않게
            「표의 한 칸이 칠해진」 그림이다. */}
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
          strokeWidth="1.8" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
          <path d="M3.5 10.5h17M3.5 15h17M12 5v14" />
          <rect x="12" y="10.5" width="8.5" height="4.5" fill="currentColor" stroke="none" opacity=".85" />
        </svg>
        <ColorPicker value={curBg} disabled={!ts} title={cbgWhy}
          head={{ lab: '채우기', colors: cellColors() }}
          onChange={(c) => { if (ts) patch(setCellBgRange(table, ts.r0, ts.c0, ts.r1, ts.c1, c)) }}
          onClear={() => { if (ts) patch(setCellBgRange(table, ts.r0, ts.c0, ts.r1, ts.c1, null)) }} />
      </span>
      <span className="tbtn-hint">{ts ? (curBg ? '칠함' : '없음') : '칸을 먼저 고르세요'}</span>
    </span>
    </>
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

  /** 그리기 도구를 **접어 둔다**(EVER-SKETCH1 5a4afce).
   *
   *  펜·형광펜·지우개는 각각 두께와 색을 달고 있어 **열다섯 칸**을 늘 차지했다.
   *
   *  **선택에 따라 접었다 폈다 하지 않는다.** 그건 손이 가 있는 자리에서 도구가
   *  스스로 움직이는 일이라, 표를 고르는 순간 펜 색이 사라진다. 대신
   *  **그리는 중에는 저절로 펴 둔다** — 펜을 든 사람에게 두께와 색은 늘 필요하다. */
  const [drawOpen, setDrawOpen] = useState(false)
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

  // 그리는 중이면 저절로 펴 둔다 — 펜을 든 사람에게 두께와 색은 늘 필요하다.
  const drawing = tool === 'pen' || tool === 'highlighter' || tool === 'eraser'
  const showDraw = drawOpen || drawing

  /** 둘째 줄이 무엇을 보일까(EVER-SKETCH1 a48539f C-1). **표가 먼저다** — 표 도구(병합·채우기)는
   *  여기밖에 없다. 글상자·도형이면 글자·색 도구, 아무것도 없으면 「표를 고르세요」가 자리를 지킨다.
   *  (원본의 연결선 도구 갈래는 오른쪽 패널 이식(5단계) 때 함께 본다.) */
  const ctx: 'table' | 'text' = el && el.type !== 'table' ? 'text' : 'table'

  return (
    /* 두 줄로 나눈다(EVER-SKETCH1 b721df0).
       첫 줄 = **늘 쓰는 만들기 도구**(그리기·도형·펜). 무엇을 골랐든 그대로다.
       둘째 줄 = **고른 것에 따라 달라지는 도구**(지금은 표). 고른 게 없어도 자리를 지킨다 —
       있다가 없어지면 도구줄 높이가 변하고 그만큼 아래 문서가 움직인다.
       4단계부터 글상자·도형을 고르면 여기에 글자 · 글자 색 · 채우기 · 테두리가 뜬다. */
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
        {/* **글상자 · 표 · 글맵시도 고르면 곧바로 놓인다**(EVER-SKETCH1 90e7439).
            도형이 그렇게 바뀐 뒤로 이 줄에서 **옆 단추끼리 동작이 달랐다** — 도형은 놓이고
            그 왼쪽 T 는 커서만 십자로 바뀌었다. 고르기·연결선은 그대로 도구다(누를 자리가 뜻이 있다). */}
        {gsTools.map((g) => (
          <button key={g.t} className={'ib' + (tool === g.t ? ' on' : '')} title={g.title}
            onClick={() => (PLACE_TOOLS.indexOf(g.t) >= 0
              ? window.dispatchEvent(new CustomEvent('ebook:place', { detail: { type: g.t } }))
              : setTool(tool === g.t ? 'select' : g.t))}>{g.icon}</button>
        ))}
        <ShapeTool />
        <button className="ib" title="이모지·아이콘·이미지" onClick={openPicker}>😀</button>
      </span>

      <span className="ax-grp gs note-grp">
        <span className="lab">노트</span>
        <select className="ax-fsel" value={curPaper} title="종이 템플릿(이 페이지)" onChange={(e) => { if (selectedPageId != null) setPaper(selectedPageId, e.target.value as PaperType) }}>
          {PAPER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {!drawing && (
          <button className="tbtn draw-toggle" title="펜 · 형광펜 · 지우개"
            aria-expanded={drawOpen} onClick={() => setDrawOpen((o) => !o)}>
            <Pen size={14} /> 그리기 {drawOpen ? '▴' : '▾'}
          </button>
        )}
        {showDraw && (<>
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
        </>)}
      </span>
     </div>

     {/* **자리는 고정, 내용만 바뀐다.** 표면 표 도구, 글상자·도형이면 글자·색 도구. */}
     <div className="ax-tbrow ctx">
      {ctx === 'text' ? <TextTools /> : <TableTools />}
     </div>
    </div>
  )
}
