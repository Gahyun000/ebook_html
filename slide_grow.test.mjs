// **창 전체가 슬라이드다 — 넘치면 슬라이드가 늘어나고, 이북에는 줄여 담는다.**
//
// 사용자(2026-10-06): 「뒤에 바탕이 흰색으로 바뀌었을 뿐이지 안에 테두리 있는 슬라이드는 아직 도형이 벗어나는데,
// 뒤에 바탕 없이 전체 슬라이드로 보이게 하면 문제 해결되는 거 아님?」
// 결정: 테두리 없음 · 기준 크기를 넘으면 슬라이드가 **같은 비율로** 커지고(편집에서는 스크롤) · 이북 · PDF · 발표 · 쪽 목록 · PPTX 에는
//       그 슬라이드를 통째로 줄여 한 장에 담는다(잘리는 것 없음).
//
// 좌표계는 그대로다. 「얼마나 늘어났나(k)」 는 도형 좌표에서 그때그때 계산하고(저장 안 함), 줄이는 것은 **그릴 때**만 한다.
// 숫자 규칙은 workArea.growOf, 그리는 자리는 cards/PageWithCanvas 한 곳이다. 화면은 스모크 13단계가 본다.
//
// 실행: node --experimental-strip-types --import ./ts_register.mjs slide_grow.test.mjs
import { readFileSync } from 'node:fs'

let pass = 0, fail = 0
const check = (c, label, extra = '') => {
  if (c) { pass++; return }
  fail++; console.log('  X ' + label + (extra ? '  — ' + extra : ''))
}
const bare = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const A = await import('./src/builder/workArea.ts')

const W = 640, H = 482
const box = (x, y, w = 120, h = 56, more = {}) => ({ x, y, w, h, ...more })
const near = (a, b) => Math.abs(a - b) < 1e-9

// ── ① 얼마나 늘어나나 ───────────────────────────────────
{
  check(A.growOf([box(100, 100)], [], W, H) === 1, '기준 크기 안에만 있으면 그대로(1)')
  check(A.growOf([], undefined, W, H) === 1 && A.growOf(undefined, undefined, W, H) === 1, '도형이 없어도 1')
  check(A.growOf([box(520, 100)], [], W, H) === 1, '오른쪽 끝에 딱 닿은 것(520+120=640)은 넘친 게 아니다')
  const kr = A.growOf([box(100, 100), box(640, 215)], [], W, H)                 // 영상의 그림 — 오른쪽 끝 760
  check(near(kr, (760 + A.GROW_PAD) / W), '오른쪽으로 넘치면 그 끝(+여백)까지 — 폭 기준', String(kr))
  const kb = A.growOf([box(100, 500)], [], W, H)
  check(near(kb, (556 + A.GROW_PAD) / H), '아래로 넘치면 높이 기준', String(kb))
  const kk = A.growOf([box(640, 215), box(100, 900)], [], W, H)
  check(near(kk, Math.max((760 + A.GROW_PAD) / W, (956 + A.GROW_PAD) / H)), '둘 다 넘치면 **더 많이 넘친 쪽** — 비율을 지켜 한 배율로', String(kk))
  check(A.growOf([box(2000, 100, 120, 56, { hidden: true })], [], W, H) === 1, '접혀서 안 보이는 상자는 안 센다')
  check(near(A.growOf([box(2000, 100, 120, 56, { hidden: true })], [], W, H, true), (2120 + A.GROW_PAD) / W), '내보낼 때(all)는 숨은 상자도 센다 — 접힌 가지를 펴서 그리므로')
  check(A.growOf([box(-300, -200)], [], W, H) === 1, '왼쪽 · 위쪽으로 나간 것은 슬라이드를 키우지 않는다')
  const ks = A.growOf([], [{ points: [[10, 10], [900, 40]], color: '#000', w: 4 }], W, H)
  check(near(ks, (902 + A.GROW_PAD) / W), '펜으로 그은 선도 센다(굵기 절반 포함)', String(ks))
  // 늘어난 슬라이드 kW×kH 안에 전부 들어온다 → 1/k 로 줄이면 W×H 안이다.
  for (const els of [[box(640, 215)], [box(100, 900)], [box(1500, 1300, 200, 90)]]) {
    const k = A.growOf(els, [], W, H)
    check(els.every((e) => (e.x + e.w) / k <= W && (e.y + e.h) / k <= H), '1/k 로 줄이면 **전부 한 장 안**에 들어온다', JSON.stringify([els[0], k]))
  }
}

// ── ② 왼쪽 · 위쪽으로 나간 것 세기(여전히 잘린다 — 안내용) ───────────
{
  check(A.strayCount([box(-10, 50), box(50, -3), box(700, 50), box(10, 10)]) === 2, '왼쪽 · 위쪽으로 나간 것만 센다(오른쪽 · 아래는 슬라이드가 늘어나 담긴다)')
  check(A.strayCount([box(-10, 50, 120, 56, { hidden: true })]) === 0 && A.strayCount(undefined) === 0, '숨은 것 · 빈 쪽은 0')
}

// ── ③ 그리는 자리는 한 곳 ─────────────────────────────────
{
  const pw = bare(readFileSync('./src/cards/PageWithCanvas.tsx', 'utf8'))
  check(/growOf\(page\.els, page\.strokes, W, H, true\)/.test(pw), 'PageWithCanvas 가 쪽마다 k 를 계산한다(편집 아님 — 접힌 가지도 펴서 내보내므로 숨은 상자까지)')
  check(/scale\(\$\{1 \/ k\}\)/.test(pw), '편집 아님(쪽 목록 · 내보내기 · 발표)에서는 도형 층을 **1/k 로 줄여** 담는다')
  check(/scale\(\$\{k\}\)/.test(pw), '편집에서는 카드 바탕을 k 배로 깐다 — 편집 그림 × 1/k = 이북 그림')
  check(/if \(k === 1 && !interactive\)/.test(pw), '**안 넘친 쪽(k=1)은 예전 DOM 그대로** 그린다')
  check(/W=\{W \* k\} H=\{H \* k\}/.test(pw), '도형 층은 늘어난 크기(kW×kH)를 받는다')
  const pv = bare(readFileSync('./src/builder/Preview.tsx', 'utf8'))
  check(/grow=\{k\}/.test(pv) && /growOf\(/.test(pv), 'Preview 가 k 를 정해 넘긴다')
  check(/downRef\.current \? Math\.max\(/.test(pv), '**누르고 있는 동안에는 k 를 줄이지 않는다**(끄는 중 좌표 보호)')
  check(/줄여 담김/.test(pv) && !/이북에 안 담김/.test(pv), '안내가 「줄여 담김」 으로 바뀌었다(「이북에 안 담김」 없음)')
  const css = bare(readFileSync('./src/builder/chrome.css', 'utf8'))
  check(!/\.pv-paper\{[^}]*outline/.test(css), '종이 테두리 선이 없다')
  const idx = bare(readFileSync('./src/index.css', 'utf8'))
  check(/\.freeconn\{[^}]*overflow:visible/.test(idx), '선은 어디서든 층 밖으로 안 잘린다(늘어난 층)')
  const px = bare(readFileSync('./src/export/exportPptx.ts', 'utf8'))
  check(/growOf\(p\.els, p\.strokes, opts\.W, opts\.H, true\)/.test(px) && /sx \/ k/.test(px), 'PPTX 도 같은 k 로 줄여 담는다')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
