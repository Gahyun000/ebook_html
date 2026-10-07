// 작업면(가운데 창)의 **숫자 규칙**. 화면에 붙이는 일은 Preview 가 한다(work_area.test.mjs).
//
// **창 전체가 슬라이드다**(2026-10-06). 도형이 기준 크기를 넘으면 슬라이드가 같은 비율로 늘어나고(`growOf`),
// 넘친 만큼 **이 창 안에서** 굴려 본다(전에는 회색 작업창이 통째로 구르며 종이가 밀렸다).
//
// **막대가 설지 말지는 화면에서 되재지 않고 도형 좌표에서 정한다.** `overflow:auto` 에 맡기면
// 가로 막대가 높이를 먹고 → 세로가 넘치고 → 세로 막대가 따라 선다. 여기서는 막대 두께(sb)만큼의
// 자리를 **늘** 빼고 계산하므로, 종이 밖 도형이 생기거나 사라져도 배율 · 종이 자리가 바뀌지 않는다.
// 그래야 끄는 중에 좌표가 안 틀어진다 — FreeLayer 는 누를 때 잰 자리와 배율을 끝까지 쓴다.

/** 종이 둘레 여백(화면 px). 맞춤 배율도 이만큼을 양쪽에서 뺀다. */
export const PAD = 8
/** 새 상자로 굴릴 때 상자 둘레에 두는 여백(화면 px). */
export const EDGE = 24

interface Rect { x: number; y: number; w: number; h: number; hidden?: boolean }
interface Line { points: [number, number][]; w: number }

/** 늘어난 슬라이드에서 맨 끝 도형 뒤에 두는 여백(논리 px). */
export const GROW_PAD = 16

/**
 * **슬라이드가 얼마나 늘어났나**(k ≥ 1). 도형 · 펜 선이 기준 크기 W×H 의 오른쪽 · 아래로 넘치면
 * 슬라이드는 **같은 비율로** kW×kH 까지 커진다 — 그린 것 전부가 슬라이드다.
 * 이북 · 쪽 목록 · 발표는 그것을 1/k 로 줄여 한 장에 담는다(cards/PageWithCanvas).
 *
 * 저장하지 않는다. 좌표에서 그때그때 계산하므로 도형을 안으로 들이면 저절로 1 로 돌아온다.
 * 왼쪽 · 위쪽으로 나간 것은 키우지 않는다(스크롤은 음수로 못 간다) — `strayCount` 가 세어 알린다.
 *
 * `all`: 접혀서 안 보이는 상자도 센다. 내보내기 · 쪽 목록 · 발표는 접힌 가지를 펴서 그리기 때문이다.
 */
export function growOf(els: Rect[] | undefined, strokes: Line[] | undefined, W: number, H: number, all = false): number {
  let right = W, bottom = H
  for (const e of els || []) {
    if (!e || (e.hidden && !all)) continue
    right = Math.max(right, e.x + e.w); bottom = Math.max(bottom, e.y + e.h)
  }
  for (const st of strokes || []) {
    if (!st || !st.points) continue
    const half = (st.w || 0) / 2
    for (const pt of st.points) { right = Math.max(right, pt[0] + half); bottom = Math.max(bottom, pt[1] + half) }
  }
  return Math.max(1, right > W ? (right + GROW_PAD) / W : 1, bottom > H ? (bottom + GROW_PAD) / H : 1)
}

/** 왼쪽 · 위쪽으로 나간 도형 수 — 이것만은 여전히 이북에서 잘린다. */
export function strayCount(els: Rect[] | undefined): number {
  let n = 0
  for (const e of els || []) if (e && !e.hidden && (e.x < 0 || e.y < 0)) n++
  return n
}

/** 맞춤 배율을 잴 자리 — 막대 자리와 양쪽 여백을 뺀 값. */
export function fitAvail(viewW: number, viewH: number, sb: number): { w: number; h: number } {
  return { w: viewW - sb - PAD * 2, h: viewH - sb - PAD * 2 }
}

export interface Layout {
  needX: boolean
  needY: boolean
  /** 굴릴 넓이(화면 px). 막대가 안 서는 축은 안쪽 크기와 같다. */
  extW: number
  extH: number
  /** 슬라이드의 왼쪽 위(화면 px). 창 크기와 배율에만 달려 있다 — 늘어나도 안 움직인다. */
  offX: number
  offY: number
}

/** `k` 는 `growOf` 의 값. 맞춤 배율과 종이 자리는 **기준 크기**로 정하고, 굴릴 넓이만 k 배가 된다. */
export function layout(viewW: number, viewH: number, sb: number, W: number, H: number, scale: number, k: number): Layout {
  const innerW = Math.max(0, viewW - sb), innerH = Math.max(0, viewH - sb)
  const offX = Math.max(PAD, (innerW - W * scale) / 2)
  const offY = Math.max(PAD, (innerH - H * scale) / 2)
  const endX = offX + W * k * scale + PAD
  const endY = offY + H * k * scale + PAD
  const needX = endX > innerW + 0.5
  const needY = endY > innerH + 0.5
  return { needX, needY, extW: needX ? endX : innerW, extH: needY ? endY : innerH, offX, offY }
}

/** 상자(+여백)가 창 안에 들어오는 **가장 가까운** 스크롤 자리. 이미 보이면 그대로. */
export function revealScroll(
  view: { w: number; h: number }, at: { x: number; y: number },
  box: { x: number; y: number; w: number; h: number }, margin: number,
): { x: number; y: number } {
  const one = (cur: number, size: number, lo: number, hi: number) => {
    if (hi - lo > size) return Math.max(0, lo)        // 창보다 크면 앞머리를 보여 준다
    if (lo < cur) return Math.max(0, lo)
    if (hi > cur + size) return Math.max(0, hi - size)
    return cur
  }
  return {
    x: one(at.x, view.w, box.x - margin, box.x + box.w + margin),
    y: one(at.y, view.h, box.y - margin, box.y + box.h + margin),
  }
}
