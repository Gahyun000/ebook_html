import { useBuilder } from '../state/store'
import { useCanvasUI } from '../state/canvasUI'
import type { FreeEl } from '../state/store'
import { pushSnap } from '../canvas/model'

// 현재 선택된 자유 캔버스 요소와, 그 요소에 서식을 적용하는 헬퍼.
export function useSelEl() {
  const pages = useBuilder((s) => s.pages)
  const selId = useBuilder((s) => s.selectedPageId)
  const updateEl = useBuilder((s) => s.updateEl)
  const selEl = useCanvasUI((s) => s.selEl)
  const page = pages.find((p) => p.id === selId)
  const el: FreeEl | undefined = page ? page.els.find((e) => e.id === selEl) : undefined
  function patch(p: Partial<FreeEl>) {
    if (!page || !el) return
    pushSnap(page.id, JSON.stringify({ els: page.els, conns: page.conns, strokes: page.strokes }))
    updateEl(page.id, el.id, p)
  }
  return { page, el, patch }
}
