// 오른쪽 패널 묶음(C-1 · C-2 · C-3) 과 「병합은 도구줄 한 곳」 을 못박는다.
//
// **왜 이 검사가 필요한가.** 여기서 하는 일은 대부분 「자리를 옮기고 붙이는」 것이라
// 타입이 안 잡아 준다. 버튼 하나가 조용히 사라져도 `tsc` 는 초록이다.
//
// ebook_html 이식(5단계 · EVER-SKETCH1 22dd552 · 3c07f77 · a48539f C-1/C-2 · 93ecb00 · 2846b9a):
//   · 원본 B-1 · B-2 · B-3(결재 카드 `ApprovalCard` — 반려 사유 · 낸 것 보기 · 수정 그만두기)은 뺐다 —
//     결재가 이 저장소에 없다.
//   · 원본의 「진행 표시 · 채우기」 이름 갈림(`palette ?`)은 뺐다 — 표준 양식 슬롯이 없어
//     이름은 늘 「채우기」 하나다. 그 이름이 **묶음으로** 붙었는지를 대신 본다.
//   · 4단계에서 옛 탭 패널에 더한 것(표 채우기 · 표 테두리 「없음」 · 선 모양 · 정렬 그림)이
//     묶음으로 옮긴 뒤에도 **남았는지**를 더 본다(⑤).
//
// 실행: node --experimental-strip-types --import ./ts_register.mjs panel_tools.test.mjs

import { readFileSync } from 'node:fs'
import { openSections } from './src/persistence/prefs.ts'

const read = (p) => readFileSync(new URL(p, import.meta.url).pathname, 'utf8')
// 주석을 걷어 낸 소스 — 안 그러면 주석에 적힌 글자가 검사를 거짓으로 통과시킨다.
const bare = (src) => src
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
const readBare = (p) => bare(read(p))

let pass = 0, fail = 0
const check = (cond, label, extra = '') => {
  if (cond) { pass++; console.log('✓ ' + label) }
  else { fail++; console.log('✗ ' + label + (extra ? '  — ' + extra : '')) }
}

const tb = readBare('./src/builder/chrome/EditToolbar.tsx')
const rp = readBare('./src/builder/chrome/RightPanel.tsx')

// (ebook_html) 원본 B-1 · B-2 · B-3 은 결재 카드 검사라 뺐다(결재 없음).

// ── C-1. 툴바 둘째 줄이 고른 것을 따라간다 ───────────
{
  check(/ctx === 'text' \? <TextTools \/> : ctx === 'conn' \? <ConnTools \/> : <TableTools \/>/.test(tb),
    'C-1 · 고른 것에 따라 갈린다 (표 · 글자 · 연결선)')
  check(/function TextTools\(/.test(tb) && /function ConnTools\(/.test(tb),
    'C-1 · 글자 도구와 연결선 도구가 실제로 있다')

  // **첫째 줄은 안 건드린다.** 줄이 생겼다 없어지면 툴바 높이가 변하고 그만큼 문서가 움직인다.
  check(/<div className="ax-tbrow ctx">/.test(tb),
    'C-1 · 자리는 고정 — 둘째 줄이 사라지지 않는다(높이가 변하면 문서가 움직인다)')
  check(/ctx: 'table' \| 'text' \| 'conn' = el && el\.type === 'table' \? 'table'/.test(tb),
    'C-1 · **표가 먼저다** — 표의 병합은 툴바에만 있다')
  // (ebook_html) 연결선 도구의 기본 모양은 캔버스가 그리는 기본(`'ortho'`)과 같아야 한다 —
  // 원본은 도구줄만 'straight' 로 읽어 **그려진 모양과 눌린 단추가 어긋났다.**
  const ct = tb.slice(tb.indexOf('function ConnTools'), tb.indexOf('function TableTools'))
  check(/conn\.kind \|\| 'ortho'/.test(ct) && !/conn\.kind \|\| 'straight'/.test(ct),
    'C-1 · 연결선 도구의 기본 모양이 캔버스와 같다(직각)')
  check(/pushSnap\(/.test(ct), 'C-1 · 연결선을 고치기 전에 되돌릴 자리를 찍는다')
}

// ── C-2. 접고 편 상태를 기억한다 ────────────────────
{
  check(/openSections\(SECS,/.test(rp), 'C-2 · 펴 둔 묶음을 읽어서 시작한다')
  check(/rememberOpenSections\(next\)/.test(rp), 'C-2 · 접거나 펼 때 기억한다')

  // **여기가 C-2 의 진짜 자물쇠다.** 기억해 놓고도 선택이 바뀔 때 넷을 다 닫아 버리면
  // 기억은 한 번도 화면에 못 나온다.
  check(/setOpenSec\(\(o\) => \(o\[k\] \? o : \{ \.\.\.o, \[k\]: true \}\)\)/.test(rp),
    'C-2 · 선택이 바뀌어도 **나머지는 안 건드린다** — 그 묶음만 펴 준다')
  check(!/setOpenSec\(\{ table: false, style: false/.test(rp),
    'C-2 · 넷을 다 닫는 옛 방식이 남아 있지 않다')

  // 순수 함수라 여기서 바로 시험한다.
  const KNOWN = ['table', 'style', 'text', 'arrange']
  const FB = { table: true, style: false, text: false, arrange: false }
  let threw = null
  let got = null
  try { got = openSections(KNOWN, FB) } catch (e) { threw = e }
  check(threw === null, 'C-2 · 저장이 막힌 데서도 안 터진다(node 에는 localStorage 가 없다)',
    threw ? threw.message : '')
  check(got && got.table === true && got.arrange === false,
    'C-2 · 못 읽으면 기본값 그대로', JSON.stringify(got))
  check(got !== FB, 'C-2 · 기본값 객체를 그대로 돌려주지 않는다 — 돌려주면 부르는 쪽이 그걸 고친다')

  // (ebook_html) 저장된 값이 있으면 **아는 이름만** 받는다 — 옛 판 키가 섞여도 늘지 않는다.
  const mem = {}
  globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v) } }
  const { rememberOpenSections } = await import('./src/persistence/prefs.ts')
  rememberOpenSections({ table: false, arrange: true, style: 'yes', ghost: true })
  const back = openSections(KNOWN, FB)
  check(back.table === false && back.arrange === true, 'C-2 · 기억한 값을 다시 읽는다', JSON.stringify(back))
  check(back.style === false && !('ghost' in back), 'C-2 · 모르는 이름과 참/거짓 아닌 값은 버린다', JSON.stringify(back))
  delete globalThis.localStorage
}

// ── C-3 · 묶음을 일 단위로 다시 나눴다 ───────────────
//
// 착수계획의 위험: 「C-3 재편이 도구를 잃는다 — 재배치 전에 **지금 있는 도구를 전부**
// **세는 검사를 먼저 만든다**」. 옮긴 뒤 그 숫자가 **줄지 않았는지**를 여기서 본다.
// (원본의 옮기기 전: 묶음 4 · 버튼 26 · 숫자칸 8. ebook_html 옛 탭 패널은 병합 두 단추를 더해
//  버튼 28 이었는데, 병합은 도구줄 한 곳으로 옮겼다(3c07f77) — 그 둘을 뺀 26 을 바닥으로 본다.)
{
  const accs = (rp.match(/<Acc k=/g) || []).length
  const pills = (rp.match(/insp-pill/g) || []).length
  const nums = (rp.match(/numRow\(/g) || []).length + (rp.match(/<NumInput/g) || []).length

  check(accs >= 10, 'C-3 · 묶음이 열 자리에 놓였다 (표 여섯 · 그 밖 넷)', accs + '곳')
  check(pills >= 26, 'C-3 · 패널 버튼이 안 줄었다 (옮기기 전 26)', pills + '개')
  check(nums >= 8, 'C-3 · 숫자 입력 칸이 안 줄었다 (옮기기 전 8)', nums + '개')

  // **숫자보다 이게 세다.** 개수는 맞는데 「불투명도」 하나가 통째로 빠질 수 있다.
  const BEFORE = ['활성 셀', '행', '열', '셀 정렬', '셀 글자 크기', '테두리 · 헤더',
    '사진', '프리셋 스타일', '채우기', '테두리', '불투명도', '효과',
    '글자', '정렬', '순서', '크기', '위치', '회전', '뒤집기', '잠금', '그룹']
  const missing = BEFORE.filter((t) => !rp.includes('className="insp-sec">' + t))
  check(missing.length === 0, 'C-3 · **옮기기 전 이름표가 하나도 안 빠졌다**',
    missing.length ? '빠짐: ' + missing.join(' , ') : '')

  for (const t of ['칸', '행', '채우기', '표 전체 글자', '크기 · 자리', '테두리 · 머리글',
    '모양 · 색', '글자', '효과 · 순서']) {
    check(rp.includes('t="' + t + '"'), `C-3 · 묶음 「${t}」`)
  }
  // (ebook_html) 원본의 「진행 표시 · 채우기」 이름 갈림 두 검사는 뺐다 — 양식 슬롯이 없다.
  check(!/'칸 색'/.test(rp), 'C-3 · 옛 이름 「칸 색」이 패널에 안 남아 있다')

  // 옛 이름이 남아 있으면 반쯤 옮긴 것이다.
  check(!/t="(스타일|정렬|표)"/.test(rp), 'C-3 · 옛 묶음 이름(스타일·정렬·표)이 안 남았다')
  check(!/insp-tabs/.test(rp) && !/setTab\(/.test(rp), 'C-3 · 탭 막대가 없다')

  // 시안이 든 문제 그 자체: 「크기」가 「정렬」 안에 있으면 안 된다.
  const geomBlock = rp.slice(rp.indexOf('t="크기 · 자리"'))
  check(/insp-sec">크기</.test(geomBlock.slice(0, 1400)),
    'C-3 · **「크기」가 「크기 · 자리」 안에 있다** — 시안이 든 바로 그 문제')

  // **접힌 줄이 지금 값을 말한다**(22dd552) — 그게 접이식의 값어치다.
  for (const k of ['cell', 'row', 'stage', 'look', 'text', 'geom', 'extra', 'border']) {
    check(new RegExp('\\n\\s+' + k + ': ').test(rp.slice(rp.indexOf('const secSub'))), `C-3 · 접힌 줄 요약 「${k}」`)
  }
  check((rp.match(/sub=\{secSub\.\w+\}/g) || []).length === accs, 'C-3 · 모든 묶음이 요약을 단다')

  console.log(`   ↳ 옮긴 뒤  묶음 ${accs} · 버튼 ${pills} · 숫자칸 ${nums}`)
}

// ── 3c07f77 · 병합은 도구줄 한 곳 · 패널은 무엇을 고치는지 말한다 ─────
{
  check(!/mergeRange|unmergeAt/.test(rp), '병합 · 병합 해제가 패널에 없다 — 도구줄 한 곳')
  check(/mergeRange\(table/.test(tb) && /unmergeAt\(table/.test(tb), '도구줄에는 그대로 있다')
  check(/위 툴바의 <b>표 ⤢ 병합<\/b>/.test(rp), '패널은 그 자리를 알려만 준다')
  check(/className="insp-who"/.test(rp), '무엇을 골랐는지 패널 맨 위에 적는다')
  check(/EL_NAME\[el\.type\] \|\| '도형'/.test(rp), '이름은 생김새로 부른다(양식 이름표는 이 저장소에 없다)')
}

// ── 2846b9a · 접이식 부품은 파일 맨 바깥 ─────────────
// (inner_component.test.mjs 가 저장소 전체를 본다. 여기서는 패널이 값을 넘기는지만.)
check(/^function Acc\(/m.test(read('./src/builder/chrome/RightPanel.tsx')), '접이식 묶음이 파일 맨 바깥에 있다')

// ── ⑤ (ebook_html) 4단계에서 더한 것이 묶음으로 옮긴 뒤에도 남았는가 ─────
{
  const blk = (t) => { const i = rp.indexOf('t="' + t + '"'); return i < 0 ? '' : rp.slice(i, rp.indexOf('</Acc>', i)) }
  const fill = blk('채우기'), border = blk('테두리 · 머리글'), look = blk('모양 · 색'), text = blk('글자'), cell = blk('칸')
  check(/cellColors\(\)\.map/.test(fill) && /es-cbg-more/.test(fill), '⑤ 표 채우기 — 자유 색 · 다른 색')
  check(/setCellBgRange\(el, ts\.r0, ts\.c0, ts\.r1, ts\.c1, color\)/.test(fill), '⑤ 표 채우기 — 고른 범위를 칠한다')
  check(/setCellBgRange\(el, ts\.r0, ts\.c0, ts\.r1, ts\.c1, null\)/.test(fill), '⑤ 표 채우기 — 지우는 길')
  check(/disabled=\{!ts\}/.test(fill), '⑤ 표 채우기 — 칸을 안 고르면 잠긴다')
  check(/<option value=\{0\}>없음<\/option>/.test(border), '⑤ 표 테두리 「없음」')
  check(/value=\{el\.borderDash \|\| 'solid'\}/.test(border) && /점선/.test(border), '⑤ 표 테두리 선 모양')
  check(/value=\{el\.borderDash \|\| 'solid'\}/.test(look), '⑤ 도형 테두리 선 모양')
  check(/<AlignIcon dir=\{d\} \/>/.test(cell) && /<VAlignIcon dir=\{d\} \/>/.test(cell), '⑤ 칸 정렬은 그림')
  check(/<AlignIcon dir=\{d\} \/>/.test(text), '⑤ 글자 정렬도 그림')
  check(!/[⇤⇔⇥⤒⇕⤓]/.test(rp), '⑤ 정렬 글자(⇤⇔⇥)가 어디에도 안 남았다')
  check(/<NumInput value=\{cellFs\}/.test(cell) && /<NumInput value=\{el\.fs\}/.test(text), '⑤ 글자 크기는 NumInput')
  check(/fitPage\(el, pt\)/.test(rp) && /tableAtCeiling/.test(rp), '⑤ 행을 넣으면 표가 크고, 천장에서 말한다')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
