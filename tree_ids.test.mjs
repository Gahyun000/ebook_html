// 트리 「＋ 자식」 · 마인드맵 「＋ 가지」 — **번호(id)는 번호표 한 곳에서만** 받는다.
//
// **왜 생겼나.** 2026-10-02 머메이드 검토 때 찾았다(사용자가 2026-10-06 고쳐 달라고 함). 가로 종이에서 아래 띠로 접히는
// 트리에 「＋ 자식」 을 누르면 새 상자가 **선 없이 왼쪽 위**에 뿌리와 포개졌다.
//
// 트리를 다시 앉힐 때 생기는 echo(아래 띠 머리에 다시 놓은 부모)는 번호표(`nextElId`)를 안 뽑고 `가장 큰 id + 1` 로
// 번호를 받는다(treeOps.layoutTree). 번호표는 그대로라, 다음에 「＋ 자식」 이 뽑은 번호가 **echo 와 같았다.**
// 그러자 layoutTree 가 새 상자로 가는 선을 「echo 로 들어가는 선」 으로 읽고 버렸다 — 부모 없는 외톨이가 된 것이다.
// 마인드맵 「＋ 가지」 도 같은 식(`가장 큰 id + 1`)이라, 가지를 붙인 뒤 도형을 놓으면 **둘이 같은 번호**를 받았다.
//
// 이 검사는 화면 없이 **스토어를 노드에서 직접 돌린다**(글자 검사가 아니다).
//
// 실행: node --experimental-strip-types --import ./ts_register.mjs tree_ids.test.mjs

import { readFileSync } from 'node:fs'
const { useBuilder, nextElId } = await import('./src/state/store.ts')
const { mkFreeEl } = await import('./src/canvas/model.ts')

const read = (p) => readFileSync(new URL(p, import.meta.url).pathname, 'utf8')
const bare = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
let pass = 0, fail = 0
const check = (c, label, extra = '') => {
  if (c) { pass++; return }
  fail++
  console.log('  X ' + label + (extra ? '  — ' + extra : ''))
}

const S = () => useBuilder.getState()
const last = () => S().pages[S().pages.length - 1]
/** 화면 기록에 나온 그림 — 가로 종이에서는 아래 띠로 접혀 「개발」 echo 가 하나 생긴다. */
const VIDEO = 'graph TB\n  A[기획] --> B[설계]\n  B --> C[개발]\n  C --> D{검수}\n  D --> E[배포]\n  D --> B'
const unique = (p) => new Set(p.els.map((e) => e.id)).size === p.els.length
/** 이 상자로 들어오는 선이 있는가 — 부모에게서 바로, 또는 아래 띠 머리에 다시 놓은 부모(echo)에게서. */
const fedBy = (p, kid, parent) => p.conns.some((c) => c.to === kid.id &&
  (c.from === parent.id || (p.els.find((e) => e.id === c.from) || {}).echoOf === parent.id))
/** 보이는 것끼리 겹친 쌍 — layoutTree 가 세는 것과 같은 규칙. */
function overlaps(p) {
  const shown = p.els.filter((e) => !e.hidden)
  let n = 0
  for (let i = 0; i < shown.length; i++) for (let j = i + 1; j < shown.length; j++) {
    const a = shown[i], b = shown[j]
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) n++
  }
  return n
}
/**
 * 번호표가 이 쪽의 **어떤 번호보다도 위**에 있는가(다음에 뽑을 번호가 이미 쓰인 번호와 겹치지 않는가).
 * **번호를 하나 써 버린다** — 그래서 동작 *뒤*에만 부른다. 앞에서 부르면 번호표가 그만큼 밀려 결함이 가려진다
 * (처음 짠 검사가 그래서 고치기 전에도 첫 「＋ 자식」 을 통과시켰다).
 */
const counterAbove = (p) => { const n = nextElId(); return p.els.every((e) => e.id < n) }

S().setOrientation('landscape')

// ── 0. 펼친 직후의 번호표 ─────────────────────────────────
{
  S().addCard('tree', undefined, VIDEO)
  const p = last()
  check(p.els.some((e) => e.echoOf != null), '(준비) 가로 종이에서 이 그림은 아래 띠로 접혀 echo 가 생긴다')
  check(counterAbove(p), '펼친 직후 번호표가 **echo 번호보다 위**에 있다 — 다음 상자가 echo 와 같은 번호를 받지 않는다')
}

// ── 1. 화면 기록의 그림에 「＋ 자식」 — 펼치자마자, 사람이 하는 순서 그대로 ─────
{
  S().addCard('tree', undefined, VIDEO)
  let p = last()
  const bepo = p.els.find((e) => e.text === '배포' && e.echoOf == null)
  S().treeAdd(p.id, bepo.id, 'right')
  p = last()
  const kid = p.els.find((e) => e.text === '새 상자')
  check(!!kid && fedBy(p, kid, bepo), '**새 상자로 가는 선이 있다** — 「배포」 의 자식이다(선을 버리지 않는다)',
    kid ? JSON.stringify([kid.id, p.conns.filter((c) => c.to === kid.id)]) : '새 상자 없음')
  check(overlaps(p) === 0, '새 상자가 **왼쪽 위에 뿌리와 포개지지 않는다**', `겹친 쌍 ${overlaps(p)} · 새 상자 ${kid ? kid.x + ',' + kid.y : '-'}`)
  check(unique(p), '한 쪽 안의 번호가 모두 다르다')

  // 한 번 더 — 처음엔 두 번째도 똑같이 외톨이가 됐다.
  S().treeAdd(p.id, bepo.id, 'right')
  p = last()
  const kids = p.els.filter((e) => e.text === '새 상자')
  check(kids.length === 2 && kids.every((k) => fedBy(p, k, bepo)), '두 번째 「＋ 자식」 도 선으로 이어진다', String(kids.length))
  check(unique(p), '두 번째 뒤에도 번호가 겹치지 않는다')
  check(counterAbove(p), '「＋ 자식」 뒤에도 번호표가 쓴 번호 위에 있다')
}

// ── 2. 「＋ 형제」 · 「＋ 새 뿌리」 · 접기도 같은 길을 지난다 ────────────
{
  S().addCard('tree', undefined, VIDEO)
  let p = last()
  const seol = p.els.find((e) => e.text === '설계' && e.echoOf == null)
  const giho = p.els.find((e) => e.text === '기획' && e.echoOf == null)
  S().treeAdd(p.id, seol.id, 'down')
  p = last()
  const sib = p.els.find((e) => e.text === '새 상자')
  check(!!sib && fedBy(p, sib, seol), '「↓ 아래에」 — 고른 상자(설계)에서 선이 온다(2026-10-07 2차: 형제가 아니라 아래 자식)')
  S().treeAdd(p.id, giho.id, 'root')
  p = last()
  const root = p.els.find((e) => e.text === '새 뿌리')
  check(!!root && (p.treeRoots || []).includes(root.id) && unique(p), '「＋ 새 뿌리」 — 뿌리 명단에 들고 번호가 겹치지 않는다')
  // 접었다 펴도 echo 를 새로 만든다 — 그 뒤의 「＋ 자식」 도 이어져야 한다.
  S().treeFold(p.id, giho.id); S().treeFold(last().id, giho.id)
  p = last()
  const bepo = p.els.find((e) => e.text === '배포' && e.echoOf == null)
  S().treeAdd(p.id, bepo.id, 'right')
  p = last()
  const kid = p.els.filter((e) => e.text === '새 상자').find((e) => fedBy(p, e, bepo))
  check(!!kid && unique(p), '접었다 편 뒤의 「＋ 자식」 도 선으로 이어진다')
  check(counterAbove(p), '접고 펴고 붙인 뒤에도 번호표가 쓴 번호 위에 있다')
}

// ── 3. 마인드맵 「＋ 가지」 — 번호표에서 받는다 ─────────────────────
{
  const rp = bare(read('./src/builder/chrome/RightPanel.tsx'))
  const add = rp.slice(rp.indexOf('function addBranch'), rp.indexOf('setCanvas(page.id', rp.indexOf('function addBranch')))
  check(/const nid = nextElId\(\)/.test(add), '「＋ 가지」 가 **번호표(nextElId)** 에서 번호를 받는다', add.replace(/\s+/g, ' ').slice(-140))
  check(!/Math\.max\(0, \.\.\.page\.els\.map\(\(e\) => e\.id\)\) \+ 1/.test(rp), '「가장 큰 id + 1」 로 만들던 줄이 없다')
  // 같은 순서를 스토어에서: 마인드맵 → 번호표로 가지 → 도구줄로 네모 하나. 둘이 다른 번호여야 한다.
  S().addCard('mindmap', 4)
  const p = last()
  const nid = nextElId()
  S().setCanvas(p.id, { els: [...p.els, { id: nid, type: 'round', x: 10, y: 10, w: 100, h: 40, text: '가지 5', color: '#eaf0ff', fs: 13 }], conns: p.conns, strokes: p.strokes })
  const shape = mkFreeEl('box', 300, 300)
  check(shape.id !== nid, '가지를 붙인 뒤 놓은 네모가 **다른 번호**를 받는다', `${nid} / ${shape.id}`)
}

// ── 4. 고친 자리가 코드에 남아 있나 ────────────────────────────
{
  const st = bare(read('./src/state/store.ts'))
  // 2026-10-07 2차(재정렬 없음): 앉히는 곳은 카드로 처음 펼칠 때(addCard) 한 곳뿐이다 — 붙이기 · 접기 · 가지째 지우기는 자리를 안 옮긴다.
  const calls = (st.match(/const laid = (layoutTree|seatTree)\(/g) || []).length
  const claims = (st.match(/claimIds\(laid\.els\)/g) || []).length
  check(calls === 1 && claims === 1, '스토어가 트리를 앉히는 **한 곳**(처음 펼칠 때) 뒤에 번호표를 올린다', `앉히기 ${calls} · claimIds ${claims}`)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
