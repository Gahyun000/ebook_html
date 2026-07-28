import { create } from 'zustand'

export type Orientation = 'portrait' | 'landscape'
export type SizePreset = 's' | 'm' | 'l'

export interface FreeEl { id: number; type: string; x: number; y: number; w: number; h: number; text: string; color: string; fs: number }
export interface Conn { from: number; to: number }
export interface Stroke { points: [number, number][]; color: string; w: number }

export interface Page {
  id: number
  cardKey: string
  fields: Record<string, string>
  free: boolean
  els: FreeEl[]
  conns: Conn[]
  strokes: Stroke[]
}

export interface BuilderState {
  title: string
  orientation: Orientation
  font: string
  size: SizePreset
  pages: Page[]
  selectedPageId: number | null
  addPage: (cardKey: string, fields: Record<string, string>) => void
  selectPage: (id: number) => void
  setOrientation: (o: Orientation) => void
  setTitle: (t: string) => void
}

let uid = 1

export const useBuilder = create<BuilderState>((set) => ({
  title: '유니에버 AX 사업모델',
  orientation: 'portrait',
  font: 'auto',
  size: 'm',
  pages: [],
  selectedPageId: null,
  addPage: (cardKey, fields) =>
    set((s) => {
      const p: Page = { id: uid++, cardKey, fields, free: false, els: [], conns: [], strokes: [] }
      return { pages: [...s.pages, p], selectedPageId: p.id }
    }),
  selectPage: (id) => set({ selectedPageId: id }),
  setOrientation: (o) => set({ orientation: o }),
  setTitle: (t) => set({ title: t }),
}))
