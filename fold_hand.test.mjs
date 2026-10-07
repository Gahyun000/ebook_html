// **접기는 손으로 이은 그림에서도**(2026-10-07 · EverSketch 불편점 10번).
//
// 사용자: 「mermaid로 생성한 경우 접히는 기능이 동작하지만, 도형으로 생성한 것의 경우 접는 collapse기능이 동작하지 않음」.
// ＋점·「→ 연결」로 이은 쪽은 `treeRoots` 가 없어 트리 쪽이 아니고(treeOps.isTreePage), 접기 손잡이도 안 떴다.
// 결정: 접기 손잡이는 **부모→자식 선이 있으면** 뜬다(마인드맵 쪽 제외). 트리 쪽이 아니면 **자리는 안 옮기고** 접힘만 표시한다 —
// 손으로 놓은 자리가 곧 그림이라서다. 트리 쪽(키로 붙인 것)은 지금처럼 다시 앉는다(간격을 되찾는다).
//
// 실행: node --experimental-strip-types --import ./ts_register.mjs fold_hand.test.mjs
import { readFileSync } from 'node:fs'
const { useBuilder } = await import('./src/state/store.ts')
const { mkFreeEl } = await import('./src/canvas/model.ts')
const { isTreePage, treeShape, knownOf } = await import('./src/cards/treeOps.ts')

let pass = 0, fail = 0
const check = (c, label, extra = '') => {
  if (c) { pass++; return }
  fail++; console.log('  X ' + label + (extra ? '  — ' + extra : ''))
}
const bare = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const S = () => useBuilder.getState()
const cur = () => S().pages.find((p) => p.id === S().selectedPageId)
const at = (p) => p.els.map((e) => [e.id, e.x, e.y]).join('|')
const el = (p, id) => p.els.find((e) => e.id === id)
function overlaps(p) {
  const shown = p.els.filter((e) => !e.hidden); let n = 0
  for (let i = 0; i < shown.length; i++) for (let j = i + 1; j < shown.length; j++) {
    const a = shown[i], b = shown[j]
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) n++
  }
  return n
}
S().setOrientation('landscape')

// ── 1. 손으로 이은 셋(가→나→다) + 선 없는 메모 ─────────────────────
{
  S().addCard('slide'); let p = cur()
  const a = mkFreeEl('box', 100, 100), b = mkFreeEl('box', 300, 100), c = mkFreeEl('box', 500, 100), memo = mkFreeEl('box', 100, 300)
  S().addEl(p.id, a); S().addEl(p.id, b); S().addEl(p.id, c); S().addEl(p.id, memo)
  S().addConn(p.id, { from: a.id, to: b.id }); S().addConn(p.id, { from: b.id, to: c.id })
  p = cur()
  check(!isTreePage(p), '(준비) 손으로 이은 쪽은 트리 쪽이 아니다')
  const sh = treeShape(p.els, p.conns, knownOf(p))
  check((sh.kids.get(a.id) || []).length === 1 && (sh.kids.get(b.id) || []).length === 1, '(준비) 선에서 부모·자식을 읽는다')
  const before = at(p)
  S().treeFold(p.id, a.id); p = cur()
  check(el(p, a.id).folded === true, '「가」 에 접힘 표시가 붙는다')
  check(el(p, b.id).hidden === true && el(p, c.id).hidden === true, '그 아래 둘(나 · 다)이 숨는다')
  check(!el(p, a.id).hidden && !el(p, memo.id).hidden, '자기와 선 없는 메모는 보인다')
  check(at(p) === before, '**상자가 하나도 안 움직인다** — 손으로 놓은 자리가 곧 그림이다', `${before}\n   → ${at(p)}`)
  check(!isTreePage(p), '접었다고 트리 쪽이 되지는 않는다(Delete · 방향키 규칙은 그대로)')
  S().treeFold(p.id, a.id); p = cur()
  check(!el(p, a.id).folded && !el(p, b.id).hidden && !el(p, c.id).hidden && at(p) === before, '한 번 더 누르면 펴진다 · 자리 그대로')
  // 가운데를 접으면 그 아래만
  S().treeFold(p.id, b.id); p = cur()
  check(el(p, b.id).folded && !el(p, b.id).hidden && el(p, c.id).hidden && !el(p, a.id).hidden, '가운데(나)를 접으면 「다」 만 숨는다')
  S().treeFold(p.id, b.id)
}
// ── 2. 키로 붙인 쪽도 — 접고 펴도 **자리는 그대로**(2026-10-07 2차 6번: 재정렬 없음) ─────────────────────
{
  S().addCard('slide'); let p = cur()
  const r = mkFreeEl('box', 200, 220); S().addEl(p.id, r)
  for (let i = 0; i < 3; i++) S().treeAdd(cur().id, r.id, 'right')
  p = cur()
  check(isTreePage(p), '(준비) 키로 붙인 쪽은 트리 쪽이다')
  const before = at(p)
  S().treeFold(p.id, r.id); p = cur()
  check(el(p, r.id).folded && p.els.filter((e) => e.id !== r.id).every((e) => e.hidden), '뿌리를 접으면 자식 셋이 숨는다')
  check(at(p) === before, '접어도 자리 그대로')
  S().treeFold(p.id, r.id); p = cur()
  check(p.els.every((e) => !e.hidden) && overlaps(p) === 0 && at(p) === before, '펴도 자리 그대로 · 겹침 없음', `겹침 ${overlaps(p)}`)
}
// ── 3. 화면 — 접기 손잡이는 손으로 이은 그림에도 · 글칸 키 규칙은 트리 쪽 그대로 ────────
{
  const fl = bare(readFileSync('./src/canvas/FreeLayer.tsx', 'utf8'))
  check(/const graphShape = /.test(fl) && /\{graphShape \? shownEls\.map\(\(el\) => \{/.test(fl), '접기 손잡이는 `graphShape`(선이 있으면) 로 그린다')
  check(/page\.conns\.length \? treeShape\(page\.els, page\.conns, knownOf\(page\)\) : null/.test(fl), '트리 쪽이 아니어도 선이 있으면 모양을 읽는다')
  // 2026-10-07 2차(4번 「머메이드와 도형은 별개가 아님」): 선으로 이어진 상자는 어디서 만들었든 도식의 상자다 — Enter 는 글 끝내기.
  check(/const inGraph = !!\(graphShape && graphShape\.members\.includes\(tid\)\)/.test(fl) && /if \(!inGraph && pristineRef\.current !== el\.id\) return/.test(fl), '글칸의 Enter · 가지 키는 **선으로 이어진 상자**면 듣는다(머메이드 · 키 · ＋점 가리지 않고)')
  const st = bare(readFileSync('./src/state/store.ts', 'utf8'))
  const i = st.indexOf('treeFold: (pageId, elId)')
  check(i > 0 && !/seatTree|layoutTree/.test(st.slice(i, i + 900)), '스토어의 접기는 어느 쪽에서든 자리를 안 옮긴다')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
