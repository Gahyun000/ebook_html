// 연결선의 **길**(2026-10-07 · FreeLayer 에서 떼어 냄). 순수 함수라 노드에서 바로 검사한다(conn_axis.test.mjs).
import type { FreeEl } from '../state/store'

export interface Pt { x: number; y: number }

/** 상자 가장자리에서 (tx, ty) 쪽으로 나가는 점. */
export function edgePoint(box: FreeEl, tx: number, ty: number): Pt {
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2
  const dx = tx - cx, dy = ty - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const scale = 1 / Math.max(Math.abs(dx) / (box.w / 2), Math.abs(dy) / (box.h / 2))
  return { x: cx + dx * scale, y: cy + dy * scale }
}

/**
 * 두 상자를 잇는 SVG 길. `kind` 를 안 적은 옛 선은 꺾은선(ortho)이다.
 *
 * `axis` — **트리의 부모→자식 선은 늘 같은 변에서 나간다**(EverSketch 불편점 5번). 꺾은선은 |dx| ≥ |dy| 로
 * 가로·세로를 골랐는데, 자식이 여럿 쌓이면 먼 자식은 |dy| 가 커져 부모의 위·아래 변에서 나갔다
 * (「5~6개 이상 될 때부터 화살표가 위에서 출발」). 'h' 는 오른쪽 변, 'v' 는 아래 변으로 고정한다 —
 * 다만 **성장 방향에 있을 때만**(자식이 부모의 오른쪽/아래). 자식을 반대편으로 끌어 둔 경우까지 고정하면
 * 선이 부모를 돌아 나온다. 손으로 꺾은 자리(bend) · 직선 · 곡선은 축을 모른다.
 */
export function connPath(a: FreeEl, b: FreeEl, conn?: { kind?: 'straight' | 'ortho' | 'curve'; bend?: Pt }, axis?: 'h' | 'v'): string {
  const kind = conn?.kind || 'ortho'
  const bend = conn?.bend
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 }, bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 }
  if (kind === 'straight') {
    const s = edgePoint(a, bc.x, bc.y), t = edgePoint(b, ac.x, ac.y)
    return 'M ' + s.x + ' ' + s.y + ' L ' + t.x + ' ' + t.y
  }
  if (kind === 'curve') {
    const s = edgePoint(a, bc.x, bc.y), t = edgePoint(b, ac.x, ac.y)
    let cx: number, cy: number
    if (bend) { cx = bend.x; cy = bend.y }
    else {
      const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2, dx = t.x - s.x, dy = t.y - s.y, len = Math.hypot(dx, dy) || 1
      const off = Math.min(70, len * 0.28)
      cx = mx - dy / len * off; cy = my + dx / len * off
    }
    return 'M ' + s.x + ' ' + s.y + ' Q ' + cx + ' ' + cy + ' ' + t.x + ' ' + t.y
  }
  // ortho (직각) — bend가 있으면 그 지점을 지나는 꺾은선
  if (bend) {
    const s = edgePoint(a, bend.x, bend.y), t = edgePoint(b, bend.x, bend.y)
    return 'M ' + s.x + ' ' + s.y + ' L ' + bend.x + ' ' + bend.y + ' L ' + t.x + ' ' + t.y
  }
  const dx = bc.x - ac.x, dy = bc.y - ac.y
  const horiz = axis === 'h' && b.x >= a.x + a.w ? true
    : axis === 'v' && b.y >= a.y + a.h ? false
    : Math.abs(dx) >= Math.abs(dy)
  if (horiz) {
    const s = { x: dx > 0 ? a.x + a.w : a.x, y: ac.y }, t = { x: dx > 0 ? b.x : b.x + b.w, y: bc.y }
    const mx = (s.x + t.x) / 2
    return 'M ' + s.x + ' ' + s.y + ' L ' + mx + ' ' + s.y + ' L ' + mx + ' ' + t.y + ' L ' + t.x + ' ' + t.y
  }
  const s = { x: ac.x, y: dy > 0 ? a.y + a.h : a.y }, t = { x: bc.x, y: dy > 0 ? b.y : b.y + b.h }
  const my = (s.y + t.y) / 2
  return 'M ' + s.x + ' ' + s.y + ' L ' + s.x + ' ' + my + ' L ' + t.x + ' ' + my + ' L ' + t.x + ' ' + t.y
}
