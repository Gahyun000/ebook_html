// **작업면 — 회색 바탕 없이 창을 꽉 채우고, 종이 밖 도형은 그 창 안에서 굴려 본다.**
//
// 사용자 요청(2026-10-06 · 화면 기록 오후 3.38.49): 파란 ＋ 점으로 붙인 상자가 종이 밖에 생기자 회색 작업창이 통째로 구르고
// 종이가 옆으로 밀렸다. 가로 막대가 생기면 세로 막대까지 **따라** 생겼다 — 가로 막대가 높이 15px 를 먹는데 종이는 바깥
// 높이에 꼭 맞춰져 있었기 때문이다.
//
// 풀이: 막대가 설지 말지를 **화면에서 되재지 않고 자료(도형 좌표)에서** 정한다. 막대 두께만큼의 자리를 늘 빼고 맞추므로
// 종이 밖 도형이 생기거나 사라져도 배율 · 종이 자리가 바뀌지 않고, 한 축의 막대가 다른 축을 넘치게 하지 않는다.
// 숫자 규칙은 src/builder/workArea.ts 에 떼어 노드에서 직접 검증한다(화면 동작은 스모크 13단계).
//
// 실행: node --experimental-strip-types --import ./ts_register.mjs work_area.test.mjs
import { readFileSync } from 'node:fs'

let pass = 0, fail = 0
const check = (cond, label, extra = '') => {
  if (cond) { pass++; return }
  fail++; console.log('  X ' + label + (extra ? '  — ' + extra : ''))
}
const bare = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const A = await import('./src/builder/workArea.ts')
const Z = await import('./src/builder/zoom.ts')

const W = 640, H = 482                       // 가로 덱
const box = (x, y, w = 120, h = 56, more = {}) => ({ id: 1, type: 'box', x, y, w, h, text: '', color: '', fs: 13, ...more })
const VIEW = { w: 900, h: 620 }
/** 그 창에서의 맞춤 배율 — Preview 와 같은 식. **기준 크기**로 잰다(늘어난 크기가 아니라). */
const fitOf = (sb) => { const a = A.fitAvail(VIEW.w, VIEW.h, sb); return Z.fitScale(a.w, a.h, W, H) }
const lay = (els, sb, scale = fitOf(sb)) => A.layout(VIEW.w, VIEW.h, sb, W, H, scale, A.growOf(els, [], W, H))

// ── ①② 넘치면 슬라이드가 늘어난다 — 종이 자리 · 배율은 그대로 ────────────
//    (2026-10-06 고침: 처음에는 「종이 밖」 을 따로 두고 넘친 축에만 막대를 세웠다. 사용자 결정으로 **슬라이드 자체가
//     비율을 지켜 늘어나므로**, 넘치면 가로 · 세로가 같이 굴러간다. 늘어난 배율 규칙은 slide_grow.test.mjs.)
for (const sb of [0, 15]) {
  const tag = `(막대 ${sb}px) `
  const s = fitOf(sb)
  const none = lay([box(100, 100)], sb)
  check(!none.needX && !none.needY, tag + '기준 크기 안에만 있으면 막대가 없다', JSON.stringify(none))
  check(none.extW === VIEW.w - sb && none.extH === VIEW.h - sb, tag + '그때 넓이 = 창 안쪽(막대 자리를 뺀 값) — 넘칠 것이 없다')
  const els = [box(100, 100), box(640, 215)]                           // 영상의 그림
  const k = A.growOf(els, [], W, H)
  const grown = lay(els, sb)
  check(grown.needX && grown.needY, tag + '넘치면 슬라이드가 비율대로 늘어나 **가로 · 세로로 굴려 본다**', JSON.stringify(grown))
  check(Math.abs(grown.extW - (grown.offX + W * k * s + A.PAD)) < 0.01 && Math.abs(grown.extH - (grown.offY + H * k * s + A.PAD)) < 0.01,
    tag + '넓이 = 늘어난 슬라이드(kW×kH) + 여백', `${grown.extW}×${grown.extH}`)
  check(none.offX === grown.offX && none.offY === grown.offY, tag + '**슬라이드 자리는 늘어나도 그대로**(끄는 중에 좌표가 안 틀어진다)',
    `${none.offX},${none.offY} / ${grown.offX},${grown.offY}`)
  // 맞춤일 때 기준 크기 전체가 안쪽에 들어온다(막대에 안 가린다).
  check(none.offX >= A.PAD && none.offY >= A.PAD &&
    none.offX + W * s <= VIEW.w - sb - A.PAD + 0.01 && none.offY + H * s <= VIEW.h - sb - A.PAD + 0.01,
    tag + '맞춤이면 기준 크기 전체가 막대 자리를 뺀 안쪽에 여백을 두고 들어온다')
  check(Math.abs((none.offX * 2 + W * s) - (VIEW.w - sb)) < 0.01 || Math.abs((none.offY * 2 + H * s) - (VIEW.h - sb)) < 0.01,
    tag + '안쪽의 가운데에 놓인다')
}

// ── ③ 확대 — 창보다 커지면 왼쪽 위부터 구른다 ──────────────────
{
  const big = A.layout(VIEW.w, VIEW.h, 15, W, H, 3, 1)
  check(big.needX && big.needY, '300% 로 키우면 양쪽 다 구른다')
  check(big.offX === A.PAD && big.offY === A.PAD, '창보다 큰 슬라이드는 왼쪽 위 여백에서 시작한다(음수로 밀려 잘리지 않는다)', `${big.offX},${big.offY}`)
  check(big.extW === A.PAD * 2 + W * 3 && big.extH === A.PAD * 2 + H * 3, '넓이 = 슬라이드 + 양쪽 여백')
}

// ── ④ 새 상자로 굴리기 — 가장 가까운 자리 ─────────────────────
{
  const view = { w: 800, h: 600 }
  const at = { x: 0, y: 0 }
  const seen = A.revealScroll(view, at, { x: 100, y: 100, w: 120, h: 56 }, 24)
  check(seen.x === 0 && seen.y === 0, '이미 다 보이면 굴리지 않는다', JSON.stringify(seen))
  const r = A.revealScroll(view, at, { x: 900, y: 100, w: 120, h: 56 }, 24)
  check(r.x === 900 + 120 + 24 - 800 && r.y === 0, '오른쪽 밖이면 상자 + 여백이 딱 들어오는 만큼만', JSON.stringify(r))
  const d = A.revealScroll(view, at, { x: 100, y: 700, w: 120, h: 56 }, 24)
  check(d.x === 0 && d.y === 700 + 56 + 24 - 600, '아래 밖이면 세로만', JSON.stringify(d))
  const back = A.revealScroll(view, { x: 500, y: 300 }, { x: 100, y: 100, w: 120, h: 56 }, 24)
  check(back.x === 76 && back.y === 76, '굴려 둔 채 왼쪽 위 상자면 되돌아온다(상자 − 여백)', JSON.stringify(back))
  const edge = A.revealScroll(view, { x: 500, y: 0 }, { x: 10, y: 10, w: 120, h: 56 }, 24)
  check(edge.x === 0 && edge.y === 0, '음수로는 굴리지 않는다', JSON.stringify(edge))
}

// ── ⑤ 화면에 붙어 있나(소스) ───────────────────────────
{
  const pv = bare(readFileSync('./src/builder/Preview.tsx', 'utf8'))
  check(/from '\.\/workArea'/.test(pv) && /layout\(/.test(pv) && /growOf\(/.test(pv), 'Preview 가 workArea 규칙을 쓴다')
  check(/overflowX: lay\.needX \? 'scroll' : 'hidden'/.test(pv) && /overflowY: lay\.needY \? 'scroll' : 'hidden'/.test(pv),
    '막대는 **축마다 직접** 켜고 끈다(auto 에 맡기지 않는다)')
  check(!/className="pv-h"/.test(pv), '「미리보기」 글자 줄이 없다')
  check(/revealScroll\(/.test(pv) && /useLayoutEffect\(/.test(pv), '새 상자로 굴리기는 넓이가 놓인 뒤(useLayoutEffect)에 한다')
  const css = bare(readFileSync('./src/builder/chrome.css', 'utf8'))
  const stage = (css.match(/\.ax-stage-wrap \.stage\{[^}]*\}/) || [''])[0]
  check(/padding:0/.test(stage) && !/overflow:auto/.test(stage), '작업창은 여백 0 · overflow:auto 없음(바탕색은 그 쪽의 바탕색을 Preview 가 준다)', stage)
  const fl = bare(readFileSync('./src/canvas/FreeLayer.tsx', 'utf8'))
  check(/n\.focus\(\{ preventScroll: true \}\)/.test(fl), '글칸에 초점을 줄 때 브라우저가 멋대로 굴리지 않는다(preventScroll)')
  check(/setReveal\(nb\.id\)/.test(fl), '파란 ＋ 점으로 만든 상자를 보여 달라고 알린다')
  const ps = bare(readFileSync('./src/builder/Present.tsx', 'utf8'))
  check(/overflow: 'hidden'/.test(ps), '발표는 종이에서 자른다(이북과 같게)')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
