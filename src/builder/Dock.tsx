import { useState, useEffect, useRef } from 'react'
import { useBuilder } from '../state/store'
import { useCanvasUI } from '../state/canvasUI'
import type { Tool } from '../state/canvasUI'
import { FCOLORS, pushSnap, popSnap, pushRedo, popRedo, pushUndoRaw, mkFreeEl } from '../canvas/model'

// 하단 독 = 자유 캔버스(주석·그리기) 도구.
// 상단 구글 슬라이드 툴바와 겹치는 것(텍스트·표·글맵시·이미지·실행취소/다시실행)은 여기서 뺀다.
const TOOLS: { t: Tool; icon: string; title: string }[] = [
  { t: 'select', icon: '▹', title: '선택/이동' },
  { t: 'box', icon: '▭', title: '사각형' },
  { t: 'ellipse', icon: '◯', title: '원' },
  { t: 'diamond', icon: '◇', title: '마름모' },
  { t: 'triangle', icon: '△', title: '삼각형' },
  { t: 'icon', icon: '★', title: '별/아이콘' },
  { t: 'connect', icon: '→', title: '화살표 연결' },
  { t: 'pen', icon: '✎', title: '펜' },
]
const MANUAL: { icon: string; name: string; desc: string }[] = [
  { icon: '▶', name: '재생/미리보기', desc: '현재 슬라이드를 슬라이드쇼로 봅니다.' },
  { icon: '▹', name: '선택/이동', desc: '도형을 고르고 끌어서 옮깁니다. 크기 조절·더블클릭 글자 편집.' },
  { icon: '▭', name: '사각형', desc: '도구를 누르고 캔버스를 클릭하면 네모가 생깁니다.' },
  { icon: '◯', name: '원', desc: '원/타원 도형.' },
  { icon: '◇', name: '마름모', desc: '분기·판단을 표현할 때 쓰는 마름모.' },
  { icon: '△', name: '삼각형', desc: '삼각형 도형.' },
  { icon: '★', name: '별/아이콘', desc: '별 같은 기호를 놓습니다.' },
  { icon: '→', name: '화살표 연결', desc: '도형 하나를 클릭 → 이어줄 다른 도형을 클릭하면 화살표가 생깁니다.' },
  { icon: '✎', name: '펜', desc: '캔버스를 드래그해 손으로 자유롭게 선을 그립니다.' },
  { icon: '⬤', name: '색상', desc: '선택한 도형의 색을 바꿉니다.' },
  { icon: '⤒', name: '맨 앞으로', desc: '겹쳐 있을 때 위로 올립니다.' },
  { icon: '⤓', name: '맨 뒤로', desc: '겹쳐 있을 때 아래로 내립니다.' },
  { icon: '🗑', name: '삭제', desc: '선택한 도형을 지웁니다. (Delete)' },
  { icon: '✦', name: 'AI 초안', desc: '예시 흐름(도형+화살표)을 자동으로 넣어줍니다.' },
]

export default function Dock() {
  const pages = useBuilder((s) => s.pages)
  const selId = useBuilder((s) => s.selectedPageId)
  const addEl = useBuilder((s) => s.addEl)
  const updateEl = useBuilder((s) => s.updateEl)
  const removeEl = useBuilder((s) => s.removeEl)
  const addConn = useBuilder((s) => s.addConn)
  const reorderEl = useBuilder((s) => s.reorderEl)
  const setCanvas = useBuilder((s) => s.setCanvas)
  const tool = useCanvasUI((s) => s.tool)
  const setTool = useCanvasUI((s) => s.setTool)
  const selEl = useCanvasUI((s) => s.selEl)
  const setSel = useCanvasUI((s) => s.setSel)
  const lastColor = useCanvasUI((s) => s.lastColor)
  const setColor = useCanvasUI((s) => s.setColor)
  const [manual, setManual] = useState(false)

  const page = pages.find((p) => p.id === selId)
  const selected = page ? page.els.find((e) => e.id === selEl) : undefined
  function snap() { if (page) pushSnap(page.id, JSON.stringify({ els: page.els, conns: page.conns, strokes: page.strokes })) }
  function chooseColor(c: string) { setColor(c); if (page && selected) { snap(); updateEl(page.id, selected.id, { color: c }) } }
  function del() { if (!page || selEl == null) return; snap(); removeEl(page.id, selEl); setSel(null) }
  function dup() { if (!page || !selected) return; snap(); const e = mkFreeEl(selected.type, selected.x + 16, selected.y + 16); e.w = selected.w; e.h = selected.h; e.text = selected.text; e.color = selected.color; e.fs = selected.fs; e.bold = selected.bold; e.tcolor = selected.tcolor; e.cells = selected.cells; e.rows = selected.rows; e.cols = selected.cols; e.wa = selected.wa; addEl(page.id, e); setSel(e.id) }
  function z(front: boolean) { if (!page || selEl == null) return; snap(); reorderEl(page.id, selEl, front) }
  function cur() { return page ? JSON.stringify({ els: page.els, conns: page.conns, strokes: page.strokes }) : '' }
  function undo() { if (!page) return; const s = popSnap(page.id); if (!s) return; pushRedo(page.id, cur()); setCanvas(page.id, JSON.parse(s)); setSel(null) }
  function redo() { if (!page) return; const s = popRedo(page.id); if (!s) return; pushUndoRaw(page.id, cur()); setCanvas(page.id, JSON.parse(s)); setSel(null) }
  function play() { window.dispatchEvent(new CustomEvent('ebook:present')) }
  function ai() { if (!page) return; snap(); const labels = ['현황 진단', 'AI 도입', '성과 확산']; const ids: number[] = []; labels.forEach((tx, i) => { const e = mkFreeEl('round', 30 + i * 118, 180); e.w = 104; e.h = 54; e.text = tx; addEl(page.id, e); ids.push(e.id) }); addConn(page.id, { from: ids[0], to: ids[1] }); addConn(page.id, { from: ids[1], to: ids[2] }) }

  // 메뉴/툴바에서 오는 요소 명령을 여기(선택 컨텍스트 보유)에서 처리.
  const handlers = { undo, redo, del, dup, zf: () => z(true), zb: () => z(false), ai }
  const hRef = useRef(handlers); hRef.current = handlers
  useEffect(() => {
    const map: Record<string, keyof typeof handlers> = {
      'ebook:undo': 'undo', 'ebook:redo': 'redo', 'ebook:del': 'del', 'ebook:dup': 'dup',
      'ebook:z-front': 'zf', 'ebook:z-back': 'zb', 'ebook:ai': 'ai',
    }
    const fns = Object.entries(map).map(([evt, k]) => {
      const fn = () => hRef.current[k]()
      window.addEventListener(evt, fn)
      return [evt, fn] as const
    })
    return () => fns.forEach(([evt, fn]) => window.removeEventListener(evt, fn))
  }, [])

  return (
    <div className="ax-dock">
      <span className="keepbadge">자유 캔버스</span>
      <button className="manual-btn" onClick={() => setManual((v) => !v)} title="각 도구 설명 보기">❔ 설명서</button>
      {manual ? (
        <div className="manual-panel">
          <button className="close" onClick={() => setManual(false)}>✕</button>
          <h3>도구 설명서</h3>
          {MANUAL.map((m) => (<div className="mrow" key={m.name}><span className="mi">{m.icon}</span><div><div className="mn">{m.name}</div><div className="md">{m.desc}</div></div></div>))}
        </div>
      ) : null}
      <div className="dksep" />
      <button className="dk play" title="재생/미리보기" onClick={play}>▶</button>
      {TOOLS.map((t) => (<button key={t.t} className={'dk' + (tool === t.t ? ' on' : '')} data-tut={'tool-' + t.t} title={t.title} onClick={() => setTool(t.t)}>{t.icon}</button>))}
      <div className="dksep" />
      <span className="dkcolors">
        {FCOLORS.map((c) => (<span key={c} className={'dksw' + ((selected ? selected.color === c : lastColor === c) ? ' on' : '')} style={{ background: c === 'transparent' ? '#333' : c }} onClick={() => chooseColor(c)} />))}
      </span>
      <div className="dksep" />
      <button className="dk" title="맨 앞으로" onClick={() => z(true)}>⤒</button>
      <button className="dk" title="맨 뒤로" onClick={() => z(false)}>⤓</button>
      <button className="dk del" title="삭제 (Delete)" onClick={del}>🗑</button>
      <button className="dk ai" onClick={ai}>✦ AI 초안</button>
      <span className="sp" />
      <span className="hint">도구를 고르고 캔버스를 클릭/드래그 · 자유 캔버스(주석·도형) 유지</span>
    </div>
  )
}
