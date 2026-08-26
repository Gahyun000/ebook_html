import type { Page } from '../state/store'
import { cardByKey } from '../cards/registry'
export interface TocItem { seq: number; title: string }
export function tocItems(pages: Page[]): TocItem[] {
  let seq = 0; const out: TocItem[] = []
  for (const p of pages) {
    const c = cardByKey(p.cardKey)
    if (c && c.kind) continue
    seq++
    out.push({ seq, title: p.fields.title || (c ? c.title : '페이지' + seq) })
  }
  return out
}
