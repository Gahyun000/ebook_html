// **머메이드 글을 고쳐 그림에 적용한다**(2026-10-07 · 추가 요청 1 「도형을 통해서 만들었는데 머메이드 소스를 볼 수 있음. 여기에서도 소스를 변경을 통해서 수정할 수 있도록」).
//
// 규칙(store.applyMermaid): 번호(n1 … = mermaidOut 의 순서)가 같은 상자는 그대로(자리 · 모양) · 글 · 모양은 **뽑았던 것과 다를 때만** 고침(전각 괄호 때문에
// 안 고친 상자가 바뀌면 안 된다) · 원문에 없는 번호는 그 상자 하나만 지움(자식은 원문대로 남는다) · 새 번호는 들어오는 선의 부모 옆에(Space 와 같은 자리 · 부모를 닮음 ·
// 열 다시 세움) 없으면 빈 자리의 뿌리 · 선은 원문대로(있던 선의 모양은 그대로 · 새 선은 한 벌) · 못 읽는 줄이 있으면 아무것도 안 바꾼다. 화면은 스모크 14단계 「[추가 1]」.
//
// 실행: node --experimental-strip-types --import ./ts_register.mjs mermaid_apply.test.mjs
import { readFileSync } from 'node:fs'
const { useBuilder } = await import('./src/state/store.ts')
const { mkFreeEl } = await import('./src/canvas/model.ts')
const { mermaidOfPage } = await import('./src/cards/mermaidOut.ts')
const { treeShape, knownOf } = await import('./src/cards/treeOps.ts')
const { GAP_SIDE } = await import('./src/canvas/placeNext.ts')

let pass = 0, fail = 0
const check = (c, label, extra = '') => {
  if (c) { pass++; return }
  fail++; console.log('  X ' + label + (extra ? '  — ' + extra : ''))
}
const S = () => useBuilder.getState()
const cur = () => S().pages.find((p) => p.id === S().selectedPageId)
const J = (v) => JSON.stringify(v)
const posOf = (pg) => pg.els.map((e) => [e.id, e.x, e.y, e.w, e.h]).join('|')
const overlaps = (pg) => { const v = pg.els.filter((e) => !e.hidden); let n = 0
  for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) { const a = v[i], b = v[j]; if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) n++ }
  return n }
S().setOrientation('landscape')

S().addCard('slide'); const p = cur()
const R = mkFreeEl('box', 120, 240); R.text = '뿌리 (초안)'; S().addEl(p.id, R)
S().treeAdd(p.id, R.id, 'right'); const A = cur().els[1]; S().updateEl(p.id, A.id, { text: 'A' })
S().treeAdd(p.id, A.id, 'sibling'); const B = cur().els[2]; S().updateEl(p.id, B.id, { text: 'B' })
const src0 = mermaidOfPage(cur())
check(src0 === 'graph LR\n  n1[뿌리 （초안）] --> n2[A]\n  n1 --> n3[B]', '(준비) 뽑은 글 — 괄호는 전각으로', src0)

// ① 그대로 적용 → 아무것도 안 바뀐다(전각 괄호가 글을 바꾸지 않는다)
{
  const before = posOf(cur()); const r = S().applyMermaid(p.id, src0)
  check(r.errors.length === 0 && r.added === 0 && r.removed === 0 && r.changed === 0 && posOf(cur()) === before && cur().els[0].text === '뿌리 (초안)', '그대로 적용 → 상자 · 자리 · 글(반각 괄호) 그대로', J(r))
}
// ② 상자 보태기 — n2(A) 의 자식
const N = (() => { const r = S().applyMermaid(p.id, src0 + '\n  n2 --> n4[새것]'); const N = cur().els.find((e) => e.text === '새것')
  const A2 = cur().els.find((e) => e.id === A.id)
  check(r.added === 1 && N && N.x === A2.x + A2.w + GAP_SIDE && N.y === A2.y && N.type === A2.type && N.w === A2.w, '새 번호는 들어오는 선의 부모(A) 옆에 · 부모를 닮는다', N && J([N.x, N.y, A2.x, A2.y, N.type]))
  check(cur().conns.some((c) => c.from === A.id && c.to === N.id && c.color === '#8b93a5' && c.width === 2 && c.axis === 'h'), '선은 A → 새것 · 한 벌 색 · 가로 축')
  check(cur().els[0].x === 120 && cur().els[0].y === 240 && overlaps(cur()) === 0, '뿌리는 제자리 · 겹침 없음')
  return N })()
const srcN = mermaidOfPage(cur())
check(/n2 --> n4\[새것\]/.test(srcN), '다시 뽑으면 새 상자가 n4 로', srcN)
// ③ 글 · 모양 고치기 — 그 상자만
const pos3 = posOf(cur())
{
  const r = S().applyMermaid(p.id, srcN.replace('n4[새것]', 'n4{바꿈}'))
  const N2 = cur().els.find((e) => e.id === N.id)
  check(r.changed === 1 && r.added === 0 && r.removed === 0 && N2.text === '바꿈' && N2.type === 'diamond' && posOf(cur()) === pos3, '글은 「바꿈」 · 모양은 마름모 · 자리 그대로', J([r, N2.text, N2.type]))
}
// ④ 선만 바꾸기 — 바꿈을 B 아래로 옮겨 달기(자리는 안 옮긴다)
{
  const r = S().applyMermaid(p.id, mermaidOfPage(cur()).replace('n2 --> n4', 'n3 --> n4'))
  check(r.errors.length === 0 && cur().conns.some((c) => c.from === B.id && c.to === N.id) && !cur().conns.some((c) => c.from === A.id && c.to === N.id) && posOf(cur()) === pos3, '선이 B → 바꿈 으로 · A → 바꿈 은 없어짐 · 자리 그대로', J(cur().conns.map((c) => [c.from, c.to])))
}
// ⑤ 지우기 — 번호를 빼면 그 상자 하나만(자식은 남아 원문대로 이어진다)
{
  const r = S().applyMermaid(p.id, 'graph LR\n  n1[뿌리 （초안）] --> n2[A]\n  n1 --> n4{바꿈}')   // n3(B) 를 뺐다 — 바꿈은 뿌리 아래로
  check(r.removed === 1 && !cur().els.some((e) => e.id === B.id) && cur().els.some((e) => e.id === N.id) && cur().conns.some((c) => c.from === R.id && c.to === N.id) && !cur().conns.some((c) => c.from === B.id || c.to === B.id),
    'B 만 지워지고 바꿈은 뿌리에 이어진다', J([r, cur().conns.map((c) => [c.from, c.to])]))
  check(cur().els.length === 3 && posOf(cur()).split('|').length === 3, '상자 셋 — 흐린 상자 없음')
}
// ⑥ 외톨이 · 새 부모 + 새 자식
{
  const r = S().applyMermaid(p.id, mermaidOfPage(cur()) + '\n  x[외톨이]\n  n1 --> p[부모]\n  p --> c[자식]')
  const X = cur().els.find((e) => e.text === '외톨이'), Pn = cur().els.find((e) => e.text === '부모'), Cn = cur().els.find((e) => e.text === '자식')
  check(r.added === 3 && X && Pn && Cn && Cn.x === Pn.x + Pn.w + GAP_SIDE && cur().conns.some((c) => c.from === Pn.id && c.to === Cn.id) && cur().conns.some((c) => c.from === R.id && c.to === Pn.id),
    '새 부모는 뿌리 옆에 · 새 자식은 새 부모 옆에 · 선도', J([Pn && [Pn.x, Pn.y], Cn && [Cn.x, Cn.y]]))
  check(X && !cur().conns.some((c) => c.from === X.id || c.to === X.id) && (cur().treeRoots || []).includes(X.id) && overlaps(cur()) === 0, '외톨이는 선 없이 빈 자리에 · 명단에(트리 쪽에 남는다) · 겹침 없음', J(cur().els.map((e) => [e.text, e.x, e.y])))
  const sh = treeShape(cur().els, cur().conns, knownOf(cur()))
  check(X && sh.members.includes(X.id) && sh.roots.includes(X.id), '외톨이도 트리의 뿌리로 읽힌다')
  const again = mermaidOfPage(cur())
  check(/x?\[외톨이\]/.test(again) && /\[부모\]/.test(again) && /\[자식\]/.test(again) && S().applyMermaid(p.id, again).changed === 0, '다시 뽑아 그대로 적용하면 아무것도 안 바뀐다(글 → 그림 → 글)', again)
}
// ⑦ 못 읽는 줄 → 아무것도 안 바꾼다
{
  const pos7 = posOf(cur()), n7 = cur().conns.length
  const r = S().applyMermaid(p.id, 'graph LR\n  n1 --> \n  n1 --> n2')
  check(r.errors.length === 1 && r.errors[0].line === 2 && posOf(cur()) === pos7 && cur().conns.length === n7 && cur().els.length === 6, '못 읽는 줄(2째)이 있으면 손대지 않는다', J(r.errors))
}
// ⑧ 패널 — 창은 고칠 수 있고 「적용」 이 되돌리기 한 걸음을 남기고 applyMermaid 를 부른다
{
  const rp = readFileSync('./src/builder/chrome/RightPanel.tsx', 'utf8')
  const i = rp.indexOf('const applyMm'); const body = i < 0 ? '' : rp.slice(i, i + 1200)
  check(i > 0 && /applyMermaid\(page\.id, mmText\)/.test(body) && body.indexOf('pushSnap(page.id') > 0 && body.indexOf('pushSnap(page.id') < body.indexOf('applyMermaid('), '「적용」 이 되돌리기 한 걸음을 남긴 뒤 applyMermaid 를 부른다')
  check(/parseMermaid\(mmText\)/.test(body) && body.indexOf('parseMermaid(mmText)') < body.indexOf('pushSnap(page.id'), '못 읽는 글이면 되돌리기 걸음도 안 남긴다(먼저 읽어 본다)')
  const j = rp.indexOf('<textarea className="mm-src"')
  check(j > 0 && !/readOnly/.test(rp.slice(j, j + 260)) && /onChange=\{\(e\) => \{ setMmText\(e\.target\.value\)/.test(rp.slice(j, j + 260)), '소스 칸은 고칠 수 있다(readOnly 아님)')
  check(/disabled=\{!dirty\}/.test(rp) && /onClick=\{openMm\}/.test(rp) && !/onClick=\{\(\) => setMmOpen\(true\)\}/.test(rp), '「적용」 은 고친 데가 있을 때만 · 두 「머메이드 보기」 단추 다 글을 새로 뽑아 연다')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
