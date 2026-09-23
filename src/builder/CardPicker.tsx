import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useBuilder } from '../state/store'
import { CARD_REGISTRY } from '../cards/registry'
import { BRANCH_MIN, BRANCH_MAX, BRANCH_DEFAULT } from '../cards/mindmapEls'

const GROUPS: { key: string; label: string }[] = [
  { key: 'frame', label: '틀 구조' },
  { key: 'extra', label: '경영 보고 보강' },
  { key: 'viz', label: '다이어그램 · 비주얼' },
]

// 카드별 미니 썸네일(viewBox 0 0 40 30, 인라인 스타일)
const S = 'stroke="#c3ccdd" stroke-width="2" fill="none"'
const B = 'fill="#dce6ff" stroke="#b9ccf5" stroke-width="1"'
const BX = 'fill="#eef2fb" stroke="#c9d6f5" stroke-width="1.4"'
const THUMBS: Record<string, string> = {
  cover: `<rect x="6" y="6" width="28" height="7" rx="2" ${B}/><line x1="10" y1="18" x2="30" y2="18" ${S}/>`,
  toc: `<line x1="8" y1="9" x2="32" y2="9" ${S}/><line x1="8" y1="15" x2="32" y2="15" ${S}/><line x1="8" y1="21" x2="26" y2="21" ${S}/>`,
  note: `<rect x="7" y="6" width="26" height="18" rx="2" ${S}/>`,
  closing: `<rect x="8" y="10" width="24" height="9" rx="2" ${B}/>`,
  summary: `<line x1="8" y1="11" x2="32" y2="11" ${S}/><rect x="8" y="16" width="24" height="7" rx="2" ${B}/>`,
  kpi: `<rect x="5" y="9" width="9" height="12" rx="2" ${BX}/><rect x="16" y="9" width="9" height="12" rx="2" ${BX}/><rect x="27" y="9" width="9" height="12" rx="2" ${BX}/>`,
  roadmap: `<rect x="4" y="12" width="8" height="6" rx="1" ${B}/><rect x="16" y="12" width="8" height="6" rx="1" ${B}/><rect x="28" y="12" width="8" height="6" rx="1" ${B}/><line x1="12" y1="15" x2="16" y2="15" ${S}/><line x1="24" y1="15" x2="28" y2="15" ${S}/>`,
  market: `<rect x="6" y="8" width="12" height="14" rx="2" ${S}/><rect x="22" y="8" width="12" height="14" rx="2" ${S}/>`,
  flow: `<rect x="12" y="3" width="16" height="6" rx="2" ${BX}/><rect x="12" y="12" width="16" height="6" rx="2" ${BX}/><rect x="12" y="21" width="16" height="6" rx="2" ${BX}/><line x1="20" y1="9" x2="20" y2="12" ${S}/><line x1="20" y1="18" x2="20" y2="21" ${S}/>`,
  mindmap: `<circle cx="20" cy="15" r="3" fill="#2462EB"/><line x1="20" y1="15" x2="7" y2="7" ${S}/><line x1="20" y1="15" x2="33" y2="7" ${S}/><line x1="20" y1="15" x2="7" y2="23" ${S}/><line x1="20" y1="15" x2="33" y2="23" ${S}/>`,
  sticky: `<rect x="7" y="8" width="11" height="11" rx="1" fill="#fdf3b6" stroke="#e6d688"/><rect x="22" y="10" width="11" height="11" rx="1" fill="#d7f0d0" stroke="#a9d39b"/>`,
  board: `<rect x="6" y="7" width="9" height="7" fill="#fdf3b6" stroke="#e6d688"/><rect x="18" y="12" width="9" height="7" fill="#d7e6ff" stroke="#b9ccf5"/><rect x="28" y="8" width="8" height="7" fill="#f6d7e6" stroke="#e6a9c8"/>`,
  dsection: `<rect x="7" y="7" width="26" height="5" rx="2" ${B}/><line x1="7" y1="17" x2="27" y2="17" ${S}/>`,
}
const DEF = `<rect x="7" y="6" width="26" height="18" rx="2" ${S}/>`
const thumb = (k: string) => `<svg viewBox="0 0 40 30" width="100%" height="100%">${THUMBS[k] || DEF}</svg>`

export default function CardPicker() {
  const addCard = useBuilder((s) => s.addCard)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  /** 마인드맵만 **넣기 전에 한 번 더 묻는다** — 가지 수(EVER-SKETCH1 8c7c812 · 원본 사용자 결정 ㄱ).
   *  그때가 개수를 정하기 가장 좋은 순간이다: 아직 아무것도 안 옮겨 놨으므로
   *  마음껏 다시 배치할 수 있다. 넣고 난 뒤에 바꾸려면 사람이 맞춰 둔 자리가 흐트러진다. */
  const [askBranches, setAskBranches] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, left: r.left })
    }
    setOpen((o) => !o)
  }
  function close() { setOpen(false); setQ(''); setAskBranches(false) }
  function pick(key: string) {
    if (key === 'mindmap') { setAskBranches(true); return }
    addCard(key); close()
  }

  const term = q.trim()
  const match = (label: string, key: string) => !term || label.includes(term) || key.includes(term)

  return (
    <div className="cardpick">
      <button ref={btnRef} className="add" onClick={toggle}>＋ 새 페이지 ▾</button>
      {open && pos && createPortal(
        <>
          <div className="cpk-scrim" onClick={close} />
          <div className="cpk-pop" style={{ top: pos.top, left: pos.left }}>
            {askBranches ? (<>
              <div className="cpk-grp">마인드맵 · 가지 수</div>
              <div className="cpk-brs">
                {Array.from({ length: BRANCH_MAX - BRANCH_MIN + 1 }, (_, i) => BRANCH_MIN + i).map((n) => (
                  <button key={n} className={'cpk-br' + (n === BRANCH_DEFAULT ? ' def' : '')}
                    onClick={() => { addCard('mindmap', n); close() }}>{n}</button>
                ))}
              </div>
              <div className="cpk-hint">나중에 오른쪽 패널에서 <b>＋ 가지</b>로 더 붙일 수 있어요.</div>
              <button className="cpk-back" onClick={() => setAskBranches(false)}>← 카드 고르기로</button>
            </>) : (<>
            <div className="cpk-quick">
              {/* 「＋ 덱 섹션」 빠른 단추는 뺐다 — 덱 섹션은 감춘 카드다(EVER-SKETCH1 e8f80f7).
                  「＋ 빈 슬라이드」는 그대로 둔다(사용자 요청). */}
              <button className="cpk-q" onClick={() => pick('slide')}>＋ 빈 슬라이드</button>
            </div>
            <input className="cpk-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="카드 검색 (예: 마인드맵, 메모)" aria-label="카드 검색" autoFocus />
            {GROUPS.map((g) => {
              // **감춘 카드를 먼저 거르고, 검색은 그 뒤에 건다**(EVER-SKETCH1 e8f80f7). 순서가 반대면
              // 감춘 카드가 검색으로 나온다. 덱 섹션만 빼던 옛 특례는 이 표시로 합쳐졌다.
              // 묶음이 통째로 비면(경영 보고 보강) 아래 `return null` 로 이름도 안 그린다.
              const items = CARD_REGISTRY.filter((c) => c.group === g.key && !c.hidden).filter((t) => match(t.label, t.key))
              if (!items.length) return null
              return (
                <div key={g.key}>
                  <div className="cpk-grp">{g.label}</div>
                  <div className="cpk-grid">
                    {items.map((c) => (
                      <button key={c.key} className={'cpk-tile' + (g.key === 'viz' ? ' hot' : '')} onClick={() => pick(c.key)} title={c.label}>
                        <span className="cpk-thumb" dangerouslySetInnerHTML={{ __html: thumb(c.key) }} />
                        <span className="cpk-nm">{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
            </>)}
          </div>
        </>,
        document.body,
      )}
    </div>
  )
}
