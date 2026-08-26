import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import type { ChangeEvent, CSSProperties } from 'react'
import { useBuilder } from '../../state/store'
import { exportBook } from '../../export/exportBook'
import { parseHtml } from '../../import/htmlImport'
import type { ImportedDoc } from '../../import/htmlImport'
import { deckIrToPages } from '../../import/deckToPages'

type Preview = {
  name: string; busy: boolean; ok?: boolean; error?: string; pages?: number
  pptx_url?: string; pdf_url?: string | null; thumbs?: string[]
  editableDoc?: ImportedDoc; ir?: { meta?: Record<string, unknown>; pages?: unknown[] }
}
export type ClassicBarHandle = { openImport: () => void }

// 툴바2: 기존 이북/문서 기능(유지) — 가져오기·미리보기·이북 만들기.
const ClassicBar = forwardRef<ClassicBarHandle, { onSettings: () => void; onDemo: () => void; onAiCleanup: () => void }>(
  function ClassicBar({ onSettings, onDemo, onAiCleanup }, ref) {
    const orientation = useBuilder((s) => s.orientation)
    const setOrientation = useBuilder((s) => s.setOrientation)
    const title = useBuilder((s) => s.title)
    const pages = useBuilder((s) => s.pages)
    const importDoc = useBuilder((s) => s.importDoc)
    const importDeckSlides = useBuilder((s) => s.importDeckSlides)
    const importPages = useBuilder((s) => s.importPages)
    const [status, setStatus] = useState('')
    const [url, setUrl] = useState<string | undefined>(undefined)
    const fileRef = useRef<HTMLInputElement>(null)
    const [deckTheme, setDeckTheme] = useState<'light' | 'dark'>('light')
    const [preview, setPreview] = useState<Preview | null>(null)

    useImperativeHandle(ref, () => ({ openImport: () => fileRef.current?.click() }))

    async function onImportFile(e: ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      const text = await file.text()
      setUrl(undefined)
      setPreview({ name: file.name, busy: true })
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('theme', deckTheme)
        const res = await fetch('/api/deck', { method: 'POST', body: fd }).then((r) => r.json())
        const editableDoc = (() => { try { return parseHtml(text) } catch { return undefined } })()
        if (res.ok) setPreview({ name: file.name, busy: false, ok: true, pages: res.pages, pptx_url: res.pptx_url, pdf_url: res.pdf_url, thumbs: res.thumbs || [], editableDoc, ir: res.ir })
        else setPreview({ name: file.name, busy: false, ok: false, error: res.error, editableDoc })
      } catch (err) {
        const editableDoc = (() => { try { return parseHtml(text) } catch { return undefined } })()
        setPreview({ name: file.name, busy: false, ok: false, error: err instanceof Error ? err.message : String(err), editableDoc })
      }
    }

    function goToCanvas() {
      if (!preview) return
      if (preview.ir && preview.ir.pages && preview.ir.pages.length) {
        setOrientation('portrait')
        importPages(deckIrToPages(preview.ir as never, 'portrait'), preview.name)
      } else if (preview.thumbs && preview.thumbs.length) {
        importDeckSlides(preview.thumbs, preview.name)
      } else if (preview.editableDoc) {
        importDoc(preview.editableDoc)
      }
      setStatus('가져옴: ' + preview.name)
      setPreview(null)
    }

    async function make() {
      if (!pages.length) { setStatus('카드를 먼저 추가하세요'); return }
      setStatus('이북 만드는 중...'); setUrl(undefined)
      try {
        const data = await exportBook(pages, { title, orientation })
        if (data.ok) { setStatus('완료!'); setUrl(data.url) } else setStatus('실패: ' + (data.error || ''))
      } catch (e) { setStatus('오류: ' + (e instanceof Error ? e.message : String(e))) }
    }
    const makeRef = useRef(make); makeRef.current = make
    useEffect(() => {
      const h = () => { void makeRef.current() }
      window.addEventListener('ebook:build', h)
      return () => window.removeEventListener('ebook:build', h)
    }, [])

    return (
      <div className="ax-tb ax-tb2">
        <span className="ax-keep">기존 기능 · 유지</span>
        <span className="ax-seg">
          <button className={orientation === 'portrait' ? 'on' : ''} onClick={() => setOrientation('portrait')}>세로 이북</button>
          <button className={orientation === 'landscape' ? 'on' : ''} onClick={() => setOrientation('landscape')}>가로 덱</button>
        </span>
        <span className="ax-seg" title="가져올 덱 테마">
          <button className={deckTheme === 'light' ? 'on' : ''} onClick={() => setDeckTheme('light')}>라이트</button>
          <button className={deckTheme === 'dark' ? 'on' : ''} onClick={() => setDeckTheme('dark')}>다크</button>
        </span>
        <button className="ax-tbtn imp" onClick={() => fileRef.current?.click()} title="HTML을 깔끔한 덱으로 변환 → 미리보기 후 캔버스로">📄 HTML 가져오기</button>
        <input ref={fileRef} type="file" accept=".html,.htm,text/html" style={{ display: 'none' }} onChange={onImportFile} />
        <button className="ax-tbtn" onClick={onAiCleanup} title="가져온 결과를 규칙으로 다듬기">✨ AI로 정리</button>
        <button className="ax-tbtn" onClick={onDemo} title="예시영상">▶ 예시영상</button>
        <button className="ax-tbtn" onClick={onSettings} title="환경설정(LLM)">⚙ 환경설정</button>
        <span className="grow" />
        {status ? <span className="ax-status">{url ? <a href={url} target="_blank" rel="noreferrer">▶ 열기</a> : status}</span> : <span className="ax-note">발표 → 상단 <b>슬라이드쇼</b>로 대체</span>}
        <button className="ax-tbtn dark" onClick={make}>이북 만들기 →</button>
        {preview && <PreviewModal preview={preview} onClose={() => setPreview(null)} onGo={goToCanvas} />}
      </div>
    )
  }
)
export default ClassicBar

function PreviewModal({ preview, onClose, onGo }: { preview: Preview; onClose: () => void; onGo: () => void }) {
  const scrim: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(11,11,11,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }
  const modal: CSSProperties = { background: '#fff', borderRadius: 16, width: 'min(940px, 96vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px -20px rgba(0,0,0,.4)' }
  const hasSlides = !!(preview.thumbs && preview.thumbs.length)
  return (
    <div style={scrim} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modal}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid #eee' }}>
          <b style={{ fontSize: 15 }}>덱 미리보기 — {preview.name}</b>
          {preview.pages ? <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#888' }}>{preview.pages}장</span> : null}
          <button onClick={onClose} style={{ marginLeft: 'auto', border: 0, background: 'none', fontSize: 18, cursor: 'pointer', color: '#888' }}>✕</button>
        </div>
        <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>
          {preview.busy ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#888' }}>깔끔한 덱으로 변환 중…</div>
          ) : preview.error ? (
            <div style={{ padding: 24, color: '#c0362c' }}>변환 실패: {preview.error}<br /><span style={{ color: '#888', fontSize: 12 }}>아래 "메인 캔버스로 가기"를 누르면 편집 페이지로 가져옵니다.</span></div>
          ) : hasSlides ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {preview.thumbs!.map((t, i) => (
                <div key={i} style={{ border: '1px solid #e5e4dd', borderRadius: 10, overflow: 'hidden', aspectRatio: '3 / 4', background: '#f7f7f4' }}>
                  <img src={t} alt={`${i + 1}쪽`} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 24, color: '#666' }}>PPTX가 생성되었습니다. 슬라이드 미리보기는 LibreOffice(soffice) 설치 시 표시됩니다.<br /><span style={{ color: '#888', fontSize: 12 }}>지금은 "메인 캔버스로 가기"를 누르면 편집 페이지로 가져옵니다.</span></div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', padding: '14px 20px', borderTop: '1px solid #eee' }}>
          {preview.pptx_url && <a className="ax-tbtn" href={preview.pptx_url} download>PPTX 다운로드</a>}
          {preview.pdf_url && <a className="ax-tbtn" href={preview.pdf_url} download>PDF 다운로드</a>}
          <span style={{ flex: 1 }} />
          <button className="ax-tbtn" onClick={onClose}>닫기</button>
          <button className="ax-tbtn dark" onClick={onGo} disabled={preview.busy}>메인 캔버스로 가기 →</button>
        </div>
      </div>
    </div>
  )
}
