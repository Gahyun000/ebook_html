// **알마인드식 가지 키** — 상자를 고른 채 Space 로 자식, Enter 로 형제, 방향키로 토픽 사이를 옮겨 다닌다.
//
// 사용자 요청(2026-10-06 · 알마인드 단축키 표): 「도형은 알마인드 기능 적용하고싶고」.
// 결정: Space/Insert 자식 · Enter 형제 · Shift+Enter 앞 형제 · 방향키 = 토픽 이동(Alt+방향키 = 1px) ·
//       Delete = 가지째 · 접기/펴기 단축키 · 붙일 때마다 자동 정렬.
//
// 「어느 키가 무슨 동작인가」 와 「방향키가 어디로 가는가」 는 src/builder/mindKeys.ts 의 순수 함수다(노드에서 직접 검증).
// 스토어 쪽은 tree_keys.test.mjs, 화면은 스모크 13단계가 본다.
//
// 실행: node --experimental-strip-types --import ./ts_register.mjs mind_keys.test.mjs
import { readFileSync } from 'node:fs'

let pass = 0, fail = 0
const check = (c, label, extra = '') => {
  if (c) { pass++; return }
  fail++; console.log('  X ' + label + (extra ? '  — ' + extra : ''))
}
const bare = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const M = await import('./src/builder/mindKeys.ts')
const { treeShape } = await import('./src/cards/treeOps.ts')

const ev = (key, more = {}) => ({ key, code: '', shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, isComposing: false, ...more })

// ── ① 키 → 동작 ──────────────────────────────────────
{
  check(M.mindKey(ev(' ')) === 'child', 'Space = 자식')
  check(M.mindKey(ev('Insert')) === 'child', 'Insert = 자식')
  check(M.mindKey(ev('Enter')) === 'sibling', 'Enter = 형제')
  check(M.mindKey(ev('Enter', { shiftKey: true })) === 'before', 'Shift+Enter = 앞 형제')
  check(M.mindKey(ev('Enter', { isComposing: true })) === null, '**한글 조합 중 Enter 는 건드리지 않는다**')
  check(M.mindKey(ev('Enter', { metaKey: true })) === null && M.mindKey(ev('Enter', { ctrlKey: true })) === null,
    '⌘/Ctrl+Enter 는 이북 만들기의 것이다')
  check(M.mindKey(ev(' ', { shiftKey: true })) === null && M.mindKey(ev(' ', { altKey: true })) === null, '조합 키가 붙은 Space 는 아니다')
  // 2026-10-06 고침: 처음 받은 표는 「Shift+Alt+＋ 접기 · Ctrl+Alt+－ 펴기」 였는데, 사용자가 다시 준 표는
  // 「Shift+Alt+－ 접기 · Shift+Alt+＋ 펴기」 다(－ 가 접기 — 접기 손잡이의 뜻과도 맞다). 뒤의 것을 따른다.
  check(M.mindKey(ev('_', { code: 'Minus', shiftKey: true, altKey: true })) === 'fold', 'Shift+Alt+－ = 접기')
  check(M.mindKey(ev('+', { code: 'Equal', shiftKey: true, altKey: true })) === 'unfold', 'Shift+Alt+＋ = 펴기')
  // 맥은 Alt 를 누르면 글자가 바뀐다(Alt+= → ≠ · Alt+- → –). 그래서 글자가 아니라 **자리(code)** 로 본다.
  check(M.mindKey(ev('±', { code: 'Equal', shiftKey: true, altKey: true })) === 'unfold', '맥에서 글자가 바뀌어도 자리(code)로 알아본다')
  check(M.mindKey(ev('-', { code: 'Minus', ctrlKey: true, altKey: true })) === null, 'Ctrl+Alt+－ 는 이제 가지 키가 아니다')
  check(M.mindKey(ev('A', { code: 'KeyA', shiftKey: true, altKey: true })) === 'unfoldAll', 'Shift+Alt+A = 모두 펴기')
  check(M.mindKey(ev('a')) === null && M.mindKey(ev('ArrowLeft')) === null && M.mindKey(ev('Tab')) === null, '다른 키는 동작이 아니다')
}

// ── ② 방향키 → 옮겨 갈 상자 ─────────────────────────────
//      1 ─┬─ 2 ─┬─ 4
//         │     └─ 5
//         └─ 3            6(다른 뿌리)
{
  const el = (id, more = {}) => ({ id, type: 'box', x: 0, y: 0, w: 10, h: 10, text: '', color: '', fs: 13, ...more })
  const conns = [{ from: 1, to: 2 }, { from: 1, to: 3 }, { from: 2, to: 4 }, { from: 2, to: 5 }]
  const els = [1, 2, 3, 4, 5, 6].map((id) => el(id))
  const sh = treeShape(els, conns, [1, 6])
  const go = (dir, id, key, shape = sh) => M.navTarget(shape, dir, id, key)

  // 왼→오른(LR): 오른쪽이 자식, 왼쪽이 부모, 위아래가 형제
  check(go('LR', 1, 'ArrowRight') === 2, 'LR → = 첫 자식')
  check(go('LR', 2, 'ArrowLeft') === 1, 'LR ← = 부모')
  check(go('LR', 2, 'ArrowDown') === 3 && go('LR', 3, 'ArrowUp') === 2, 'LR ↑↓ = 형제')
  check(go('LR', 4, 'ArrowDown') === 5 && go('LR', 5, 'ArrowDown') === null, '형제의 끝에서는 안 움직인다')
  check(go('LR', 4, 'ArrowRight') === null && go('LR', 1, 'ArrowLeft') === null, '자식 · 부모가 없으면 안 움직인다')
  check(go('LR', 1, 'ArrowDown') === 6 && go('LR', 6, 'ArrowUp') === 1, '뿌리끼리도 형제처럼 오간다')
  // 위→아래(TD): 아래가 자식, 위가 부모, 좌우가 형제
  check(go('TD', 1, 'ArrowDown') === 2 && go('TD', 2, 'ArrowUp') === 1, 'TD ↓ = 자식 · ↑ = 부모')
  check(go('TD', 2, 'ArrowRight') === 3 && go('TD', 3, 'ArrowLeft') === 2, 'TD ←→ = 형제')
  // 접혀서 안 보이는 것은 건너뛴다
  const folded = treeShape(els.map((e) => (e.id === 2 ? { ...e, folded: true } : e)), conns, [1, 6])
  check(go('LR', 2, 'ArrowRight', folded) === null, '접힌 상자의 자식(안 보임)으로는 안 간다')
  check(go('LR', 99, 'ArrowRight') === null, '트리에 없는 상자면 null')
}

// ── ③ 단축키에 붙어 있나(소스) ───────────────────────────
{
  const hk = bare(readFileSync('./src/builder/Hotkeys.tsx', 'utf8'))
  check(/mindKey\(e\)/.test(hk) && /navTarget\(/.test(hk), 'Hotkeys 가 mindKeys 규칙을 쓴다')
  const iMind = hk.indexOf('mindKey(e)'), iDel = hk.indexOf("(k === 'Delete' || k === 'Backspace') && selMany"), iArrow = hk.indexOf("if (!mod && (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') && sel)")
  check(iDel > 0 && iArrow > 0, '기존 삭제 · 방향키(1px) 줄이 그대로 있다')
  const iNav = hk.indexOf('navTarget(')
  check(iNav > 0 && iNav < iArrow, '토픽 이동이 1px 이동 **앞**에서 먼저 받는다')
  check(/!e\.altKey/.test(hk.slice(hk.lastIndexOf('\n', iNav - 200), iNav)), '**Alt 를 누르면 토픽 이동을 건너뛴다** — Alt+방향키는 1px 이동으로 남는다')
  check(iMind > 0 && /treeRemove\(/.test(hk) && hk.indexOf('treeRemove(') < iDel, '가지째 지우기가 낱개 삭제 **앞**에서 먼저 받는다')
  check(/mindmapCenter != null/.test(hk), '마인드맵 카드 쪽은 가로채지 않는다')
  check(/requestEdit\(/.test(hk) && /setReveal\(/.test(hk), '붙인 상자는 글 편집을 열고 화면에 보이게 한다')
  const fl = bare(readFileSync('./src/canvas/FreeLayer.tsx', 'utf8'))
  check(/editReq/.test(fl) && /requestEdit\(null\)/.test(fl), 'FreeLayer 가 편집 부탁을 받고 비운다')
  check(/isComposingKey\(e\)/.test(fl.slice(fl.indexOf('className="feltext" contentEditable'), fl.indexOf('className="feltext" contentEditable') + 6000)),
    '글칸의 Enter 는 한글 조합 중이면 건너뛴다')
  const help = bare(readFileSync('./src/builder/Help.tsx', 'utf8'))
  check(/자식/.test(help) && /형제/.test(help) && /K\('alt'\)/.test(help), '도움말에 가지 키가 적혀 있다')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
