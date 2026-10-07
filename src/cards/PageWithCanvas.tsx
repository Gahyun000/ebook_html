import type { PointerEvent as RPointerEvent } from 'react'
import type { Page, Orientation, SizePreset } from '../state/store'
import type { TocItem } from '../builder/util'
import PageView from './PageView'
import FreeLayer from '../canvas/FreeLayer'
import { pageSize } from './sizing'
import { useCanvasUI } from '../state/canvasUI'
import { growOf } from '../builder/workArea'

export interface PageWithCanvasProps {
  page: Page; docTitle: string; orientation: Orientation; size: SizePreset; font: string
  tocItems?: TocItem[]; domId?: string; interactive: boolean
  /** 편집 화면에서만: 슬라이드가 얼마나 늘어났나(Preview 가 정한다 — 누르고 있는 동안에는 줄이지 않으려고). */
  grow?: number
}
/**
 * 쪽 한 장 = 카드 바탕(PageView) + 자유 요소 층(FreeLayer).
 *
 * **넘치면 슬라이드가 늘어난다**(2026-10-06 · workArea.growOf). 도형이 기준 크기 W×H 의 오른쪽 · 아래로 넘친 쪽은
 * 슬라이드가 같은 비율로 kW×kH 가 된다. 좌표는 그대로 두고 **그릴 때만** 맞춘다 —
 *   · 편집: 카드 바탕을 k 배로 깔고 도형 층을 kW×kH 로 편다(도형의 화면 크기는 안 변한다).
 *   · 그 밖(쪽 목록 · 내보내기 · 발표): 카드 바탕은 제 크기, 도형 층을 1/k 로 줄여 W×H 한 장에 담는다.
 * 둘은 같은 그림이다(편집 그림 × 1/k). 쪽 크기는 늘 W×H — 이북의 쪽 크기 계약은 그대로다.
 */
export default function PageWithCanvas({ page, docTitle, orientation, size, font, tocItems, domId, interactive, grow }: PageWithCanvasProps) {
  const { W, H, SC } = pageSize(orientation)
  const setSel = useCanvasUI((s) => s.setSel)
  // 빈 곳 클릭 시 선택 해제. 자식이 stopPropagation 하는 것에만 의존하면
  // 한 군데라도 빠뜨렸을 때 방금 만든 선택이 곧바로 날아간다 → 대상까지 직접 확인한다.
  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement | null
    if (t && t.closest('.fel, .cardedit, .conn-hint')) return
    setSel(null)
    // **카드 쪽에서도 빈 곳에서 끌면 고르기**(2026-10-07 · 사용자: 「도형이나 선을 선택하지 않은 이상 어디서든 드래그」).
    // 카드 쪽은 도형 층이 passthru(pointer-events:none)라 층이 pointerdown 을 못 받는다 — 여기서 받아 층에 넘긴다(ebook:marquee → FreeLayer.beginMarquee).
    // 자유 쪽은 층이 직접 받으므로(target 이 .freelayer 안) 건너뛴다. 단추 · 입력칸 · 글칸은 제 일이 있다(카드 글자 칸은 위에서 이미 걸렀다).
    if (e.button !== 0 || !t || t.closest('.freelayer') || t.closest('button, a, input, textarea, select, [contenteditable="true"]')) return
    if (useCanvasUI.getState().tool !== 'select') return
    e.preventDefault()
    window.dispatchEvent(new CustomEvent('ebook:marquee', { detail: { x: e.clientX, y: e.clientY } }))
  }
  // 편집 아님: 접힌 가지도 펴서 내보내므로(FreeLayer) 숨은 상자까지 센다.
  const k = interactive ? Math.max(1, grow || 1) : growOf(page.els, page.strokes, W, H, true)
  if (k === 1 && !interactive) {
    return (
      <div id={domId} style={{ position: 'relative', width: W, height: H }}>
        <PageView page={page} docTitle={docTitle} orientation={orientation} size={size} font={font} tocItems={tocItems} editable={interactive} />
        <FreeLayer page={page} W={W} H={H} SC={SC} interactive={interactive} />
      </div>
    )
  }
  if (!interactive) {
    return (
      <div id={domId} style={{ position: 'relative', width: W, height: H }}>
        <PageView page={page} docTitle={docTitle} orientation={orientation} size={size} font={font} tocItems={tocItems} editable={interactive} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: W * k, height: H * k, transform: `scale(${1 / k})`, transformOrigin: 'top left' }}>
          <FreeLayer page={page} W={W * k} H={H * k} SC={SC} interactive={interactive} />
        </div>
      </div>
    )
  }
  return (
    <div id={domId} style={{ position: 'relative', width: W * k, height: H * k }} onPointerDown={onDown}>
      {/* 바탕은 감싸개에서 자른다 — 카드의 그림자 · 둥근 모서리가 슬라이드 「테두리」 로 보이지 않게. */}
      <div className="pwc-bg" style={{ position: 'absolute', left: 0, top: 0, width: W * k, height: H * k, overflow: 'hidden' }}>
        <div style={{ width: W, height: H, transform: `scale(${k})`, transformOrigin: 'top left' }}>
          <PageView page={page} docTitle={docTitle} orientation={orientation} size={size} font={font} tocItems={tocItems} editable={interactive} />
        </div>
      </div>
      <FreeLayer page={page} W={W * k} H={H * k} SC={SC} interactive={interactive} />
    </div>
  )
}
