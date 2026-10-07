// **키로 붙이면 고른 상자 기준으로만 놓는다 — 다른 상자는 안 움직인다**(2026-10-07 · 2차 요청 5·6번으로 다시 씀).
//
// 이 파일의 앞 판(2026-10-06~07 오전)은 「붙일 때마다 트리를 종이 안에 다시 앉힌다(seatTree) · 뿌리 고정」 을 검사했다.
// 사용자가 쓰고 나서 뒤집었다: 「엔터를 누르는 경우 여전히 우측의 아래에 생성됨 — 부모의 아래를 의미」 · 「도형을 어느 위치로 이동 후 다시
// 스페이스나 엔터를 누르면 재정렬됨. 그런 현상은 없도록」. 그래서 이제 —
//   · Space = 고른 상자의 **오른쪽**(같은 높이), 또 누르면 그 아래로 쌓임 · Enter = 고른 상자의 **바로 아래**(같은 x) · Shift+Enter = 바로 위
//   · 있던 상자는 **하나도 안 움직인다** — 손으로 옮긴 자리도, 머메이드로 펼친 자리도 그대로
//   · 글을 끝내면 고른 것이 허브(키를 누른 상자)로 돌아온다(place_next.test.mjs · 화면은 스모크 13 · 14단계)
//
// 실행: node --experimental-strip-types --import ./ts_register.mjs tree_keys.test.mjs
import { readFileSync } from 'node:fs'
const { useBuilder } = await import('./src/state/store.ts')
const { mkFreeEl } = await import('./src/canvas/model.ts')
const { isTreePage, treeShape, knownOf } = await import('./src/cards/treeOps.ts')
const { GAP_SIDE, GAP_DOWN, GAP_STACK } = await import('./src/canvas/placeNext.ts')

let pass = 0, fail = 0
const check = (c, label, extra = '') => {
  if (c) { pass++; return }
  fail++; console.log('  X ' + label + (extra ? '  — ' + extra : ''))
}
const bare = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const S = () => useBuilder.getState()
const cur = () => S().pages.find((p) => p.id === S().selectedPageId)
const J = (v) => JSON.stringify(v)
const posOf = (pg, ids) => pg.els.filter((e) => ids.has(e.id)).map((e) => [e.id, e.x, e.y]).join('|')
const overlaps = (pg) => { const v = pg.els.filter((e) => !e.hidden); let n = 0
  for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) { const a = v[i], b = v[j]; if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) n++ }
  return n }
/** 붙이고 **새로 생긴 상자**를 돌려준다. */
function add(pid, hubId, side) {
  const had = new Set(cur().els.map((e) => e.id)); S().treeAdd(pid, hubId, side)
  return cur().els.find((e) => !had.has(e.id))
}
S().setOrientation('landscape')

// ── 1. 한 상자에서 Space 를 이어 누르면 — 오른쪽 열의 자식들이 **허브 가운데**에 맞춰 선다 · 허브는 제자리 ───────────
//    (2026-10-07 3차 · 사용자: 「자식 7개 정도까지는 가능한한 중간에 위치 … 지금은 축 쳐져서 밑으로 내려가는 느낌」)
//    같은 열에 선 자식들(새 상자 포함)만 다시 가운데 맞춤 — 그 밖의 것은 여전히 안 움직인다(1b).
{
  S().addCard('slide'); const p = cur()
  const hub = mkFreeEl('box', 120, 240); hub.text = '내용'; S().addEl(p.id, hub)        // 가운데 y = 268
  const at = (id) => cur().els.find((e) => e.id === id)
  const k1 = add(p.id, hub.id, 'right')
  check(k1.x === hub.x + hub.w + GAP_SIDE && k1.y === hub.y, '첫째는 오른쪽 같은 높이', `${k1.x},${k1.y}`)
  const k2 = add(p.id, hub.id, 'right')
  check(at(k1.id).y === 203 && at(k2.id).y === 277 && at(k1.id).x === at(k2.id).x, '둘이면 **허브 가운데를 사이에 두고** 위아래로(첫째가 올라간다)', J([at(k1.id).y, at(k2.id).y]))
  const k3 = add(p.id, hub.id, 'right')
  check(at(k1.id).y === 166 && at(k2.id).y === 240 && at(k3.id).y === 314, '셋이면 가운데 자식이 **허브와 같은 높이** · 위아래 18 간격', J([k1, k2, k3].map((e) => at(e.id).y)))
  const H = at(hub.id)
  check(H.x === 120 && H.y === 240, '허브는 제자리', `${H.x},${H.y}`)
  for (let i = 0; i < 4; i++) add(p.id, hub.id, 'right')
  const col = () => cur().els.filter((e) => e.id !== hub.id).sort((a, b) => a.y - b.y)
  check(col().length === 7 && col().map((e) => e.y).join() === '18,92,166,240,314,388,462' && col().every((e) => e.x === k1.x), '일곱까지는 다 가운데 맞춤(그룹의 가운데 = 허브 가운데)', col().map((e) => e.y).join())
  const k8 = add(p.id, hub.id, 'right')
  check(k8.y === 462 + 56 + GAP_STACK && col().slice(0, 7).map((e) => e.y).join() === '18,92,166,240,314,388,462', '여덟째부터는 가운데 맞춤 없이 아래로 이어 쌓인다(일곱은 그대로)', J([k8.y, col().slice(0, 7).map((e) => e.y)]))
  const sh = treeShape(cur().els, cur().conns, knownOf(cur()))
  check((sh.kids.get(hub.id) || []).length === 8 && cur().conns.every((c) => c.from === hub.id && c.axis === 'h'), '여덟 다 허브의 자식 · 선은 가로 축')
  check(overlaps(cur()) === 0 && isTreePage(cur()), '겹침 없음 · 트리 쪽')
}
// ── 1b. 가운데 맞춤이 건드리지 않는 것 — 손으로 옮긴 자식 · 자손은 함께 · 남과 겹치면 그만둔다 ───
{
  S().addCard('slide'); const p = cur()
  const hub = mkFreeEl('box', 120, 240); S().addEl(p.id, hub)
  const at = (id) => cur().els.find((e) => e.id === id)
  const k1 = add(p.id, hub.id, 'right'), k2 = add(p.id, hub.id, 'right')      // 203 · 277
  const g1 = add(p.id, k1.id, 'right')                                        // 첫째의 자식 — 첫째와 같은 높이
  check(at(g1.id).y === at(k1.id).y && at(g1.id).x === at(k1.id).x + 120 + GAP_SIDE, '(준비) 손자는 첫째 옆 같은 높이', J([at(k1.id).y, at(g1.id).y]))
  add(p.id, hub.id, 'right')                                                  // 셋 → 166 · 240 · 314
  check(at(k1.id).y === 166 && at(g1.id).y === 166, '자식이 올라가면 **그 자손도 함께** 올라간다', J([at(k1.id).y, at(g1.id).y]))
  S().updateEl(p.id, k2.id, { x: 600, y: 420 })                               // 둘째를 손으로 딴 데로
  add(p.id, hub.id, 'right')                                                  // 열에 남은 셋만 가운데 맞춤
  check(at(k2.id).x === 600 && at(k2.id).y === 420, '손으로 옮긴 자식은 **안 건드린다**')
  const inCol = cur().els.filter((e) => e.x === k1.x).sort((a, b) => a.y - b.y)
  check(inCol.length === 3 && inCol.map((e) => e.y).join() === '166,240,314', '열에 남은 셋만 다시 가운데', inCol.map((e) => e.y).join())
  // 남과 겹치면 그만둔다 — 가운데 맞춤이 밀어 올릴 자리에 남의 상자가 있으면 그냥 아래로 쌓인 채 둔다
  S().addCard('slide'); const q = cur()
  const h2 = mkFreeEl('box', 120, 240); S().addEl(q.id, h2)
  const other = mkFreeEl('box', 300, 150); other.text = '남'; S().addEl(q.id, other)   // 첫째가 올라갈 자리(203..259)와 겹친다
  const a1 = add(q.id, h2.id, 'right'), a2 = add(q.id, h2.id, 'right')
  check(at(a1.id).y === 240 && at(a2.id).y === 240 + 56 + GAP_STACK && at(other.id).y === 150, '남의 상자와 겹치게 되면 가운데 맞춤을 하지 않는다(아래로 쌓인 채)', J([at(a1.id).y, at(a2.id).y]))
}

// ── 2. Enter 둘 — 부모 **바로 아래**, 둘째는 그 오른쪽 ──────────────────────
{
  S().addCard('slide'); const p = cur()
  const hub = mkFreeEl('box', 120, 100); S().addEl(p.id, hub)
  const d1 = add(p.id, hub.id, 'down'), d2 = add(p.id, hub.id, 'down')
  check(d1.x === hub.x && d1.y === hub.y + hub.h + GAP_DOWN, 'Enter = 부모의 바로 아래(같은 x)', `${d1.x},${d1.y}`)
  check(d2.y === d1.y && d2.x === d1.x + d1.w + GAP_STACK + 6, '또 Enter 면 그 오른쪽에 줄을 선다(첫째는 그대로)', `${d2.x},${d2.y}`)
  check(cur().conns.every((c) => c.from === hub.id && c.axis === 'v'), '아래로 붙인 선은 세로 축(부모 아래 변에서 나간다)')
  const u = add(p.id, hub.id, 'up')
  check(u.x === hub.x && u.y === hub.y - GAP_DOWN - hub.h, 'Shift+Enter = 바로 위')
}

// ── 3. 옮긴 뒤 붙여도 — **재정렬 없음** ─────────────────────────────────
{
  S().addCard('slide'); const p = cur()
  const hub = mkFreeEl('round', 120, 240); S().addEl(p.id, hub)
  const k1 = add(p.id, hub.id, 'right'), k2 = add(p.id, hub.id, 'right')
  S().updateEl(p.id, k1.id, { x: 500, y: 40 })                 // 첫 자식을 손으로 옮긴다
  S().updateEl(p.id, hub.id, { x: 60, y: 400 })                // 허브도 옮긴다
  const kept = new Set(cur().els.map((e) => e.id)); const before = posOf(cur(), kept)
  const k3 = add(p.id, hub.id, 'right')
  check(posOf(cur(), kept) === before, '**옮겨 둔 상자(자식도 허브도)가 하나도 안 움직인다**')
  check(k3.x === 60 + hub.w + GAP_SIDE && k3.y === 400, '새 상자는 **옮긴 허브 자리** 기준으로 놓인다', `${k3.x},${k3.y}`)
  const k4 = add(p.id, hub.id, 'down')
  check(k4.x === 60 && k4.y === 400 + hub.h + GAP_DOWN && posOf(cur(), kept) === before, 'Enter 도 옮긴 자리 바로 아래 · 역시 아무것도 안 움직인다')
  check(k2.id !== k3.id && cur().els.some((e) => e.id === k2.id && e.x === k2.x && e.y === k2.y), '둘째 자식도 옛 자리 그대로')
}

// ── 4. 머메이드로 펼친 쪽에서도 — 붙여도 다시 앉지 않는다 ─────────────────────
{
  S().addCard('tree', undefined, 'graph LR\n  A[기획] --> B[설계]\n  A --> C[문서]\n  B --> D[개발]')
  const p = cur()
  const B = p.els.find((e) => e.text === '설계' && e.echoOf == null)
  const D = p.els.find((e) => e.text === '개발' && e.echoOf == null)                 // 설계의 자식 — 설계 옆 열에 있다(열 간격 192 = 132 + 60)
  const A = p.els.find((e) => e.text === '기획' && e.echoOf == null), M = p.els.find((e) => e.text === '문서' && e.echoOf == null)
  const kept = new Set([A.id]); const before = posOf(p, kept)
  const k = add(p.id, B.id, 'right')
  const D2 = cur().els.find((e) => e.id === D.id), B2 = cur().els.find((e) => e.id === B.id), M2 = cur().els.find((e) => e.id === M.id), A2 = cur().els.find((e) => e.id === A.id)
  check(posOf(cur(), kept) === before, '뿌리(기획)는 **그대로**다(전에는 전부 다시 앉혔다)')
  check(D2.y === B2.y - 28 && k.y === B2.y + 28 && D2.x === k.x, '설계의 자식 열(개발 + 새것)은 **설계 가운데**에 맞춰 선다(3차)', J([B2.y, D2.y, k.y]))
  // 4차: 설계에 자손이 생겼으니 형제(문서)와의 사이가 그만큼 벌어지고, 둘은 여전히 기획 가운데에
  check(B2.y === A2.y - 28 && M2.y === A2.y + 56, '설계 · 문서는 자손 범위(94 + 18 + 38)만큼 벌어져 기획 가운데에', J([A2.y, B2.y, M2.y]))
  check(k && cur().conns.some((c) => c.from === B.id && c.to === k.id), '새 상자는 「설계」 에 이어진다')
  check(cur().conns.filter((c) => c.to === k.id).every((c) => c.color === '#8b93a5' && c.width === 2), '머메이드 쪽에 붙인 선도 한 벌 색')
  // 가지째 지워도 · 접어도 다시 앉지 않는다
  const kept2 = new Set(cur().els.filter((e) => e.id !== k.id && e.echoOf == null).map((e) => e.id)); const before2 = posOf(cur(), kept2)
  S().treeRemove(p.id, k.id)
  check(posOf(cur(), kept2) === before2, '가지째 지워도 남은 상자는 제자리')
  S().treeFold(p.id, A.id)
  check(posOf(cur(), kept2) === before2 && cur().els.filter((e) => e.id !== A.id && e.echoOf == null).every((e) => e.hidden), '접으면 숨기만 하고 자리는 그대로')
  S().treeFold(p.id, A.id)
  check(posOf(cur(), kept2) === before2 && cur().els.every((e) => !e.hidden), '펴도 자리 그대로')
}

// ── 4b. 아래 띠로 접힌 머메이드(흐린 상자 echo 있음) — 접으면 echo 도 제 원본을 따라 숨는다 ────────────
//    전에는 다시 앉히면서 echo 를 새로 만들어 저절로 됐다. 이제 자리를 안 옮기니 숨김을 따로 따라가야 한다(스모크 7단계).
{
  S().addCard('tree', undefined, 'graph TB\n  A[기획] --> B[설계]\n  B --> C[개발]\n  C --> D{검수}\n  D --> E[배포]\n  D --> B')
  const p = cur()
  const echo = p.els.filter((e) => e.echoOf != null)
  check(echo.length >= 1, '(준비) 가로 종이에서 이 그림은 아래 띠로 접혀 흐린 상자가 생긴다', String(echo.length))
  const A = p.els.find((e) => e.text === '기획' && e.echoOf == null)
  const kept = new Set(p.els.map((e) => e.id)); const before = posOf(p, kept)
  S().treeFold(p.id, A.id)
  check(cur().els.filter((e) => e.id !== A.id).every((e) => e.hidden), '뿌리를 접으면 **흐린 상자까지** 전부 숨는다', J(cur().els.filter((e) => e.id !== A.id && !e.hidden).map((e) => [e.text, e.echoOf])))
  check(posOf(cur(), kept) === before, '접어도 자리 그대로')
  S().treeFold(p.id, A.id)
  check(cur().els.every((e) => !e.hidden) && posOf(cur(), kept) === before, '펴면 다 보이고 자리 그대로')
}

// ── 6. 손자가 생기면 형제 사이가 벌어진다(2026-10-07 4차) ─────────────────────────────
//    사용자: 「child1 계층에서 A,B,C,D,E 를 만들었고 B 에서 child2, C 에서 child2 계층을 만든 경우 얘네 둘이 그림상으로 겹쳐보이는 때가 있음 …
//    처음 만들때부터 겹치지 않도록 — B,C 사이 간격을 늘인다거나」. 자식을 붙이면 그 가지의 윗대로 올라가며 **형제들을 자손 범위만큼 떼어** 부모 가운데에 다시 세운다.
{
  S().addCard('slide'); const p = cur()
  const R = mkFreeEl('box', 120, 240); R.text = 'R'; S().addEl(p.id, R)              // 가운데 y = 268
  const at = (id) => cur().els.find((e) => e.id === id)
  const A = add(p.id, R.id, 'right')
  const B = add(p.id, A.id, 'sibling'), C = add(p.id, B.id, 'sibling'), D = add(p.id, C.id, 'sibling'), E = add(p.id, D.id, 'sibling')
  check([A, B, C, D, E].map((k) => at(k.id).y).join() === '92,166,240,314,388', '(준비) 자식 다섯이 뿌리 가운데에', [A, B, C, D, E].map((k) => at(k.id).y).join())
  const b1 = add(p.id, B.id, 'right'), b2 = add(p.id, b1.id, 'sibling')              // B 의 자식 둘
  check(overlaps(cur()) === 0, 'B 에 자식 둘 — 겹침 없음(C · D · E 가 아래로 비켜 선다)', J(cur().els.map((e) => [e.text, e.y])))
  check((at(b1.id).y + at(b2.id).y + 56) / 2 === at(B.id).y + 28, 'B 의 자식 둘은 B 가운데에', J([at(B.id).y, at(b1.id).y, at(b2.id).y]))
  check(at(C.id).y - (at(b2.id).y + 56) === GAP_STACK, 'B 의 둘째 자식 아래와 C 사이가 꼭 한 칸(18)', J([at(b2.id).y, at(C.id).y]))
  const c1 = add(p.id, C.id, 'right'), c2 = add(p.id, c1.id, 'sibling')              // C 의 자식 둘 — 사용자가 본 그 겹침
  check(overlaps(cur()) === 0, 'C 에도 자식 둘 — **B 의 자식과 C 의 자식이 안 겹친다**', J(cur().els.map((e) => [e.text, e.x, e.y])))
  check(at(c1.id).y - (at(b2.id).y + 56) === GAP_STACK && (at(c1.id).y + at(c2.id).y + 56) / 2 === at(C.id).y + 28, 'C 의 자식은 C 가운데에 · B 의 자식 아래와 한 칸 띄어', J([at(b2.id).y, at(c1.id).y, at(c2.id).y, at(C.id).y]))
  check([A, B, C, D, E].map((k) => at(k.id).y).join() === '18,129,277,388,462' && [A, B, C, D, E].every((k) => at(k.id).x === at(A.id).x), '형제 다섯이 자손 범위만큼 벌어지고 여전히 뿌리 가운데에', [A, B, C, D, E].map((k) => at(k.id).y).join())
  const r = at(R.id)
  check(r.x === 120 && r.y === 240, '뿌리는 제자리')
  // 손으로 딴 데 옮긴 형제는 벌리기에 안 끼고 건드리지도 않는다
  S().updateEl(p.id, E.id, { x: 900, y: 640 })
  add(p.id, D.id, 'right'); add(p.id, D.id, 'right')
  check(at(E.id).x === 900 && at(E.id).y === 640 && overlaps(cur()) === 0, '옮겨 둔 E 는 그대로 · D 의 자식이 생겨도 겹침 없음', J([at(E.id).x, at(E.id).y]))
  check([A, B, C, D].map((k) => at(k.id).y).join() === '18,129,277,425', 'E 가 열 밖으로 나가 넷만 센다 — A · B · C · D 가 뿌리 가운데에', [A, B, C, D].map((k) => at(k.id).y).join())
  // 증손 — b1 에 자식 둘: B 의 범위가 다시 커져(130 + 18 + 56) 형제들이 더 벌어지고, 열이 위로 넘치면 0 에서 시작한다(뿌리는 그대로)
  const bb1 = add(p.id, b1.id, 'right'), bb2 = add(p.id, bb1.id, 'sibling')
  check(overlaps(cur()) === 0 && (at(bb1.id).y + at(bb2.id).y + 56) / 2 === at(b1.id).y + 28, '증손 둘 — 겹침 없음 · b1 가운데에', J([at(b1.id).y, at(bb1.id).y, at(bb2.id).y]))
  check(at(A.id).y === 0 && at(c1.id).y - (at(b2.id).y + 56) === GAP_STACK && at(R.id).y === 240, '열이 위로 넘쳐 0 에서 시작 · B · C 의 자식 열 사이는 여전히 한 칸 · 뿌리 제자리', J([at(A.id).y, at(B.id).y, at(C.id).y, at(D.id).y]))
  // 열 밖 상자가 새 자리를 막으면 — 줄기 전체 다시 세우기를 포기하고 고른 열만(3차 arrangeColumn) · 그래도 겹침은 없다
  S().updateEl(p.id, E.id, { x: at(bb1.id).x + 4, y: 0 })
  const pos0 = posOf(cur(), new Set([A.id, B.id, C.id, D.id].map((k) => k.id)))
  add(p.id, bb2.id, 'sibling')
  check(overlaps(cur()) === 0 && posOf(cur(), new Set([A.id, B.id, C.id, D.id].map((k) => k.id))) === pos0, '장애물(옮긴 E)이 막으면 줄기는 그대로 두고 겹침만 피한다', J(cur().els.map((e) => [e.text, e.x, e.y])))
}

// ── 5. 소스 — 다시 앉히는 길이 스토어에 없다 ─────────────────────────────
{
  const st = bare(readFileSync('./src/state/store.ts', 'utf8'))
  check(!/seatTree/.test(st), '`seatTree` 가 없다')
  check((st.match(/const laid = layoutTree\(/g) || []).length === 1 && (st.match(/claimIds\(laid\.els\)/g) || []).length === 1, '앉히는 곳은 처음 펼칠 때(addCard) 한 곳뿐')
  const i = st.indexOf('treeFold: (pageId, elId)')
  check(i > 0 && !/layoutTree|seatTree/.test(st.slice(i, i + 900)), '접기는 숨김 표시만 바꾼다')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
