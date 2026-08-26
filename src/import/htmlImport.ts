// 3차 HTML Import — 규칙 파서 (P0 골격 + P1 표지·목차 제목 정규화 + P3 콜아웃).
// 이사님 HTML 문자열을 표지 / 목차 / 페이지(섹션) 구조로 분해한다.
// 브라우저 DOMParser만 사용(앱 의존성 없음). 원본 서식은 버리고 내용만 가져온다.
// 분할 규칙: 제목(H1/H2)마다 새 페이지. 첫 H1은 표지.

export type ImportBlockType = 'h1' | 'h2' | 'text' | 'bullet' | 'divider' | 'toggle' | 'callout'
export type CalloutTone = 'info' | 'key' | 'warn'
export interface ImportedBlock { type: ImportBlockType; text: string; tone?: CalloutTone }
export interface ImportedSection { title: string; blocks: ImportedBlock[] }
export interface ImportedDoc {
  title: string
  cover: { title: string; sub: string }
  sections: ImportedSection[]
}

const clean = (s: string | null | undefined): string => (s || '').replace(/\s+/g, ' ').trim()

// 강조박스(콜아웃) 감지 — 이사님 HTML의 색깔 박스를 색조(클래스명)로 정보/핵심/주의로 매핑.
const CALLOUT_SEL = '.note,.warn,.warning,.caution,.danger,.alert,.ok,.ok-box,.success,.tip,.key,.info,.q,.callout,.hint,blockquote'
function calloutTone(el: Element): CalloutTone {
  const cls = ((el.getAttribute('class') || '') + ' ' + el.tagName).toLowerCase()
  if (/\b(ok|success|tip|key|good|done)\b/.test(cls)) return 'key'   // 초록: 핵심
  if (/\b(warn|warning|caution|danger|alert|note)\b/.test(cls)) return 'warn' // 노랑/주황/빨강: 주의
  return 'info' // 파랑: 정보 (q·info·callout·blockquote 등)
}

// 제목에서 장식 요소(번호 뱃지·태그 칩 등)를 떼고 깔끔한 텍스트만 뽑는다.
function headingText(el: Element): string {
  const clone = el.cloneNode(true) as Element
  clone.querySelectorAll('.n, .no, .num, .step, .tag, .badge, .chip, .pill, sup').forEach((x) => x.remove())
  let t = clean(clone.textContent)
  t = t.replace(/^(\d{1,2})[.)\]]\s+/, '') // 선행 목록번호 "1. " "2) " 제거(연도 등 4자리는 보존)
  return t
}

// 표지 부제: .lede/.lead/.subtitle 우선, 없으면 첫 문단. 길면 단어 경계에서 자르고 말줄임.
function coverSubtitle(doc: Document): string {
  let sub = clean(doc.querySelector('.lede, .lead, .subtitle, .sub')?.textContent)
  if (!sub) sub = clean(doc.querySelector('p')?.textContent)
  if (sub.length > 140) {
    const cut = sub.slice(0, 140)
    const sp = cut.lastIndexOf(' ')
    sub = (sp > 80 ? cut.slice(0, sp) : cut).trim() + '…'
  }
  return sub
}

export function parseHtml(html: string): ImportedDoc {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const docTitle = clean(doc.querySelector('title')?.textContent)
  const firstH1 = doc.querySelector('h1')
  const coverTitle = (firstH1 ? headingText(firstH1) : '') || docTitle || '가져온 문서'
  const coverSub = coverSubtitle(doc)

  const sections: ImportedSection[] = []
  let cur: ImportedSection | null = null
  let sawFirstH1 = false

  const els = doc.body ? Array.from(doc.body.querySelectorAll('h1, h2, h3, p, ul, ol, hr, ' + CALLOUT_SEL)) : []
  for (const el of els) {
    const tag = el.tagName.toLowerCase()

    if (tag === 'h1') {
      if (!sawFirstH1) { sawFirstH1 = true; continue } // 첫 H1 = 표지
      cur = { title: headingText(el) || '페이지', blocks: [] }
      sections.push(cur)
      continue
    }
    if (tag === 'h2') {
      cur = { title: headingText(el) || '페이지', blocks: [] }
      sections.push(cur)
      continue
    }

    const c = cur
    if (!c) continue // 첫 섹션 이전 내용(표지 리드문 등)은 건너뜀
    if (el.closest('li')) continue // 목록 내부 요소는 목록에서 처리

    if (el.matches(CALLOUT_SEL)) { // 강조박스 = 콜아웃 한 블록(내부는 아래에서 skip)
      const t = clean(el.textContent)
      if (t) c.blocks.push({ type: 'callout', text: t, tone: calloutTone(el) })
      continue
    }
    if (el.closest(CALLOUT_SEL)) continue // 콜아웃 내부 요소는 위에서 통째로 처리됨

    if (tag === 'h3') { const t = headingText(el); if (t) c.blocks.push({ type: 'h2', text: t }) }
    else if (tag === 'p') { const t = clean(el.textContent); if (t) c.blocks.push({ type: 'text', text: t }) }
    else if (tag === 'hr') { c.blocks.push({ type: 'divider', text: '' }) }
    else if (tag === 'ul' || tag === 'ol') {
      Array.from(el.querySelectorAll(':scope > li')).forEach((li) => {
        const t = clean(li.textContent)
        if (t) c.blocks.push({ type: 'bullet', text: t })
      })
    }
  }

  return { title: docTitle || coverTitle, cover: { title: coverTitle, sub: coverSub }, sections }
}
