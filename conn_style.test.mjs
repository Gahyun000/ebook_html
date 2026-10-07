// **화살표 한 벌**(2026-10-07 · EverSketch 불편점 8번).
//
// 사용자: 「마우스 호버링시 나오는 점을 클릭했을 때와 스페이스바를 눌렀을때의 화살표의 굵기 및 색상 통일」.
// ＋점·「→ 연결」은 색·굵기를 안 적어 화면 기본(#8b93a5 · 2)으로 그려졌고, Space(treeAdd)·머메이드(treeParts)는 #b9c2d4 · 1.5 였다.
// 결정(사용자): **기본 연결선 #8b93a5 · 2px**. 상수는 cards/treeEls.ts 한 곳(`TREE_CONN`)이고 네 길이 다 그것을 쓴다.
// 아래 띠의 흐린 이음(echo · treeOps.layoutTree)만 연하게 남긴다 — 그건 「다시 놓은 부모」 표시다.
//
// 실행: node --experimental-strip-types --import ./ts_register.mjs conn_style.test.mjs
import { readFileSync } from 'node:fs'
const { TREE_CONN } = await import('./src/cards/treeOps.ts')
const E = await import('./src/cards/treeEls.ts')
const { parseMermaid } = await import('./src/cards/mermaid.ts')

let pass = 0, fail = 0
const check = (c, label, extra = '') => {
  if (c) { pass++; return }
  fail++; console.log('  X ' + label + (extra ? '  — ' + extra : ''))
}
const bare = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const WANT = { kind: 'ortho', arrow: 'end', color: '#8b93a5', width: 2 }
const same = (c) => c.kind === WANT.kind && c.arrow === WANT.arrow && c.color === WANT.color && c.width === WANT.width

check(same(TREE_CONN) && Object.keys(TREE_CONN).length === 4, 'TREE_CONN = 꺾은선 · 끝 화살촉 · #8b93a5 · 2', JSON.stringify(TREE_CONN))
check(E.TREE_CONN === TREE_CONN, 'treeOps 는 treeEls 의 것을 그대로 내보낸다(한 벌)')
{
  const g = parseMermaid('graph LR\n  A --> B\n  B --> C')
  let i = 1
  const parts = E.treeParts(g, 1040, 720, () => i++, g.dir)
  check(parts.conns.length === 2 && parts.conns.every(same), '머메이드로 펼친 선도 같은 벌', JSON.stringify(parts.conns))
}
{
  const fl = bare(readFileSync('./src/canvas/FreeLayer.tsx', 'utf8'))
  check(/addConn\(page\.id, \{ from: connSrc, to: el\.id, \.\.\.TREE_CONN \}\)/.test(fl), '「→ 연결」 도구가 같은 벌을 쓴다')
  check((fl.match(/addConn\(page\.id, \{ from: el\.id, to: (?:target\.id|nb\.id), \.\.\.TREE_CONN \}\)/g) || []).length === 2, '＋점 두 길(기존 도형에 잇기 · 새 상자)이 같은 벌을 쓴다')
  check(!/#b9c2d4/.test(fl), 'FreeLayer 에 옛 연한 색이 없다')
  // 2026-10-07 2차(4번): 「머메이드라고 되어있는 부분 또한 화살표의 굵기 및 색상을 현재의 화살표등에 맞게」 — echo 이음도 한 벌, 옛 자료는 불러올 때 고친다.
  const ops = readFileSync('./src/cards/treeOps.ts', 'utf8')
  check(!/#b9c2d4/.test(ops) && /outConns\.push\(\{ from: id, to: k, \.\.\.TREE_CONN \}\)/.test(ops), 'echo 이음(아래 띠)도 같은 벌')
  check(!/#b9c2d4/.test(readFileSync('./src/cards/treeEls.ts', 'utf8')), 'treeEls 에 옛 연한 색이 없다')
  const st = readFileSync('./src/state/store.ts', 'utf8')
  const heal = st.slice(st.indexOf('export function reseedUids'), st.indexOf('export function reseedUids') + 2500)
  check(/#b9c2d4/.test(heal) && /TREE_CONN\.color/.test(heal), '옛 머메이드 선(#b9c2d4 · 1.5)은 **불러올 때** 한 벌로 고친다')
  check((bare(st).match(/#b9c2d4/g) || []).length === 1, '그 밖에 store 에 옛 색이 없다(주석 빼고 치유 한 줄뿐)')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
