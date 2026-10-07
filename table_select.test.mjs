// **끝까지 끌면 월 1~12 가 빠지던 것, 그리고 머리 띠.**
//
// 2026-09-16 · 사용자: 「2027년까진 잘 드래그 되다가 2027년 지나면 1~12칸이 드래그 포함이
// 안되잖아」. 영상을 프레임으로 뜯고 실제 화면에서 재어 원인을 잡았습니다.
//
//   범위는 눌러 시작한 칸과 커서가 있는 칸의 **저장된 (행, 열)** 로만 만들어졌습니다.
//   그런데 **병합 칸은 제 왼쪽 위 좌표 하나만** 갖습니다.
//
//     Project = (0행,0열, 2행2열)   2027년 = (0행,14열, **2행**1열)   월 1~12 = (1행,2~13열)
//
//     Project 에서 시작 → 월 12(1행) 위  : 0~1행 → 월 들어옴  (2×14)
//     Project 에서 시작 → 2027년(0행) 위 : **0~0행** → 월 빠짐 (1×15)
//
//   커서가 2027년에 닿는 순간 범위의 아래 변이 **1행에서 0행으로 올라갔습니다.**
//   칠하기는 「칸의 왼쪽 위가 범위 안에 있나」로만 판정하니 2027년은 칠해지고(2행 높이로
//   그려져 월 줄까지 파랗게 보이고) 월 칸은 빠져서, 화면에는 **월 줄만 뚫린** 모습이 됐습니다.
//
// **제가 앞서 「엑셀과 같은 동작」이라고 한 것은 틀렸습니다.** 엑셀은 병합 칸에 닿으면
// 선택이 **커집니다.** 여기서는 **줄어들고** 있었습니다. 그래서 결함입니다.
//
// 고친 것 둘:
//   ① growToMerges — 범위가 병합 칸을 통째로 품도록 넓힌다(엑셀과 같게).
//   ② bandRange + 머리 띠 — ①을 고쳐도 「월 1~12 만」은 못 고릅니다(양옆이 2행 병합).
//      그래서 머리를 눌러 그 줄에 **제 칸으로 들어 있는 것만** 고르는 길을 냈습니다.
//
// ebook_html 이식: 2단계에서 미뤄 둔 원본 ①~⑦(EVER-SKETCH1 e38d357)을 3단계에서 **그대로** 되살렸다.
// 뒤에 붙은 「기반(b721df0)」 검사는 2단계에서 쓴 것이다 — 칸 끌기 함수가 표를 통째로 받게
// 바뀐(`startCellDrag(el, …)`) 만큼만 고쳤다. 칸 누름은 편집 중 갈래에도 startCellDrag 가 하나 더
// 있으므로(표 편집 중 다른 칸 누르기 · table_edit_exit) **마지막** 호출을 기준으로 자른다.
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

const { growToMerges, bandRange } = await import('./src/canvas/tableOps.ts')
const fl = bare(read('./src/canvas/FreeLayer.tsx'))
const css = read('./src/index.css')

/** 실제 로드맵과 같은 표 — 18열, 머리글 2줄, 본문 4줄. */
const ROADMAP = {
  rows: 6, cols: 18,
  merges: [
    { r: 0, c: 0, rs: 2, cs: 2 },    // Project (2행 2열)
    { r: 0, c: 2, rs: 1, cs: 12 },   // 2026년 (12열)
    { r: 0, c: 14, rs: 2, cs: 1 },   // 2027년 (2행)
    { r: 0, c: 15, rs: 2, cs: 1 },   // 계획 M/M
    { r: 0, c: 16, rs: 2, cs: 1 },   // 투입 M/M
    { r: 0, c: 17, rs: 2, cs: 1 },   // 비고
  ],
}
const g = (r0, c0, r1, c1) => growToMerges(ROADMAP.merges, r0, c0, r1, c1)
const box = (o) => o && [o.r0, o.c0, o.r1, o.c1].join(',')

// ── ① 영상 속 그 동작 ─────────────────────────────
{
  // Project(0,0) 에서 시작해 오른쪽으로.
  check(box(g(0, 0, 1, 13)) === '0,0,1,13', '월 12 위에서는 0~1행 (예전에도 됐다)')
  // **여기가 신고된 자리다.**
  const at2027 = g(0, 0, 0, 14)
  check(at2027.r0 === 0 && at2027.r1 === 1,
    '**2027년에 닿아도 1행이 안 빠진다** — 예전에는 0~0행으로 줄어 월 1~12 가 통째로 빠졌다',
    box(at2027))
  check(box(g(0, 0, 0, 17)) === '0,0,1,17', '끝까지 끌어도 0~1행이 유지된다', box(g(0, 0, 0, 17)))
  // 월 칸(1행)이 범위 안에 있나 — 그게 「1~12가 포함된다」는 뜻이다.
  for (const end of [14, 15, 16, 17]) {
    const r = g(0, 0, 0, end)
    check(r.r0 <= 1 && r.r1 >= 1, `${end}열까지 끌어도 월 줄(1행)이 범위 안에 있다`, box(r))
  }
}

// ── ② 왼쪽으로 거꾸로, 그리고 한 칸만 ────────────────
{
  check(box(g(1, 13, 1, 2)) === '1,2,1,13', '월 12 → 월 1 (병합에 안 닿음) 그대로 1행')
  check(box(g(1, 13, 0, 0)) === '0,0,1,13', '월 12 → Project 는 0~1행')
  // 병합 칸 하나만 골라도 그 칸 전체를 감싼다 — 선택 테두리가 귀퉁이만 덮던 것도 이걸로 낫는다.
  check(box(g(0, 0, 0, 0)) === '0,0,1,1', 'Project 한 칸을 골라도 2행 2열 전체', box(g(0, 0, 0, 0)))
  check(box(g(0, 2, 0, 2)) === '0,2,0,13', '2026년 한 칸을 골라도 12열 전체', box(g(0, 2, 0, 2)))
  check(box(g(0, 14, 0, 14)) === '0,14,1,14', '2027년 한 칸을 골라도 2행 전체')
  check(box(g(1, 5, 1, 5)) === '1,5,1,5', '병합 아닌 칸은 그대로 한 칸')
}

// ── ③ 되풀이로 번지는 경우 ────────────────────────
// 넓힌 사각형이 **또 다른** 병합에 닿을 수 있다. 한 번만 훑으면 놓친다.
{
  const M = [{ r: 0, c: 0, rs: 1, cs: 2 }, { r: 0, c: 2, rs: 1, cs: 2 }, { r: 0, c: 4, rs: 1, cs: 2 }]
  const r = growToMerges(M, 0, 1, 0, 1)      // 첫 병합만 건드렸는데
  check(box(r) === '0,0,0,1', '옆으로 번지지 않을 때는 거기서 멈춘다', box(r))
  // **차례가 중요하다.** 번지게 하는 병합(세로)이 목록에서 **뒤에** 있으면,
  // 한 번만 훑는 코드는 앞쪽 가로 병합을 이미 지나쳐 버려 놓친다.
  // (처음 쓴 검사는 둘의 차례가 반대여서 한 번만 훑어도 통과했다 — 2026-09-16 파괴 검사 B.)
  const M2 = [{ r: 1, c: 0, rs: 1, cs: 3 }, { r: 0, c: 1, rs: 2, cs: 1 }]
  const r2 = growToMerges(M2, 0, 1, 0, 1)    // 세로 병합 → 1행 → 그제서야 가로 병합 → 0~2열
  check(box(r2) === '0,0,1,2', '**번지면 더 안 커질 때까지 되풀이한다**', box(r2))
}

// ── ④ 병합이 없으면 값이 들지 않는다 ────────────────
{
  check(box(growToMerges(undefined, 2, 3, 5, 7)) === '2,3,5,7', '병합이 없으면 준 값 그대로')
  check(box(growToMerges([], 5, 7, 2, 3)) === '2,3,5,7', '거꾸로 준 값은 바로 세워 돌려준다')
}

// ── ⑤ 머리 띠 — 그 줄에 「제 칸」으로 있는 것만 ────────
{
  const row1 = bandRange(ROADMAP, 'row', 1)
  check(box(row1) === '1,2,1,13',
    '**월 줄 머리를 누르면 딱 1~12** — Project·2027년은 0행 칸이라 안 들어온다', box(row1))
  const row0 = bandRange(ROADMAP, 'row', 0)
  check(box(row0) === '0,0,1,17', '0행 머리는 머리글 전체 (2행 병합들이 1행까지 뻗는다)', box(row0))
  const row2 = bandRange(ROADMAP, 'row', 2)
  check(box(row2) === '2,0,2,17', '본문 줄은 18칸 한 줄', box(row2))
  const col5 = bandRange(ROADMAP, 'col', 5)
  check(box(col5) === '1,5,5,5',
    '**「4」월 열 머리를 누르면 그 열만** — 2026년(0행 12열 병합)은 안 딸려 온다', box(col5))
  const col0 = bandRange(ROADMAP, 'col', 0)
  check(box(col0) === '0,0,5,1', '0열 머리는 Project 병합 폭까지', box(col0))
  check(bandRange(ROADMAP, 'row', 99) === null, '없는 줄은 null')
  check(bandRange(ROADMAP, 'col', -1) === null, '음수도 null')
  // 제 칸이 하나도 없는 줄(위 병합에 통째로 덮인 줄)
  const covered = { rows: 2, cols: 2, merges: [{ r: 0, c: 0, rs: 2, cs: 2 }] }
  check(bandRange(covered, 'row', 1) === null, '통째로 덮인 줄은 고를 게 없다 → null')
}

// ── ⑥ 화면이 이 길들을 쓴다 ───────────────────────
{
  // **모든 범위 잡기가 한 문으로 들어와야 한다.** 한 군데라도 새면 거기서만 옛 결함이 산다.
  check(/function pickRange\(el: FreeEl, r0: number, c0: number, r1: number, c1: number\) \{/.test(fl),
    '범위를 잡는 문이 하나 있다')
  check(/const g = growToMerges\(el\.merges, r0, c0, r1, c1\)/.test(fl), '그 문이 병합을 반영한다')
  const direct = (fl.match(/setTableSel\(\{/g) || []).length
  check(direct === 3,
    '`setTableSel` 을 직접 부르는 자리는 **세 곳뿐**이다 (pickRange · pickBand · 띠 끌기)',
    '지금 ' + direct + '곳')
  // 끌기가 넓히는지
  const drag = fl.slice(fl.indexOf('function startCellDrag'), fl.indexOf('function onLayerDown'))
  check(/pickRange\(el, r0, c0, r, c\)/.test(drag), '**끌기가 그 문으로 들어간다** — 신고된 그 동작')
  check(!/setTableSel\(\{ elId, r0, c0/.test(drag), '끌기에 옛 줄이 안 남아 있다')
  // 클릭·Shift클릭·방향키·Tab
  check(/pickRange\(el, ts\.r0, ts\.c0, r, c\)/.test(fl), 'Shift 클릭도 그 문으로')
  check(/pickRange\(el, r, c, r, c\)/.test(fl), '클릭도 그 문으로')
  check(/pickRange\(el, nr, nc, nr, nc\)/.test(fl), '방향키도 그 문으로')
  check(/pickRange\(el, r, nc, r, nc\)/.test(fl), 'Tab 도 그 문으로')
}

// ── ⑦ 머리 띠가 화면에 있다 ───────────────────────
{
  check(/className="trk-band trk-band-col"/.test(fl) && /className="trk-band trk-band-row"/.test(fl),
    '열 띠와 행 띠 둘 다 그린다')
  check(/function pickBand\(el: FreeEl, axis: 'row' \| 'col', i: number\)/.test(fl), '눌러 고르는 문이 있다')
  check(/const r = bandRange\(el, axis, i\)/.test(fl), '그 문이 bandRange 를 쓴다')
  // **여기서 growToMerges 를 쓰면 안 된다** — 쓰면 월 줄을 눌러도 양옆 병합이 딸려 온다.
  const band = fl.slice(fl.indexOf('function pickBand'), fl.indexOf('function startBandDrag'))
  check(!/growToMerges/.test(band),
    '**머리 띠는 넓히지 않는다** — 넓히면 월 줄을 눌러도 2행이 되어 이 기능이 무의미해진다')
  check(/function startBandDrag/.test(fl), '띠를 끌면 여러 줄이 이어서 골라진다')
  // 띠는 손잡이 **아래**에 깔려야 경계에서 크기 조절이 이긴다.
  const iBand = fl.indexOf("className=\"trk-band trk-band-col\"")
  const iGrip = fl.indexOf("className=\"trk-grip trk-col\"")
  check(iBand > 0 && iGrip > 0 && iBand < iGrip,
    '**띠를 먼저 그리고 손잡이를 그 위에 얹는다** — 경계에서는 크기 조절이 이긴다')
  check(/\.trk-band\{[^}]*z-index:6/.test(css) && /\.trk-grip\{[^}]*z-index:7/.test(css),
    '겹 순서도 CSS 가 같이 지킨다 (띠 6 < 손잡이 7)')
  check(/\.trk-band\{[^}]*cursor:pointer/.test(css), '띠 위에서는 누를 수 있다고 커서가 말한다')
  check(/\.trk-band:hover::before\{opacity:\.22\}/.test(css), '올리면 어느 줄인지 보인다')
}

// ━━ 기반(b721df0) — 2단계 이식 때 쓴 검사 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ── ① 끌어서 범위 고르기 ───────────────────────────
{
  check(/function startCellDrag\(el: FreeEl, r0: number, c0: number, from: Element\)/.test(fl),
    '칸 끌기 함수(startCellDrag)가 있다')
  const drag = fl.slice(fl.indexOf('function startCellDrag'), fl.indexOf('function onLayerDown'))
  check(/document\.elementFromPoint\(ev\.clientX, ev\.clientY\)/.test(drag), '커서 밑의 **실제 칸**을 짚는다')
  check(/closest\('\[data-tel\]'\)/.test(drag) && /cell\.dataset\.tel !== String\(elId\)/.test(drag),
    '다른 표의 칸은 받지 않는다(data-tel)')
  check(/layer\.contains\(cell\)/.test(drag), '같은 레이어 안의 칸만 받는다 — 필름 미리보기의 같은 칸에 속지 않는다')
  // (3단계) 「끄는 동안 setTableSel({ elId, r0, c0, r1: r, c1: c })」 검사는 원본 ⑥ 「끌기가 그 문(pickRange)으로
  // 들어간다 · 옛 줄이 안 남아 있다」로 **대체**됐다 — 같은 일을 더 세게 본다.
  check(/data-tel=\{el\.id\} data-r=\{r\} data-c=\{c\}/.test(fl), '칸마다 data-tel · data-r · data-c 를 단다')
  check(/startCellDrag\(el, r, c, e\.currentTarget\)/.test(fl), '칸 누름이 startCellDrag 로 들어간다')
}

// ── ② 칸 위 누름은 표를 옮기지 않는다 ─────────────────
{
  // 칸의 onPointerDown 몸통만 떼어 본다.
  const i = fl.lastIndexOf('startCellDrag(el, r, c, e.currentTarget)')
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
  const i = fl.lastIndexOf('startCellDrag(el, r, c, e.currentTarget)')
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

// ━━ 3단계 ebook_html 덧붙임 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ⑧ 표에는 연결점을 띄우지 않는다(EVER-SKETCH1 824ec0e 의 NO_CPT 한 줄만 — 양식 판정은 빼고).
//    표에 점이 붙으면 칸을 잡으려다 선이 그어진다.
{
  // 2026-10-07: 목록은 model.ts 한 곳(NO_CPT)으로 옮겼다 — 캔버스 · 도구줄 동작 묶음 · 머메이드 뽑기가 같은 목록을 본다.
  const m = /export const NO_CPT = \[([^\]]*)\]/.exec(bare(read('./src/canvas/model.ts')))
  check(!!m && /'table'/.test(m[1]) && /NO_CPT/.test(fl), '**표에는 연결점을 안 띄운다** — 칸을 잡으려다 선이 그어지지 않게', m ? m[1] : '못 찾음')
}
// ⑨ 오른쪽 패널의 표 안내가 ⠿ 손잡이와 맞는다. 칸 위 누름은 칸 고르기라
//    「표 가장자리를 끌어」 옮긴다는 옛 말은 틀렸다(가장자리를 잡으면 편집만 풀린다).
{
  const rp = bare(read('./src/builder/chrome/RightPanel.tsx'))
  check(!/표 자체를 옮길 땐 표 가장자리를 끌거나/.test(rp), '옛 안내(「표 가장자리를 끌거나 방향키」)가 없다')
  check(/⠿/.test(rp), '표를 옮기는 길로 ⠿ 손잡이를 말한다')
  // ⑩ 행을 넣어 표가 커질 때 종이 밖으로 밀려나지 않게 자른다(EVER-SKETCH1 bc8baa1 fitPage).
  //    원본은 양식 슬롯 표에만 걸었다 — 이 저장소에는 슬롯이 없으므로 모든 표에 건다.
  check(/updateEl\(page\.id, el\.id, fitPage\(el, pt\)\)/.test(rp), '표 고치기가 종이 크기로 자르는 문(fitPage)을 거친다')
  check(!/isSlotEl/.test(rp), '슬롯 판정은 들이지 않는다')
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
