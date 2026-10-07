// **고르면 무장 → 빈 곳을 찍으면 그 자리에**(2026-10-07 · EverSketch 불편점 6번 · 사용자 결정: 텍스트·표·글맵시까지 전부).
//
// 지난 결정(e4dfbfd 「고르면 곧바로 놓인다」 · 90e7439 글상자·표·글맵시도)을 **뒤집는다** — 사용자: 「메뉴바에서 도형을 클릭하면
// 바로 도형이 생겨버림 → 도형을 클릭 후 마우스로 사용자가 화면에 찍으면 그 곳에 생기도록」. 그때의 걱정(「도구만 켜두면 한 번 더
// 클릭해야 하는 걸 모르는 사람이 아무 반응 없다고 느낀다」)은 **안내 띠**가 맡는다. 도구줄·메뉴는 그대로 `ebook:place` 를 쏘고,
// 무장은 캔버스가 한다(insert_shape.test.mjs ② 가 「도구줄은 말만 한다」 를 본다).
// 같은 자리에서 1번(Esc) · 7번(연결 취소) · ＋점 손질(고른 도형에도 · 누르기만 = Space 와 같은 자식)도 소스로 본다.
//
// 실행: node --experimental-strip-types --import ./ts_register.mjs shape_place.test.mjs
import { readFileSync } from 'node:fs'

let pass = 0, fail = 0
const check = (c, label, extra = '') => {
  if (c) { pass++; return }
  fail++; console.log('  X ' + label + (extra ? '  — ' + extra : ''))
}
const bare = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const fl = bare(readFileSync('./src/canvas/FreeLayer.tsx', 'utf8'))

// ── ① 캔버스는 「놓아 달라」 는 말을 받아 **무장만** 한다 ──
{
  const j = fl.indexOf('const onPlace')
  const body = j < 0 ? '' : fl.slice(j, j + 900)
  check(j > 0 && /ADDABLE\.indexOf\(type\) < 0\) return/.test(body), '모르는 이름은 되돌려 보낸다(그대로)')
  check(/setTool\(cur === type \? 'select' : type as Tool\)/.test(body), '고르면 **무장** — 같은 것을 또 고르면 내려놓는다')
  check(!/addEl\(/.test(body) && !/centerSpot/.test(body), '곧바로 놓지 않는다')
  check(!/centerSpot/.test(fl), 'centerSpot 은 더 안 쓴다(import 도 없다)')
}
// ── ② 놓는 규칙은 onLayerDown **한 곳** — 찍은 점이 상자 가운데 · 글 담는 것은 커서까지 ──
{
  const k = fl.indexOf("ADDABLE.indexOf(tool) >= 0) { e.stopPropagation()")
  const line = k < 0 ? '' : fl.slice(k, k + 420)
  check(k > 0, '놓는 줄이 있다')
  check(/el\.x = Math\.max\(0, Math\.round\(x - el\.w \/ 2\)\); el\.y = Math\.max\(0, Math\.round\(y - el\.h \/ 2\)\)/.test(line), '찍은 점이 **상자 가운데**(종이 왼쪽 · 위로는 안 나간다)')
  check(/if \(tool === 'text' \|\| tool === 'wordart' \|\| tool === 'note'\) startEditing\(el\.id\)/.test(line), '글을 담는 것은 커서까지(좌표 없이 → 기본 글자가 통째로 골라진다)')
  check(/\bsnap\(\)/.test(line) && /setSel\(el\.id\)/.test(line) && /setTool\('select'\)/.test(line), '되돌리기 · 고르기 · 손 놓기는 그대로')
}
// ── ③ 무장 중 안내 띠 ──
{
  check(/\{active && adding \? <div className="conn-hint">점선 안의 빈 곳을 눌러 놓을 자리를 정하세요 · Esc 취소<\/div> : null\}/.test(fl), '무장 중에는 「점선 안의 빈 곳을 눌러 … Esc 취소」 띠가 뜬다')
  // 「좌우로 안 보이는 경계선」(2026-10-07): 작업면이 종이와 같은 색이라 종이 끝이 안 보였다 — 놓는 동안만 종이 가장자리를 점선으로.
  const pv = bare(readFileSync('./src/builder/Preview.tsx', 'utf8'))
  check(/'pv-paper' \+ \(placing \? ' placing' : ''\)/.test(pv) && /tool !== 'select' && tool !== 'connect' && tool !== 'pen'/.test(pv), '놓는 도구를 든 동안 종이에 .placing(점선 가장자리)')
  check(/\.pv-paper\.placing\{outline:2px dashed/.test(readFileSync('./src/builder/chrome.css', 'utf8')), '점선 가장자리 CSS')
}
// ── ④ 1번 — 편집 중 Esc 는 편집만 끝내고 상자는 고른 채 ──
{
  const i = fl.indexOf("if (e.key === 'Escape') {")
  const esc = i < 0 ? '' : fl.slice(i, i + 420)
  check(i > 0 && /const ed = connKeyRef\.current\.editing; if \(ed != null\) \{/.test(esc), 'Esc 가 먼저 「편집 중인가」 를 본다')
  check(/if \(e\.isComposing\) return/.test(esc), '한글 조합을 끊는 Esc 는 건드리지 않는다')
  check(/pristineRef\.current = null; endEditing\(\); setSel\(ed\); return/.test(esc), '편집만 끝내고 **그 상자를 고른 채** 둔다')
  check(/setSel\(null\); setConnSrc\(null\); setSelConn\(null\); endEditing\(\); setMarquee\(null\); setTool\('select'\)/.test(esc), '편집 중이 아니면 예전대로(선택 해제 · 도구 취소)')
}
// ── ⑤ 7번 — 연결 모드: 빈 곳 클릭도 취소 · 힌트에 Esc ──
{
  check(/if \(tool === 'connect'\) setTool\('select'\)/.test(fl), '연결 도구로 빈 곳을 누르면 모드가 풀린다')
  check(/이을 도형을 클릭하세요 \(첫 번째\) · Esc 취소/.test(fl) && /이어줄 다른 도형을 클릭하세요 \(두 번째\) · Esc 취소/.test(fl), '연결 힌트 둘 다 「Esc 취소」 를 말한다')
}
// ── ⑥ ＋점 — 고른 도형에도(변 밖 16) · 누르기만 = 트리에서는 Space 와 같은 자식 · 이동량으로 판정 ──
{
  const nd = fl.slice(fl.indexOf('function onNodeDown'), fl.indexOf('function onLineDown'))
  check(/const moved = Math\.hypot\(ev\.clientX - e\.clientX, ev\.clientY - e\.clientY\) > 6/.test(nd), '「끌었나」 는 포인터 이동량으로 본다(중심 거리 40 은 좌우 점을 누르기만 해도 넘었다)')
  // 2026-10-07 2차: 누르기만 하면 어느 쪽에서든 addNext(그 변 쪽에 · 재정렬 없음). 되돌리기는 addNext 가 한 번 남긴다.
  check(/addNext\(page\.id, tid, SIDE\[dir\]\)/.test(nd) && nd.indexOf('addNext(') < nd.indexOf('snap()'), '누르기만 하면 **addNext**(그 변 쪽에 · Space 와 같은 자리)')
  check(/nb\.w = el\.w; nb\.h = el\.h; nb\.color = el\.color; nb\.fs = el\.fs; nb\.tcolor = el\.tcolor/.test(nd), '끌어 놓은 새 상자도 고른 상자의 모양 · 크기 · 색을 닮는다(treeAdd 와 같은 규칙)')
  const dots = fl.slice(fl.indexOf('const dotEl = '), fl.indexOf('const dotEl = ') + 1600)
  check(/const dotEl = /.test(fl) && /const out = [^\n]*16/.test(dots), '고른 도형에는 ＋점이 **변 밖 16px** 에 늘 뜬다')
  check(/hoverId != null && !selEls\.includes\(hoverId\)/.test(dots), '다른 도형은 예전처럼 올렸을 때만')
  // 2026-10-07 2차(3번): 떠 있던 서식 막대(ctxbar)를 걷었다 — 고른 상자 위에 떠서 윗줄 상자를 가려 「클릭해도 반응하지 않는 부분」 이 됐다. 동작은 도구줄로.
  check(!/className="ctxbar"/.test(fl) && /\{pts\.map\(\(pt\) => \(/.test(dots), '떠 있는 막대가 없으니 ＋점 넷을 다 그린다')
}
// ── ⑦ 도움말 ──
{
  const help = bare(readFileSync('./src/builder/Help.tsx', 'utf8'))
  check(/Space = 자식\(오른쪽\) · Enter = 형제\(같은 부모 · 바로 아래\)/.test(help), '도움말이 Space = 자식 · Enter = 형제 로 말한다(9번 · 3차)')
  check(/k: 'Esc', d: '글 편집 끝내기\(상자는 고른 채\)/.test(help), '도움말의 Esc 설명이 새 동작을 말한다')
  check(/빈 곳을 눌러 놓기/.test(help), '도움말이 「고르고 → 빈 곳을 눌러 놓기」 를 말한다')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
