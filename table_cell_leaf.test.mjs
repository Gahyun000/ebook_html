// 편집 중인 칸은 **React 의 잎**이어야 한다 — 자식이 하나뿐이어야 한다.
//
// 왜 이게 규칙인가
//   contentEditable 은 브라우저가 DOM 을 직접 고치는 곳이다. React 도 같은 자리를
//   관리하려 들면 둘이 한 자리를 놓고 다툰다. 다투는 방식이 자식 수에 따라 갈린다.
//
//     자식이 하나(문자열)  → React 는 textContent 로 통째로 갈아 끼운다. 안전하다.
//     자식이 둘 이상        → React 는 마디를 하나씩 맞춰 넣는다. 이때
//                            React 가 빈 값('')으로 만들어 둔 글자 마디가 남은 채
//                            브라우저가 타자용 마디를 새로 만들어 **마디가 둘**이 된다.
//                            커밋한 값이 되돌아오면 React 는 자기 마디만 채우므로
//                            같은 글자가 두 번 찍힌다.
//
//   2026-09-07 에 실제로 이걸 겪었다. 빈 칸에 처음 글을 쓸 때만 두 번 찍혔고,
//   저장된 값은 멀쩡해서 「화면만 이상하다」로 보였다. 원인은 칸 안에 있던 의견 핀이었다 —
//   핀 하나 때문에 자식이 둘이 된 것이다.
//
//   핀은 두 번째 사고도 냈다. 커밋은 `n.textContent` 를 읽는데 핀은 **자기 개수를 글자로**
//   그린다(1, 2...). 의견이 하나 달린 칸에 '가' 를 쓰면 '가1' 이 저장됐다.
//   화면에는 안 보이고 저장에만 남는 종류의 오염이다.
//
// 그래서 핀은 칸 **밖**, 같은 격자 자리에 겹친 별도 칸에 그린다.
// 타입 검사도 서버 테스트도 이걸 못 잡는다 — 둘 다 문법상 멀쩡하기 때문이다.
//
// ebook_html 이식(EVER-SKETCH1 d57203f): 핀이 없는 저장소라 핀 검사는 빼고, 칸이 잎이라는 규칙만 지킨다.
//
// 실행: node table_cell_leaf.test.mjs

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
const tsx = read('./src/canvas/FreeLayer.tsx')

let pass = 0, fail = 0
const check = (cond, label, extra = '') => {
  if (cond) { pass++; console.log('✓ ' + label) }
  else { fail++; console.log('✗ ' + label + (extra ? '  — ' + extra : '')) }
}

// ── 칸의 자식은 하나다 ────────────────────────────────
const CELL_OPEN = "className={'feltd'"
const CELL_CLOSE = '>{val}</div>'
const oi = tsx.indexOf(CELL_OPEN)
const ci = tsx.indexOf(CELL_CLOSE)

check(oi >= 0, '표 칸을 찾았다 (className={\'feltd\'})')
check(ci > oi, '표 칸의 자식은 {val} 하나이고 그 자리에서 닫힌다',
  '`>{val}</div>` 를 못 찾았다 — 칸에 자식이 더 붙었는지 확인하세요')

// 칸이 열린 곳부터 **첫 </div>** 까지가 칸의 안쪽이다.
// 위 검사(`>{val}</div>`)가 깨졌을 때 여기까지 덩달아 통과하면 안 되므로,
// 위 결과에 기대지 않고 따로 잘라 낸다.
const endi = oi >= 0 ? tsx.indexOf('</div>', oi) : -1
const inside = endi > oi ? tsx.slice(oi, endi) : tsx
check(!/<[A-Z][A-Za-z]*[\s/>]/.test(inside), '칸 안에 다른 컴포넌트가 없다',
  (inside.match(/<[A-Z][A-Za-z]*/) || [''])[0] + ' 가 칸 안에 있다')
check(!inside.includes('<Pin'), '의견 핀이 칸 **안**에 없다')

// ── (ebook_html 이식) 핀 자리 · Fragment · comments.css 검사는 뺐다 ──
// 원본은 여기서 「핀은 칸 **밖**, 같은 격자 자리에 따로 그린다」(.feltd-pin · <Fragment key={k}>)를 본다.
// 이 저장소에는 의견 핀이 **아예 없다**(이식 제외 항목). 두 번 찍히던 원인이 처음부터 없으므로
// 핀 자리 검사는 대상이 없다. 대신 **칸이 곧바로 key 를 받는 한 마디**임을 지킨다 —
// 나중에 누가 칸 옆에 형제를 붙이면(Fragment 로 감싸면) 여기서 알 수 있게.
check(tsx.includes("<div key={k} className={'feltd'"), '칸은 key 를 직접 받는 **한 마디**다(형제 없음)')
check(!/className="feltd-pin"/.test(tsx), '칸 자리에 핀 겹이 없다 — 이 저장소는 의견 핀을 들이지 않는다')

// ── 커밋이 textContent 를 읽는 한, 이 규칙은 계속 필요하다 ──
check(tsx.includes('cells[r][c] = n.textContent'),
  '칸 커밋은 여전히 textContent 를 읽는다',
  '읽는 방식이 바뀌었다면 이 파일의 전제를 다시 쓰세요')

// ── 글상자도 같은 규칙을 지킨다 ────────────────────────
check(tsx.includes('>{el.text}</div>'), '편집 중인 글상자도 자식이 {el.text} 하나다')

console.log('\n' + pass + ' 통과, ' + fail + ' 실패')
if (fail) process.exit(1)
