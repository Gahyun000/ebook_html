import { useEffect, useState } from 'react'
import { useBuilder } from '../state/store'
import PageWithCanvas from '../cards/PageWithCanvas'
import { pageSize } from '../cards/sizing'
import { tocItems } from './util'

export default function Present({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pages = useBuilder((s) => s.pages)
  const orientation = useBuilder((s) => s.orientation)
  const size = useBuilder((s) => s.size)
  const font = useBuilder((s) => s.font)
  const title = useBuilder((s) => s.title)
  const [idx, setIdx] = useState(0)
  const [scale, setScale] = useState(1)
  const items = tocItems(pages)
  const { W, H } = pageSize(orientation)

  useEffect(() => { if (open) setIdx(0) }, [open])
  useEffect(() => {
    function recompute() { setScale(Math.min((window.innerWidth * 0.84) / W, (window.innerHeight * 0.8) / H)) }
    recompute()
    window.addEventListener('resize', recompute)
    return () => window.removeEventListener('resize', recompute)
  }, [W, H, open])
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); setIdx((i) => Math.min(i + 1, Math.max(0, pages.length - 1))) }
      else if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, pages.length, onClose])

  if (!open) return null
  if (!pages.length) {
    return (<div className="present"><button className="pexit" onClick={onClose}>✕ 나가기 (Esc)</button><div style={{ color: '#fff' }}>페이지가 없습니다</div></div>)
  }
  const clamped = Math.min(idx, pages.length - 1)
  const page = pages[clamped]
  return (
    <div className="present">
      <button className="pexit" onClick={onClose}>✕ 나가기 (Esc)</button>
      <div style={{ transform: 'scale(' + scale + ')', transformOrigin: 'center', cursor: 'pointer' }} onClick={() => setIdx((i) => Math.min(pages.length - 1, i + 1))}>
        <PageWithCanvas page={page} docTitle={title} orientation={orientation} size={size} font={font} tocItems={items} interactive={false} />
      </div>
      <div className="pnav">
        <button onClick={(e) => { e.stopPropagation(); setIdx((i) => Math.max(0, i - 1)) }}>‹</button>
        <span className="pidx">{clamped + 1} / {pages.length}</span>
        <button onClick={(e) => { e.stopPropagation(); setIdx((i) => Math.min(pages.length - 1, i + 1)) }}>›</button>
      </div>
    </div>
  )
}
