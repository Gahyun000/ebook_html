// **손으로 놓은 상자에서도 가지를 붙인다 — 붙일 때마다 종이 안에 다시 앉는다.**
//
// 사용자 요청(2026-10-06 · 화면 기록 오후 3.38.49): 가로 덱에서 상자 둘을 잇고 하나 더 붙이자 새 상자가 종이(폭 640) 밖
// x=693 에 생겼다. 알마인드처럼 키로 붙이면 **가지 전체를 겹치지 않게, 종이 안에** 다시 앉힌다.
// 결정: 「선으로 이어진 상자 전부」 가 대상 — 트리 카드가 아닌 일반 쪽에서도 듣는다.
//
// 이 검사는 화면 없이 **스토어를 노드에서 직접 돌린다**(tree_ids.test.mjs 와 같은 방식).
//
// 실행: node --experimental-strip-types --import ./ts_register.mjs tree_keys.test.mjs
const { useBuilder, nextElId } = await import('./src/state/store.ts')
const { mkFreeEl } = await import('./src/canvas/model.ts')
const { isTreePage, treeShape, knownOf } = await import('./src/cards/treeOps.ts')

let pass = 0, fail = 0
const check = (c, label, extra = '') => {
  if (c) { pass++; return }
  fail++; console.log('  X ' + label + (extra ? '  — ' + extra : ''))
}
const S = () => useBuilder.getState()
const cur = () => S().pages.find((p) => p.id === S().selectedPageId)
const W = 640, H = 482
const unique = (p) => new Set(p.els.map((e) => e.id)).size === p.els.length
const inPaper = (p) => p.els.filter((e) => !e.hidden).every((e) => e.x >= 0 && e.y >= 0 && e.x + e.w <= W && e.y + e.h <= H)
function overlaps(p) {
  const shown = p.els.filter((e) => !e.hidden)
  let n = 0
  for (let i = 0; i < shown.length; i++) for (let j = i + 1; j < shown.length; j++) {
    const a = shown[i], b = shown[j]
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) n++
  }
  return n
}
const shapeOf = (p) => treeShape(p.els, p.conns, knownOf(p))
const fresh = () => p0.els.filter((e) => !e.echoOf).map((e) => e.id)
let p0

S().setOrientation('landscape')

/** 영상의 그림 — 빈 쪽에 상자 둘을 놓고 잇는다. 둘째는 종이 오른쪽 끝에 걸쳐 있다. 선 없는 메모 하나도 둔다. */
function video() {
  S().addCard('slide')
  const p = cur()
  const a = mkFreeEl('box', 380, 213), b = mkFreeEl('box', 540, 213), memo = mkFreeEl('box', 40, 400)
  a.text = '가'; b.text = '나'; memo.text = '메모'
  S().addEl(p.id, a); S().addEl(p.id, b); S().addEl(p.id, memo)
  S().addConn(p.id, { from: a.id, to: b.id })
  return { a, b, memo }
}

// ── 1. 일반 쪽에서 자식 붙이기 ─────────────────────────────
{
  const { a, b, memo } = video()
  let p = cur()
  check(!isTreePage(p), '(준비) 손으로 놓은 쪽은 아직 트리 쪽이 아니다')
  const before = new Set(p.els.map((e) => e.id))
  S().treeAdd(p.id, b.id, 'child')
  p = cur()
  const kid = p.els.find((e) => !before.has(e.id) && e.echoOf == null)
  check(!!kid && p.conns.some((c) => c.to === kid.id), '새 상자가 생기고 **선으로 이어진다**', kid ? String(kid.id) : '없음')
  check(shapeOf(p).parent.get(kid.id) === b.id, '고른 상자(나)의 자식이다')
  // 2026-10-07 고침: 처음에는 「전부 종이 안」 이었다(종이 안에 접어 앉힘). 사용자 결정으로 **뿌리는 제자리, 가지는 옆으로 뻗고**
  // 넘치면 슬라이드가 늘어난다(이북에는 줄여 담김).
  const a1 = p.els.find((e) => e.id === a.id)
  check(a1.x === 380 && a1.y === 213, '**뿌리(가)는 놓아 둔 자리 그대로다**', `${a1.x},${a1.y}`)
  check(p.els.find((e) => e.id === b.id).x > a1.x && kid.x > p.els.find((e) => e.id === b.id).x, '가지는 뿌리에서 오른쪽으로 뻗는다', JSON.stringify(p.els.map((e) => [e.text, e.x, e.y])))
  check(overlaps(p) === 0, '겹친 상자가 없다', String(overlaps(p)))
  check(unique(p), '번호가 모두 다르다')
  const m = p.els.find((e) => e.id === memo.id)
  check(m.x === 40 && m.y === 400, '**선 없는 도형은 건드리지 않는다**', `${m.x},${m.y}`)
  check(isTreePage(p), '이 쪽은 이제 트리 쪽이다(접기 손잡이 · 패널 단추가 따라 나온다)', JSON.stringify(p.treeRoots))
  check((p.treeRoots || []).includes(a.id), '뿌리 명단에 맨 위 상자(가)가 적혔다', JSON.stringify(p.treeRoots))
  const n = nextElId(); check(p.els.every((e) => e.id < n), '번호표가 쓴 번호 위에 있다')
}

// ── 2. 선이 하나도 없는 외톨이 상자에서 시작 ──────────────────
{
  S().addCard('slide')
  let p = cur()
  const solo = mkFreeEl('box', 300, 200); solo.text = '혼자'
  S().addEl(p.id, solo)
  S().treeAdd(p.id, solo.id, 'child')
  p = cur()
  const sh = shapeOf(p)
  check(sh.members.includes(solo.id) && (sh.kids.get(solo.id) || []).length === 1, '외톨이 상자에 자식이 붙는다')
  check(isTreePage(p) && inPaper(p) && overlaps(p) === 0, '트리 쪽이 되고 · 종이 안 · 겹침 없음')

  // 외톨이에서 「형제」 — 부모가 없으니 또 하나의 뿌리다. 고른 상자도 트리에 남아야 한다.
  S().addCard('slide')
  p = cur()
  const one = mkFreeEl('box', 300, 200); one.text = '하나'
  S().addEl(p.id, one)
  S().treeAdd(p.id, one.id, 'sibling')
  p = cur()
  const sh2 = shapeOf(p)
  check(sh2.roots.length === 2 && sh2.roots.includes(one.id), '외톨이의 형제 = 새 뿌리 · **고른 상자도 뿌리로 남는다**', JSON.stringify(sh2.roots))
  check(overlaps(p) === 0 && inPaper(p), '둘이 포개지지 않는다', JSON.stringify(p.els.map((e) => [e.x, e.y])))
}

// ── 3. 앞 형제(Shift+Enter) — 고른 것 바로 **위**에 ─────────────
{
  const { a, b } = video()
  let p = cur()
  S().treeAdd(p.id, b.id, 'sibling')                 // 가 ─ 나 · 뒤
  p = cur()
  const ids0 = new Set(p.els.map((e) => e.id))
  S().treeAdd(p.id, b.id, 'before')                  // 가 ─ 앞 · 나 · 뒤
  p = cur()
  const front = p.els.find((e) => !ids0.has(e.id) && e.echoOf == null)
  const kids = shapeOf(p).kids.get(a.id) || []
  check(kids.length === 3 && kids.indexOf(front.id) === kids.indexOf(b.id) - 1, '앞 형제는 고른 상자 **바로 앞**에 선다', JSON.stringify(kids))
  check(kids.indexOf(b.id) === 1, '뒤 형제(Enter)는 고른 상자 바로 뒤에 그대로', JSON.stringify(kids))
  check(overlaps(p) === 0 && unique(p), '겹침 없음 · 번호 유일')
}

// ── 4. 가지째 지우기 ────────────────────────────────────
{
  const { a, b, memo } = video()
  let p = cur()
  S().treeAdd(p.id, b.id, 'child'); S().treeAdd(cur().id, b.id, 'child')
  p = cur()
  const n0 = p.els.length
  S().treeRemove(p.id, b.id)
  p = cur()
  check(!p.els.some((e) => e.id === b.id), '고른 상자가 지워진다')
  check(p.els.length === n0 - 3, '**그 아래 가지까지** 지워진다(나 + 자식 둘)', `${n0} → ${p.els.length}`)
  const live = new Set(p.els.map((e) => e.id))
  check(p.conns.every((c) => live.has(c.from) && live.has(c.to)), '끊긴 선이 남지 않는다', JSON.stringify(p.conns))
  check(p.els.some((e) => e.id === a.id) && p.els.some((e) => e.id === memo.id), '부모(가)와 선 없는 메모는 남는다')
  const sh = shapeOf(p)
  check(sh.roots.length === 1 && sh.roots[0] === a.id, '외톨이 뿌리가 새로 생기지 않는다', JSON.stringify(sh.roots))
}

// ── 5. 깊은 가지 — **접지 않고 계속 뻗는다** ───────────────────────
//    (2026-10-07 고침: 처음에는 「종이 밖으로 안 나간다 — 아래 띠로 접어 앉힌다」 였다. 사용자: 「자식이 두개까지만 생기고 그 이후엔
//     새로운 트리가 생김. 슬라이드를 넓게 한 이유가 계속 가지 뻗어나갈려고 한건데」 — 넷째 단부터 흐린 상자와 함께 아래로 접히던 것이다.)
{
  const { a, b } = video()
  let tip = b.id
  for (let i = 0; i < 6; i++) {
    const had = new Set(cur().els.map((e) => e.id))
    S().treeAdd(cur().id, tip, 'child')
    tip = cur().els.find((e) => !had.has(e.id) && e.echoOf == null).id
  }
  const p = cur()
  check(p.els.every((e) => e.echoOf == null), '여덟 단을 내려 붙여도 **흐린 상자(다시 놓은 부모)가 안 생긴다**', String(p.els.filter((e) => e.echoOf != null).length))
  const chain = p.els.filter((e) => e.text !== '메모')
  check(new Set(chain.map((e) => e.y)).size === 1, '한 줄로 **오른쪽으로 계속** 뻗는다(같은 높이)', JSON.stringify(chain.map((e) => [e.x, e.y])))
  check(chain.every((e, i) => i === 0 || e.x > chain[i - 1].x), '단마다 더 오른쪽이다')
  check(p.els.find((e) => e.id === a.id).x === 380, '뿌리는 제자리')
  check(overlaps({ els: chain }) === 0 && unique(p), '겹침 없음 · 번호 유일', String(overlaps({ els: chain })))
}

// ── 6. 손으로 놓은 상자는 크기가 제각각이다 — **크기는 그대로 두고 간격을 상자에 맞춘다** ────────
//    (2026-10-07 고침: 처음에는 편입할 때 트리 상자 크기(132×38)로 맞췄다. 사용자: 「도형이 바뀐다」.)
{
  S().addCard('slide')
  let p = cur()
  const big = mkFreeEl('box', 100, 100), tall = mkFreeEl('box', 300, 100), memo = mkFreeEl('box', 40, 400)
  big.w = 200; big.h = 120; tall.h = 130; memo.w = 220; memo.h = 70
  S().addEl(p.id, big); S().addEl(p.id, tall); S().addEl(p.id, memo)
  S().addConn(p.id, { from: big.id, to: tall.id })
  S().treeAdd(p.id, big.id, 'child')
  p = cur()
  const tree = p.els.filter((e) => e.id !== memo.id)
  const gap = () => { const v = tree.slice().sort((x, y) => x.y - y.y); let g = Infinity
    for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) if (v[i].x < v[j].x + v[j].w && v[j].x < v[i].x + v[i].w) g = Math.min(g, v[j].y - (v[i].y + v[i].h))
    return g }
  const B = p.els.find((e) => e.id === big.id), T = p.els.find((e) => e.id === tall.id)
  check(B.w === 200 && B.h === 120 && T.w === 120 && T.h === 130, '**상자 크기가 그대로다**', `${B.w}×${B.h} · ${T.w}×${T.h}`)
  check(overlaps({ els: tree }) === 0, '큰 상자끼리도 겹치지 않는다', String(overlaps({ els: tree })))
  check(gap() >= 8, '아래위 상자 사이에 **틈이 있다**', String(gap()))
  check(T.x >= B.x + B.w + 20, '부모와 자식 사이에 선이 지나갈 틈이 있다', `${B.x}+${B.w} → ${T.x}`)
  const m = p.els.find((e) => e.id === memo.id)
  check(m.w === 220 && m.h === 70 && m.x === 40 && m.y === 400, '선 없는 도형은 자리 · 크기 그대로', `${m.x},${m.y} ${m.w}×${m.h}`)
}

// ── 8. 화면 기록(2026-10-07 오전 10.57.49) — 제자리에서 시작 · 모양 그대로 ─────────────
{
  S().addCard('slide')
  let p = cur()
  const r = mkFreeEl('round', 300, 200); r.text = '내용'; r.color = '#ffe9a8'
  S().addEl(p.id, r)
  S().treeAdd(p.id, r.id, 'child')
  p = cur()
  const R = p.els.find((e) => e.id === r.id), K = p.els.find((e) => e.id !== r.id)
  check(R.x === 300 && R.y === 200, '**고른 상자가 제자리에 있다** — 왼쪽 위 격자로 끌려가지 않는다', `${R.x},${R.y}`)
  check(R.type === 'round' && R.w === r.w && R.h === r.h, '고른 상자의 모양 · 크기가 그대로다', `${R.type} ${R.w}×${R.h}`)
  check(K.type === 'round' && K.w === r.w && K.h === r.h && K.color === '#ffe9a8', '**새 상자가 고른 상자를 닮는다**(모양 · 크기 · 색)', `${K.type} ${K.w}×${K.h} ${K.color}`)
  check(K.x > R.x + R.w && K.y === R.y, '자식은 바로 오른쪽 같은 높이에', `${K.x},${K.y}`)

  // 영상 그대로: 왼쪽 위로 끌어다 둔(−85,21) 둥근 상자에서 Enter — 선 없는 또 하나의 뿌리가 **바로 아래**에.
  S().addCard('slide')
  p = cur()
  const v = mkFreeEl('round', -85, 21); v.text = '내용'
  S().addEl(p.id, v)
  S().treeAdd(p.id, v.id, 'sibling')
  p = cur()
  const V = p.els.find((e) => e.id === v.id), N = p.els.find((e) => e.id !== v.id)
  check(V.x === 8 && V.y === 21, '종이 왼쪽 밖에 있던 상자는 **여백 안으로만** 들어온다(높이는 그대로)', `${V.x},${V.y}`)
  check(V.type === 'round' && V.w === v.w && V.h === v.h, '모양 · 크기 그대로')
  check(N.x === V.x && N.y > V.y + V.h && N.y - (V.y + V.h) <= 40, '새 뿌리는 고른 상자 **바로 아래**에', `${N.x},${N.y}`)
  check(N.type === 'round' && N.w === v.w && p.conns.length === 0, '새 뿌리도 같은 모양 · 선 없음')

  // 자식이 여럿이면 뿌리를 가운데 두고 위아래로 펼친다 — 뿌리는 여전히 제자리.
  S().addCard('slide')
  p = cur()
  const c = mkFreeEl('box', 200, 220); S().addEl(p.id, c)
  let k = null
  for (let i = 0; i < 3; i++) { const had = new Set(cur().els.map((e) => e.id)); S().treeAdd(cur().id, i ? k : c.id, i ? 'sibling' : 'child'); k = cur().els.find((e) => !had.has(e.id)).id }
  p = cur()
  const C = p.els.find((e) => e.id === c.id), ks = p.els.filter((e) => e.id !== c.id).sort((x, y) => x.y - y.y)
  check(C.x === 200 && C.y === 220, '자식 셋을 붙여도 뿌리는 제자리', `${C.x},${C.y}`)
  check(ks[0].y < C.y && ks[2].y > C.y && ks[1].y === C.y, '자식은 뿌리 높이를 가운데로 위아래에 선다', JSON.stringify(ks.map((e) => e.y)))
}

// ── 7. 화면 기록(2026-10-06 오후 5.10.16) — 자식 다섯 + 손자, 거기서 한 단 더 ──────────
//    가로 종이는 세 단까지다. 넷째 단은 「아래 띠」 로 접혀 흐린 부모(echo)와 함께 놓이는데, 위 띠가 다섯 줄이라
//    아래 띠가 **위 띠와 포개졌다**(겹친 쌍 2~3 · 영상의 뒤엉킨 모습). 이제 슬라이드가 늘어나므로, 종이에 안 들어가면
//    포개지 않고 **더 큰 슬라이드에 앉힌다**(이북에는 줄여 담김 — slide_grow.test.mjs).
{
  S().addCard('slide')
  let p = cur()
  const root = mkFreeEl('box', 100, 200); S().addEl(p.id, root)
  const add = (id, kind) => { const had = new Set(cur().els.map((e) => e.id)); S().treeAdd(cur().id, id, kind); return cur().els.find((e) => !had.has(e.id) && e.echoOf == null).id }
  let k = add(root.id, 'child'); const first = k
  for (let i = 2; i <= 5; i++) k = add(k, 'sibling')
  const grand = add(first, 'child')
  check(overlaps(cur()) === 0 && inPaper(cur()), '(준비) 자식 다섯 + 손자 — 종이 안 · 겹침 없음')
  let d = add(grand, 'child')                         // 영상: 손자를 고르고 Space
  check(overlaps(cur()) === 0, '**넷째 단을 붙여도 포개지지 않는다**', `겹친 쌍 ${overlaps(cur())} · ${JSON.stringify(cur().els.map((e) => [e.echoOf != null ? 'E' : '', e.x, e.y]))}`)
  d = add(d, 'sibling'); d = add(d, 'sibling')
  check(overlaps(cur()) === 0 && unique(cur()), '거기에 형제를 더 붙여도 겹침 없음 · 번호 유일', String(overlaps(cur())))
  const sh = shapeOf(cur())
  check(sh.parent.get(d) === grand && sh.depth.get(d) === 3, '관계는 그대로다(손자의 자식 · 넷째 단)')
  // 형제를 아주 많이 — 한 줄에 다 못 서면 슬라이드가 아래로 늘어난다.
  for (let i = 0; i < 12; i++) k = add(k, 'sibling')
  check(overlaps(cur()) === 0, '형제 열일곱 — 겹침 없음', String(overlaps(cur())))
  // 가지를 지워도 뿌리는 **지금 있는 자리**에 남는다(2026-10-07 고침: 전에는 「다시 종이 안으로」 였다 — 이제 트리는 뿌리를 따라 앉는다.
  // 형제가 많아 위로 넘칠 때 뿌리가 아래로 밀려 내려간 자리이고, 지운다고 도로 튀어 오르지 않는다).
  const rootAt = () => { const e = cur().els.find((x) => x.id === root.id); return e.x + ',' + e.y }
  const before = rootAt()
  S().treeRemove(cur().id, first)
  for (const e of cur().els.filter((x) => x.echoOf == null && x.id !== root.id).slice(3)) S().treeRemove(cur().id, e.id)
  check(overlaps(cur()) === 0 && rootAt() === before, '가지를 지워 줄여도 겹침 없음 · 뿌리가 튀지 않는다', `${before} → ${rootAt()}`)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
