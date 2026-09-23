// **표 칸을 끌면 범위가 골라지고, 표는 ⠿ 손잡이로만 옮긴다.**
//
// EVER-SKETCH1 table_select.test.mjs 를 ebook_html 2단계(기반 복원)에 맞춰 옮겼다.
// 원본은 거의 전부가 `growToMerges`·`bandRange`·`pickRange`(병합 칸에 닿으면 범위가 넓어지는 것,
// 머리 띠로 줄 통째로 고르기 — EVER-SKETCH1 e38d357)를 본다. **그것은 3단계 몫이다.**
// 그래서 그 검사들은 여기 두지 않고, 3단계에서 원본 그대로 되살린다(아래 「3단계로 미룬 것」).
//
// 여기서 지키는 것은 b721df0 기반에 이미 있던 것들이다.
//   ① 칸 위 누름은 **칸 선택**으로 시작하고, 끌면 커서 밑의 칸까지 범위를 넓힌다(startCellDrag).
//      좌표 산술이 아니라 elementFromPoint 로 실제 칸(data-tel·data-r·data-c)을 짚는다.
//      같은 쪽이 필름 미리보기에도 그려지므로 **같은 레이어** 안의 칸만 받는다.
//   ② 칸 위 누름은 표를 옮기지 않는다 — 표 이동은 ⠿ 손잡이(.tbl-move)가 맡는다.
//      손잡이는 `.fel` 의 overflow:hidden 에 잘리지 않도록 **자기 겹**에 그린다(EVER-SKETCH1 8cb80f5).
//   ③ 칸을 더블클릭하면 **그 칸**에 커서가 선다.
//   ④ 열 너비·행 높이(colw/rowh)와 칸 색(cbg)이 그려진다.
//
// 실행: node --experimental-strip-types --import ./ts_register.mjs table_select.test.mjs
import { readFileSync } from 'node:fs'

let pass = 0, fail = 0
const check = (cond, label, extra = '') => {
  if (cond) { pass++; console.log('✓ ' + label) }
  else { fail++; console.log('✗ ' + label + (extra ? '  — ' + extra : '')) }
}
const read = (p) => readFileSync(p, 'utf8')
const bare = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/^\s*\/\/.*$/gm, '')

const fl = bare(read('./src/canvas/FreeLayer.tsx'))
const css = read('./src/index.css')

// ── ① 끌어서 범위 고르기 ───────────────────────────
{
  check(/function startCellDrag\(elId: number, r0: number, c0: number, from: Element\)/.test(fl),
    '칸 끌기 함수(startCellDrag)가 있다')
  const drag = fl.slice(fl.indexOf('function startCellDrag'), fl.indexOf('function onLayerDown'))
  check(/document\.elementFromPoint\(ev\.clientX, ev\.clientY\)/.test(drag), '커서 밑의 **실제 칸**을 짚는다')
  check(/closest\('\[data-tel\]'\)/.test(drag) && /cell\.dataset\.tel !== String\(elId\)/.test(drag),
    '다른 표의 칸은 받지 않는다(data-tel)')
  check(/layer\.contains\(cell\)/.test(drag), '같은 레이어 안의 칸만 받는다 — 필름 미리보기의 같은 칸에 속지 않는다')
  check(/setTableSel\(\{ elId, r0, c0, r1: r, c1: c \}\)/.test(drag), '끄는 동안 시작 칸 ~ 커서 칸으로 범위를 넓힌다')
  check(/data-tel=\{el\.id\} data-r=\{r\} data-c=\{c\}/.test(fl), '칸마다 data-tel · data-r · data-c 를 단다')
  check(/startCellDrag\(el\.id, r, c, e\.currentTarget\)/.test(fl), '칸 누름이 startCellDrag 로 들어간다')
}

// ── ② 칸 위 누름은 표를 옮기지 않는다 ─────────────────
{
  // 칸의 onPointerDown 몸통만 떼어 본다.
  const i = fl.indexOf('startCellDrag(el.id, r, c, e.currentTarget)')
  const cellDown = fl.slice(fl.lastIndexOf('onPointerDown={(e) => {', i), i)
  check(cellDown.length > 0 && /e\.stopPropagation\(\)/.test(cellDown),
    '칸 누름은 위(.fel)로 올라가지 않는다 — 올라가면 onElDown 이 표를 통째로 끈다')
  check(!/onElDown/.test(cellDown), '칸 누름에서 onElDown(표 끌기)을 부르지 않는다')
  check(/className="tbl-move"/.test(fl), '표 이동 손잡이(⠿)가 있다')
  const iMove = fl.indexOf('className="tbl-move"')
  const mv = fl.slice(iMove, iMove + 200)
  check(/onElDown\(e, se\)/.test(mv), '손잡이를 끌면 onElDown — 표가 움직인다')
  // 손잡이가 표 안(.feltable)에 있으면 .fel 의 overflow:hidden 에 잘린다.
  const iTable = fl.indexOf('className="feltable"')
  const iTableEnd = fl.indexOf('})()', iTable)
  check(!(iMove > iTable && iMove < iTableEnd), '손잡이는 표 안이 아니라 자기 겹에 그린다(잘리지 않게)')
  check(/\.tbl-move\{[^}]*position:absolute/.test(css) && /\.tbl-move\{[^}]*cursor:grab/.test(css),
    '손잡이 CSS 가 index.css 에 있다(template.css 는 이식하지 않는다)')
  check(/\.tbl-move\{[^}]*pointer-events:auto/.test(css), '손잡이 겹이 pointer-events:none 이어도 손잡이 자체는 잡힌다')
}

// ── ③ 칸 더블클릭 = 그 칸에서 쓰기 ────────────────────
{
  const i = fl.indexOf('startCellDrag(el.id, r, c, e.currentTarget)')
  const after = fl.slice(i, i + 1600)
  check(/onDoubleClick=\{\(e\) => \{[\s\S]*?startEditing\(el\.id\)[\s\S]*?node\.focus\(\)/.test(after),
    '칸 더블클릭이 편집을 켜고 **그 칸**에 초점을 준다')
}

// ── ④ 열 너비·행 높이·칸 색이 그려진다 ─────────────────
{
  check(/gridTemplateColumns: sizeTracks\(el\.colw, C\)/.test(fl), '열 너비(colw)를 비율 트랙으로 그린다')
  check(/gridTemplateRows: sizeTracks\(el\.rowh, R\)/.test(fl), '행 높이(rowh)를 비율 트랙으로 그린다')
  check(/el\.cbg && el\.cbg\[r \+ '_' \+ c\]/.test(fl), '칸 색(cbg)을 읽는다')
  check(/cellBackground\(bg\)/.test(fl) && /cellTextColor\(bg\)/.test(fl),
    '칸 색과 그 위 글자색은 PPT 내보내기와 같은 함수(canvas/cellColor)로 정한다')
  check(!/template\/slots|isSlotEl|lockedRowCount/.test(fl), '양식 슬롯(template/*)은 들여오지 않는다')
}

// ── 3단계로 미룬 것 ────────────────────────────────
// 원본의 ①~⑦ 중 growToMerges / bandRange / pickRange / pickBand / startBandDrag / .trk-band 검사는
// EVER-SKETCH1 e38d357 기능이라 3단계(표 편집)에서 원본 그대로 옮긴다. 여기서 약하게 흉내 내지 않는다.

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
