import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search, Copy, Trash2, Pencil, ExternalLink, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react'
import { useProjects } from './projects'
import type { ProjectMeta } from './projectApi'
import Modal from '../ui/Modal'

const PAGE_SIZE = 12
const FOLIO_URL = 'http://127.0.0.1:8811'

// KST 24시간 표기(표준: 한국 표준시·24h).
function fmtKst(ts?: number): string {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function LibraryScreen() {
  const view = useProjects((s) => s.view)
  const list = useProjects((s) => s.list)
  const loading = useProjects((s) => s.loading)
  const openProject = useProjects((s) => s.openProject)
  const newProject = useProjects((s) => s.newProject)
  const renameProject = useProjects((s) => s.renameProject)
  const deleteProject = useProjects((s) => s.deleteProject)
  const duplicateProject = useProjects((s) => s.duplicateProject)

  const [qIn, setQIn] = useState(''); const [fromIn, setFromIn] = useState(''); const [toIn, setToIn] = useState('')
  const [q, setQ] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null)
  const [pendingDel, setPendingDel] = useState<ProjectMeta | null>(null)
  /** 지우기에 실패한 이유 — **그 창 안에** 적는다(EVER-SKETCH1 e0afde4). 창이 사라진 뒤
   *  엉뚱한 자리에서 이유가 뜨면 방금 누른 것과 이어지지 않는다. */
  const [delErr, setDelErr] = useState('')
  /** 서버에 보내는 중 — **확인 버튼과 취소를 함께 잠근다**(EVER-SKETCH1 e0afde4).
   *
   *  이게 없으면 「삭제」를 두 번 누를 수 있고, 요청이 두 번 나간다. 두 번째는 404 로 떨어지고,
   *  **이미 지워졌는데 「지우지 못했어요」로 보인다** — 늦게 온 거절이 다음 창에 남는 것도 같은 구멍이다.
   *  구멍은 **응답을 기다리는 그 사이**에만 열린다. 빠른 회선에서는 잘 안 걸리고, 느린 날에 걸린다.
   *
   *  (ebook_html) 상태(`busy`)만으로는 **같은 틀 안의 두 번 누르기**를 못 막는다 — 두 번째 누르기가
   *  다시 그리기 전에 오면 둘 다 옛 `busy=false` 를 본다. 그래서 ref 로 한 번 더 잠근다. */
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  useEffect(() => { if (view === 'library') setPage(1) }, [view])

  const filtered = useMemo(() => {
    const term = q.trim()
    const fromTs = from ? new Date(from + 'T00:00:00').getTime() : -Infinity
    const toTs = to ? new Date(to + 'T23:59:59').getTime() : Infinity
    return list.filter((p) => {
      const u = p.updated_at || 0
      if (u < fromTs || u > toTs) return false
      if (!term) return true
      return (p.name || '').includes(term) || p.id.includes(term)
    })
  }, [list, q, from, to])

  const total = filtered.length
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const cur = Math.min(page, pages)
  const shown = filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE)

  if (view !== 'library') return null

  const applySearch = () => { setQ(qIn); setFrom(fromIn); setTo(toIn); setPage(1) }
  const resetSearch = () => { setQIn(''); setFromIn(''); setToIn(''); setQ(''); setFrom(''); setTo(''); setPage(1) }
  const commitRename = async () => { if (editing && editing.value.trim()) await renameProject(editing.id, editing.value.trim()); setEditing(null) }
  const openDelete = (p: ProjectMeta) => { setPendingDel(p); setDelErr('') }
  const closeDelete = () => { setPendingDel(null); setDelErr('') }
  const confirmDelete = async () => {
    if (!pendingDel || busyRef.current) return
    busyRef.current = true
    setDelErr(''); setBusy(true)
    try {
      await deleteProject(pendingDel.id)
      setPendingDel(null)
    } catch (e) {
      // 서버가 준 말을 **그대로** 옮긴다. 못 알아들을 때만 우리가 지어낸다.
      setDelErr(e instanceof Error && e.message ? e.message : '지우지 못했어요.')
    } finally { busyRef.current = false; setBusy(false) }
  }

  return (
    <div className="lib-screen">
      <div className="lib-head">
        <div className="lib-brand"><div className="logo" aria-label="EVER-SKETCH" /> EVER-SKETCH</div>
        <button className="lib-new" onClick={() => void newProject()}><Plus className="h-4 w-4" /> 스케치</button>
      </div>

      {/* 검색/조회 (표준: 검색어·시작일·종료일·검색·초기화) */}
      <div className="lib-search">
        <input className="lib-date" type="date" value={fromIn} onChange={(e) => setFromIn(e.target.value)} aria-label="시작일" />
        <span className="lib-tilde">~</span>
        <input className="lib-date" type="date" value={toIn} onChange={(e) => setToIn(e.target.value)} aria-label="종료일" />
        <div className="lib-q"><Search className="h-4 w-4" /><input value={qIn} onChange={(e) => setQIn(e.target.value)} placeholder="이북 제목 또는 ID" onKeyDown={(e) => { if (e.key === 'Enter') applySearch() }} aria-label="검색어" /></div>
        <button className="lib-btn dark" onClick={applySearch}>검색</button>
        <button className="lib-btn" onClick={resetSearch}>초기화</button>
      </div>

      {/* 개수/페이지 (표준: 전체개수·현재/총 페이지·페이지크기) */}
      <div className="lib-pager">
        <span className="lib-count">전체 {total}개 · {cur}/{pages} 페이지 · {PAGE_SIZE}개씩</span>
        <span className="lib-nav">
          <button disabled={cur <= 1} onClick={() => setPage(cur - 1)} aria-label="이전 페이지"><ChevronLeft className="h-4 w-4" /></button>
          <button disabled={cur >= pages} onClick={() => setPage(cur + 1)} aria-label="다음 페이지"><ChevronRight className="h-4 w-4" /></button>
        </span>
      </div>

      <div className="lib-list">
        {loading ? (
          <div className="lib-empty">불러오는 중…</div>
        ) : total === 0 ? (
          <div className="lib-empty">{q || from || to ? '조건에 맞는 이북이 없어요.' : '아직 이북이 없어요.\n＋ 스케치으로 시작해 보세요.'}</div>
        ) : (
          shown.map((p) => (
            <div key={p.id} className="lib-card">
              <button className="lib-open-hit" title="이 이북 열기" onClick={() => void openProject(p.id)}>
                <div className="lib-ico"><BookOpen className="h-5 w-5" /></div>
                <div className="lib-meta">
                  {editing && editing.id === p.id ? (
                    <input className="lib-rename" autoFocus value={editing.value}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setEditing({ id: p.id, value: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void commitRename() } if (e.key === 'Escape') setEditing(null) }}
                      onBlur={() => void commitRename()} />
                  ) : (
                    <div className="lib-name">{p.name || '제목 없음'}</div>
                  )}
                  <div className="lib-sub">{fmtKst(p.updated_at)} · {p.page_count}페이지{p.published_id ? ' · 발행됨' : ''}</div>
                </div>
              </button>
              <div className="lib-actions">
                {p.published_id ? (
                  <a className="lib-act" title="발행본 보기(EVER-FOLIO)" href={`${FOLIO_URL}/ebooks/${p.published_id}/index.html`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><ExternalLink className="h-4 w-4" /></a>
                ) : null}
                <button className="lib-act" title="이름 바꾸기" onClick={() => setEditing({ id: p.id, value: p.name || '' })}><Pencil className="h-4 w-4" /></button>
                <button className="lib-act" title="복제" onClick={() => void duplicateProject(p.id)}><Copy className="h-4 w-4" /></button>
                <button className="lib-act danger" title="삭제" onClick={() => openDelete(p)}><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 프로젝트 자체 확인 다이얼로그(표준: 브라우저 confirm 금지).
          껍데기는 ui/Modal 하나다(EVER-SKETCH1 82d87f4) — Esc · 포커스 가두기 · 배경 잠금이 따라온다.
          처리 중(`busy`)에는 Esc·바깥 누르기·취소로도 안 닫힌다 — 절반만 처리된 채 창이 사라지면
          무엇이 참인지 알 수 없다. */}
      {pendingDel && (
        <Modal title="이북 삭제" onClose={closeDelete} size="sm" busy={busy}
          scrimClassName="lib-confirm" className="lib-confirm-box"
          footClassName="lib-confirm-actions"
          cancel={{ label: '취소', onClick: closeDelete }}
          footer={<>
            <button className="lib-c-ok danger" disabled={busy}
              onClick={() => void confirmDelete()}>{busy ? '삭제 중…' : '삭제'}</button>
          </>}>
          ‘{pendingDel.name || '제목 없음'}’ 이북을 삭제할까요?<br />
          이 이북의 모든 슬라이드와 버전 기록이 함께 삭제되며 <b>되돌릴 수 없어요.</b>
          {delErr && <div className="lib-delerr" role="alert">{delErr}</div>}
        </Modal>
      )}
    </div>
  )
}
