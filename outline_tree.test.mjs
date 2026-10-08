// **AI 마인드맵 — 개요(JSON)를 편집되는 트리로 펼친다.**
//
// 사용자(2026-10-08): 「llm 연결해서 노트북LM 마인드맵 기능을 넣고싶음」. 결정: 결과는 **새 슬라이드에 편집되는 트리**(처음엔 큰 가지만 보이고
// 하위는 접힘 → 눌러 폄) · 가지를 챗봇에 묻기. 개요는 서버 하네스(server/intent/mindmap.py)가 LLM 답을 검증해 준 것이다.
//
// 가지를 붙이거나 접어도 **자리를 다시 앉히지 않는 것**이 지금 규칙이다(2026-10-07 「재정렬 없음」). 그래서 처음 펼칠 때
// **접힌 하위까지 모두 겹치지 않는 자리**를 잡아 둔다 — 펴는 순간 겹치면 안 된다.
//
// 실행: node --experimental-strip-types --import ./ts_register.mjs outline_tree.test.mjs
import { readFileSync } from 'node:fs'
const { useBuilder, nextElId } = await import('./src/state/store.ts')
const { outlineParts } = await import('./src/cards/outlineTree.ts')
const { treeShape, knownOf, isTreePage } = await import('./src/cards/treeOps.ts')
const { GAP_SIDE } = await import('./src/canvas/placeNext.ts')

let pass = 0, fail = 0
const check = (c, label, extra = '') => {
  if (c) { pass++; return }
  fail++; console.log('  X ' + label + (extra ? '  — ' + extra : ''))
}
const bare = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const S = () => useBuilder.getState()
const cur = () => S().pages.find((p) => p.id === S().selectedPageId)
const overlaps = (els) => { let n = 0; for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
  const a = els[i], b = els[j]; if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) n++ } return n }

const OUT = { title: '스마트 공장', children: [
  { title: '설비', children: [{ title: '성형기', children: [{ title: '온도' }, { title: '압력' }] }, { title: '공조' }] },
  { title: '품질', children: [{ title: '불량률' }, { title: '검사 기준이 조금 긴 제목입니다 열두 자 넘김' }] },
  { title: '인력' },
] }
const N = 10

// ── ① 순수 변환 ─────────────────────────────────────────
{
  let n = 500; const id = () => n++
  const { els, conns, rootId } = outlineParts(OUT, id)
  check(els.length === N && conns.length === N - 1, '상자 = 개요의 노드 수 · 선 = 노드 − 1', `${els.length} · ${conns.length}`)
  const root = els.find((e) => e.id === rootId)
  check(root && root.text === '스마트 공장' && !conns.some((c) => c.to === rootId), '뿌리 = 주제 · 들어오는 선 없음')
  check(new Set(els.map((e) => e.id)).size === N, '번호가 모두 다르다')
  check(overlaps(els) === 0, '**접힌 하위까지 포함해** 하나도 겹치지 않는다(펴도 안 겹친다)', String(overlaps(els)))
  const by = (t) => els.find((e) => e.text === t)
  check(by('설비').x === root.x + root.w + GAP_SIDE && by('성형기').x === by('설비').x + by('설비').w + GAP_SIDE,
    '자식은 부모 **옆 열**(부모 오른쪽 + 간격)에 선다 — 손으로 붙일 때와 같은 자리 규칙', `${root.x}+${root.w} → ${by('설비').x}`)
  check(by('설비').y < by('품질').y && by('품질').y < by('인력').y, '형제는 개요 순서대로 위에서 아래로')
  const mid = (e) => e.y + e.h / 2
  check(Math.abs(mid(by('성형기')) - (mid(by('온도')) + mid(by('압력'))) / 2) < 1, '부모는 자식들의 가운데 높이에')
  check(conns.every((c) => c.kind === 'ortho' && c.arrow === 'end' && c.axis === 'h'), '선은 트리 선 한 벌 · 옆 변에서 나간다')
  // 노트북LM 처럼 — 큰 가지까지만 보이고 그 아래는 접혀 있다
  check(by('설비').folded && by('품질').folded && !by('인력').folded && !root.folded, '**큰 가지 중 하위가 있는 것은 접힌 채** 시작한다')
  check(['성형기', '공조', '온도', '압력', '불량률'].every((t) => by(t).hidden) && ['설비', '품질', '인력'].every((t) => !by(t).hidden), '접힌 가지의 아래는 숨어 있다')
  check(by('검사 기준이 조금 긴 제목입니다 열두 자 넘김').h > by('공조').h, '긴 제목은 두 줄이 들어가게 상자가 높다')
  check(outlineParts({ title: '혼자' }, id).els.length === 1, '가지가 없어도 뿌리 하나는 만든다')
}

// ── ② 스토어 — 새 쪽에 펼친다 ──────────────────────────────────
{
  S().setOrientation('landscape')
  S().addCard('slide'); S().addCard('slide')
  const first = S().pages[0].id
  S().selectPage(first)
  const n0 = S().pages.length
  S().addOutline(OUT, '근거 글')
  const p = cur()
  check(S().pages.length === n0 + 1 && S().pages[1].id === p.id, '**고른 쪽 바로 뒤**에 새 쪽 하나가 끼고 그 쪽이 골라진다', S().pages.map((x) => x.id).join(','))
  check(p.free && p.cardKey === 'slide' && p.els.length === N && p.conns.length === N - 1, '빈 슬라이드에 상자와 선으로 놓인다')
  check(isTreePage(p) && p.treeDir === 'LR' && (p.treeRoots || []).length === 1, '트리 쪽으로 적힌다 — 접기 손잡이 · 가지 키가 그대로 듣는다')
  check(p.mindSrc === '근거 글', '가지를 물을 때 쓸 **근거 글**을 쪽에 적어 둔다')
  const n = nextElId(); check(p.els.every((e) => e.id < n), '번호표가 쓴 번호 위에 있다')

  // 접힌 가지를 펴면 하위가 보이고, 겹치지 않는다
  const seolbi = p.els.find((e) => e.text === '설비')
  S().treeFold(p.id, seolbi.id)
  let q = cur()
  check(!q.els.find((e) => e.text === '성형기').hidden && !q.els.find((e) => e.text === '공조').hidden, '큰 가지를 펴면 그 아래가 보인다')
  check(overlaps(q.els.filter((e) => !e.hidden)) === 0, '편 뒤에도 겹침 없음')
  // 알마인드 키가 그 위에서 그대로 — 「공조」 에 자식을 붙인다
  const gongjo = q.els.find((e) => e.text === '공조')
  S().treeAdd(q.id, gongjo.id, 'right')
  q = cur()
  const sh = treeShape(q.els, q.conns, knownOf(q))
  check(q.els.length === N + 1 && (sh.kids.get(gongjo.id) || []).length === 1, '만든 트리에 **손으로 가지를 더 붙일 수 있다**')
  // 되돌리기 — 쪽 추가와 같은 문서 단위 한 걸음
  S().undoDoc()
  check(S().pages.length === n0 && !S().pages.some((x) => x.id === p.id), '⌘Z(문서 단위) 한 번에 쪽이 통째로 사라진다')
}

// ── ③ 화면에 붙어 있나(소스) ───────────────────────────────
{
  const mk = bare(readFileSync('./src/builder/MindmapMaker.tsx', 'utf8'))
  check(/\$\{API_BASE\}\/mindmap`/.test(mk) && /addOutline\(/.test(mk), '만들기 창이 서버에 개요를 받아 addOutline 으로 펼친다')
  check(/pagesText\(/.test(mk) && /notesText\(/.test(mk) && /readableFile\(/.test(mk), '재료 셋 — 슬라이드 · 메모 · 붙여 넣은 글/파일')
  check(/truncated/.test(mk) && /message/.test(mk), '잘린 자료 · 서버가 준 오류 문구를 보여 준다')
  const cp = bare(readFileSync('./src/builder/CardPicker.tsx', 'utf8'))
  check(/AI 마인드맵/.test(cp) && /ebook:mindmap/.test(cp), '카드 고르기에 「AI 마인드맵」 문이 있다')
  const rp = bare(readFileSync('./src/builder/chrome/RightPanel.tsx', 'utf8'))
  check(/챗봇에 묻기/.test(rp) && /page\.mindSrc/.test(rp) && /ebook:mind-ask/.test(rp), '오른쪽 패널 — 근거 글이 있는 쪽에서 「챗봇에 묻기」')
  const ch = bare(readFileSync('./src/chat/ChatPanel.tsx', 'utf8'))
  check(/ebook:mind-ask/.test(ch) && /\$\{API_BASE\}\/mindmap\/ask`/.test(ch), '챗봇이 가지 질문을 받아 따로 묻는다(일반 챗 경로를 안 탄다)')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
