// 화면 배율의 **숫자 규칙**(EVER-SKETCH1 1363964 배율 부분).
//
// 원본은 이 계산을 Preview 안에 두었다. 여기서는 노드에서 바로 검증할 수 있게 떼어 냈다
// (zoom.test.mjs). 화면에 붙이는 일(상태·키·휠)은 Preview 가 한다.
//
// **맞춤 배율에 100% 상한이 없다.** 예전 계산은
//     Math.min(1, avW / W, avH / H)
// 이라서 세로 이북(432×576)은 넓은 창에서도 작은 종이만 뜨고 나머지가 회색으로 남았다.
// 「세로 작업공간이 너무 좁다」의 정체가 이 한 줄이다. 확대는 CSS transform 이라
// 좌표계(FreeEl x/y)는 그대로이고, 마우스 좌표는 FreeLayer.zoomOf 가 나눠 되읽는다.

export const ZMIN = 0.25
export const ZMAX = 4
export const ZSTEP = 1.25

export function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return 1
  return Math.max(ZMIN, Math.min(ZMAX, z))
}

/** 작업창(패딩을 뺀 너비·높이)에 논리 크기 W×H 종이를 통째로 맞추는 배율. 잴 수 없으면 null. */
export function fitScale(avW: number, avH: number, W: number, H: number): number | null {
  if (!(avW > 0) || !(avH > 0) || !(W > 0) || !(H > 0)) return null
  return Math.min(avW / W, avH / H)
}

/** 한 걸음 키우거나 줄인다. */
export function stepZoom(cur: number, dir: 'in' | 'out'): number {
  return clampZoom(dir === 'in' ? cur * ZSTEP : cur / ZSTEP)
}

interface KeyLike {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  altKey?: boolean
  target: { tagName?: string; isContentEditable?: boolean } | null | EventTarget
}

/**
 * ⌘/Ctrl 와 = − 0. **글자를 치는 중에는 가로채지 않는다** — 표 칸에 '0' 을 쓰다가
 * 배율이 튀면 무슨 일이 난 건지 아무도 모른다.
 */
export function zoomKey(e: KeyLike): 'in' | 'out' | 'fit' | null {
  if (!(e.metaKey || e.ctrlKey)) return null
  // Alt 가 붙으면 배율 키가 아니다 — Alt 조합은 가지 접기 · 펴기가 쓴다(mindKeys).
  if (e.altKey) return null
  const t = e.target as { tagName?: string; isContentEditable?: boolean } | null
  if (t && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return null
  if (e.key === '=' || e.key === '+') return 'in'
  if (e.key === '-' || e.key === '_') return 'out'
  if (e.key === '0') return 'fit'
  return null
}
