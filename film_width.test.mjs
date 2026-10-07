// 쪽 목록 폭이 **종이 방향을 따른다** — 가로일 때는 사용자가 끌어 보인 만큼 넓게(2026-10-06).
//
// **왜 생겼나.** 사용자: 「왼쪽 폭이 세로기준이라 가로슬라이드는 살짝 잘리는거」. 목록 칸은 늘 212px 이었고
// 그림 폭은 가로 168 · 세로 150 이었다. 세로 그림은 들어가는데 가로 그림은 번호 · 여백 · 늘 보이는 스크롤 막대와
// 함께 들어갈 자리가 모자랐다. 사용자는 화면 기록 끝에서 경계를 끌어 **「이 정도 폭이면 좋겠다」** 를 보여 줬다
// (처음에 이걸 「넘쳐서 스크롤 막대가 생긴다」 로 잘못 읽었다 — 바로잡음을 받았다).
//
// 그리고 그림 칸이 border-box 라 안쪽이 2px 좁은데, 배율을 바깥 폭으로 정해 종이 그림 오른쪽 · 아래 2px 가 늘 잘렸다.
// 마지막으로, 쪽을 끝까지 지우면 화면이 멈췄다(React #300) — 훅이 「쪽이 없으면 일찍 돌아가기」 뒤에 있었다.
//
// 실행: node --experimental-strip-types --import ./ts_register.mjs film_width.test.mjs

import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(p, import.meta.url).pathname, 'utf8')
const bare = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
let pass = 0, fail = 0
const check = (c, label, extra = '') => {
  if (c) { pass++; return }
  fail++
  console.log('  X ' + label + (extra ? '  — ' + extra : ''))
}

const lay = bare(read('./src/builder/Layout.tsx'))
const fs = bare(read('./src/builder/Filmstrip.tsx'))
const css = bare(read('./src/builder/chrome.css'))

// ── 1. 방향별 폭 — 그림이 다 들어가는가 ───────────────────────
// 한 줄에 드는 것: 목록 여백 10 · 줄 여백 3 · 번호 14 · 사이 8 · 그림 · 끝 여백 10 · 스크롤 막대 15 · 경계선 1 = 그림 + 61.
// 아래 CSS 값이 바뀌면 이 61 도 다시 재야 한다 — 그래서 같이 본다.
{
  check(/\.axth-list\{[^}]*padding:6px 10px 12px/.test(css), '(전제) 목록 여백 좌우 10px')
  check(/\.axth\{[^}]*gap:8px[^}]*padding:3px/.test(css), '(전제) 줄 사이 8px · 줄 여백 3px')
  check(/\.axth-no\{[^}]*width:14px/.test(css), '(전제) 번호 칸 14px')
  check(/\.ax-film\{[^}]*border-right:1px/.test(css), '(전제) 목록 경계선 1px')
  const thumb = /orientation === 'landscape' \? (\d+) : (\d+)/.exec(fs) || []
  const land = Number(thumb[1]), port = Number(thumb[2])
  const fw = /FILM_W\s*=\s*\{\s*portrait:\s*(\d+),\s*landscape:\s*(\d+)\s*\}/.exec(lay) || []
  const fwP = Number(fw[1]), fwL = Number(fw[2])
  check(land === 168 && port === 150, '(전제) 그림 바깥 폭 가로 168 · 세로 150', `${land} / ${port}`)
  check(!!fw[0], '목록 칸에 **방향별 폭**이 있다(FILM_W)')
  check(fwL >= land + 61, '가로 폭에 **가로 그림이 다 들어간다**(그림 + 61 이상)', `${fwL} ≥ ${land + 61}`)
  check(fwP >= port + 61, '세로 폭에 세로 그림이 다 들어간다', `${fwP} ≥ ${port + 61}`)
  check(fwP === 212, '세로 폭은 **지금 그대로** 212 — 사용자가 문제 삼지 않은 쪽은 바꾸지 않는다', String(fwP))
  check(fwL === 232, '가로 폭은 사용자가 끌어 보인 **232**', String(fwL))
}

// ── 2. 방향을 따라가되, 사람이 끌어 정한 폭은 그대로 ─────────────────
{
  check(/useState<number>\(FILM_W\[orientation\]\)/.test(lay), '처음 폭도 **지금 방향의 폭**으로 시작한다')
  const eff = (lay.match(/useEffect\(\(\) => \{[^{}]*FILM_W\[orientation\][^{}]*\}, \[orientation\]\)/) || [''])[0]
  check(!!eff, '방향이 바뀌면 폭이 따라간다', eff.slice(0, 120))
  check(/if \(!leftDragged\.current\)/.test(eff), '…다만 **끌어 정한 폭이 있으면 건드리지 않는다**')
  const rs = lay.slice(lay.indexOf('function startResize'), lay.indexOf('function startResize') + 900)
  check(/if \(side === 'left'\) \{ leftDragged\.current = true;/.test(rs), '경계를 끌면 「끌어 정했다」 를 남긴다', rs.replace(/\s+/g, ' ').slice(0, 200))
}

// ── 3. 그림 칸 안쪽 폭으로 배율 — 2px 잘림 ───────────────────────
{
  check(/const scale = \(miniW - 2\) \/ W/.test(fs), '배율을 **테두리를 뺀 안쪽 폭**으로 정한다(종이 그림 오른쪽·아래 2px 가 잘리던 것)')
  check(/const miniH = Math\.round\(H \* scale\) \+ 2/.test(fs), '높이도 안쪽 높이 + 테두리')
}

// ── 4. 훅은 「쪽이 없으면 일찍 돌아가기」 앞에 ────────────────────────
// 뒤에 있으면 쪽이 0 이 되는 순간 훅 개수가 바뀌어 React 가 멈춘다(#300 · 마지막 쪽을 지울 때).
{
  const at = fs.indexOf('if (!pages.length) return')
  const after = at < 0 ? '' : fs.slice(at)
  check(at > 0, '(준비) 일찍 돌아가는 줄을 찾았다')
  check(!/\buse(Effect|LayoutEffect|State|Ref|Builder|Memo|Callback)\(/.test(after), '그 뒤에는 **훅이 하나도 없다**', (after.match(/\buse\w+\(/) || [''])[0])
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
