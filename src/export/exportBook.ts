import { toPng } from 'html-to-image'
import type { Page } from '../state/store'
import { cardByKey } from '../cards/registry'

export interface ExportSettings { title: string; orientation: string }
interface OutPage { role: string; seq?: number; title?: string; imageDataUrl: string }
export interface BuildResult { ok: boolean; id?: string; url?: string; error?: string }

export async function exportBook(pages: Page[], settings: ExportSettings): Promise<BuildResult> {
  const out: OutPage[] = []
  let seq = 0
  for (const p of pages) {
    const node = document.getElementById('export-page-' + p.id)
    if (!node) continue
    const dataUrl = await toPng(node as HTMLElement, { pixelRatio: 2, cacheBust: true })
    const c = cardByKey(p.cardKey)
    let role = 'content'
    if (c && c.kind === 'cover') role = 'cover'
    else if (c && c.kind === 'back') role = 'back'
    else if (c && c.kind === 'toc') role = 'toc'
    if (role === 'content') {
      seq++
      out.push({ role, seq, title: p.fields.title || (c ? c.title : '페이지' + seq), imageDataUrl: dataUrl })
    } else {
      out.push({ role, imageDataUrl: dataUrl })
    }
  }
  const res = await fetch('/api/build', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: settings.title, orientation: settings.orientation, pages: out }),
  })
  return res.json() as Promise<BuildResult>
}
