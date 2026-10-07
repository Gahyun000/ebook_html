// 한글 조합 중 Enter — **입력기가 아직 글자를 쥐고 있을 때의 키는 입력기 것이다.**
//
// **왜 생겼나.** 2026-10-02 오후 5.41 화면 기록: 챗봇 패널 안 메모장에서 「ㅌ」 을 치고 Enter 를 한 번 누를
// 때마다 줄이 **두 개** 생기고 같은 글자가 다음 줄에 한 번 더 찍혔다.
//
// 맥 크롬은 조합 중에 Enter 를 누르면 keydown 을 **두 번** 보낸다 — 조합 중(`isComposing=true`, keyCode 229)
// 한 번, 입력기가 글자를 확정한 뒤(`false`, 13) 한 번. 메모장은 둘 다 Enter 로 받아,
//   ① 첫 번째에 새 줄을 만들고 초점을 옮겼고 ② 입력기가 확정한 글자가 **옮겨 간 줄에** 또 들어갔고
//   ③ 두 번째가 줄을 하나 더 만들었다.
// 같은 모양의 Enter 처리가 네 곳 더 있었다(아래 2번). 고친 방법은 하나다 — 조합 중인 키는 건너뛴다.
//
// 실행: node --experimental-strip-types --import ./ts_register.mjs ime_enter.test.mjs

import { readFileSync } from 'node:fs'
import { isComposingKey } from './src/lib/ime.ts'

const read = (p) => readFileSync(new URL(p, import.meta.url).pathname, 'utf8')
// 주석에 적은 설명에 걸리지 않게 주석을 벗기고 잰다.
const bare = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
let pass = 0, fail = 0
const check = (c, label, extra = '') => {
  if (c) { pass++; return }
  fail++
  console.log('  X ' + label + (extra ? '  — ' + extra : ''))
}

// ── 1. 판정 ─────────────────────────────────────────────
{
  check(isComposingKey({ nativeEvent: { isComposing: true } }) === true, 'React 이벤트 — 조합 중이면 참')
  check(isComposingKey({ nativeEvent: { isComposing: false } }) === false, 'React 이벤트 — 확정 뒤면 거짓(이게 진짜 Enter 다)')
  check(isComposingKey({ isComposing: true }) === true, 'DOM 이벤트 — 조합 중이면 참(창에 직접 단 리스너용)')
  check(isComposingKey({ isComposing: false }) === false, 'DOM 이벤트 — 확정 뒤면 거짓')
  // 사파리는 조합을 **먼저** 끝내고(compositionend) 그 뒤에 keydown(229)을 보낸다.
  // 그 키까지 막으면 사파리에서는 Enter 를 두 번 눌러야 줄이 바뀐다 — 229 는 보지 않는다.
  check(isComposingKey({ nativeEvent: { isComposing: false }, keyCode: 229 }) === false,
    '사파리 모양(확정 뒤 keyCode 229)은 **진짜 Enter** 로 둔다 — 막으면 두 번 눌러야 한다')
  check(isComposingKey({}) === false, '아무 표시가 없으면 거짓')
}

// ── 2. 다섯 자리가 Enter 를 처리하기 **전에** 판정을 거친다 ─────────
// 함수만 만들어 두고 자리마다 안 부르면 화면은 그대로다.
const uses = (src) => /import \{[^}]*\bisComposingKey\b[^}]*\} from '[./]+lib\/ime'/.test(src)
{
  // 메모장 · 블록 편집기 — 키 처리 함수 **맨 앞**에서 돌려보낸다(조합 중의 Enter · Backspace 는 입력기 몫이다).
  for (const [name, path] of [['메모장', './src/notes/PlainEditor.tsx'], ['블록 편집기', './src/builder/NoteBlocks.tsx']]) {
    const src = bare(read(path))
    check(uses(src), `${name} — 판정을 들여온다`)
    const body = (src.match(/function onKey\([^)]*\)[^{]*\{\s*([^\n]*)/) || [])[1] || ''
    check(/^if \(isComposingKey\(e\)\) return\b/.test(body.trim()), `${name} — onKey **첫 줄**에서 조합 중인 키를 돌려보낸다`, body.trim())
  }
  // 챗봇 입력창 — 보내기 전에.
  const chat = bare(read('./src/chat/ChatPanel.tsx'))
  check(uses(chat), '챗봇 — 판정을 들여온다')
  check(/if \(event\.key === 'Enter' && !isComposingKey\(event\)\) void send\(\)/.test(chat),
    '챗봇 — 조합 중 Enter 로는 **보내지 않는다**(마지막 글자를 한 번 더 보내던 것)')
  // 표 칸 편집 — Enter 갈래에만. Escape · Tab 은 손대지 않는다(실제 입력기로 확인 못 함).
  const fl = bare(read('./src/canvas/FreeLayer.tsx'))
  check(uses(fl), '표 칸 — 판정을 들여온다')
  check(/if \(e\.key === 'Enter' && !e\.shiftKey && !isComposingKey\(e\)\) \{ to\(/.test(fl),
    '표 칸 — 조합 중 Enter 로는 칸을 옮기지 않는다(아래 칸이 편집 상태로 열리던 것)')
  check(/if \(e\.key === 'Escape'\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); endEditing\(\); return \}/.test(fl)
        && /if \(e\.key === 'Tab'\) \{ to\(/.test(fl), '표 칸 — Escape · Tab 은 그대로다')
  // 카드 글자 칸 — Enter 로 빠져나가는 세 곳.
  const pv = bare(read('./src/cards/PageView.tsx'))
  check(uses(pv), '카드 글자 칸 — 판정을 들여온다')
  const guarded = (pv.match(/if \(e\.key === 'Enter' && !e\.shiftKey && !isComposingKey\(e\)\) \{ e\.preventDefault\(\); \(e\.currentTarget as HTMLElement\)\.blur\(\) \}/g) || []).length
  const all = (pv.match(/e\.key === 'Enter'/g) || []).length
  check(guarded === 3 && all === 3, '카드 글자 칸 — Enter 로 빠져나가는 **세 곳 모두** 조합 중에는 안 빠져나간다', `${guarded}/${all}`)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
