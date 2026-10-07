// **도형이나 선을 고르지 않은 이상 어디서든 끌어 고르기**(2026-10-07 · 추가 요청).
//
// 사용자: 「지금 마우스로 드래그하는게 되는 곳도 있고 안되는 곳도 있음(원인 불명) — 도형이나 선을 선택하지 않은 이상 어디서든 드래그가 되도록」.
// 안 되던 자리 셋 —
//   ① **카드 쪽**(표지 · 빈 페이지 … `free:false`): 도형 층이 passthru(pointer-events:none)라 빈 곳 pointerdown 이 층에 안 닿았다 → PageWithCanvas 가 받아 `ebook:marquee` 로 넘긴다.
//   ② **선 둘레 16px 누름 영역**: 빈 곳처럼 보이는 데를 눌러도 선이 잡혀 **휘기**가 시작됐다 → 고르지 않은 선에서 끌면 끌어 고르기, 누르기만 하면 그 선 고르기, 휘기는 **고른 선**에서만.
//   ③ 납작한 끌기(세로 4px 미만)는 아무것도 안 골랐다 → 가로 · 세로 중 하나만 4px 넘으면 고른다.
//
// 실행: node --experimental-strip-types --import ./ts_register.mjs marquee_any.test.mjs
import { readFileSync } from 'node:fs'

let pass = 0, fail = 0
const check = (c, label, extra = '') => {
  if (c) { pass++; return }
  fail++; console.log('  X ' + label + (extra ? '  — ' + extra : ''))
}
const bare = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const fl = bare(readFileSync('./src/canvas/FreeLayer.tsx', 'utf8'))
const pwc = bare(readFileSync('./src/cards/PageWithCanvas.tsx', 'utf8'))
const pv = bare(readFileSync('./src/builder/Preview.tsx', 'utf8'))

// ── ③ 납작한 끌기도 고른다 ──
check(/if \(mw > 4 \|\| mh > 4\) \{/.test(fl) && !/mw > 4 && mh > 4/.test(fl), '가로 · 세로 중 하나만 4px 넘으면 끌어 고르기다(납작한 끌기)')

// ── ② 선 위에서 — 고른 선만 휜다 ──
{
  const nd = fl.slice(fl.indexOf('function onLineDown'), fl.indexOf('const conns = page.conns.map'))
  check(/if \(selConn !== i\) \{/.test(nd), '고르지 않은 선은 따로 간다')
  check(/beginMarquee\(sx, sy\)/.test(nd), '고르지 않은 선에서 끌면 **끌어 고르기**')
  check(/<= 4\) setSelConn\(i\)/.test(nd), '누르기만 하면(안 끌면) 그 선이 골라진다')
  check(/updateConn\(page\.id, i, \{ x, y \}\); setBending\(\{ x, y \}\)/.test(nd), '휘기(bend)는 그대로 — 고른 선에서만')
}

// ── ① 카드 쪽에서도 — 페이지가 받아 층에 넘긴다 ──
{
  check(/window\.dispatchEvent\(new CustomEvent\('ebook:marquee', \{ detail: \{ x: e\.clientX, y: e\.clientY \} \}\)\)/.test(pwc), 'PageWithCanvas 가 빈 곳 pointerdown 을 ebook:marquee 로 넘긴다')
  check(/t\.closest\('\.freelayer'\)/.test(pwc), '자유 쪽(층이 직접 받음)은 건너뛴다 — 두 번 시작하지 않는다')
  check(/closest\('button, a, input, textarea, select, \[contenteditable="true"\]'\)/.test(pwc), '단추 · 입력칸 · 글칸은 제 일을 한다')
  check(/useCanvasUI\.getState\(\)\.tool !== 'select'\) return/.test(pwc), '고르기 도구일 때만')
  check(/e\.preventDefault\(\)/.test(pwc), '글자 긁기(브라우저 선택)가 같이 시작되지 않게 막는다')
  check(/'ebook:marquee'/.test(fl) && /beginMarquee\(d\.x, d\.y\)/.test(fl), 'FreeLayer 가 그 말을 받아 beginMarquee 로 시작한다')
  check(/'ebook:marquee'/.test(pv) && /closest\('\.pv-paper'\)\) return/.test(pv), 'Preview(종이 밖 작업면)도 같은 길이고 종이 안은 페이지에 맡긴다')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
