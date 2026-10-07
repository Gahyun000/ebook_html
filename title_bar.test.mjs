// 머리줄 — **하는 일이 없는 것은 두지 않는다**(2026-10-06).
//
// 오른쪽 끝에 초록 동그라미 「가」 가 있었다. 누를 곳도 설명도 없는 장식이었다 — 사용자: 「원모양 가는 기능이
// 없는데 없애고싶어」. 이 저장소에는 계정이 없어 사용자 메뉴로 쓸 데도 없다. 모양 규칙도 함께 걷었다.
//
// 실행: node --experimental-strip-types --import ./ts_register.mjs title_bar.test.mjs

import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(p, import.meta.url).pathname, 'utf8')
const bare = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
let pass = 0, fail = 0
const check = (c, label, extra = '') => {
  if (c) { pass++; return }
  fail++
  console.log('  X ' + label + (extra ? '  — ' + extra : ''))
}

const tb = bare(read('./src/builder/chrome/TitleBar.tsx'))
const css = bare(read('./src/builder/chrome.css'))

check(!/className="av"/.test(tb), '머리줄에 **하는 일 없는 동그라미가 없다**')
check(!/\.ax-title \.av\b/.test(css), '그 동그라미의 모양 규칙도 없다 — 쓰는 곳이 없는 규칙을 남기지 않는다')
// 나머지는 그대로다.
check(/className="folio-chip"/.test(tb), 'EVER-FOLIO 로 가는 단추는 그대로다')
check(/className="rbtn" onClick=\{onPresent\}/.test(tb), '슬라이드쇼 단추는 그대로다')
check(/className="rbtn pri" onClick=\{\(\) => void newProject\(\)\}/.test(tb), '새로 만들기 단추는 그대로다')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
