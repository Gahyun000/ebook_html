// **연결선이 늘 같은 변에서 나간다** — 트리 부모→자식 선의 축 고정(2026-10-07 · EverSketch 불편점 5번).
//
// 사용자: 「하나의 도형에서 계속 스페이스바를 누를 시 처음에는 화살표가 옆에서 시작하다가 5~6개 이상 될때부터는
// 화살표가 위에서 출발하게 되는데」. 꺾은선(ortho)은 |dx| ≥ |dy| 로 가로·세로를 골랐다 — 자식이 여럿 쌓이면
// 먼 자식은 |dy| 가 커져 부모의 **위·아래 변**에서 나갔다. 트리 쪽의 부모→자식 선은 성장 방향(LR 오른쪽 · TD 아래쪽)의
// 변에서 나가도록 축(`axis`)을 받는다. 자식을 반대편으로 끌어 둔 경우는 예전 자동 — 선이 부모를 돌아 나오지 않게.
//
// 실행: node --experimental-strip-types --import ./ts_register.mjs conn_axis.test.mjs
import { readFileSync } from 'node:fs'
const { connPath, edgePoint } = await import('./src/canvas/connPath.ts')

let pass = 0, fail = 0
const check = (c, label, extra = '') => {
  if (c) { pass++; return }
  fail++; console.log('  X ' + label + (extra ? '  — ' + extra : ''))
}
const bare = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const box = (x, y, w = 120, h = 56) => ({ id: 0, type: 'box', x, y, w, h, text: '', color: '', fs: 12 })
const start = (d) => d.match(/^M (-?[\d.]+) (-?[\d.]+)/).slice(1).map(Number)
const end = (d) => d.match(/L (-?[\d.]+) (-?[\d.]+)$/).slice(1).map(Number)

// ── ① 왼→오른 — 부모 가운데에 자식 일곱(세로 74 간격 = seatTree 의 줄 간격) ──
{
  const parent = box(100, 100)
  const kids = Array.from({ length: 7 }, (_, i) => box(292, 100 + (i - 3) * 74))
  const auto = kids.map((k) => start(connPath(parent, k, { kind: 'ortho' })))
  check(auto.some((s) => s[0] !== 220), '(결함 기록) 축을 안 주면 먼 자식의 선이 옆이 아닌 위·아래 변에서 나간다', JSON.stringify(auto))
  const h = kids.map((k) => connPath(parent, k, { kind: 'ortho' }, 'h'))
  check(h.every((d) => { const s = start(d); return s[0] === 220 && s[1] === 128 }), "'h' 면 **일곱 선 모두 부모의 오른쪽 가운데**(220,128)에서 나간다", JSON.stringify(h.map(start)))
  check(h.every((d, i) => { const e = end(d); return e[0] === kids[i].x && e[1] === kids[i].y + kids[i].h / 2 }), '끝은 자식의 왼쪽 가운데', JSON.stringify(h.map(end)))
  check(h.every((d) => d.split(' L ').length === 4), '꺾은선 세 토막(가로 · 세로 · 가로)은 그대로')
}
// ── ② 위→아래 — 자식들이 가로로 깔린다 ──
{
  const parent = box(100, 100)
  const kids = Array.from({ length: 5 }, (_, i) => box(100 + (i - 2) * 150, 250))
  const v = kids.map((k) => connPath(parent, k, { kind: 'ortho' }, 'v'))
  check(v.every((d) => { const s = start(d); return s[0] === 160 && s[1] === 156 }), "'v' 면 모두 부모의 **아래 가운데**(160,156)에서 나간다", JSON.stringify(v.map(start)))
  check(v.every((d, i) => { const e = end(d); return e[0] === kids[i].x + kids[i].w / 2 && e[1] === kids[i].y }), '끝은 자식의 위 가운데')
  const auto = kids.map((k) => start(connPath(parent, k, { kind: 'ortho' })))
  check(auto.some((s) => s[1] !== 156), '(결함 기록) 축 없이는 먼 자식이 옆 변에서 나간다', JSON.stringify(auto))
}
// ── ③ 축은 성장 방향에서만 — 반대편 · 겹친 자리는 예전 자동 ──
{
  const parent = box(100, 100)
  const below = box(100, 400)                       // 바로 아래(x 겹침) — 'h' 를 줘도 세로가 맞다
  check(JSON.stringify(start(connPath(parent, below, { kind: 'ortho' }, 'h'))) === JSON.stringify([160, 156]), "자식이 부모 아래에 겹쳐 있으면 'h' 를 무시한다(자동)")
  const left = box(-200, 300)
  check(connPath(parent, left, { kind: 'ortho' }, 'h') === connPath(parent, left, { kind: 'ortho' }), '부모 왼쪽으로 끌어 둔 자식은 축 없이 그린 것과 같다')
  const above = box(300, -300)
  check(connPath(parent, above, { kind: 'ortho' }, 'v') === connPath(parent, above, { kind: 'ortho' }), "부모 위로 끌어 둔 자식은 'v' 를 무시한다")
}
// ── ④ 축보다 센 것 — 손으로 꺾은 자리(bend) · 직선 · 곡선 ──
{
  const parent = box(100, 100), kid = box(292, -122)
  check(/ L 250 0 L /.test(connPath(parent, kid, { kind: 'ortho', bend: { x: 250, y: 0 } }, 'h')), '손으로 꺾은 자리(bend)는 축보다 세다')
  check(connPath(parent, kid, { kind: 'straight' }, 'h') === connPath(parent, kid, { kind: 'straight' }), '직선은 축을 모른다')
  check(connPath(parent, kid, { kind: 'curve' }, 'h') === connPath(parent, kid, { kind: 'curve' }), '곡선도 축을 모른다')
  check(connPath(parent, kid, undefined) === connPath(parent, kid, { kind: 'ortho' }), '종류를 안 적은 옛 선은 꺾은선이다(그대로)')
  const e = edgePoint(parent, 400, 128)
  check(e.x === 220 && e.y === 128, 'edgePoint 도 같은 모듈에서 온다')
}
// ── ⑤ 화면이 그 축을 **그리는 선과 누르는 선 둘 다**에 준다 ──
{
  const fl = bare(readFileSync('./src/canvas/FreeLayer.tsx', 'utf8'))
  check(/from '\.\/connPath'/.test(fl), 'FreeLayer 는 connPath 모듈을 쓴다')
  check(!/^function connPath\(/m.test(fl) && !/^function edgePoint\(/m.test(fl), '옛 복사본이 FreeLayer 안에 남아 있지 않다')
  const uses = (fl.match(/connPath\(a, b, c, axisOf\(c\)\)/g) || []).length
  check(uses === 2, '그리는 선(conns)과 누르는 선(hits)이 **같은 축**으로 그려진다', `${uses}군데`)
  check(/const tshapeAll = useMemo\(/.test(fl) && /interactive \? tshapeAll : null/.test(fl), '트리 모양은 interactive 와 무관하게 한 번 읽는다 — 내보내기에서도 같은 선')
  check(/page\.treeDir === 'TD' \? 'v' : 'h'/.test(fl), '축은 쪽의 트리 방향에서 온다')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
