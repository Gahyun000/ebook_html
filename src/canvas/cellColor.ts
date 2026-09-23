// 표 칸 색 규칙 — 화면과 내보내기(PPT)가 **같은 함수**를 쓴다.
// EVER-SKETCH1 template/slots.ts 의 cellTextColor·cellBackground 만 옮겼다
// (ebook_html 에는 양식 슬롯이 없으므로 슬롯 관련 부분은 없다).

/** 표 본문 기본 글자색(index.css 와 같은 값). */
const INK = '#1c2433'

/** WCAG 상대 휘도. 단순 평균이 아니라 감마 보정을 거쳐야 실제 대비와 맞는다. */
function relLuminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)))
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [relLuminance(a), relLuminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** 배경색 위에 올릴 글자색. 흰색과 본문색 중 대비가 큰 쪽을 실제로 계산해 고른다.
 *  본문색이 더 잘 읽히면 undefined(기본값 그대로). */
export function cellTextColor(bg: string | undefined): string | undefined {
  if (!bg || bg.length !== 7 || bg[0] !== '#') return undefined
  const onWhite = contrast(bg, '#ffffff')
  const onInk = contrast(bg, INK)
  return onWhite > onInk ? '#ffffff' : undefined
}

/** 셀 배경 — 칠한 색을 그대로 쓴다. */
export function cellBackground(bg: string | undefined): string | undefined {
  return bg || undefined
}

/**
 * **표 칸 채우기에 쓰는 자유 색 여덟**(EVER-SKETCH1 b1911d3 `CBG_FREE`).
 *
 * 원본에서는 칸 색 목록을 표준 양식 슬롯에서만 내주다 보니, 양식 없는 표에서는 칸 색을
 * 바꿀 **길이 아예 없었다** — 자료에도 `cbg` 가 있고 화면도 그리는데. 그래서 슬롯과 상관없는
 * 자유 색을 두었다. 이 저장소에는 슬롯이 없으므로 **이것이 곧 전부**다.
 *
 * 글자는 늘 진한 잉크색이므로 **옅은 색만** 둔다(대비를 지키려고). 짙은 색은 고르개의
 * 일반 팔레트로 고르고, 그때는 `cellTextColor` 가 글자를 흰색으로 돌린다.
 */
export const CBG_FREE: string[] = [
  '#FFFFFF', '#F1F3F6', '#EAF0FF', '#E9F5EF', '#FFF4E3', '#FDF0F0', '#EEF2FA', '#F6F0FF',
]

/**
 * 표에서 쓸 수 있는 칸 색 목록 — **한 군데서 정한다.** 도구줄과 오른쪽 패널이 같은 함수를 부른다.
 * (원본은 `cellColors(slot)` 로 양식 색을 앞에 세운다. 이 저장소는 슬롯이 없어 자유 색만 낸다.)
 */
export function cellColors(): string[] {
  return CBG_FREE
}
