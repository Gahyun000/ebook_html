import { useEffect, useRef, useState } from 'react'
import { Plus, Search, Pin, PinOff, Trash2, Copy, Send, X, ChevronLeft, ChevronRight, StickyNote } from 'lucide-react'
import SideTabs, { useNoteCount } from '../ui/SideTabs'
import { useProjects } from '../persistence/projects'
import { useBuilder, newBlock } from '../state/store'
import type { Block } from '../state/store'
import { cardByKey } from '../cards/registry'
import BlockEditor from '../builder/BlockEditor'
import PlainEditor, { normalizePlain } from './PlainEditor'
import { listNotes, saveNote, deleteNoteApi } from './notesApi'
import type { Note } from './notesApi'
import './notes.css'

/**
 * **챗봇과 같은 눈금을 쓴다**(EVER-SKETCH1 fb61df4). 전에는 320 · 430 · 620 이었는데, 챗봇은
 * 340 · 460 · 640 이었다. 둘이 한 자리를 나눠 쓰게 되면서 **같은 「M」인데 폭이 30px
 * 다른** 꼴이 됐다 — 탭을 누를 때마다 패널이 덜컥 움직인다(원본 시험 서버 실측: 460 → 430).
 *
 * 기억은 여전히 **따로** 한다(`notepad-size` · `agentic-pm-chat-size`). 메모는 넓게,
 * 챗봇은 좁게 쓰는 사람이 있어서다. 다만 **같은 글자는 같은 폭**이어야, 둘 다 M 으로
 * 두고 쓰는 대부분의 사람에게는 움직임이 아예 없다.
 */
const SIZES = { S: 340, M: 460, L: 640 } as const
type Size = keyof typeof SIZES

// 블록 id를 새로 매겨 편집기·다른 노트와 충돌 방지(서버에서 온 id 재사용 금지).
function reid(bs: Block[]): Block[] {
  return (bs || []).map((b) => ({ ...b, id: newBlock().id, children: b.children ? reid(b.children) : b.children }))
}
function blocksText(bs: Block[]): string {
  return (bs || []).map((b) => (b.text || '') + (b.children ? ' ' + blocksText(b.children) : '')).join(' ')
}
function previewOf(bs: Block[]): string {
  for (const b of bs || []) { if ((b.text || '').trim()) return b.text.trim() }
  return ''
}
function todoStats(bs: Block[]): { done: number; total: number } {
  let done = 0, total = 0
  const walk = (a: Block[]) => (a || []).forEach((b) => { if (b.type === 'todo') { total++; if (b.done) done++ } if (b.children) walk(b.children) })
  walk(bs)
  return { done, total }
}
function genId(): string { return 'n' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36) }

/**
 * 메모장 — **챗봇과 한 자리를 나눠 쓴다**(EVER-SKETCH1 fb61df4 · 시안 ㄷ).
 *
 * 전에는 제 열림 상태를 스스로 들고, 왼쪽 아래에 제 단추를 따로 띄웠다. 이제는
 * 바깥(Layout)이 「지금 이 자리에 무엇을 띄울까」를 하나로 들고 있다 — 둘이 동시에
 * 뜨는 일이 없어야 하는데, 각자 들고 있으면 언젠가 겹친다.
 */
export default function NotesPanel({ open, onClose, onChat }: {
  open: boolean; onClose: () => void; onChat: () => void
}) {
  const activeId = useProjects((s) => s.activeId)
  const addCard = useBuilder((s) => s.addCard)
  const setBlocks = useBuilder((s) => s.setBlocks)

  const [notes, setNotes] = useState<Note[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'editor' | 'slide'>('list')

  /**
   * **지금 슬라이드**(2026-10-06 · 사용자 결정). 고른 쪽이 빈 페이지면 그 글을 여기서 넓게 고친다.
   *
   * 전에는 오른쪽 속성 패널 **맨 아래**(폭 316px)가 유일한 자리였고, 챗봇 단추가 마지막 줄을 가렸다.
   * 「메모랑 슬라이드랑 연동되게」 — 그래서 메모장을 그 글을 고치는 **창**으로 쓴다. 글은 슬라이드 한 곳에만
   * 둔다: 메모 쪽에 한 벌 더 두면 두 벌이 어긋나는 날이 온다. 편집기도 오른쪽 패널에 있던 그것(BlockEditor)
   * 그대로다 — 메모용 PlainEditor 는 토글 · 강조 상자 · 구분선 · 정렬을 몰라 평범한 글로 눌러 버린다.
   * 다른 쪽(캔버스 슬라이드 · 카드)은 종이 위에서 바로 고치므로 여기 줄을 띄우지 않는다.
   */
  const nowPage = useBuilder((s) => s.pages.find((p) => p.id === s.selectedPageId) || null)
  const nowNo = useBuilder((s) => s.pages.findIndex((p) => p.id === s.selectedPageId) + 1)
  const nowNote = !!nowPage && cardByKey(nowPage.cardKey)?.viz === 'note'
  // 슬라이드 보기는 「지금 쪽」 을 따라간다 — 빈 페이지가 아닌 쪽으로 옮기면 목록을 보인다.
  const shown = view === 'slide' && !nowNote ? 'list' : view
  // 오른쪽 「내용」 의 「메모장에서 글 고치기」 — 곁자리는 Layout 이 열고, 여기서는 보기를 고른다.
  useEffect(() => {
    const go = () => setView('slide')
    window.addEventListener('ebook:notes-slide', go)
    return () => window.removeEventListener('ebook:notes-slide', go)
  }, [])
  const [q, setQ] = useState('')
  const [sortBy, setSortBy] = useState<'updated' | 'title' | 'created'>('updated')
  const [size, setSize] = useState<Size>(() => {
    try { const v = localStorage.getItem('notepad-size'); if (v === 'S' || v === 'M' || v === 'L') return v } catch { /* noop */ }
    return 'M'
  })
  const width = SIZES[size]
  const timers = useRef<Record<string, number>>({})

  function pickSize(s: Size) { setSize(s); try { localStorage.setItem('notepad-size', s) } catch { /* noop */ } }

  // 프로젝트 전환 시: 그 이북 메모를 불러온다. **패널을 여닫는 일은 바깥(Layout)이 한다.**
  // 챗봇과 같은 규칙이다 — 항상 닫힌 채로 시작하고, 필요한 사람이 연다. 전에는 이북마다
  // 「열어 두었나」를 따로 기억해 다시 열었는데, 자리를 챗봇과 나눠 쓰면서 그 기억을 놓았다.
  // 닫혀 있어도 목록은 불러 둔다 — 탭의 파란 점(적어 둔 게 있다)이 이 값을 본다.
  useEffect(() => {
    if (!activeId) { setNotes([]); return }
    let alive = true
    void (async () => {
      const list = await listNotes(activeId)
      if (!alive) return
      setNotes(list.map((n) => ({ ...n, blocks: normalizePlain(reid(n.blocks || [])) })))
    })()
    setView('list'); setCurrentId(null); setQ('')
    return () => { alive = false }
  }, [activeId])

  function queueSave(n: Note) {
    if (!activeId) return
    const pid = activeId
    if (timers.current[n.id]) window.clearTimeout(timers.current[n.id])
    timers.current[n.id] = window.setTimeout(() => { void saveNote(pid, n) }, 500)
  }
  function patchNote(id: string, patch: Partial<Note>) {
    setNotes((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() / 1000 } : n))
      const changed = next.find((n) => n.id === id)
      if (changed) queueSave(changed)
      return next
    })
  }
  function newNote() {
    const n: Note = { id: genId(), title: '', blocks: [newBlock('text', '')], pinned: false, sort: Date.now() }
    setNotes((prev) => [n, ...prev]); setCurrentId(n.id); setView('editor')
    if (activeId) void saveNote(activeId, n)
  }
  function removeNote(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id)); void deleteNoteApi(id)
    if (currentId === id) { setCurrentId(null); setView('list') }
  }
  function duplicateNote(n: Note) {
    const copy: Note = { ...n, id: genId(), title: (n.title || '제목 없음') + ' 사본', blocks: reid(n.blocks), pinned: false, sort: Date.now() }
    setNotes((prev) => [copy, ...prev]); if (activeId) void saveNote(activeId, copy)
  }
  function sendToSlide(n: Note) {
    addCard('note')
    const pid = useBuilder.getState().selectedPageId
    const body = n.blocks && n.blocks.length ? reid(n.blocks) : []
    const blocks: Block[] = n.title ? [{ ...newBlock('h1', n.title), bold: true }, ...body] : (body.length ? body : [newBlock('text', '')])
    if (pid != null) setBlocks(pid, blocks)
    // 보낸 뒤에는 **그 새 슬라이드를 고치는 보기**로 넘어간다. 메모를 계속 고치면서
    // 「슬라이드가 왜 안 바뀌지」 하던 혼동을 막는다 — 메모는 메모대로 목록에 남는다.
    setView('slide')
  }

  // **적어 둔 게 있다**는 신호를 바깥으로 넘긴다. 없애 버린 왼쪽 아래 단추의 파란 점이
  // 하던 일이다 — 챗봇을 보고 있는 사람에게 「메모에 뭔가 있다」를 말해 줄 것이 필요하다.
  const setNoteCount = useNoteCount((s) => s.setN)
  useEffect(() => { setNoteCount(notes.length) }, [notes.length, setNoteCount])

  const cur = notes.find((n) => n.id === currentId) || null
  const filtered = notes.filter((n) => {
    if (!q.trim()) return true
    return (n.title + ' ' + blocksText(n.blocks)).toLowerCase().includes(q.toLowerCase())
  })
  const sorted = [...filtered].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    if (sortBy === 'title') return (a.title || '제목 없음').localeCompare(b.title || '제목 없음')
    if (sortBy === 'created') return (b.createdAt || 0) - (a.createdAt || 0)
    return (b.updatedAt || 0) - (a.updatedAt || 0)
  })

  if (!activeId || !open) return null

  return (
    <div className="np-panel" style={{ width }}>
      <div className="np-head">
        <StickyNote size={16} /><b>메모장</b>
        <span className="np-sizes">{(['S', 'M', 'L'] as Size[]).map((s) => <button key={s} className={size === s ? 'on' : ''} onClick={() => pickSize(s)}>{s}</button>)}</span>
        <button className="np-x" title="닫기" onClick={onClose}><X size={16} /></button>
      </div>
      <SideTabs mode="notes" onChat={onChat} onNotes={() => { /* 이미 여기다 */ }} />

      {shown === 'slide' && nowPage ? (
        <div className="np-body">
          <div className="np-ed-top">
            <button className="np-back" title="목록" onClick={() => setView('list')}><ChevronLeft size={16} /></button>
            <span className="np-slide-head">📄 {nowNo}쪽 · 빈 페이지</span>
          </div>
          <div className="np-slide-cap">여기서 고치면 이 쪽 종이에 바로 보입니다.</div>
          <div className="np-slide-ed"><BlockEditor pageId={nowPage.id} /></div>
        </div>
      ) : shown === 'list' ? (
        <div className="np-body">
          {nowNote && nowPage ? (
            <button className="np-slide" title="이 쪽 글을 메모장에서 고칩니다" onClick={() => setView('slide')}>
              <span className="np-slide-lab">📄 지금 슬라이드 · {nowNo}쪽</span>
              <span className="np-slide-prev">{previewOf(nowPage.blocks || []) || '아직 글이 없어요'}</span>
              <ChevronRight size={15} className="np-slide-go" />
            </button>
          ) : null}
          <div className="np-toolbar">
            <div className="np-search"><Search size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="메모 검색" /></div>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'updated' | 'title' | 'created')} title="정렬">
              <option value="updated">수정순</option><option value="created">생성순</option><option value="title">제목순</option>
            </select>
          </div>
          <button className="np-new" onClick={newNote}><Plus size={15} /> 새 메모</button>
          <div className="np-list">
            {sorted.length === 0 ? <div className="np-empty">{q ? '검색 결과가 없어요.' : '메모가 아직 없어요. ‘새 메모’로 시작하세요.'}</div> : null}
            {sorted.map((n) => {
              const st = todoStats(n.blocks)
              return (
                <div key={n.id} className="np-item" onClick={() => { setCurrentId(n.id); setView('editor') }}>
                  <div className="np-item-main">
                    <div className="np-item-title">{n.pinned ? <Pin size={12} className="np-pin-ic" /> : null}{n.title || '제목 없음'}</div>
                    <div className="np-item-prev">{previewOf(n.blocks) || '내용 없음'}</div>
                  </div>
                  <div className="np-item-side">
                    {st.total ? <span className="np-badge" title="체크리스트">☑ {st.done}/{st.total}</span> : null}
                    <button className="np-iconbtn" title={n.pinned ? '고정 해제' : '고정'} onClick={(e) => { e.stopPropagation(); patchNote(n.id, { pinned: !n.pinned }) }}>{n.pinned ? <PinOff size={13} /> : <Pin size={13} />}</button>
                    <button className="np-iconbtn danger" title="삭제" onClick={(e) => { e.stopPropagation(); removeNote(n.id) }}><Trash2 size={13} /></button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : cur ? (() => {
        const st = todoStats(cur.blocks)
        return (
          <div className="np-body">
            <div className="np-ed-top">
              <button className="np-back" title="목록" onClick={() => setView('list')}><ChevronLeft size={16} /></button>
              <input className="np-title-in" value={cur.title} placeholder="제목 없음" onChange={(e) => patchNote(cur.id, { title: e.target.value })} />
              <button className="np-iconbtn" title={cur.pinned ? '고정 해제' : '고정'} onClick={() => patchNote(cur.id, { pinned: !cur.pinned })}>{cur.pinned ? <PinOff size={15} /> : <Pin size={15} />}</button>
            </div>
            {st.total ? (<div className="np-progress"><div className="np-progress-bar"><span style={{ width: (st.total ? Math.round((st.done / st.total) * 100) : 0) + '%' }} /></div><span className="np-progress-txt">할 일 {st.done}/{st.total}</span></div>) : null}
            <div className="np-editor"><PlainEditor blocks={cur.blocks} onChange={(bs) => patchNote(cur.id, { blocks: bs })} /></div>
            <div className="np-ed-actions">
              <button className="np-act" title="이 메모를 슬라이드(노트 카드)로 보내기" onClick={() => sendToSlide(cur)}><Send size={14} /> 슬라이드로</button>
              <button className="np-act" title="복제" onClick={() => duplicateNote(cur)}><Copy size={14} /> 복제</button>
              <button className="np-act danger" title="삭제" onClick={() => removeNote(cur.id)}><Trash2 size={14} /> 삭제</button>
            </div>
          </div>
        )
      })() : (<div className="np-body"><div className="np-empty">메모를 선택하세요.</div></div>)}
    </div>
  )
}
