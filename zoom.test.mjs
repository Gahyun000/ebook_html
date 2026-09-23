// **화면 배율 — 사람이 바꾸고, 100% 를 넘을 수 있다.**
//
// 사용자 요청(스크린샷 ①): 「화면 사이즈 확대/축소 — 세로 작업공간이 너무 좁음」.
// EVER-SKETCH1 1363964 의 배율 부분만 옮긴다(방향 기억 rememberOrientation 은 뺀다 —
// 그래서 원본 prefs.test.mjs 는 전부 방향 검사라 옮길 것이 없다).
//
// 원인은 한 줄이었다.
//     setScale(Math.min(1, avW / W, avH / H))
// 세로 이북(432×576)은 넓은 창에서 줄일 것이 없으니 작은 종이만 뜨고 나머지는 회색이었다.
//
// 원본은 계산을 Preview 안에 두었다. 여기서는 **숫자 규칙만** src/builder/zoom.ts 로 떼어
// 노드에서 직접 검증한다(화면 동작은 e2e/sketch_port_smoke.mjs 2단계가 본다).
// 그리고 FreeLayer 가 마우스 좌표를 배율로 나누는지(b721df0 zoomOf)를 소스에서 확인한다.
//
// 실행: node --experimental-strip-types --import ./ts_register.mjs zoom.test.mjs
import { readFileSync } from 'node:fs'

let pass = 0, fail = 0
const check = (cond, label, extra = '') => {
  if (cond) { pass++; console.log('✓ ' + label) }
  else { fail++; console.log('✗ ' + label + (extra ? '  — ' + extra : '')) }
}
const bare = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/^\s*\/\/.*$/gm, '')

const Z = await import('./src/builder/zoom.ts')

// ── ① 맞춤 배율에 100% 상한이 없다 ────────────────────
{
  // 세로 이북 432×576 을 넓은 작업창(1000×1400, 패딩 뺀 값)에 맞춘다.
  const s = Z.fitScale(1000, 1400, 432, 576)
  check(s > 1, '**넓은 창에서 맞춤 배율이 100% 를 넘는다** (상한이 풀렸다)', String(s))
  check(Math.abs(s - Math.min(1000 / 432, 1400 / 576)) < 1e-9, '가로·세로 중 빡빡한 쪽에 맞춘다')
  const t = Z.fitScale(300, 900, 432, 576)
  check(t < 1 && Math.abs(t - 300 / 432) < 1e-9, '좁은 창에서는 줄인다')
  check(Z.fitScale(0, 500, 432, 576) === null && Z.fitScale(500, -3, 432, 576) === null,
    '잴 수 없는 크기(0·음수)면 null — 배율을 0 으로 만들지 않는다')
}

// ── ② 한 걸음 · 한계 ─────────────────────────────
{
  check(Z.ZSTEP === 1.25, '한 걸음은 1.25배')
  check(Math.abs(Z.stepZoom(1, 'in') - 1.25) < 1e-9, '+ 한 번 = 125%')
  check(Math.abs(Z.stepZoom(1, 'out') - 0.8) < 1e-9, '− 한 번 = 80%')
  check(Math.abs(Z.stepZoom(Z.stepZoom(1.3, 'in'), 'out') - 1.3) < 1e-9, '+ 뒤 − 는 제자리')
  check(Z.stepZoom(3.9, 'in') === Z.ZMAX, `아무리 키워도 ${Z.ZMAX * 100}% 에서 멈춘다`)
  check(Z.stepZoom(0.26, 'out') === Z.ZMIN, `아무리 줄여도 ${Z.ZMIN * 100}% 에서 멈춘다`)
  check(Z.clampZoom(NaN) === 1, '이상한 값(NaN)은 100% 로')
}

// ── ③ 단축키 ⌘/Ctrl + = − 0 ──────────────────────
{
  const ev = (key, o = {}) => ({ key, metaKey: false, ctrlKey: false, target: null, ...o })
  check(Z.zoomKey(ev('=', { metaKey: true })) === 'in', '⌘= 확대')
  check(Z.zoomKey(ev('+', { ctrlKey: true })) === 'in', 'Ctrl+ 확대')
  check(Z.zoomKey(ev('-', { metaKey: true })) === 'out' && Z.zoomKey(ev('_', { ctrlKey: true })) === 'out', '⌘− 축소')
  check(Z.zoomKey(ev('0', { ctrlKey: true })) === 'fit', '⌘0 맞춤')
  check(Z.zoomKey(ev('=')) === null, '⌘/Ctrl 없이 = 는 배율이 아니다(글자)')
  check(Z.zoomKey(ev('z', { metaKey: true })) === null, '다른 단축키는 건드리지 않는다')
  // 글자를 치는 중이면 가로채지 않는다 — 표 칸에 '0' 을 쓰다가 배율이 튀면 안 된다.
  const typing = [{ tagName: 'INPUT', isContentEditable: false }, { tagName: 'TEXTAREA', isContentEditable: false },
    { tagName: 'DIV', isContentEditable: true }]
  check(typing.every((t) => Z.zoomKey(ev('0', { metaKey: true, target: t })) === null),
    '입력칸·글상자에서 치는 중에는 가로채지 않는다')
  check(Z.zoomKey(ev('=', { metaKey: true, target: { tagName: 'DIV', isContentEditable: false } })) === 'in',
    '평범한 자리에서는 받는다')
}

// ── ④ 화면이 이 규칙을 쓴다 ───────────────────────
{
  const pv = bare(readFileSync('./src/builder/Preview.tsx', 'utf8'))
  check(!/Math\.min\(1,/.test(pv), 'Preview 에 100% 상한(Math.min(1, …))이 남아 있지 않다')
  check(/fitScale\(/.test(pv) && /zoomKey\(/.test(pv) && /stepZoom\(/.test(pv), 'Preview 가 zoom.ts 규칙을 쓴다')
  check(/const scale = userZoom \?\? fitZ/.test(pv), '사람이 정한 배율과 맞춤 배율을 따로 둔다(사람 것이 이긴다)')
  check(/className="pv-zoom"/.test(pv) && /className=\{'fitb'/.test(pv), '상태막대에 − % + 맞춤 이 있다')
  check(/addEventListener\('wheel', onWheel, \{ passive: false \}\)/.test(pv),
    'Ctrl+휠은 네이티브로 붙인다(React onWheel 은 passive 라 브라우저가 페이지째 확대한다)')
  check(/K\('mod\+-'\)/.test(pv) && /K\('mod\+='\)/.test(pv) && /K\('mod\+0'\)/.test(pv) && !/⌘\/Ctrl/.test(pv),
    '툴팁 단축키는 그 사람 키보드 글자로(ui/keyLabel K(\'mod+…\')) — 「⌘/Ctrl」 섞어 쓰기 없음')
  check(/transform: `scale\(\$\{scale\}\)`/.test(pv), '종이는 CSS transform 으로 키운다 — 좌표계는 그대로')
}

// ── ⑤ FreeLayer 는 마우스 좌표를 배율로 나눈다 (b721df0 zoomOf) ─────
{
  const fl = bare(readFileSync('./src/canvas/FreeLayer.tsx', 'utf8'))
  check(/const zoomOf = \(r: \{ width: number \}\) => \(r\.width > 0 \? r\.width \/ W : 1\)/.test(fl),
    'zoomOf: 그려진 폭 ÷ 논리 폭 = 지금 배율')
  check(/const layerZoom = \(from: Element\)/.test(fl), 'layerZoom: 요소에서 레이어 배율을 되읽는다')
  const raw = (fl.match(/clientX - rect\.left(?!\) \/ z)/g) || []).length
  check(raw === 0, '**나누지 않은 좌표(clientX - rect.left)가 없다** — 있으면 확대 중에 커서와 어긋난다', raw + '곳')
  const rawDelta = (fl.match(/const dx = ev\.clientX - sx0?, dy/g) || []).length
  check(rawDelta === 0, '끌기 이동량도 배율로 나눈다', rawDelta + '곳')
}

// ── ⑥ 카드 칸 떼어내기(PageView)도 배율로 나눈다 ─────────
{
  const pvw = bare(readFileSync('./src/cards/PageView.tsx', 'utf8'))
  check(!/startX \+ \(ev\.clientX - sx\)(?! \/ z)/.test(pvw) && /startX \+ \(ev\.clientX - sx\) \/ z/.test(pvw),
    '카드 칸을 떼어 끌 때도 화면 픽셀을 그대로 더하지 않는다(확대 중에 커서보다 빨리 달아난다)')
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
