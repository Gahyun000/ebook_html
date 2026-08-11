import { create } from 'zustand'
import { cardByKey } from '../cards/registry'
import type { ImportedDoc } from '../import/htmlImport'
import { polish } from '../builder/polish'
import type { ThemeName } from '../design/tokens'
export type Orientation = 'portrait' | 'landscape'
export type SizePreset = 's' | 'm' | 'l'
// G3/G4 — 서버 planner 가 내는 이북 설계. applyPlan 이 카드로 변환한다.
export interface PlanPage { cardKey: string; fields?: Record<string, string> }
export interface BookPlan { title?: string; orientation?: Orientation; theme?: ThemeName; pages: PlanPage[] }
export interface FreeEl { id: number; type: string; x: number; y: number; w: number; h: number; text: string; color: string; fs: number; src?: string; bold?: boolean; tcolor?: string; rows?: number; cols?: number; cells?: string[][]; wa?: boolean; italic?: boolean; underline?: boolean; rot?: number; align?: 'left' | 'center' | 'right' }
export interface Conn { from: number; to: number; bend?: { x: number; y: number } }
export interface Stroke { points: [number, number][]; color: string; w: number }
export type BlockType = 'h1' | 'h2' | 'text' | 'bullet' | 'divider' | 'toggle' | 'callout'
export type CalloutTone = 'info' | 'key' | 'warn'
export interface Block { id: number; type: BlockType; text: string; bold?: boolean; align?: 'left' | 'center' | 'right'; collapsed?: boolean; children?: Block[]; tone?: CalloutTone; color?: string; fs?: number }
export interface Page { id: number; cardKey: string; fields: Record<string, string>; free: boolean; els: FreeEl[]; conns: Conn[]; strokes: Stroke[]; blocks?: Block[]; bg?: string; contd?: boolean; trans?: string }
export interface CanvasData { els: FreeEl[]; conns: Conn[]; strokes: Stroke[] }
export interface BuilderState {
  title: string; orientation: Orientation; font: string; size: SizePreset; theme: ThemeName
  pages: Page[]; selectedPageId: number | null
  addCard: (cardKey: string) => void
  updateField: (pageId: number, key: string, value: string) => void
  removePage: (pageId: number) => void
  movePage: (pageId: number, dir: number) => void
  duplicatePage: (pageId: number) => void
  selectPage: (pageId: number) => void
  setTitle: (t: string) => void
  setOrientation: (o: Orientation) => void
  setFont: (f: string) => void
  setSize: (s: SizePreset) => void
  setTheme: (t: ThemeName) => void
  toggleFree: (pageId: number) => void
  addEl: (pageId: number, el: FreeEl) => void
  updateEl: (pageId: number, elId: number, patch: Partial<FreeEl>) => void
  removeEl: (pageId: number, elId: number) => void
  addConn: (pageId: number, conn: Conn) => void
  addStroke: (pageId: number, stroke: Stroke) => void
  reorderEl: (pageId: number, elId: number, toFront: boolean) => void
  setCanvas: (pageId: number, data: CanvasData) => void
  updateConn: (pageId: number, index: number, bend: { x: number; y: number }) => void
  setBlocks: (pageId: number, blocks: Block[]) => void
  setPageBg: (pageId: number, bg: string) => void
  setPageTrans: (pageId: number, trans: string) => void
  importDoc: (doc: ImportedDoc) => void
  importDeckSlides: (urls: string[], title: string) => void
  importPages: (pages: Page[], title?: string) => void
  applyPlan: (plan: BookPlan) => void
  polishAll: () => void
  setCard: (pageId: number, cardKey: string, fields: Record<string, string>) => void
  summarizeNotes: () => Promise<{ ok: boolean; error?: string; count?: number }>
}
let blockUid = 1
export const newBlock = (type: BlockType = 'text', text = ''): Block => ({ id: blockUid++, type, text })
let uid = 1
function defaultsFor(cardKey: string): Record<string, string> {
  const c = cardByKey(cardKey); const f: Record<string, string> = {}
  if (c) c.fields.forEach((fd) => { f[fd.key] = fd.example ?? '' })
  return f
}
const mapPage = (pages: Page[], id: number, fn: (p: Page) => Page) => pages.map((p) => (p.id === id ? fn(p) : p))
export const useBuilder = create<BuilderState>((set, get) => ({
  title: '유니에버 AX 사업모델', orientation: 'portrait', font: 'auto', size: 'm', theme: 'light',
  pages: [], selectedPageId: null,
  addCard: (cardKey) => set((s) => {
    // 슬라이드 = 빈 캔버스 편집 페이지(구글 슬라이드식). 블록편집기 없이 요소로 직접 편집.
    if (cardKey === 'slide') {
      const sp: Page = { id: uid++, cardKey: 'slide', fields: {}, free: true, els: [], conns: [], strokes: [], blocks: [], bg: '' }
      return { pages: [...s.pages, sp], selectedPageId: sp.id }
    }
    const p: Page = { id: uid++, cardKey, fields: defaultsFor(cardKey), free: false, els: [], conns: [], strokes: [] }
    if (cardKey === 'note') {
      p.blocks = [
        { ...newBlock('h1', '새 페이지 제목'), bold: true },
        newBlock('text', '여기에 내용을 적어보세요. ‘/’로 블록을 추가하고, ‘>’로 접히는 토글을 만들 수 있어요.'),
      ]
      p.bg = ''
    }
    return { pages: [...s.pages, p], selectedPageId: p.id }
  }),
  updateField: (pageId, key, value) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, fields: { ...p.fields, [key]: value } })) })),
  removePage: (pageId) => set((s) => { const pages = s.pages.filter((p) => p.id !== pageId); const sel = s.selectedPageId === pageId ? (pages.length ? pages[0].id : null) : s.selectedPageId; return { pages, selectedPageId: sel } }),
  movePage: (pageId, dir) => set((s) => { const i = s.pages.findIndex((p) => p.id === pageId); const j = i + dir; if (i < 0 || j < 0 || j >= s.pages.length) return {} as Partial<BuilderState>; const pages = [...s.pages]; const tmp = pages[i]; pages[i] = pages[j]; pages[j] = tmp; return { pages } }),
  duplicatePage: (pageId) => set((s) => {
    const i = s.pages.findIndex((p) => p.id === pageId); if (i < 0) return {} as Partial<BuilderState>
    const src = s.pages[i]
    const copy: Page = JSON.parse(JSON.stringify(src)); copy.id = uid++
    const pages = [...s.pages]; pages.splice(i + 1, 0, copy)
    return { pages, selectedPageId: copy.id }
  }),
  selectPage: (pageId) => set({ selectedPageId: pageId }),
  setTitle: (t) => set({ title: t }),
  setOrientation: (o) => set({ orientation: o }),
  setFont: (fv) => set({ font: fv }),
  setSize: (sz) => set({ size: sz }),
  setTheme: (t) => set({ theme: t }),
  toggleFree: (pageId) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, free: !p.free })) })),
  addEl: (pageId, el) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, els: [...p.els, el] })) })),
  updateEl: (pageId, elId, patch) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, els: p.els.map((e) => (e.id === elId ? { ...e, ...patch } : e)) })) })),
  removeEl: (pageId, elId) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, els: p.els.filter((e) => e.id !== elId), conns: p.conns.filter((c) => c.from !== elId && c.to !== elId) })) })),
  addConn: (pageId, conn) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, conns: [...p.conns, conn] })) })),
  addStroke: (pageId, stroke) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, strokes: [...p.strokes, stroke] })) })),
  reorderEl: (pageId, elId, toFront) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => { const i = p.els.findIndex((e) => e.id === elId); if (i < 0) return p; const els = [...p.els]; const e = els.splice(i, 1)[0]; if (toFront) els.push(e); else els.unshift(e); return { ...p, els } }) })),
  setCanvas: (pageId, data) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, els: data.els, conns: data.conns, strokes: data.strokes })) })),
  updateConn: (pageId, index, bend) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, conns: p.conns.map((c, i) => (i === index ? { ...c, bend } : c)) })) })),
  setBlocks: (pageId, blocks) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, blocks })) })),
  setPageBg: (pageId, bg) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, bg })) })),
  setPageTrans: (pageId, trans) => set((s) => ({ pages: mapPage(s.pages, pageId, (p) => ({ ...p, trans })) })),
  importDoc: (doc) => set(() => {
    const mk = (cardKey: string, fields: Record<string, string>, extra: Partial<Page> = {}): Page =>
      ({ id: uid++, cardKey, fields, free: false, els: [], conns: [], strokes: [], ...extra })
    const pages: Page[] = [
      mk('cover', { title: doc.cover.title, sub: doc.cover.sub }),
      mk('toc', {}),
    ]
    for (const s of doc.sections) {
      const blocks: Block[] = [{ ...newBlock('h1', s.title), bold: true }]
      for (const b of s.blocks) { const nb = newBlock(b.type, b.text); if (b.tone) nb.tone = b.tone; blocks.push(nb) }
      pages.push(mk('note', { title: s.title }, { blocks, bg: '', contd: s.contd }))
    }
    return { pages, selectedPageId: pages[0] ? pages[0].id : null, title: doc.title || '가져온 이북' }
  }),
  // 변환한 덱 슬라이드(이미지 URL)를 각각 한 페이지로 캔버스에 채운다.
  importDeckSlides: (urls, title) => set(() => {
    const pages: Page[] = urls.map((u) => ({
      id: uid++, cardKey: 'deckslide', fields: { img: u },
      free: false, els: [], conns: [], strokes: [],
    }))
    return { pages, selectedPageId: pages[0] ? pages[0].id : null, title: title || '가져온 덱' }
  }),
  // 덱 IR을 편집 가능한 요소로 변환해 만든 페이지들을 로드(구글 슬라이드식 편집).
  importPages: (pgs, title) => set((s) => {
    const pages = pgs.map((p) => ({ ...p, id: uid++ }))
    return { pages, selectedPageId: pages[0] ? pages[0].id : null, title: title || s.title }
  }),
  // (G4) 서버 planner 의 BookPlan 을 실제 카드로 변환해 전체 교체(빈 이북에서 한 번에 초안 완성).
  // 미채운 필드는 예시 대신 빈칸 → 근거 없는 수치/문구 주입 방지. note 는 제목 블록으로.
  applyPlan: (plan) => set((s) => {
    const valid = (plan.pages || []).filter((sp) => sp && (sp.cardKey === 'note' || sp.cardKey === 'slide' || !!cardByKey(sp.cardKey)))
    const pages: Page[] = valid.map((sp) => {
      const cardKey = sp.cardKey
      const given = sp.fields || {}
      if (cardKey === 'note') {
        const title = (given.title || '새 페이지').toString()
        return { id: uid++, cardKey: 'note', fields: {}, free: false, els: [], conns: [], strokes: [], blocks: [{ ...newBlock('h1', title), bold: true }], bg: '' }
      }
      const empties: Record<string, string> = {}
      const c = cardByKey(cardKey)
      if (c) c.fields.forEach((fd) => { empties[fd.key] = '' })
      const fields = { ...empties, ...given }
      return { id: uid++, cardKey, fields, free: false, els: [], conns: [], strokes: [] }
    })
    return {
      pages,
      selectedPageId: pages.length ? pages[0].id : null,
      title: plan.title || s.title,
      orientation: plan.orientation || s.orientation,
      theme: plan.theme || s.theme,
    }
  }),
  polishAll: () => set((s) => ({
    pages: s.pages.map((p) => ({
      ...p,
      fields: Object.fromEntries(Object.entries(p.fields).map(([k, v]) => [k, polish(v)])),
      blocks: p.blocks ? p.blocks.map((b) => ({ ...b, text: polish(b.text) })) : p.blocks,
    })),
  })),
  setCard: (pageId, cardKey, fields) => set((s) => ({
    pages: mapPage(s.pages, pageId, (p) => ({ ...p, cardKey, fields: { ...p.fields, ...fields } })),
  })),
  // (B) 본문(note) 페이지들을 LLM으로 요약해 EVER-PEAK식 카드로 치환. 실패 섹션은 원문 유지(폴백).
  summarizeNotes: async () => {
    const st = get()
    const targets = st.pages.filter((p) => {
      const c = cardByKey(p.cardKey)
      return !(c && c.kind) && !!(p.blocks && p.blocks.length)
    })
    if (!targets.length) return { ok: false, error: '요약할 본문 페이지가 없어요(먼저 HTML을 가져오세요).' }
    const sections = targets.map((p) => ({
      title: p.fields.title || '',
      text: (p.blocks || []).map((b) => b.text).filter(Boolean).join('\n'),
    }))
    let data: { ok?: boolean; error?: string; results?: Array<{ headline?: string; bullets?: string[] }> }
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections }),
      })
      data = await res.json()
    } catch {
      return { ok: false, error: '서버(/api/summarize) 연결 실패 — 서버가 떠 있는지 확인하세요.' }
    }
    if (!data || !data.ok || !data.results) return { ok: false, error: data?.error || '요약 실패' }
    const results = data.results
    let applied = 0
    set((s) => ({
      pages: s.pages.map((p) => {
        const idx = targets.findIndex((t) => t.id === p.id)
        if (idx < 0) return p
        const r = results[idx]
        if (!r || !r.bullets || !r.bullets.length) return p   // 실패 섹션 → 원문(A) 유지
        applied++
        const headline = r.headline || p.fields.title || '요약'
        const blocks: Block[] = [{ ...newBlock('h1', headline), bold: true }]
        r.bullets.forEach((b) => blocks.push(newBlock('bullet', b)))
        return { ...p, blocks, fields: { ...p.fields, title: headline } }
      }),
    }))
    return applied ? { ok: true, count: applied } : { ok: false, error: 'LLM 응답을 받지 못했어요(연결·모델 설정 확인).' }
  },
}))
