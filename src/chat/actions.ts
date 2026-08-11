// 챗 액션 브리지 — ui_action(type/payload)을 실제 스토어/캔버스 조작으로 연결.
// 의도 엔진(server/intent)이 내는 이북 액션을 프론트 동작에 매핑한다.
import { useBuilder } from '../state/store'
import { useCanvasUI } from '../state/canvasUI'
import type { Orientation, BookPlan } from '../state/store'
import type { Tool } from '../state/canvasUI'

export interface UiAction { type: string; payload?: Record<string, unknown>; auto_apply?: boolean; requires_confirm?: boolean }

const emit = (n: string) => window.dispatchEvent(new CustomEvent(n))

export function applyUiAction(a: UiAction) {
  const B = useBuilder.getState()
  const C = useCanvasUI.getState()
  const p = a.payload || {}
  switch (a.type) {
    // 슬라이드
    case 'add_slide':
      B.addCard('slide')
      break
    case 'duplicate_slide':
      if (B.selectedPageId != null) B.duplicatePage(B.selectedPageId)
      break
    case 'delete_slide':
      if (B.selectedPageId != null) B.removePage(B.selectedPageId)
      break
    // 요소 삽입 → 캔버스 도구 켜기
    case 'insert_element': {
      const tool = String(p.tool || 'box') as Tool
      C.setTool(tool)
      break
    }
    // 배경/테마
    case 'set_theme':
      if (B.selectedPageId != null) B.setPageBg(B.selectedPageId, p.theme === 'dark' ? '#0e1c30' : '')
      break
    case 'set_orientation':
      B.setOrientation((p.orientation === 'landscape' ? 'landscape' : 'portrait') as Orientation)
      break
    // 정렬(z-order)
    case 'z_order':
      emit(p.dir === 'back' ? 'ebook:z-back' : 'ebook:z-front')
      break
    // (G4) 생성 에이전트 — 서버 planner 의 BookPlan 을 카드로 통째로 적용
    case 'apply_book_plan':
      if (p.plan) B.applyPlan(p.plan as BookPlan)
      break
    // 전역 동작
    case 'import_html':
      emit('ebook:import')
      break
    case 'make_ebook':
      emit('ebook:build')
      break
    case 'present':
      emit('ebook:present')
      break
    case 'undo':
      emit('ebook:undo')
      break
    case 'redo':
      emit('ebook:redo')
      break
    // 하위호환: 기존 카드 추가
    case 'add_card':
      if (p.cardKey) B.addCard(String(p.cardKey))
      break
    default:
      break
  }
}
