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
  check(inPaper(p), '**전부 종이 안에 있다** — 영상처럼 종이 밖(x=693)에 생기지 않는다', JSON.stringify(p.els.map((e) => [e.text, e.x, e.y])))
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
  check(overlaps(p) === 0 && inPaper(p) && unique(p), '겹침 없음 · 종이 안 · 번호 유일')
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

// ── 5. 접힌 가지 · 깊은 가지 — 많이 붙여도 종이 안 ────────────────
{
  const { b } = video()
  let p = cur()
  let tip = b.id
  for (let i = 0; i < 6; i++) {
    const had = new Set(cur().els.map((e) => e.id))
    S().treeAdd(cur().id, tip, 'child')
    tip = cur().els.find((e) => !had.has(e.id) && e.echoOf == null).id
  }
  p = cur()
  check(inPaper(p), '여섯 단을 내려 붙여도 **종이 밖으로 나가지 않는다**(아래 띠로 접어 앉힌다)',
    JSON.stringify(p.els.filter((e) => e.x + e.w > W || e.y + e.h > H).map((e) => [e.x, e.y])))
  check(overlaps(p) === 0 && unique(p), '겹침 없음 · 번호 유일', String(overlaps(p)))
}

// ── 6. 손으로 놓은 상자는 크기가 제각각이다 — 편입할 때 트리 상자 크기로 맞춘다 ────────
//    줄 간격(56)은 트리 상자 높이(38)에 맞춘 값이라, 큰 상자를 그대로 두면 아래 줄과 붙거나 겹친다(화면 대조에서 발견).
{
  S().addCard('slide')
  let p = cur()
  const big = mkFreeEl('box', 100, 100), tall = mkFreeEl('box', 300, 100), memo = mkFreeEl('box', 40, 400)
  big.w = 200; big.h = 120; tall.h = 130; memo.w = 220; memo.h = 70
  S().addEl(p.id, big); S().addEl(p.id, tall); S().addEl(p.id, memo)
  S().addConn(p.id, { from: big.id, to: tall.id })
  S().treeAdd(p.id, big.id, 'child')
  p = cur()
  const gap = () => { const v = p.els.filter((e) => e.id !== memo.id && !e.hidden).sort((x, y) => x.y - y.y); let g = Infinity
    for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) if (v[i].x < v[j].x + v[j].w && v[j].x < v[i].x + v[i].w) g = Math.min(g, v[j].y - (v[i].y + v[i].h))
    return g }
  check(overlaps(p) === 0 && inPaper(p), '큰 상자에서 시작해도 겹치지 않고 종이 안이다', String(overlaps(p)))
  check(gap() >= 8, '아래위 상자 사이에 **틈이 있다**(붙어 앉지 않는다)', String(gap()))
  const m = p.els.find((e) => e.id === memo.id)
  check(m.w === 220 && m.h === 70, '선 없는 도형은 크기도 그대로', `${m.w}×${m.h}`)
  // 이미 트리인 쪽에서는 크기를 다시 건드리지 않는다(사람이 그 뒤에 키운 상자).
  const t = p.els.find((e) => e.id === tall.id)
  S().updateEl(p.id, tall.id, { w: t.w + 20 })
  S().treeAdd(p.id, big.id, 'child')
  check(cur().els.find((e) => e.id === tall.id).w === t.w + 20, '이미 트리인 쪽에서는 사람이 바꾼 크기를 되돌리지 않는다')
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
  // 다시 줄이면(가지째 지우기) 종이 안으로 돌아온다.
  S().treeRemove(cur().id, first)
  for (const e of cur().els.filter((x) => x.echoOf == null && x.id !== root.id).slice(3)) S().treeRemove(cur().id, e.id)
  check(overlaps(cur()) === 0 && inPaper(cur()), '가지를 지워 줄이면 다시 종이 안에 앉는다', JSON.stringify(cur().els.map((e) => [e.x, e.y])))
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
