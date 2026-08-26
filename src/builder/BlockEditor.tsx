import { useEffect, useRef, useState } from 'react'
import { useBuilder, newBlock } from '../state/store'
import type { Block, BlockType } from '../state/store'

const TYPES: { t: BlockType; label: string; icon: string; child?: boolean }[] = [
  { t: 'h1', label: '제목', icon: 'H1', child: true },
  { t: 'h2', label: '소제목', icon: 'H2', child: true },
  { t: 'text', label: '본문', icon: '¶', child: true },
  { t: 'bullet', label: '목록', icon: '•', child: true },
  { t: 'toggle', label: '토글(접기)', icon: '▸', child: false },
  { t: 'divider', label: '구분선', icon: '—', child: false },
]
const BG_SWATCHES = ['', '#ffffff', '#f5f6f8', '#eef2fb', '#eafaf0', '#fdf3d6', '#fdecef', '#111318']
// HWP 글자모양(색) — 순환 선택
const TEXT_COLORS = ['#111318', '#2462EB', '#0f9d58', '#c5501f', '#4a3aa7', '#5B6270']
const nextColor = (c?: string) => TEXT_COLORS[(TEXT_COLORS.indexOf(c || '#111318') + 1) % TEXT_COLORS.length]

export default function BlockEditor({ pageId }: { pageId: number }) {
  const page = useBuilder((s) => s.pages.find((p) => p.id === pageId))
  const setBlocks = useBuilder((s) => s.setBlocks)
  const setPageBg = useBuilder((s) => s.setPageBg)
  const [menuFor, setMenuFor] = useState<number | null>(null)
  const [focusId, setFocusId] = useState<number | null>(null)
  const refs = useRef<Record<number, HTMLTextAreaElement | null>>({})

  const blocks = page?.blocks || []

  useEffect(() => {
    if (focusId != null) {
      const el = refs.current[focusId]
      if (el) { el.focus(); const v = el.value; el.setSelectionRange(v.length, v.length) }
      setFocusId(null)
    }
  }, [focusId, blocks])

  if (!page) return null
  const commit = (next: Block[]) => setBlocks(pageId, next)

  // 시각 순서(펼쳐진 토글 자식 포함)로 평탄화 — 이전/다음 포커스 계산용
  const flat: { id: number; ti: number; ci: number | null }[] = []
  blocks.forEach((b, ti) => {
    flat.push({ id: b.id, ti, ci: null })
    if (b.type === 'toggle' && !b.collapsed) (b.children || []).forEach((c, ci) => flat.push({ id: c.id, ti, ci }))
  })
  const prevId = (id: number) => { const i = flat.findIndex((x) => x.id === id); return i > 0 ? flat[i - 1].id : null }

  function updateAt(ti: number, ci: number | null, patch: Partial<Block>) {
    commit(blocks.map((b, i) => {
      if (i !== ti) return b
      if (ci == null) return { ...b, ...patch }
      return { ...b, children: (b.children || []).map((c, j) => (j === ci ? { ...c, ...patch } : c)) }
    }))
  }
  function insertAfter(ti: number, ci: number | null, nb: Block) {
    if (ci == null) { const next = [...blocks]; next.splice(ti + 1, 0, nb); commit(next) }
    else commit(blocks.map((b, i) => (i === ti ? { ...b, children: (() => { const ch = [...(b.children || [])]; ch.splice(ci + 1, 0, nb); return ch })() } : b)))
    setFocusId(nb.id)
  }
  function addChild(ti: number) {
    const nb = newBlock('text')
    commit(blocks.map((b, i) => (i === ti ? { ...b, collapsed: false, children: [...(b.children || []), nb] } : b)))
    setFocusId(nb.id)
  }
  function removeAt(ti: number, ci: number | null) {
    const back = prevId(ci == null ? blocks[ti].id : (blocks[ti].children || [])[ci].id)
    if (ci == null) { const next = blocks.filter((_, i) => i !== ti); commit(next) }
    else commit(blocks.map((b, i) => (i === ti ? { ...b, children: (b.children || []).filter((_, j) => j !== ci) } : b)))
    if (back != null) setFocusId(back)
  }

  function onChange(ti: number, ci: number | null, b: Block, val: string) {
    if (val === '/') { setMenuFor(b.id); updateAt(ti, ci, { text: '' }); return }
    if (val === '> ' && ci == null && b.type !== 'toggle') { updateAt(ti, ci, { type: 'toggle', text: '' }); return }
    updateAt(ti, ci, { text: val })
  }
  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>, ti: number, ci: number | null, b: Block) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); updateAt(ti, ci, { bold: !b.bold }); return }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (b.type === 'toggle' && ci == null) addChild(ti)
      else insertAfter(ti, ci, newBlock(b.type === 'bullet' ? 'bullet' : 'text'))
      return
    }
    if (e.key === 'Backspace' && b.text === '') {
      if (b.type !== 'text') { e.preventDefault(); updateAt(ti, ci, { type: 'text' }); return }
      if (flat.length > 1) { e.preventDefault(); removeAt(ti, ci) }
    }
  }
  function pickType(ti: number, ci: number | null, b: Block, t: BlockType) {
    setMenuFor(null)
    if (t === 'divider') { updateAt(ti, ci, { type: 'divider', text: '' }); return }
    updateAt(ti, ci, { type: t })
    setFocusId(b.id)
  }

  function Row({ b, ti, ci }: { b: Block; ti: number; ci: number | null }) {
    const isToggle = b.type === 'toggle' && ci == null
    const ph = b.type === 'h1' ? '제목' : b.type === 'h2' ? '소제목' : isToggle ? '토글 제목' : b.type === 'bullet' ? '목록 항목' : "본문 (‘/’ 블록 · ‘>’ 토글)"
    const taStyle: React.CSSProperties = {
      fontSize: b.type === 'h1' ? 20 : b.type === 'h2' || isToggle ? 16 : 13.5,
      fontWeight: b.bold || b.type === 'h1' || b.type === 'h2' || isToggle ? 800 : 500,
      textAlign: b.align || 'left',
    }
    if (b.type === 'divider') {
      return (<div className={'be-row' + (ci != null ? ' child' : '')}>
        <div className="be-divider" />
        <button className="be-tool danger" title="삭제" onClick={() => removeAt(ti, ci)}>✕</button>
      </div>)
    }
    return (
      <div className={'be-row' + (ci != null ? ' child' : '')}>
        {isToggle ? <button className="be-arrow" onClick={() => updateAt(ti, null, { collapsed: !b.collapsed })}>{b.collapsed ? '▸' : '▾'}</button>
          : <button className="be-badge" title="블록 종류" onClick={() => setMenuFor(menuFor === b.id ? null : b.id)}>{b.type === 'bullet' ? '•' : b.type === 'h1' ? 'H1' : b.type === 'h2' ? 'H2' : '¶'}</button>}
        <textarea
          ref={(n) => { refs.current[b.id] = n }}
          className="be-ta" rows={1} style={taStyle} value={b.text} placeholder={ph}
          onChange={(e) => { onChange(ti, ci, b, e.target.value); const t = e.target; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' }}
          onKeyDown={(e) => onKey(e, ti, ci, b)}
        />
        <div className="be-tools">
          <button className={'be-tool' + (b.bold ? ' on' : '')} title="굵게 (⌘/Ctrl+B)" onClick={() => updateAt(ti, ci, { bold: !b.bold })}>B</button>
          <button className={'be-tool' + ((b.align || 'left') === 'left' ? ' on' : '')} title="왼쪽 정렬" onClick={() => updateAt(ti, ci, { align: 'left' })}>⇤</button>
          <button className={'be-tool' + (b.align === 'center' ? ' on' : '')} title="가운데 정렬" onClick={() => updateAt(ti, ci, { align: 'center' })}>⇔</button>
          <button className={'be-tool' + (b.align === 'right' ? ' on' : '')} title="오른쪽 정렬" onClick={() => updateAt(ti, ci, { align: 'right' })}>⇥</button>
          <button className="be-tool" title="글자 작게" onClick={() => updateAt(ti, ci, { fs: Math.max(0.6, Math.round(((b.fs || 1) - 0.1) * 10) / 10) })}>A−</button>
          <button className="be-tool" title="글자 크게" onClick={() => updateAt(ti, ci, { fs: Math.min(2, Math.round(((b.fs || 1) + 0.1) * 10) / 10) })}>A+</button>
          <button className="be-tool" title="글자 색" onClick={() => updateAt(ti, ci, { color: nextColor(b.color) })}><span style={{ display: 'inline-block', width: 11, height: 11, borderRadius: 3, background: b.color || '#111318', border: '1px solid rgba(0,0,0,.15)' }} /></button>
          <button className="be-tool danger" title="삭제" onClick={() => removeAt(ti, ci)}>✕</button>
        </div>
        {menuFor === b.id ? (
          <div className="be-menu">
            {TYPES.filter((tp) => (ci == null ? true : tp.child)).map((tp) => (
              <button key={tp.t} onClick={() => pickType(ti, ci, b, tp.t)}><span className="mi">{tp.icon}</span>{tp.label}</button>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="block-editor">
      <div className="be-topbar">
        <span className="be-bglabel">배경</span>
        {BG_SWATCHES.map((c) => (
          <button key={c || 'none'} className={'be-swatch' + ((page.bg || '') === c ? ' on' : '')}
            style={{ background: c || 'transparent' }} title={c || '없음'} onClick={() => setPageBg(pageId, c)}>{c ? '' : '⌀'}</button>
        ))}
      </div>
      <div className="be-hint">‘/’ 블록 추가 · ‘&gt;’ 토글 · ⌘/Ctrl+B 굵게 · Enter 새 줄</div>
      <div className="be-list">
        {blocks.map((b, ti) => (
          <div key={b.id}>
            <Row b={b} ti={ti} ci={null} />
            {b.type === 'toggle' && !b.collapsed ? (
              <div className="be-children">
                {(b.children || []).map((c, ci) => <Row key={c.id} b={c} ti={ti} ci={ci} />)}
                <button className="be-addchild" onClick={() => addChild(ti)}>＋ 내용 추가</button>
              </div>
            ) : null}
          </div>
        ))}
        <button className="be-addblock" onClick={() => insertAfter(blocks.length - 1, null, newBlock('text'))}>＋ 블록 추가</button>
      </div>
    </div>
  )
}
