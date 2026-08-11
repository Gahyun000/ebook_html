// G1 문서 컨텍스트 계약 — 현재 이북을 서버로 보낼 스냅샷으로 요약한다.
// 서버(chat_engine)는 이 스냅샷을 세션에 보관하고, G3 생성·G5 수정 레인이 소비한다.
// (chat/actions.ts 와 동일하게 React 밖에서 store 를 읽는 기존 패턴을 따른다.)
import { useBuilder } from '../state/store'
import type { BuilderState, Page } from '../state/store'
import { cardByKey } from '../cards/registry'

export interface BookStatePage {
  id: number
  cardKey: string
  title: string
  summary: string
}
export interface BookState {
  title: string
  orientation: string
  theme: string
  selectedPageId: number | null
  pages: BookStatePage[]
}

const clip = (s: string, n = 120): string => {
  const t = (s || '').trim()
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

// 페이지 제목: 채운 title 필드 > 카드 기본 제목 > ''
function pageTitle(p: Page): string {
  const c = cardByKey(p.cardKey)
  return (p.fields?.title || (c ? c.title : '') || '').toString()
}

// 페이지 한 줄 요약: 블록 본문 > title 제외 필드값 > 캔버스 요소 텍스트
function pageSummary(p: Page): string {
  if (p.blocks && p.blocks.length) {
    const t = p.blocks.map((b) => b.text).filter(Boolean).join(' · ')
    if (t) return clip(t)
  }
  const vals = Object.entries(p.fields || {})
    .filter(([k, v]) => k !== 'title' && String(v).trim())
    .map(([, v]) => String(v).trim())
  if (vals.length) return clip(vals.join(' · '))
  if (p.els && p.els.length) {
    const t = p.els.map((e) => e.text).filter(Boolean).join(' · ')
    return t ? clip(t) : `요소 ${p.els.length}개`
  }
  return ''
}

// 순수 변환 — 스토어 상태에서 스냅샷을 만든다(테스트 용이).
export function buildSnapshot(
  s: Pick<BuilderState, 'title' | 'orientation' | 'theme' | 'selectedPageId' | 'pages'>,
): BookState {
  return {
    title: s.title,
    orientation: s.orientation,
    theme: s.theme,
    selectedPageId: s.selectedPageId,
    pages: s.pages.map((p) => ({
      id: p.id,
      cardKey: p.cardKey,
      title: pageTitle(p),
      summary: pageSummary(p),
    })),
  }
}

// 전송 시점 스냅샷(React 밖에서 호출).
export function getBookState(): BookState {
  return buildSnapshot(useBuilder.getState())
}
