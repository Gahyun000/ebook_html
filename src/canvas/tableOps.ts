import type { FreeEl } from '../state/store'

// 표 편집 순수 함수 — FreeEl(table)을 받아 부분 패치(Partial<FreeEl>)를 돌려준다.
export type Merge = { r: number; c: number; rs: number; cs: number }
type Align = 'left' | 'center' | 'right'
type VAlign = 'top' | 'middle' | 'bottom'
type CAlign = Record<string, Align>
// 셀 단위 맵은 모두 "r_c" 키를 쓴다. calign(가로정렬)·cvalign(세로정렬)·cfs(글자크기)·cbg(배경색)가 같은 규칙이다.
type CellMap<T> = Record<string, T>
type CVAlign = Record<string, VAlign>
type CFs = Record<string, number>

const key = (r: number, c: number) => r + '_' + c

function grid(el: FreeEl): { R: number; C: number; cells: string[][] } {
  const R = el.rows || 2, C = el.cols || 2
  const cells: string[][] = []
  for (let r = 0; r < R; r++) {
    const row: string[] = []
    for (let c = 0; c < C; c++) row.push((el.cells && el.cells[r] && el.cells[r][c]) || '')
    cells.push(row)
  }
  return { R, C, cells }
}

// (r,c)를 덮는 병합(앵커 포함) 찾기
export function mergeCovering(merges: Merge[] | undefined, r: number, c: number): Merge | undefined {
  if (!merges) return undefined
  return merges.find((m) => r >= m.r && r < m.r + m.rs && c >= m.c && c < m.c + m.cs)
}

/**
 * 고른 칸 범위를 **병합 칸의 실제 크기에 맞춰 넓힌다**(EVER-SKETCH1 e38d357).
 *
 * 범위는 눌러 시작한 칸과 커서가 있는 칸의 **저장된 (행, 열)** 로만 만들어졌는데,
 * **병합 칸은 제 왼쪽 위 좌표 하나만** 갖는다. 그래서 2행 높이로 병합된 칸(0행 시작)에
 * 커서가 닿는 순간 범위의 아래 변이 1행에서 **0행으로 줄어들어** 그 아래 줄이 통째로 빠졌다.
 * 엑셀은 반대로 병합 칸에 닿으면 선택이 그 칸 전체를 삼키도록 **커진다.** 그렇게 맞춘다.
 *
 * 사각형에 닿은 병합이 있으면 통째로 품도록 키우고, 키운 사각형이 또 다른 병합에 닿을 수
 * 있으니 **더 커지지 않을 때까지** 되풀이한다. 병합이 없으면 준 값 그대로(바로 세워서)다.
 */
export function growToMerges(merges: Merge[] | undefined,
                             r0: number, c0: number, r1: number, c1: number,
                             ): { r0: number; c0: number; r1: number; c1: number } {
  let a = Math.min(r0, r1), b = Math.max(r0, r1)
  let x = Math.min(c0, c1), y = Math.max(c0, c1)
  if (!merges || !merges.length) return { r0: a, c0: x, r1: b, c1: y }
  // 병합 개수만큼 돌면 반드시 멈춘다 — 한 바퀴에 적어도 하나는 새로 삼켜야 계속 커진다.
  for (let pass = 0; pass <= merges.length; pass++) {
    let grew = false
    for (const m of merges) {
      const mr1 = m.r + m.rs - 1, mc1 = m.c + m.cs - 1
      if (m.r > b || mr1 < a || m.c > y || mc1 < x) continue   // 안 닿았다
      if (m.r < a) { a = m.r; grew = true }
      if (mr1 > b) { b = mr1; grew = true }
      if (m.c < x) { x = m.c; grew = true }
      if (mc1 > y) { y = mc1; grew = true }
    }
    if (!grew) break
  }
  return { r0: a, c0: x, r1: b, c1: y }
}

/**
 * 머리 띠를 눌렀을 때 고를 범위 — **그 줄·그 열에 「제 칸」으로 들어 있는 것들**(EVER-SKETCH1 e38d357).
 *
 * 줄 양옆이 전부 2행 높이 병합이면 끌어서는 그 줄만 고를 수 없다(병합에 닿아 2행이 된다).
 * 그래서 머리 띠는 **그 줄에서 시작하는 칸만** 센다 — 끌기(growToMerges)와 답이 다른 게 의도다.
 * 고를 게 없으면 null — 병합에 통째로 덮인 줄(제 칸이 하나도 없는 줄)이 그렇다.
 */
export function bandRange(el: Pick<FreeEl, 'rows' | 'cols' | 'merges'>,
                          axis: 'row' | 'col', i: number,
                          ): { r0: number; c0: number; r1: number; c1: number } | null {
  const R = el.rows || 1, C = el.cols || 1
  if (i < 0 || (axis === 'row' ? i >= R : i >= C)) return null
  const cov = coveredSet(el.merges)
  let r0 = Infinity, c0 = Infinity, r1 = -Infinity, c1 = -Infinity
  const n = axis === 'row' ? C : R
  for (let k = 0; k < n; k++) {
    const r = axis === 'row' ? i : k
    const c = axis === 'row' ? k : i
    if (cov.has(r + '_' + c)) continue          // 위/왼쪽 병합에 덮인 자리 — 제 칸이 아니다
    const m = mergeCovering(el.merges, r, c)
    const er = m ? m.r + m.rs - 1 : r
    const ec = m ? m.c + m.cs - 1 : c
    if (r < r0) r0 = r
    if (c < c0) c0 = c
    if (er > r1) r1 = er
    if (ec > c1) c1 = ec
  }
  if (r0 === Infinity) return null
  return { r0, c0, r1, c1 }
}

// 덮이지만 앵커가 아닌 셀들(렌더에서 숨김)
export function coveredSet(merges: Merge[] | undefined): Set<string> {
  const s = new Set<string>()
  if (!merges) return s
  for (const m of merges) for (let r = m.r; r < m.r + m.rs; r++) for (let c = m.c; c < m.c + m.cs; c++) if (!(r === m.r && c === m.c)) s.add(key(r, c))
  return s
}

// 열 너비·행 높이는 **비율(가중치) 배열**이다. px 가 아니다. (EVER-SKETCH1 859c9e0 · b721df0)
// px 로 두면 표 전체 크기를 바꾸는 순간 칸 합이 표 폭과 어긋나 마지막 칸이 잘린다.
// 길이가 열/행 수와 다르면(구 문서·잘못된 입력) 균등 분할로 되돌린다 — 조용히 어긋난 폭을
// 유지하는 것보다 눈에 띄게 균등해지는 편이 고치기 쉽다.
// (화면 grid 용 문자열. PPT 내보내기는 숫자 배열이 필요해서 아래 trackSizes 를 쓴다.)
export function sizeTracks(arr: number[] | undefined, n: number): string {
  const ok = !!arr && arr.length === n && arr.every((v) => typeof v === 'number' && v > 0 && isFinite(v))
  return ok ? (arr as number[]).map((v) => v + 'fr').join(' ') : `repeat(${n}, 1fr)`
}

/** 경계선 i(칸 i 와 i+1 사이)를 끌었을 때의 새 비율 배열(EVER-SKETCH1 6817694).
 *
 *  **합을 그대로 둔다.** 한쪽이 넓어지면 옆이 그만큼 좁아진다 — 표 전체 크기는
 *  안 변한다. 표를 키우는 것은 모서리 손잡이가 할 일이고, 이건 「안에서 나누는」 일이다.
 *  둘을 한 동작에 섞으면 열 하나 넓히려다 표가 종이 밖으로 나간다.
 *
 *  `px` 는 이 방향의 표 크기(캔버스 px), `dPx` 는 끌린 거리다.
 *  최소 12px 은 남긴다 — 0 으로 만들면 그 열은 다시 잡을 수 없다.
 */
export function dragTrack(arr: number[], i: number, dPx: number, px: number,
                          minPx = 12): number[] {
  if (i < 0 || i + 1 >= arr.length || !(px > 0)) return arr
  const total = arr.reduce((a, b) => a + b, 0)
  if (!(total > 0)) return arr
  const min = (total * minPx) / px
  const a0 = arr[i], b0 = arr[i + 1]
  // 두 칸 다 이미 최소보다 작으면(아주 좁은 표) 건드리지 않는다 — 억지로 맞추면 튄다.
  if (a0 - min < 0 && b0 - min < 0) return arr
  let d = (dPx * total) / px
  d = Math.max(-(a0 - min), Math.min(b0 - min, d))
  const out = arr.slice()
  out[i] = a0 + d
  out[i + 1] = b0 - d
  return out
}

// 새 행/열의 크기는 **바로 그 자리에 있던 것과 같게** 잡는다(끝에 붙이면 마지막 것과 같게).
// 1 로 고정하면 넓은 열 옆에 열을 넣었을 때 그 칸만 좁아져 표가 어긋나 보인다.
function insertSize(arr: number[] | undefined, at: number, n: number): number[] | undefined {
  if (!arr || arr.length !== n) return undefined
  const out = arr.slice()
  out.splice(at, 0, arr[Math.min(Math.max(at, 0), arr.length - 1)] || 1)
  return out
}
function removeSize(arr: number[] | undefined, at: number, n: number): number[] | undefined {
  if (!arr || arr.length !== n) return undefined
  const out = arr.slice()
  out.splice(at, 1)
  return out.length ? out : undefined
}

// 행·열이 늘거나 줄면 셀 좌표가 통째로 밀린다. 좌표를 키로 쓰는 맵은 전부 다시 매핑해야 한다.
// **이 함수를 거치지 않는 셀 맵을 새로 추가하면, 행을 하나 추가하는 순간
// 그 맵의 값이 한 칸씩 어긋난다**(칸 색이 엉뚱한 줄로 밀리는 식).
function remapCells<T>(map: CellMap<T> | undefined, fn: (r: number, c: number) => [number, number] | null): CellMap<T> {
  const out: CellMap<T> = {}
  if (map) for (const k of Object.keys(map)) {
    const [r, c] = k.split('_').map(Number)
    const nk = fn(r, c)
    if (nk) out[key(nk[0], nk[1])] = map[k]
  }
  return out
}

// 셀 서식 맵은 네 개가 항상 함께 움직여야 한다. 하나라도 빠뜨리면 행을 지운 뒤
// 정렬만 따라오고 글자 크기·칸 색은 엉뚱한 칸에 남는 식으로 표가 어긋난다.
// **셀 맵을 새로 추가하면 반드시 여기에도 넣는다.**
function remapCellStyles(el: FreeEl, fn: (r: number, c: number) => [number, number] | null): Partial<FreeEl> {
  return {
    calign: remapCells<Align>(el.calign, fn),
    cvalign: remapCells<VAlign>(el.cvalign, fn),
    cfs: remapCells<number>(el.cfs, fn),
    cbg: remapCells<string>(el.cbg, fn),
  }
}

/**
 * 행이 하나 늘거나 줄 때 **표 전체 높이**를 얼마로 옮길지(EVER-SKETCH1 bc8baa1).
 *
 * 예전에는 행을 추가해도 `h` 를 안 건드렸다. 표는 고정 높이 격자이고 `gridTemplateRows` 가
 * `fr` 이라, 행이 늘면 **남아 있던 행들이 대신 납작해졌다** — 「행을 넣었더니 표가 뭉개졌다」.
 *
 * 규칙: **행 높이는 사람이 정하고, 표 높이는 행 수를 따라간다.** 넣으면 그 자리 행만큼 커지고,
 * 빼면 그만큼 작아진다(대칭 — 한쪽만 움직이면 넣었다 뺐다 하는 동안 표가 계속 부푼다).
 * 새 행 크기는 insertSize() 와 **같은 규칙**(그 자리 행과 같게)으로 잡는다.
 */
export function rowChangedHeight(el: FreeEl, at: number, delta: 1 | -1): number | undefined {
  const h = el.h
  if (typeof h !== 'number' || !isFinite(h) || h <= 0) return undefined
  const R = el.rows || (el.cells ? el.cells.length : 0) || 1
  const arr = el.rowh
  const ok = !!arr && arr.length === R && arr.every((v) => typeof v === 'number' && v > 0 && isFinite(v))
  const w = ok ? (arr as number[]) : Array.from({ length: R }, () => 1)
  const sum = w.reduce((a, b) => a + b, 0)
  if (sum <= 0) return undefined
  const one = w[Math.min(Math.max(at, 0), R - 1)] || 1
  const next = delta > 0 ? sum + one : sum - one
  if (next <= 0) return undefined
  return Math.max(1, Math.round((h * next) / sum))
}

// 높이를 모르면 **키 자체를 싣지 않는다.** `h: undefined` 를 실어 보내면 updateEl 의
// 펼치기(`{ ...el, ...patch }`)가 멀쩡한 높이까지 undefined 로 덮는다.
function heightPatch(h: number | undefined): Partial<FreeEl> { return h == null ? {} : { h } }

export function addRow(el: FreeEl, at: number): Partial<FreeEl> {
  const { R, C, cells } = grid(el)
  const nc = cells.map((row) => row.slice())
  nc.splice(at, 0, Array.from({ length: C }, () => ''))
  const merges = (el.merges || []).map((m) => ({ ...m }))
  for (const m of merges) { if (at <= m.r) m.r++; else if (at <= m.r + m.rs - 1) m.rs++ }
  const st = remapCellStyles(el, (r, c) => [r >= at ? r + 1 : r, c])
  return { rows: R + 1, cells: nc, merges, ...st, rowh: insertSize(el.rowh, at, R),
           ...heightPatch(rowChangedHeight(el, at, 1)) }
}

export function delRow(el: FreeEl, at0: number): Partial<FreeEl> {
  const { R, cells } = grid(el)
  if (R <= 1) return {}
  // 범위 밖이면 splice 가 아무것도 못 지우는데 rows 만 줄어 cells 와 어긋난다 →
  // 남은 행이 화면·내보내기에서 조용히 사라지고, 다음 '행 추가' 때 영구 삭제된다.
  const at = Math.max(0, Math.min(R - 1, at0))
  const nc = cells.map((row) => row.slice()); nc.splice(at, 1)
  const merges: Merge[] = []
  for (const m0 of (el.merges || [])) {
    const m = { ...m0 }
    if (at < m.r) m.r--
    else if (at <= m.r + m.rs - 1) m.rs--
    if (m.rs >= 1 && m.cs >= 1 && !(m.rs === 1 && m.cs === 1)) merges.push(m)
  }
  const st = remapCellStyles(el, (r, c) => (r === at ? null : [r > at ? r - 1 : r, c]))
  return { rows: R - 1, cells: nc, merges, ...st, rowh: removeSize(el.rowh, at, R),
           ...heightPatch(rowChangedHeight(el, at, -1)) }
}

export function addCol(el: FreeEl, at: number): Partial<FreeEl> {
  const { C, cells } = grid(el)
  const nc = cells.map((row) => { const rr = row.slice(); rr.splice(at, 0, ''); return rr })
  const merges = (el.merges || []).map((m) => ({ ...m }))
  for (const m of merges) { if (at <= m.c) m.c++; else if (at <= m.c + m.cs - 1) m.cs++ }
  const st = remapCellStyles(el, (r, c) => [r, c >= at ? c + 1 : c])
  return { cols: C + 1, cells: nc, merges, ...st, colw: insertSize(el.colw, at, C) }
}

export function delCol(el: FreeEl, at0: number): Partial<FreeEl> {
  const { C, cells } = grid(el)
  if (C <= 1) return {}
  const at = Math.max(0, Math.min(C - 1, at0))   // delRow 와 같은 이유로 클램프
  const nc = cells.map((row) => { const rr = row.slice(); rr.splice(at, 1); return rr })
  const merges: Merge[] = []
  for (const m0 of (el.merges || [])) {
    const m = { ...m0 }
    if (at < m.c) m.c--
    else if (at <= m.c + m.cs - 1) m.cs--
    if (m.rs >= 1 && m.cs >= 1 && !(m.rs === 1 && m.cs === 1)) merges.push(m)
  }
  const st = remapCellStyles(el, (r, c) => (c === at ? null : [r, c > at ? c - 1 : c]))
  return { cols: C - 1, cells: nc, merges, ...st, colw: removeSize(el.colw, at, C) }
}

export function mergeRange(el: FreeEl, r0: number, c0: number, r1: number, c1: number): Partial<FreeEl> {
  const R0 = Math.min(r0, r1), C0 = Math.min(c0, c1), R1 = Math.max(r0, r1), C1 = Math.max(c0, c1)
  if (R0 === R1 && C0 === C1) return {}
  const merges = (el.merges || []).filter((m) => !(m.r < R1 + 1 && m.r + m.rs > R0 && m.c < C1 + 1 && m.c + m.cs > C0))
  merges.push({ r: R0, c: C0, rs: R1 - R0 + 1, cs: C1 - C0 + 1 })
  return { merges }
}

export function unmergeAt(el: FreeEl, r: number, c: number): Partial<FreeEl> {
  const m = mergeCovering(el.merges, r, c)
  if (!m) return {}
  return { merges: (el.merges || []).filter((x) => x !== m) }
}

export function setAlignRange(el: FreeEl, r0: number, c0: number, r1: number, c1: number, align: Align): Partial<FreeEl> {
  const R0 = Math.min(r0, r1), C0 = Math.min(c0, c1), R1 = Math.max(r0, r1), C1 = Math.max(c0, c1)
  const calign: CAlign = { ...(el.calign || {}) }
  for (let r = R0; r <= R1; r++) for (let c = C0; c <= C1; c++) calign[key(r, c)] = align
  return { calign }
}

/**
 * 고른 칸 범위의 **채우기**(칸 색 `cbg`)를 바꾼다 — EVER-SKETCH1 b721df0 그대로.
 * 도구줄(표 → 채우기)과 오른쪽 패널(표 탭 → 채우기)이 **같은 함수**로 칠한다.
 */
export function setCellBgRange(el: FreeEl, r0: number, c0: number, r1: number, c1: number,
                               color: string | null): Partial<FreeEl> {
  const R0 = Math.min(r0, r1), C0 = Math.min(c0, c1), R1 = Math.max(r0, r1), C1 = Math.max(c0, c1)
  const cbg: CellMap<string> = { ...(el.cbg || {}) }
  for (let r = R0; r <= R1; r++) for (let c = C0; c <= C1; c++) {
    // null 이면 지운다 — 빈 문자열을 남기면 "칠했는데 투명"이라는 애매한 상태가 된다.
    if (color) cbg[key(r, c)] = color
    else delete cbg[key(r, c)]
  }
  return { cbg }
}

export function cellBg(el: FreeEl, r: number, c: number): string | undefined {
  return el.cbg ? el.cbg[key(r, c)] : undefined
}

export function setVAlignRange(el: FreeEl, r0: number, c0: number, r1: number, c1: number, valign: VAlign): Partial<FreeEl> {
  const R0 = Math.min(r0, r1), C0 = Math.min(c0, c1), R1 = Math.max(r0, r1), C1 = Math.max(c0, c1)
  const cvalign: CVAlign = { ...(el.cvalign || {}) }
  for (let r = R0; r <= R1; r++) for (let c = C0; c <= C1; c++) cvalign[key(r, c)] = valign
  return { cvalign }
}

// fs 가 null 이면 셀 지정을 지워 표 기본 크기(el.fs)로 되돌린다.
// 지우기를 따로 두지 않으면 한 번 셀 크기를 준 표는 전체 크기 조절이 영영 안 먹는다.
export function setCellFsRange(el: FreeEl, r0: number, c0: number, r1: number, c1: number, fs: number | null): Partial<FreeEl> {
  const R0 = Math.min(r0, r1), C0 = Math.min(c0, c1), R1 = Math.max(r0, r1), C1 = Math.max(c0, c1)
  const cfs: CFs = { ...(el.cfs || {}) }
  for (let r = R0; r <= R1; r++) for (let c = C0; c <= C1; c++) {
    if (fs == null) delete cfs[key(r, c)]
    else cfs[key(r, c)] = Math.max(6, Math.min(120, Math.round(fs)))
  }
  return { cfs }
}

// 열 너비·행 높이 비율 배열을 **숫자 배열**로 편다(EVER-SKETCH1 tableOps.trackSizes).
// 길이가 맞지 않거나 이상한 값이 섞이면 균등(전부 1)으로 되돌린다.
export function trackSizes(arr: number[] | undefined, n: number): number[] {
  const ok = !!arr && arr.length === n && arr.every((v) => typeof v === 'number' && v > 0 && isFinite(v))
  return ok ? (arr as number[]).slice() : Array.from({ length: n }, () => 1)
}
