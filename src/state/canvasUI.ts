import { create } from 'zustand'
export type Tool = 'select' | 'box' | 'round' | 'ellipse' | 'diamond' | 'triangle' | 'text' | 'sticky' | 'image' | 'icon' | 'connect' | 'pen' | 'table' | 'wordart'
export interface CanvasUI {
  tool: Tool; selEl: number | null; connSrc: number | null; lastColor: string
  setTool: (t: Tool) => void
  setSel: (id: number | null) => void
  setConnSrc: (id: number | null) => void
  setColor: (c: string) => void
}
export const useCanvasUI = create<CanvasUI>((set) => ({
  tool: 'select', selEl: null, connSrc: null, lastColor: '#2f6df6',
  setTool: (t) => set({ tool: t, connSrc: null }),
  setSel: (id) => set({ selEl: id }),
  setConnSrc: (id) => set({ connSrc: id }),
  setColor: (c) => set({ lastColor: c }),
}))
