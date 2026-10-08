// **AI 마인드맵 만들기 창**(2026-10-08). 재료를 골라 서버에 보내고, 검증된 개요를 새 슬라이드에 트리로 펼친다.
//
// 노트북LM 의 마인드맵처럼 「자료를 읽어 주제 → 큰 가지 → 하위 가지」 로 정리한다. LLM 은 서버가 부른다(키는 브라우저에
// 오지 않는다 · server/intent/mindmap.py). LLM 이 안 되면 **안 된다고 말한다** — 빈 골격을 지어내지 않는다.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useBuilder } from '../state/store'
import type { Outline } from '../cards/outlineTree'
import { useProjects } from '../persistence/projects'
import { listNotes } from '../notes/notesApi'
import type { Note } from '../notes/notesApi'
import { API_BASE } from '../chat/config'
import { combine, notesText, pagesText, readableFile } from '../ai/sourceText'
import Modal from '../ui/Modal'

const num = (n: number) => n.toLocaleString('ko-KR')

export default function MindmapMaker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pages = useBuilder((s) => s.pages)
  const title = useBuilder((s) => s.title)
  const addOutline = useBuilder((s) => s.addOutline)
  const activeId = useProjects((s) => s.activeId)
  const [notes, setNotes] = useState<Note[]>([])
  const [useSlides, setUseSlides] = useState(true)
  const [useNotes, setUseNotes] = useState(false)
  const [pasted, setPasted] = useState('')
  const [fileNote, setFileNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  /** 만들긴 했는데 알려야 할 것(못 읽은 부분 · 줄인 가지). 있으면 창을 닫지 않고 보여 준다 — 닫히면 알 길이 없다. */
  const [done, setDone] = useState<string[] | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // 열 때마다 처음 모습으로 — 지난번에 붙여 넣은 글이 남아 다른 문서의 지도에 섞이면 안 된다.
  useEffect(() => {
    if (!open) return
    setPasted(''); setFileNote(''); setError(''); setBusy(false); setDone(null)
    let alive = true
    void (async () => { const list = activeId ? await listNotes(activeId) : []; if (alive) setNotes(list) })()
    return () => { alive = false }
  }, [open, activeId])

  const slideTxt = useMemo(() => pagesText(pages), [pages])
  const noteTxt = useMemo(() => notesText(notes), [notes])
  const src = combine([
    { label: '슬라이드', text: useSlides ? slideTxt : '' },
    { label: '메모', text: useNotes ? noteTxt : '' },
    { label: '붙여 넣은 글', text: pasted },
  ])
  if (!open) return null

  const onFile = async (f: File | undefined) => {
    if (!f) return
    const ok = readableFile(f.name, f.size)
    if (!ok.ok) { setFileNote(ok.reason); return }
    const text = await f.text()
    setPasted((cur) => (cur.trim() ? cur.trim() + '\n\n' : '') + text)
    setFileNote(`「${f.name}」 ${num(text.length)}자를 붙였어요.`)
  }

  const make = async () => {
    if (!src.text || busy) return
    setBusy(true); setError('')
    try {
      const res = await fetch(`${API_BASE}/mindmap`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: src.text, title }) })
      const data = await res.json() as { ok: boolean; outline?: Outline; digest?: string; message?: string
        stats?: { truncated?: boolean; chars_used?: number; chars_total?: number }; warnings?: string[] }
      if (!res.ok || !data.ok || !data.outline) { setError(data.message || 'AI 마인드맵을 만들지 못했어요. 잠시 뒤 다시 해 주세요.'); return }
      addOutline(data.outline, data.digest || '')
      const notes2 = [...(data.warnings || [])]
      if (data.stats && data.stats.truncated && !notes2.some((w) => w.includes('읽었어요'))) notes2.push('자료가 길어 앞부분만 읽었어요.')
      if (notes2.length) setDone(notes2); else onClose()
    } catch {
      setError('서버에 닿지 못했어요. 서버가 떠 있는지 확인해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <Modal title="✨ AI 마인드맵" onClose={onClose} size="sm" className="mm-maker" cancel={{ label: '확인', onClick: onClose }}>
        <p className="ai-sub">새 슬라이드에 마인드맵을 펼쳤어요. 다만 알아 두실 것이 있습니다.</p>
        <ul className="mm-warn">{done.map((w, i) => <li key={i}>{w}</li>)}</ul>
      </Modal>
    )
  }
  return (
    <Modal title="✨ AI 마인드맵" onClose={onClose} size="md" busy={busy} error={error} className="mm-maker"
      cancel={{ label: '취소', onClick: onClose }}
      footer={<button className="ax-tbtn dark mm-go" disabled={busy || !src.text} onClick={() => { void make() }}>
        {busy ? '자료를 읽고 만드는 중… (보통 15초~1분)' : '마인드맵 만들기'}</button>}>
      <p className="ai-sub">고른 자료를 AI 가 읽고 <b>주제 → 큰 가지 → 하위 가지</b>로 정리해 새 슬라이드에 펼칩니다.
        만든 뒤에는 상자를 고쳐 쓰고, 가지를 골라 챗봇에 물어볼 수 있어요. 자료는 사내 LLM 서버로 보내집니다.</p>
      <label className="mm-src"><input type="checkbox" checked={useSlides} disabled={busy || !slideTxt} onChange={(e) => setUseSlides(e.target.checked)} />
        <span>지금 스케치의 슬라이드 전체</span><em>{slideTxt ? `${pages.length}쪽 · ${num(slideTxt.length)}자` : '글이 없어요'}</em></label>
      <label className="mm-src"><input type="checkbox" checked={useNotes} disabled={busy || !noteTxt} onChange={(e) => setUseNotes(e.target.checked)} />
        <span>메모장의 메모</span><em>{noteTxt ? `${notes.length}개 · ${num(noteTxt.length)}자` : '메모가 없어요'}</em></label>
      <div className="mm-paste">
        <div className="mm-paste-h"><span>붙여 넣는 글</span>
          <button className="ax-tbtn" disabled={busy} onClick={() => fileRef.current?.click()}>글 파일 고르기</button>
          <input ref={fileRef} type="file" hidden accept=".txt,.md,.markdown,.csv,.tsv,.json,.jsonl,.log,.xml,.yaml,.yml,.ini,.html,.htm,.sql"
            onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} /></div>
        <textarea className="mm-text" value={pasted} disabled={busy} onChange={(e) => setPasted(e.target.value)}
          placeholder="회의록 · 기획안 · 보고서 본문을 여기에 붙여 넣으세요. PDF · 오피스 문서는 내용을 글로 복사해 넣어 주세요." />
        {fileNote ? <div className="mm-note">{fileNote}</div> : null}
      </div>
      <div className="mm-sum">{src.text
        ? <>읽을 자료 <b>{num(src.chars)}자</b>{src.chars > 64000 ? <> — 길어서 <b>앞 64,000자까지만</b> 읽습니다</> : src.chars > 12000 ? ' — 길어서 나눠 읽습니다(몇 분 걸릴 수 있어요)' : ''}</>
        : '읽을 자료를 하나 이상 고르거나 글을 붙여 넣어 주세요.'}</div>
    </Modal>
  )
}
