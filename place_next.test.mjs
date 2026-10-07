// **고른 상자 기준으로만 놓는다 — 재정렬 없음**(2026-10-07 · 2차 요청 5·6번) + 허브로 돌아오기 + 머메이드 소스(4번) + 떠 있던 서식 막대 걷기(3번).
//
// 사용자: 「엔터를 누르는 경우 여전히 우측의 아래에 생성됨 … 아래에 생성되도록 — 부모의 아래를 의미(부모의 우측의 아래 아님)」 ·
// 「도형을 어느 위치로 이동 후 다시 스페이스나 엔터를 누르면 재정렬됨. 그런 현상은 없도록」 · 「어떤 도식화를 하면 그것의 머메이드 소스를 볼 수 있도록」 ·
// 「도형을 선택하고, 특정 부분에서 클릭해도 반응하지 않는 부분이 있음」(= 고른 상자 위에 떠 있던 서식 막대가 윗줄 상자를 가렸다).
// 전에는(f067e4b) 붙일 때마다 트리를 다시 앉혔다(seatTree) — 뿌리는 고정이어도 형제들이 매번 움직였고 손으로 옮긴 상자가 격자로 돌아갔다.
//
// 실행: node --experimental-strip-types --import ./ts_register.mjs place_next.test.mjs
import { readFileSync } from 'node:fs'
const { nextSpot, centeredYs, CENTER_MAX, GAP_SIDE, GAP_DOWN, GAP_STACK } = await import('./src/canvas/placeNext.ts')
const { useBuilder } = await import('./src/state/store.ts')
const { mkFreeEl } = await import('./src/canvas/model.ts')
const { isTreePage } = await import('./src/cards/treeOps.ts')
const { mermaidOfPage } = await import('./src/cards/mermaidOut.ts')
const { parseMermaid } = await import('./src/cards/mermaid.ts')

let pass = 0, fail = 0
const check = (c, label, extra = '') => {
  if (c) { pass++; return }
  fail++; console.log('  X ' + label + (extra ? '  — ' + extra : ''))
}
const bare = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const S = () => useBuilder.getState()
const cur = () => S().pages.find((p) => p.id === S().selectedPageId)
const J = (v) => JSON.stringify(v)
const posOf = (pg, ids) => pg.els.filter((e) => ids.has(e.id)).map((e) => [e.id, e.x, e.y, e.w, e.h]).join('|')
const overlaps = (pg) => { const v = pg.els.filter((e) => !e.hidden); let n = 0
  for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) { const a = v[i], b = v[j]; if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) n++ }
  return n }

// ── ① nextSpot(순수) — 고른 상자의 오른쪽 · 아래 · 위 · 왼쪽, 차 있으면 밀기 ──
{
  const hub = { x: 100, y: 100, w: 120, h: 56 }, sz = { w: 120, h: 56 }
  check(J(nextSpot(hub, 'right', [hub], sz)) === J({ x: 100 + 120 + GAP_SIDE, y: 100 }), 'Space = 오른쪽 · 같은 높이', J(nextSpot(hub, 'right', [hub], sz)))
  check(J(nextSpot(hub, 'down', [hub], sz)) === J({ x: 100, y: 100 + 56 + GAP_DOWN }), 'Enter = **바로 아래 · 같은 x**(부모의 우측 아래가 아니다)', J(nextSpot(hub, 'down', [hub], sz)))
  check(J(nextSpot(hub, 'up', [hub], sz)) === J({ x: 100, y: 100 - GAP_DOWN - 56 }), 'Shift+Enter = 바로 위')
  check(J(nextSpot(hub, 'left', [hub], sz)) === J({ x: 0, y: 100 }), '왼쪽은 종이 밖(음수)으로 안 나간다')
  const first = { x: 280, y: 100, w: 120, h: 56 }
  check(J(nextSpot(hub, 'right', [hub, first], sz)) === J({ x: 280, y: 100 + 56 + GAP_STACK }), '오른쪽 자리에 상자가 있으면 **그 아래로 쌓인다**(있던 상자는 그대로)')
  const below = { x: 100, y: 196, w: 120, h: 56 }
  check(J(nextSpot(hub, 'down', [hub, below], sz)) === J({ x: 100 + 120 + GAP_STACK + 6, y: 196 }), '아래 자리에 상자가 있으면 **그 오른쪽으로** 민다')
  const tall = { x: 100, y: 100, w: 200, h: 120 }
  check(J(nextSpot(tall, 'right', [tall], sz)) === J({ x: 100 + 200 + GAP_SIDE, y: 100 + (120 - 56) / 2 }), '크기가 다르면 세로 가운데를 맞춘다')
  // 2026-10-07 3차: 같은 열에 쌓인 자식들을 허브 가운데에 — 그룹의 가운데가 허브의 가운데, 사이는 GAP_STACK, 위로 넘치면 0 에서 시작
  check(J(centeredYs(268, [56, 56])) === J([203, 277]) && J(centeredYs(268, [56, 56, 56])) === J([166, 240, 314]), 'centeredYs — 그룹의 가운데를 허브 가운데에', J(centeredYs(268, [56, 56, 56])))
  check(J(centeredYs(30, [56, 56, 56])) === J([0, 74, 148]), '위로 넘치면 전체를 내려 0 에서 시작')
  check(CENTER_MAX === 7, '가운데 맞춤은 일곱까지(사용자: 「7개 정도까지는」)')
}

// ── ② 스토어 treeAdd — 새 상자만 놓고 **아무것도 안 옮긴다** ──
{
  S().setOrientation('landscape'); S().addCard('slide'); let p = cur()
  const a = mkFreeEl('round', 100, 100); a.color = '#ffe9a8'; S().addEl(p.id, a)
  const fresh = () => { const had = new Set(cur().els.map((e) => e.id)); return () => cur().els.find((e) => !had.has(e.id)) }
  let pick = fresh(); S().treeAdd(p.id, a.id, 'right'); p = cur(); const b = pick()
  check(b && b.x === a.x + a.w + GAP_SIDE && b.y === a.y, 'Space → 오른쪽 같은 높이', b && `${b.x},${b.y}`)
  check(b && b.type === 'round' && b.w === a.w && b.h === a.h && b.color === '#ffe9a8' && b.text === '새 상자', '새 상자는 고른 상자를 닮는다(모양 · 크기 · 색)')
  const cb = p.conns.find((c) => c.to === b.id)
  check(cb && cb.from === a.id && cb.axis === 'h' && cb.color === '#8b93a5' && cb.width === 2 && cb.kind === 'ortho', '고른 상자에서 선이 오고 · **가로 축** · 한 벌 색', J(cb))
  check(isTreePage(p) && (p.treeRoots || []).includes(a.id), '첫 붙임에 그 쪽이 트리 쪽이 되고(방향키 · 가지째 지우기) 고른 상자가 명단에 든다')
  const kept = new Set(p.els.map((e) => e.id)); const before = posOf(p, kept)
  pick = fresh(); S().treeAdd(p.id, a.id, 'down'); p = cur(); const d = pick()
  check(d && d.x === a.x && d.y === a.y + a.h + GAP_DOWN, 'Enter → **부모 바로 아래 · 같은 x**', d && `${d.x},${d.y}`)
  check(p.conns.find((c) => c.to === d.id).axis === 'v', '아래로 붙인 선은 세로 축')
  check(posOf(p, kept) === before, '**있던 상자는 하나도 안 움직인다**')
  pick = fresh(); S().treeAdd(p.id, a.id, 'right'); p = cur(); const b2 = pick()
  const bNow = p.els.find((e) => e.id === b.id)
  // 2026-10-07 3차: 같은 열의 자식들은 허브 가운데에 맞춰 선다(첫째가 올라간다). 허브 가운데 y=128 · 둘 높이 56+18+56 → 63 · 137.
  check(b2 && b2.x === b.x && bNow.y === 63 && b2.y === 137, '같은 상자에서 또 Space → 둘이 **허브 가운데를 사이에 두고** 선다(첫째가 올라간다)', J([bNow.y, b2 && b2.y]))
  pick = fresh(); S().treeAdd(p.id, a.id, 'up'); p = cur(); const u = pick()
  check(u && u.x === a.x && u.y === a.y - GAP_DOWN - a.h, 'Shift+Enter → 바로 위')
  // 손으로 옮긴 상자는 그대로 — 그 뒤 붙여도(열에 남은 것들만 가운데 맞춤)
  S().updateEl(p.id, b.id, { x: 520, y: 20 }); p = cur()
  pick = fresh(); S().treeAdd(p.id, a.id, 'right'); p = cur(); const b3 = pick()
  const bAfter = p.els.find((e) => e.id === b.id), b2After = p.els.find((e) => e.id === b2.id), aAfter = p.els.find((e) => e.id === a.id)
  check(bAfter.x === 520 && bAfter.y === 20 && aAfter.x === 100 && aAfter.y === 100, '**옮겨 둔 상자(와 허브)는 그대로** — 격자로 돌아가지 않는다')
  check(b3 && b3.x === a.x + a.w + GAP_SIDE && b2After.y === 63 && b3.y === 137, '열에 남은 둘(둘째 · 새것)만 다시 허브 가운데에', J([b2After.y, b3 && b3.y]))
  check(overlaps(p) === 0, '겹침 없음', String(overlaps(p)))
  // Enter = **형제**(같은 부모 · 같은 열 · 고른 상자 바로 뒤) — 3차 「엔터는 형제」. Shift+Enter = 바로 앞. 열은 다시 부모 가운데에.
  pick = fresh(); S().treeAdd(p.id, b3.id, 'sibling'); p = cur(); const sib = pick()
  const colX = a.x + a.w + GAP_SIDE
  const colIds = () => cur().els.filter((e) => e.x === colX).sort((x, y) => x.y - y.y).map((e) => e.id)
  const colYs = () => cur().els.filter((e) => e.x === colX).sort((x, y) => x.y - y.y).map((e) => e.y).join()
  check(sib && p.conns.some((c) => c.from === a.id && c.to === sib.id && c.axis === 'h'), '형제는 **같은 부모(a)** 에서 선이 온다 · 가로 축')
  check(J(colIds()) === J([b2.id, b3.id, sib.id]) && colYs() === '26,100,174', '고른 상자(b3) **바로 뒤**에 끼고, 셋이 부모 가운데에', colYs())
  pick = fresh(); S().treeAdd(p.id, b3.id, 'before'); p = cur(); const bf = pick()
  check(J(colIds()) === J([b2.id, bf.id, b3.id, sib.id]) && colYs() === '0,74,148,222', 'Shift+Enter = 고른 상자 **바로 앞**에(넷 · 위로 넘쳐 0 에서 시작)', colYs())
  check(posOf(p, new Set([a.id, b.id, d.id, u.id])) === posOf(cur(), new Set([a.id, b.id, d.id, u.id])), '허브 · 손으로 옮긴 상자 · 다른 쪽의 자식은 그대로')
  // 뿌리의 형제 = 선 없는 또 하나의 뿌리(바로 아래 · 차 있으면 옆으로)
  pick = fresh(); S().treeAdd(p.id, a.id, 'sibling'); p = cur(); const rs = pick()
  check(rs && !p.conns.some((c) => c.to === rs.id || c.from === rs.id) && (p.treeRoots || []).includes(rs.id) && overlaps(p) === 0, '뿌리의 형제 = **선 없는 또 하나의 뿌리** · 겹침 없음', rs && `${rs.x},${rs.y}`)
  // 아무것도 안 고르고 「＋ 상자」 — 빈 자리에 · 선 없이 · 명단에
  pick = fresh(); S().treeAdd(p.id, null, 'root'); p = cur(); const r = pick()
  check(r && !p.conns.some((c) => c.to === r.id || c.from === r.id) && (p.treeRoots || []).includes(r.id) && overlaps(p) === 0, '고른 것 없이 붙이면 빈 자리에 선 없는 상자(명단에 든다)')
  // 가지째 지우기도 다시 앉히지 않는다
  const keep3 = new Set(p.els.filter((e) => e.id === r.id || e.id === u.id).map((e) => e.id)); const before3 = posOf(p, keep3)
  S().treeRemove(p.id, b.id); p = cur()
  check(!p.els.some((e) => e.id === b.id) && posOf(p, keep3) === before3, '가지째 지워도 남은 상자는 제자리')
}

// ── ③ 머메이드 소스 — 그린 것에서 뽑고, 다시 읽으면 같다 ──
{
  S().addCard('slide'); let p = cur()
  const a = mkFreeEl('box', 50, 50); a.text = '기획 (초안)'
  const b = mkFreeEl('round', 300, 50); b.text = '설계'
  const c = mkFreeEl('diamond', 300, 200); c.text = '검수?'
  const t = mkFreeEl('text', 50, 300); t.text = '메모'
  S().addEl(p.id, a); S().addEl(p.id, b); S().addEl(p.id, c); S().addEl(p.id, t)
  S().addConn(p.id, { from: a.id, to: b.id }); S().addConn(p.id, { from: b.id, to: c.id }); S().addConn(p.id, { from: a.id, to: c.id })
  p = cur()
  const src = mermaidOfPage(p)
  check(/^graph LR\n/.test(src), '머메이드 글은 graph LR 로 시작한다(쪽 방향)', src.split('\n')[0])
  check((src.match(/-->/g) || []).length === 3, '선 셋이 화살표 셋', src)
  const g = parseMermaid(src)
  check(g.errors.length === 0 && g.edges.length === 3 && g.order.length === 3, '다시 읽으면 상자 셋 · 선 셋 · 오류 없음', J(g.errors))
  const labels = g.order.map((id) => g.nodes[id].label)
  check(labels.includes('설계') && labels.includes('검수?') && labels.some((l) => l.startsWith('기획')), '글자가 그대로 간다', J(labels))
  check(!labels.includes('메모'), '글상자(선을 못 다는 것)는 도식에 안 들어간다')
  check(g.order.map((id) => g.nodes[id].shape).sort().join() === ['box', 'dec', 'round'].sort().join(), '네모 · 둥근 · 마름모 모양이 글에 남는다', J(g.order.map((id) => g.nodes[id].shape)))
  check(!/[\[\](){}]/.test(labels.find((l) => l.startsWith('기획'))), '글자 안의 괄호는 머메이드를 깨지 않게 전각으로 바꾼다', labels.find((l) => l.startsWith('기획')))
}

// ── ④ 화면 배선 ──
{
  const fl = bare(readFileSync('./src/canvas/FreeLayer.tsx', 'utf8'))
  const st = bare(readFileSync('./src/state/store.ts', 'utf8'))
  const ma = bare(readFileSync('./src/builder/mindActions.ts', 'utf8'))
  const ui = bare(readFileSync('./src/state/canvasUI.ts', 'utf8'))
  const hk = bare(readFileSync('./src/builder/Hotkeys.tsx', 'utf8'))
  const tb = bare(readFileSync('./src/builder/chrome/EditToolbar.tsx', 'utf8'))
  const rp = bare(readFileSync('./src/builder/chrome/RightPanel.tsx', 'utf8'))
  const help = bare(readFileSync('./src/builder/Help.tsx', 'utf8'))
  check(!/seatTree/.test(st) && (st.match(/const laid = layoutTree\(/g) || []).length === 1, '스토어에 다시 앉히기(seatTree)가 없다 — 처음 펼칠 때(addCard)만 앉힌다')
  check(/nextSpot\(hub, side, /.test(st) && /function arrangeColumn\(/.test(st), 'treeAdd 는 부모 기준 자리(nextSpot)에 놓고 같은 열을 가운데 맞춤(arrangeColumn)')
  // 3차(사용자 「엔터는 형제, 스페이스는 자식」): 허브로 돌아오기는 뺐다 — 알마인드처럼 새 상자가 고른 채로 남는다.
  check(/export function addNext\(pageId: number, id: number, kind: NextKind\)/.test(ma) && /treeAdd\(page\.id, id, kind\)/.test(ma) && !/setHub/.test(ma), 'addNext 가 붙이고 새 상자를 고른 채 글을 연다(허브 기억 없음)')
  check(!/hubId/.test(ui), '허브 상태가 없다 — 고른 것은 늘 지금 고른 상자')
  check(/function endEditing\(\) \{ commitEditing\(\); setEditing\(null\) \}/.test(fl), '글을 끝내도 고른 것은 그 상자(이어서 Enter 면 형제 · Space 면 자식)')
  check(/addNext\(page\.id, tid, act === 'child' \? 'right' : act\)/.test(fl), '아무것도 안 친 글칸의 Space = 자식 · Enter = 형제 · Shift+Enter = 앞 형제')
  check(/addNext\(mind\.page\.id, mind\.id, act === 'child' \? 'right' : act\)/.test(hk), 'Hotkeys: Space = 자식(오른쪽) · Enter = 형제 · Shift+Enter = 앞 형제')
  check(!/className="ctxbar"/.test(fl) && /'ebook:connect-from'/.test(fl), '떠 있던 서식 막대가 없다 · 연결 시작은 도구줄의 말을 듣는다')
  check(/function ActionTools/.test(tb) && /ebook:connect-from/.test(tb) && /title="복제"/.test(tb) && /title="삭제"/.test(tb), '도구줄에 동작 묶음(연결 · 복제 · 앞 · 뒤 · 삭제)')
  check(/export const SHAPES/.test(tb) && /patch\(\{ type: sh\.t \}\)/.test(rp), '패널에서 **도형 모양을 바꾼다**(2차 2번)')
  check(/mermaidOfPage\(/.test(rp) && /머메이드 보기/.test(rp), '패널에 「머메이드 보기」(2차 4번)')
  check(/addNext\(/.test(rp) && !/treeAdd\(page\.id, selElId/.test(rp), '패널의 붙이기 단추도 같은 길(addNext)')
  check(/Space = 자식\(오른쪽\) · Enter = 형제\(같은 부모 · 바로 아래\) · Shift\+Enter = 앞 형제/.test(help), '도움말이 새 규칙을 말한다')
  check(/#b9c2d4/.test(st.slice(st.indexOf('export function reseedUids'), st.indexOf('export function reseedUids') + 2500)), '옛 머메이드 선 색은 불러올 때 한 벌로 고친다(2차 4번)')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
