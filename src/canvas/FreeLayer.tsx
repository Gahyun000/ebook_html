import type React from 'react'
import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { Page, FreeEl } from '../state/store'
import { useBuilder } from '../state/store'
import { useCanvasUI } from '../state/canvasUI'
import { mkFreeEl, pushSnap } from './model'

interface Props { page: Page; W: number; H: number; SC: number; interactive: boolean }
const ADDABLE = ['box', 'round', 'ellipse', 'diamond', 'triangle', 'text', 'sticky', 'image', 'icon', 'table', 'wordart']
interface Pt { x: number; y: number }

function edgePoint(box: FreeEl, tx: number, ty: number): Pt {
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2
  const dx = tx - cx, dy = ty - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const scale = 1 / Math.max(Math.abs(dx) / (box.w / 2), Math.abs(dy) / (box.h / 2))
  return { x: cx + dx * scale, y: cy + dy * scale }
}
function connPath(a: FreeEl, b: FreeEl, bend?: Pt): string {
  if (bend) {
    const s = edgePoint(a, bend.x, bend.y), t = edgePoint(b, bend.x, bend.y)
    return 'M ' + s.x + ' ' + s.y + ' L ' + bend.x + ' ' + bend.y + ' L ' + t.x + ' ' + t.y
  }
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 }, bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 }
  const dx = bc.x - ac.x, dy = bc.y - ac.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    const s = { x: dx > 0 ? a.x + a.w : a.x, y: ac.y }, t = { x: dx > 0 ? b.x : b.x + b.w, y: bc.y }
    const mx = (s.x + t.x) / 2
    return 'M ' + s.x + ' ' + s.y + ' L ' + mx + ' ' + s.y + ' L ' + mx + ' ' + t.y + ' L ' + t.x + ' ' + t.y
  }
  const s = { x: ac.x, y: dy > 0 ? a.y + a.h : a.y }, t = { x: bc.x, y: dy > 0 ? b.y : b.y + b.h }
  const my = (s.y + t.y) / 2
  return 'M ' + s.x + ' ' + s.y + ' L ' + s.x + ' ' + my + ' L ' + t.x + ' ' + my + ' L ' + t.x + ' ' + t.y
}

export default function FreeLayer({ page, W, H, interactive }: Props) {
  const tool = useCanvasUI((s) => s.tool)
  const setTool = useCanvasUI((s) => s.setTool)
  const selEl = useCanvasUI((s) => s.selEl)
  const setSel = useCanvasUI((s) => s.setSel)
  const connSrc = useCanvasUI((s) => s.connSrc)
  const setConnSrc = useCanvasUI((s) => s.setConnSrc)
  const lastColor = useCanvasUI((s) => s.lastColor)
  const addEl = useBuilder((s) => s.addEl)
  const updateEl = useBuilder((s) => s.updateEl)
  const addConn = useBuilder((s) => s.addConn)
  const addStroke = useBuilder((s) => s.addStroke)
  const updateConn = useBuilder((s) => s.updateConn)

  const [editing, setEditing] = useState<number | null>(null)
  const [penPts, setPenPts] = useState<[number, number][] | null>(null)
  const [mouse, setMouse] = useState<Pt | null>(null)
  const [bending, setBending] = useState<Pt | null>(null)
  const active = interactive
  const markerId = 'fah' + page.id

  function snap() { pushSnap(page.id, JSON.stringify({ els: page.els, conns: page.conns, strokes: page.strokes })) }
  function pickImage(el: FreeEl) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'
    inp.onchange = () => {
      const f = inp.files && inp.files[0]; if (!f) return
      const r = new FileReader(); r.onload = () => { snap(); updateEl(page.id, el.id, { src: String(r.result) }) }; r.readAsDataURL(f)
    }
    inp.click()
  }

  function onLayerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!active) return
    if (e.target !== e.currentTarget) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left, y = e.clientY - rect.top
    if (tool === 'pen') {
      e.preventDefault(); snap()
      const pts: [number, number][] = [[x, y]]; setPenPts([...pts])
      const move = (ev: PointerEvent) => { pts.push([ev.clientX - rect.left, ev.clientY - rect.top]); setPenPts([...pts]) }
      const up = () => { const col = (lastColor === 'transparent' || lastColor === '#ffffff') ? '#111318' : lastColor; addStroke(page.id, { points: pts, color: col, w: 2.5 }); setPenPts(null); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); return
    }
    if (ADDABLE.indexOf(tool) >= 0) { snap(); const el = mkFreeEl(tool, x - 50, y - 25); addEl(page.id, el); setSel(el.id); setTool('select'); return }
    setSel(null); setConnSrc(null); setEditing(null)
  }
  function onLayerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!active || tool !== 'connect' || connSrc === null) { if (mouse) setMouse(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    setMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }
  function onElDown(e: React.PointerEvent<HTMLDivElement>, el: FreeEl) {
    if (!active) return
    if (tool === 'connect') {
      e.preventDefault(); e.stopPropagation()
      if (connSrc === null) setConnSrc(el.id)
      else if (connSrc !== el.id) { snap(); addConn(page.id, { from: connSrc, to: el.id }); setConnSrc(null); setMouse(null) }
      return
    }
    if (tool === 'pen') return
    e.preventDefault(); e.stopPropagation()
    const sx = e.clientX, sy = e.clientY, ox = el.x, oy = el.y; let moved = false
    const move = (ev: PointerEvent) => { const dx = ev.clientX - sx, dy = ev.clientY - sy; if (Math.abs(dx) + Math.abs(dy) > 4) { if (!moved) snap(); moved = true } updateEl(page.id, el.id, { x: ox + dx, y: oy + dy }) }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); setSel(el.id) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  function onResizeDown(e: React.PointerEvent<HTMLDivElement>, el: FreeEl) {
    e.preventDefault(); e.stopPropagation()
    const sx = e.clientX, sy = e.clientY, sw = el.w, sh = el.h; let did = false
    const move = (ev: PointerEvent) => { if (!did) { snap(); did = true } updateEl(page.id, el.id, { w: Math.max(30, sw + ev.clientX - sx), h: Math.max(24, sh + ev.clientY - sy) }) }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  function onLineDown(e: React.PointerEvent<SVGPathElement>, i: number) {
    if (!active) return
    e.preventDefault(); e.stopPropagation()
    const svg = e.currentTarget.ownerSVGElement
    if (!svg) return
    const rect = svg.getBoundingClientRect(); let did = false
    const move = (ev: PointerEvent) => { const x = ev.clientX - rect.left, y = ev.clientY - rect.top; if (!did) { snap(); did = true } updateConn(page.id, i, { x, y }); setBending({ x, y }) }
    const up = () => { setBending(null); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }

  const conns = page.conns.map((c, i) => {
    const a = page.els.find((e) => e.id === c.from); const b = page.els.find((e) => e.id === c.to)
    if (!a || !b) return null
    return <path key={'c' + i} d={connPath(a, b, c.bend)} fill="none" stroke="#8b93a5" strokeWidth={2} markerEnd={'url(#' + markerId + ')'} />
  })
  const hits = active ? page.conns.map((c, i) => {
    const a = page.els.find((e) => e.id === c.from); const b = page.els.find((e) => e.id === c.to)
    if (!a || !b) return null
    return <path key={'hit' + i} d={connPath(a, b, c.bend)} fill="none" stroke="transparent" strokeWidth={16} style={{ pointerEvents: 'stroke', cursor: 'grab' }} onPointerDown={(e) => onLineDown(e, i)} />
  }) : null
  const strokes = page.strokes.map((st, i) => {
    if (st.points.length < 2) return null
    const d = 'M ' + st.points.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L ')
    return <path key={'s' + i} d={d} fill="none" stroke={st.color} strokeWidth={st.w} strokeLinecap="round" strokeLinejoin="round" />
  })
  const penPath = penPts && penPts.length > 1
    ? <path d={'M ' + penPts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L ')} fill="none" stroke={(lastColor === 'transparent' || lastColor === '#ffffff') ? '#111318' : lastColor} strokeWidth={2.5} strokeLinecap="round" />
    : null
  let rubber = null
  if (active && tool === 'connect' && connSrc !== null && mouse) {
    const src = page.els.find((e) => e.id === connSrc)
    if (src) { const s = edgePoint(src, mouse.x, mouse.y); rubber = <line x1={s.x} y1={s.y} x2={mouse.x} y2={mouse.y} stroke="#f0a020" strokeWidth={2} strokeDasharray="5 4" /> }
  }

  return (
    <div className={'freelayer' + (active ? '' : ' off')} style={{ width: W, height: H, cursor: active && tool === 'pen' ? 'crosshair' : undefined }} onPointerDown={onLayerDown} onPointerMove={active ? onLayerMove : undefined}>
      <svg className="freeconn" width={W} height={H}>
        <defs>
          <marker id={markerId} markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="#8b93a5" /></marker>
        </defs>
        {conns}{strokes}{penPath}{rubber}{hits}
        {bending ? <circle cx={bending.x} cy={bending.y} r={6} fill="#fff" stroke="#8b93a5" strokeWidth={2} /> : null}
      </svg>
      {active && tool === 'connect' ? <div className="conn-hint">{connSrc === null ? '이을 도형을 클릭하세요 (첫 번째)' : '이어줄 다른 도형을 클릭하세요 (두 번째)'}</div> : null}
      {page.els.map((el) => {
        const isImg = el.type === 'image'
        const isTable = el.type === 'table'
        const style: CSSProperties = { left: el.x, top: el.y, width: el.w, height: el.h }
        if (!isImg && !isTable && el.color !== 'transparent') style.background = el.color
        if (el.color === '#111318') style.borderColor = '#111318'
        const txtStyle: CSSProperties = { fontSize: el.fs }
        if (el.bold) txtStyle.fontWeight = 800
        if (el.tcolor) txtStyle.color = el.tcolor
        else if (el.color === '#111318') txtStyle.color = '#fff'
        if (el.wa) { txtStyle.fontWeight = 900; txtStyle.letterSpacing = '0.01em'; txtStyle.textShadow = '0 1px 0 rgba(0,0,0,.18)' }
        const cls = 'fel ' + el.type + (selEl === el.id ? ' sel' : '') + (connSrc === el.id ? ' connsrc' : '')
        const editingThis = editing === el.id
        return (
          <div key={el.id} className={cls} style={style}
            onPointerDown={active ? (e) => onElDown(e, el) : undefined}
            onDoubleClick={active ? () => { if (isImg) pickImage(el); else setEditing(el.id) } : undefined}>
            {isTable
              ? (<div className="feltable" style={{ display: 'grid', gridTemplateColumns: `repeat(${el.cols || 2}, 1fr)`, gridTemplateRows: `repeat(${el.rows || 2}, 1fr)`, width: '100%', height: '100%' }}>
                  {Array.from({ length: (el.rows || 2) * (el.cols || 2) }).map((_, k) => {
                    const r = Math.floor(k / (el.cols || 2)), c = k % (el.cols || 2)
                    const val = (el.cells && el.cells[r] && el.cells[r][c]) || ''
                    return (
                      <div key={k} className="feltd" style={{ border: '1px solid #cfd5e2', fontSize: el.fs, padding: '3px 5px', overflow: 'hidden', background: r === 0 ? '#f2f5fa' : '#fff', fontWeight: r === 0 ? 700 : 400 }}
                        contentEditable={editingThis} suppressContentEditableWarning
                        onPointerDown={editingThis ? (e) => e.stopPropagation() : undefined}
                        onBlur={editingThis ? (e) => { const cells = (el.cells || []).map((row) => row.slice()); while (cells.length < (el.rows || 2)) cells.push([]); cells[r][c] = e.currentTarget.textContent || ''; updateEl(page.id, el.id, { cells }) } : undefined}
                      >{val}</div>
                    )
                  })}
                </div>)
              : isImg
              ? (el.src
                  ? <img src={el.src} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
                  : <div className="feltext" style={{ fontSize: 11, color: '#8a93a5' }}>더블클릭해서 이미지 올리기</div>)
              : (editingThis
                  ? <div className="feltext" contentEditable suppressContentEditableWarning ref={(n) => { if (n) n.focus() }} style={txtStyle}
                      onBlur={(e) => { updateEl(page.id, el.id, { text: e.currentTarget.textContent || '' }); setEditing(null) }}>{el.text}</div>
                  : <div className="feltext" style={txtStyle}>{el.text}</div>)}
            {active && selEl === el.id ? <div className="frh" onPointerDown={(e) => onResizeDown(e, el)} /> : null}
          </div>
        )
      })}
    </div>
  )
}
