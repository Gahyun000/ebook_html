import { useRef, useLayoutEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { Page, Orientation, SizePreset } from '../state/store'
import { cardByKey } from './registry'
import { colors } from '../design/tokens'
import { pageSize } from './sizing'
import type { TocItem } from '../builder/util'

export interface PageViewProps {
  page: Page
  docTitle: string
  orientation: Orientation
  size: SizePreset
  font: string
  tocItems?: TocItem[]
}

function groupColor(group?: string): string {
  if (group === 'model') return colors.blockLime
  if (group === 'extra') return colors.blockCream
  return colors.blockLilac
}
function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function mindmapSVG(fields: Record<string, string>, land: boolean, sc: number): string {
  const center = fields.center || '중심'
  const br = ['b1', 'b2', 'b3', 'b4', 'b5'].map((k) => fields[k]).filter(Boolean)
  const vw = land ? 360 : 250, vh = land ? 190 : 220, cx = vw / 2, cy = vh / 2, rx = vw * 0.34, ry = vh * 0.33
  const n = Math.max(br.length, 1)
  let s = '<svg width="' + (vw * sc).toFixed(0) + '" height="' + (vh * sc).toFixed(0) + '" viewBox="0 0 ' + vw + ' ' + vh + '">'
  const pts = br.map((t, i) => { const a = (-90 + i * (360 / n)) * Math.PI / 180; return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a), t } })
  pts.forEach((p) => { s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + p.x.toFixed(1) + '" y2="' + p.y.toFixed(1) + '" stroke="#c3cbdb" stroke-width="1.5"/>' })
  pts.forEach((p) => {
    const anc = p.x < cx - 6 ? 'end' : p.x > cx + 6 ? 'start' : 'middle'
    s += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3.5" fill="#2f6df6"/>'
    s += '<text x="' + (p.x + (anc === 'end' ? -6 : anc === 'start' ? 6 : 0)).toFixed(1) + '" y="' + (p.y + (p.y < cy ? -6 : 14)).toFixed(1) + '" font-size="10.5" fill="#3a4150" text-anchor="' + anc + '">' + esc(p.t) + '</text>'
  })
  s += '<rect x="' + (cx - 48) + '" y="' + (cy - 15) + '" width="96" height="30" rx="15" fill="#111318"/><text x="' + cx + '" y="' + (cy + 4) + '" font-size="11" fill="#fff" text-anchor="middle" font-weight="700">' + esc(center) + '</text>'
  return s + '</svg>'
}

// 오토핏 — 내용이 페이지보다 길면 통째로 축소해 맞춘다(잘림 방지). 덱처럼 한 페이지에 담는다.
function FitBox({ children, maxH }: { children: ReactNode; maxH: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const h = el.scrollHeight // 레이아웃 높이(transform 영향 없음) — 폭 고정이라 안정적
    const s = h > maxH + 1 ? Math.max(0.4, (maxH - 2) / h) : 1
    setScale((prev) => (Math.abs(prev - s) > 0.005 ? s : prev))
  })
  return (
    <div ref={ref} style={{ transformOrigin: 'top left', transform: scale < 1 ? `scale(${scale})` : undefined }}>
      {children}
    </div>
  )
}

export default function PageView({ page, docTitle, orientation, size, font, tocItems = [] }: PageViewProps) {
  const { W, H, SC, land } = pageSize(orientation)
  // 슬라이드 페이지 — 배경만 그리고, 내용은 캔버스(FreeLayer) 요소로 직접 편집한다(구글 슬라이드식).
  if (page.cardKey === 'slide') {
    const bg = page.bg || '#ffffff'
    return <div style={{ width: W, height: H, background: bg, borderRadius: 8, boxShadow: '0 14px 40px rgba(20,25,40,.18)', overflow: 'hidden' }} />
  }
  // 덱 슬라이드 페이지 — 변환된 슬라이드 이미지를 한 장 통째로.
  if (page.cardKey === 'deckslide') {
    return (
      <div style={{ width: W, height: H, borderRadius: 8, boxShadow: '0 14px 40px rgba(20,25,40,.18)', overflow: 'hidden', background: '#fff' }}>
        <img src={page.fields.img} alt="슬라이드" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
      </div>
    )
  }
  const mul = (size === 's' ? 0.86 : size === 'l' ? 1.18 : 1) * SC
  const H1 = (land ? 30 : 26) * mul, BODY = (land ? 15 : 14) * mul
  const pad = Math.round(24 * SC)
  const fontFamily = font === 'auto' ? "-apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif" : font
  const card = cardByKey(page.cardKey)
  const f = page.fields
  const gc = groupColor(card ? card.group : undefined)
  const noteBg = (card && card.viz === 'note' && page.bg) ? page.bg : '#fff'
  const isCover = !!(card && card.kind === 'cover')

  const bookStyle: CSSProperties = { width: W, height: H, fontFamily, background: isCover ? colors.navy : noteBg, borderRadius: 8, boxShadow: '0 14px 40px rgba(20,25,40,.18)', position: 'relative', overflow: 'hidden' }
  const pg: CSSProperties = { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: pad + 'px ' + (pad - 4) + 'px', boxSizing: 'border-box', color: colors.ink }
  const eyebrow: CSSProperties = { fontSize: 11.5, letterSpacing: 2, textTransform: 'uppercase', color: '#9aa2b1', fontWeight: 700 }
  const divider = '1px solid #eef0f4'

  let inner: ReactNode = null
  if (card && card.kind === 'cover') {
    inner = (<div style={{ ...pg, color: '#fff' }}>
      <div style={{ ...eyebrow, color: 'rgba(255,255,255,.55)' }}>{docTitle}</div>
      <div style={{ margin: 'auto 0' }}>
        <div style={{ fontSize: H1 * 1.2, fontWeight: 800, lineHeight: 1.15, letterSpacing: -1, color: '#fff' }}>{f.title || card.title}</div>
        <div style={{ color: 'rgba(255,255,255,.78)', fontSize: BODY, marginTop: 10 }}>{f.sub}</div>
      </div>
      <div style={{ height: 8, width: 52, borderRadius: 4, background: colors.blue }} />
    </div>)
  } else if (card && card.kind === 'back') {
    inner = (<div style={{ ...pg, justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ fontSize: H1, fontWeight: 700, lineHeight: 1.15 }}>{f.title || card.title}</div>
      <div style={{ color: colors.muted, fontSize: BODY, marginTop: 10 }}>{f.sub}</div>
    </div>)
  } else if (card && card.kind === 'toc') {
    inner = (<div style={pg}>
      <div style={eyebrow}>목차</div>
      <div style={{ fontSize: H1, fontWeight: 700, marginTop: 6 }}>목차</div>
      <ul style={{ marginTop: 14, listStyle: 'none', padding: 0, fontSize: BODY }}>
        {tocItems.length ? tocItems.map((t, i) => (<li key={i} style={{ padding: '8px 0', borderTop: divider, color: '#3a4150' }}>{t.seq}. {t.title}</li>)) : <li style={{ color: '#aab' }}>카드를 추가하면 여기에</li>}
      </ul>
    </div>)
  } else if (card && card.kpi) {
    const rows = ['k1', 'k2', 'k3'].map((k) => f[k]).filter(Boolean).map((sv, i) => {
      const idx = sv.indexOf(':'); const a = idx >= 0 ? sv.slice(0, idx) : sv; const b = idx >= 0 ? sv.slice(idx + 1) : ''
      return (<div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderTop: divider }}><span style={{ color: '#6b7382' }}>{a}</span><b style={{ fontSize: '1.4em' }}>{b}</b></div>)
    })
    inner = (<div style={pg}><div style={eyebrow}>성과</div><div style={{ fontSize: H1, fontWeight: 700, marginTop: 6 }}>{f.title || card.title}</div><div style={{ marginTop: 'auto', fontSize: BODY }}>{rows}</div></div>)
  } else if (card && card.viz === 'flow') {
    const steps = ['s1', 's2', 's3', 's4'].map((k) => f[k]).filter(Boolean)
    const items: ReactNode[] = []
    steps.forEach((s, i) => {
      if (i > 0) items.push(<span key={'a' + i} style={{ color: '#9aa2b1', fontWeight: 700, fontSize: 16 }}>{land ? '→' : '↓'}</span>)
      items.push(<div key={'n' + i} style={{ background: '#fff', border: '1.5px solid #cfd5e2', borderRadius: 8, padding: '8px 13px', fontSize: BODY, fontWeight: 600, color: '#2a3346' }}>{s}</div>)
    })
    inner = (<div style={pg}><div style={eyebrow}>프로세스</div><div style={{ fontSize: H1, fontWeight: 700, marginTop: 6 }}>{f.title || card.title}</div>
      <div style={{ margin: 'auto 0', display: 'flex', flexDirection: land ? 'row' : 'column', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8 }}>{items}</div></div>)
  } else if (card && card.viz === 'mindmap') {
    inner = (<div style={pg}><div style={eyebrow}>마인드맵</div><div style={{ fontSize: H1, fontWeight: 700, marginTop: 6 }}>{f.title || card.title}</div>
      <div style={{ display: 'flex', justifyContent: 'center', margin: 'auto 0' }} dangerouslySetInnerHTML={{ __html: mindmapSVG(f, land, SC) }} /></div>)
  } else if (card && (card.viz === 'sticky' || card.viz === 'board')) {
    const cols = ['#fdf3b6', '#cdeacf', '#f4d2c1', '#e7e3fb', '#dceeb1', '#f9d0e0']
    const keys = card.viz === 'board' ? ['n1', 'n2', 'n3', 'n4', 'n5', 'n6'] : ['n1', 'n2', 'n3', 'n4']
    const notes = keys.map((k) => f[k]).filter(Boolean)
    inner = (<div style={pg}><div style={eyebrow}>{card.viz === 'board' ? '자유 보드' : '메모'}</div><div style={{ fontSize: H1, fontWeight: 700, marginTop: 6 }}>{f.title || card.title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 16, alignContent: 'flex-start' }}>
        {notes.map((t, i) => (<div key={i} style={{ width: 'calc(50% - 5px)', minHeight: 60, borderRadius: 3, padding: '10px 11px', fontSize: 12.5, lineHeight: 1.35, color: '#39371f', boxShadow: '0 2px 6px rgba(0,0,0,.12)', background: cols[i % cols.length], transform: card.viz === 'board' ? (i % 2 ? 'rotate(2.5deg)' : 'rotate(-2.5deg)') : 'none' }}>{t}</div>))}
      </div></div>)
  } else if (card && card.viz === 'note') {
    const blocks = page.blocks || []
    const dark = noteBg === '#111318'
    const col = dark ? '#f2f4f8' : colors.ink
    const sub = dark ? '#c4ccda' : '#3a4150'
    const renderB = (b: typeof blocks[number], key: string, child: boolean): ReactNode => {
      const fsc = b.fs || 1                                   // HWP 글자모양: 크기 배율
      const bcol = b.color || col                             // HWP 글자모양: 색
      const base: CSSProperties = { textAlign: (b.align || 'left'), margin: '5px 0', lineHeight: 1.32, color: bcol, fontWeight: b.bold ? 800 : 500 }
      if (b.type === 'divider') return <div key={key} style={{ height: 1, background: dark ? '#3a4150' : '#e4e7ee', margin: '10px 0' }} />
      if (b.type === 'h1') return <div key={key} style={{ ...base, fontSize: H1 * 0.82 * fsc, fontWeight: 800, letterSpacing: -0.5 }}>{b.text}</div>
      if (b.type === 'h2') return <div key={key} style={{ ...base, fontSize: BODY * 1.3 * fsc, fontWeight: 800 }}>{b.text}</div>
      if (b.type === 'bullet') return <div key={key} style={{ ...base, fontSize: BODY * fsc, paddingLeft: child ? 26 : 14 }}>•&nbsp;&nbsp;{b.text}</div>
      if (b.type === 'toggle') return <div key={key} style={{ ...base, fontSize: BODY * 1.14 * fsc, fontWeight: 800 }}>▾&nbsp;{b.text}</div>
      if (b.type === 'callout') {
        const tone = b.tone || 'info'
        const tint = tone === 'key' ? colors.tintGreen : tone === 'warn' ? colors.tintAmber : colors.tintBlue
        const bar = tone === 'key' ? colors.barGreen : tone === 'warn' ? colors.barAmber : colors.barBlue
        return <div key={key} data-tone={tone} style={{ ...base, fontSize: BODY * fsc, background: dark ? 'rgba(255,255,255,.08)' : tint, borderLeft: '4px solid ' + bar, borderRadius: 8, padding: Math.round(BODY * 0.55) + 'px ' + Math.round(BODY * 0.7) + 'px', color: b.color || (dark ? '#eef' : colors.ink), fontWeight: 500 }}>{b.text}</div>
      }
      return <div key={key} style={{ ...base, fontSize: BODY * fsc, color: b.color || (b.bold ? col : sub), paddingLeft: child ? 14 : 0 }}>{b.text}</div>
    }
    const nodes: ReactNode[] = []
    blocks.forEach((b, i) => {
      nodes.push(renderB(b, 'b' + i, false))
      if (b.type === 'toggle' && b.children) b.children.forEach((c, j) => nodes.push(renderB(c, 'c' + i + '_' + j, true)))
    })
    inner = (<div style={{ ...pg, overflow: 'hidden' }}><FitBox maxH={H - pad * 2}>{nodes}</FitBox></div>)
  } else {
    const pts = ['p1', 'p2', 'p3'].map((k) => f[k]).filter(Boolean)
    inner = (<div style={pg}><div style={eyebrow}>{card ? card.label : ''}</div>
      <div style={{ fontSize: H1, fontWeight: 700, marginTop: 6, lineHeight: 1.15, letterSpacing: -1 }}>{f.title || (card ? card.title : '')}</div>
      <ul style={{ marginTop: 'auto', listStyle: 'none', padding: 0, fontSize: BODY }}>{pts.map((t, i) => (<li key={i} style={{ padding: '9px 0', borderTop: divider, fontWeight: 500, color: '#3a4150' }}>{t}</li>))}</ul>
      <div style={{ height: 8, width: 40, borderRadius: 4, background: gc }} /></div>)
  }
  return (<div style={bookStyle}>{inner}</div>)
}
