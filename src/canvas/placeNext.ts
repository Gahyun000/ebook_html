// **고른 상자 기준으로 놓는다 — 다른 상자는 안 움직인다**(2026-10-07 · 사용자 2차 요청 5·6번).
//
// 사용자: 「엔터를 누르는 경우 여전히 우측의 아래에 생성됨 … 아래에 생성되도록 — 부모의 아래를 의미(부모의 우측의 아래 아님)」 ·
// 「도형을 어느 위치로 이동 후 다시 스페이스나 엔터를 누르면 재정렬됨. 그런 현상은 없도록」.
// 전에는(f067e4b) 붙일 때마다 트리를 다시 앉혔다(seatTree) — 뿌리는 고정이어도 형제들이 매번 움직였고, 손으로 옮긴 상자가 격자로 돌아갔다.
// 이제 **새 상자만** 고른 상자의 오른쪽(Space) · 아래(Enter) · 위(Shift+Enter) · 왼쪽(＋점)에 놓는다.
// 그 자리에 이미 상자가 있으면 옆으로 붙인 것은 **아래로**, 아래 · 위로 붙인 것은 **오른쪽으로** 민다 — 있던 상자는 그대로다.
// 순수 함수라 노드에서 바로 검사한다(place_next.test.mjs · tree_keys.test.mjs).

export type Side = 'right' | 'down' | 'up' | 'left'

/** 옆으로 붙일 때 사이(트리 열 간격 192 − 상자 132 — 선이 지나갈 틈). */
export const GAP_SIDE = 60
/** 같은 열에 쌓일 때 사이(줄 간격 56 − 상자 38). */
export const GAP_STACK = 18
/** 아래 · 위로 붙일 때 사이(선이 꺾일 틈). */
export const GAP_DOWN = 40

export interface Box { x: number; y: number; w: number; h: number }

export function nextSpot(hub: Box, side: Side, others: readonly Box[], size: { w: number; h: number }): { x: number; y: number } {
  const { w, h } = size
  let x: number, y: number
  if (side === 'right') { x = hub.x + hub.w + GAP_SIDE; y = hub.y + (hub.h - h) / 2 }
  else if (side === 'left') { x = hub.x - GAP_SIDE - w; y = hub.y + (hub.h - h) / 2 }
  else if (side === 'down') { x = hub.x + (hub.w - w) / 2; y = hub.y + hub.h + GAP_DOWN }
  else { x = hub.x + (hub.w - w) / 2; y = hub.y - GAP_DOWN - h }
  // 겹치면 민다 — 옆으로 붙인 것은 아래로(같은 열에 쌓임), 아래 · 위로 붙인 것은 오른쪽으로(한 줄로 늘어섬). 허브 자신은 안 센다.
  const PAD = 8
  const hit = () => others.find((o) => o !== hub && x < o.x + o.w + PAD && o.x < x + w + PAD && y < o.y + o.h + PAD && o.y < y + h + PAD)
  for (let guard = 0, o = hit(); o && guard < 200; guard++, o = hit()) {
    if (side === 'right' || side === 'left') y = o.y + o.h + GAP_STACK
    else x = o.x + o.w + GAP_STACK + 6
  }
  // 종이 왼쪽 · 위로는 안 나간다(오른쪽 · 아래는 슬라이드가 늘어난다 — workArea.growOf).
  return { x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)) }
}

/** 같은 열에 쌓인 자식이 이만큼까지는 **허브 가운데**에 맞춰 선다(2026-10-07 3차 · 사용자: 「자식 7개 정도까지는」). 그 뒤로는 아래로 이어 쌓인다. */
export const CENTER_MAX = 7

/**
 * 세로로 쌓인 상자들을 `cy` 를 가운데로 다시 놓을 때의 y 들(순서 그대로 · 사이 GAP_STACK).
 * 사용자: 「지금은 뭔가 축 쳐져서 밑으로 내려가는 느낌이 강함 — 작업 전의 부모 중간에 위치하는 느낌」. 위로 넘치면 전체를 내려 0 에서 시작한다.
 */
export function centeredYs(cy: number, heights: readonly number[]): number[] {
  const total = heights.reduce((s, h) => s + h, 0) + GAP_STACK * Math.max(0, heights.length - 1)
  let y = cy - total / 2
  const out = heights.map((h) => { const v = Math.round(y); y += h + GAP_STACK; return v })
  const shift = out.length && out[0] < 0 ? -out[0] : 0
  return out.map((v) => v + shift)
}

/**
 * 고른 것 없이 「＋ 새 상자」 — 종이 한가운데에서 시작해 **사각형이 안 겹치는** 자리까지 24px 씩 비껴 간다.
 * `dropSpot.centerSpot` 은 중심 거리만 봐서(16px) 크기가 다른 상자와는 겹칠 수 있었다.
 */
export function freeSpot(others: readonly Box[], size: { w: number; h: number }, W: number, H: number): { x: number; y: number } {
  const { w, h } = size
  const x0 = Math.max(0, Math.round(W / 2 - w / 2)), y0 = Math.max(0, Math.round(H / 2 - h / 2))
  const PAD = 8
  for (let i = 0; i < 80; i++) {
    const x = x0 + i * 24, y = y0 + i * 24
    if (!others.some((o) => x < o.x + o.w + PAD && o.x < x + w + PAD && y < o.y + o.h + PAD && o.y < y + h + PAD)) return { x, y }
  }
  return { x: x0, y: y0 }
}
