// 복사 · 잘라내기 · 붙여넣기 · 복제 — **고른 것 전부와 그 사이의 선**을 옮긴다.
//
// **왜 생겼나.** 2026-10-02, 머메이드로 펼친 트리를 전부 골라 복사해 다른 쪽에 붙였더니
// 「개발」 상자 **하나만** 들어왔다(화면 기록). 셋이 겹쳐 있었다:
//
//   ① 클립보드가 요소 **한 개**였다 — 여럿을 골라도 마지막 것만 담았다.
//   ② 선은 요소 밖(`page.conns`)에 있어 아예 따라오지 않았다.
//   ③ 옮길 칸을 **골라 담아서**(w·h·text·color·fs) 글자색·굵기·테두리·정렬이 떨어져 나갔다.
//
// 그리고 잘라내기(⌘X)는 **하나만 담고 전부 지웠다** — 나머지는 그대로 사라졌다.
//
// ── 흐린 상자(echo) — **보이는 그대로** 옮긴다 ──────────────
// 트리가 아래 띠로 접히면 띠 머리에 **부모를 흐리게 다시** 놓는다(echo · treeOps).
//
// 처음에는 「그건 그림이지 상자가 아니다」 라며 **원본으로 되돌려** 담았다. 구조로는 맞는 말인데
// 화면에서는 틀렸다 — 여섯을 골랐는데 다섯이 붙고, 왼쪽 아래 「개발」 에서 「검수」 로 꺾여 올라가는
// 선이 새로 생겨 「검수 → 설계」 선과 겹쳤다. 사용자가 돌려 보고 「복붙 제대로 안되는데」 라고 했다
// (2026-10-02 오후 5.40 화면 기록). **사람은 그림을 복사한다.** 붙인 그림이 원본과 달라지면 안 된다.
//
// 그래서 흐린 상자도 상자로, 그 선도 그어진 그대로 옮긴다. 다만 **머메이드(트리) 쪽에 붙일 때만**
// 「다시 놓은 부모」 표시(`echoOf`)를 붙인 원본으로 이어 둔다 — 거기서는 다시 앉힐 때 그 표시로
// 구조를 읽기 때문이다. 보통 쪽에서는 표시를 뗀다(다시 앉히는 일이 없다).
//
// 실행: node --experimental-strip-types --import ./ts_register.mjs clipboard.test.mjs

import { readFileSync } from 'node:fs'
import { copyParts, pasteParts } from './src/canvas/clipboard.ts'
import { parseMermaid } from './src/cards/mermaid.ts'
import { treeParts } from './src/cards/treeEls.ts'
import { treeShape, layoutTree } from './src/cards/treeOps.ts'

const read = (p) => readFileSync(new URL(p, import.meta.url).pathname, 'utf8')
let pass = 0, fail = 0
const check = (c, label, extra = '') => {
  if (c) { pass++; return }
  fail++
  console.log('  X ' + label + (extra ? '  — ' + extra : ''))
}
// 이 저장소의 가로 종이(cards/sizing.ts). 원본(1040×720)보다 작아 같은 그림도 더 일찍 접힌다.
const LAND = [640, 482]
const counter = (from) => { let n = from; return () => n++ }

/** 화면 기록에 나온 그림 그대로 — `store.addCard('tree')` 가 하는 순서로 만든다. */
function videoPage() {
  const g = parseMermaid([
    'graph TB',
    '  A[기획] --> B[설계]',
    '  B --> C[개발]',
    '  C --> D{검수}',
    '  D --> E[배포]',
    '  D --> B',
  ].join('\n'))
  const parts = treeParts(g, LAND[0], LAND[1], counter(100), g.dir)
  const roots = treeShape(parts.els, parts.conns).roots
  const laid = layoutTree(parts.els, parts.conns, LAND[0], LAND[1], g.dir, roots)
  return { els: laid.els, conns: laid.conns }
}
const box = (id, x, y, more = {}) => ({ id, type: 'box', x, y, w: 120, h: 56, text: 'n' + id, color: '#eaf0ff', fs: 12, ...more })
const edgesOf = (els, conns) => {
  const t = (id) => (els.find((e) => e.id === id) || {}).text
  return conns.map((c) => t(c.from) + '>' + t(c.to)).sort().join(' ')
}
/** 눈에 보이는 것만 — 무엇이, 어디에, 어떤 크기와 색으로. `(dx, dy)` 는 밀어서 견줄 때 쓴다. */
const look = (e, dx = 0, dy = 0) => [e.type, e.text, e.x + dx, e.y + dy, e.w, e.h, e.color, e.tcolor].join('|')

// ── 1. 화면 기록 그대로: 트리를 전부 골라 복사 → 보통 쪽에 붙인다 ─────────
// **붙인 그림이 원본과 같아야 한다.**
{
  const page = videoPage()
  const before = JSON.stringify(page)
  const echoes = page.els.filter((e) => e.echoOf != null)
  const echo = echoes[0]
  check(echoes.length === 1 && echo.text === '개발',
    '(준비) 이 종이에서는 아래 띠로 접혀 흐린 「개발」(echo)이 하나 생긴다', echoes.map((e) => e.text).join())
  check(page.els.length === 6 && page.conns.length === 5, '(준비) 화면에서 고른 것은 여섯 · 선은 다섯', page.els.length + ' · ' + page.conns.length)

  const clip = copyParts(page, page.els.map((e) => e.id))
  check(clip.els.length === 6, '**고른 여섯을 전부 담는다** — 흐린 상자도 상자다', String(clip.els.length))
  check(clip.conns.length === 5 && clip.conns.every((c, i) => c.from === page.conns[i].from && c.to === page.conns[i].to),
    '**선을 그어진 그대로** 담는다 — 다른 상자로 옮겨 잇지 않는다', JSON.stringify(clip.conns.map((c) => [c.from, c.to])))

  const out = pasteParts(clip, [], counter(500), 20, 20, false)
  const ids = new Set(out.els.map((e) => e.id))
  check(out.els.length === 6 && out.conns.length === 5, '붙이면 **상자 여섯 · 선 다섯** — 고른 만큼 붙는다', out.els.length + ' · ' + out.conns.length)
  check(ids.size === 6 && out.els.every((e) => !page.els.some((o) => o.id === e.id)), '전부 **새 id** 를 받는다')
  check(out.conns.every((c) => ids.has(c.from) && ids.has(c.to)), '**모든 선의 양 끝이 새 상자**를 가리킨다 — 옛 id 가 안 남는다')

  // 그림이 같다 — 붙인 상자 하나하나가 원본을 그대로 민 것이다.
  check(out.els.map((e) => look(e)).join('  ') === page.els.map((e) => look(e, 20, 20)).join('  '),
    '**붙인 상자 하나하나가 원본을 그대로 민 것**이다 — 글자 · 자리 · 크기 · 채움 · 글자색', out.els.map((e) => look(e)).join('  '))
  const ghost = out.els.find((e) => e.text === '개발' && e.color === echo.color)
  check(!!ghost && ghost.x === echo.x + 20 && ghost.y === echo.y + 20 && ghost.tcolor === echo.tcolor,
    '흐린 「개발」 이 **흐린 채로 제자리에** 붙는다', ghost ? look(ghost) : '없음')
  // 화면 기록에서 틀렸던 바로 그 선.
  const gum = out.els.find((e) => e.text === '검수') || {}
  const into = out.conns.filter((c) => c.to === gum.id)
  check(into.length === 1 && !!ghost && into[0].from === ghost.id,
    '「검수」 로 들어오는 선은 **흐린 「개발」 에서** 나온다 — 왼쪽 아래 「개발」 에서 꺾여 올라오지 않는다',
    into.map((c) => (out.els.find((e) => e.id === c.from) || {}).color).join())
  // 표시가 남으면 오른쪽 패널이 「여기 것은 앉힐 때마다 새로 그려집니다」 라고 말한다 — 보통 쪽에서는 틀린 말이다.
  check(out.els.every((e) => e.echoOf == null), '보통 쪽에서는 **보통 상자**다 — 「다시 놓은 부모」 표시가 안 남는다')
  check(JSON.stringify(page) === before, '원본 쪽은 건드리지 않는다')
}

// ── 1-2. 머메이드(트리) 쪽에 붙이면 **구조까지** 그대로다 ───────────────
// 트리 쪽은 다시 앉힐 때 `echoOf` 로 「이건 다시 놓은 부모」 임을 읽는다. 표시를 떼고 붙이면 흐린 상자가
// **진짜 뿌리로 굳어** 붙인 그림이 둘로 쪼개진다(뿌리 3 · 상자 11 · 겹침). 그래서 표시를 **붙인 원본으로
// 다시 이어** 둔다 — 원본 쪽의 상자를 가리킨 채로 두면 남의 그림에 매달린다.
{
  const page = videoPage()
  const roots = treeShape(page.els, page.conns).roots
  const taken = page.els.map((e) => e.id)
  const clip = copyParts(page, taken)
  const out = pasteParts(clip, taken, counter(500), 20, 20, true)
  const ghosts = out.els.filter((e) => e.echoOf != null)
  const origin = ghosts.length ? out.els.find((e) => e.id === ghosts[0].echoOf) : null
  check(ghosts.length === 1, '흐린 사본이 「다시 놓은 부모」 로 남는다', String(ghosts.length))
  check(!!origin && origin.text === '개발' && origin.echoOf == null,
    '그 표시는 **붙인 「개발」** 을 가리킨다 — 원본 쪽의 「개발」 이 아니다', origin ? look(origin) : '붙인 것 안에 없음')
  check(out.els.map((e) => look(e)).join('  ') === page.els.map((e) => look(e, 20, 20)).join('  '), '붙인 직후의 그림은 여기서도 원본과 같다')

  const again = layoutTree([...page.els, ...out.els], [...page.conns, ...out.conns], LAND[0], LAND[1], 'TD', roots)
  const real = again.els.filter((e) => e.echoOf == null).length
  const rootN = treeShape(again.els, again.conns, roots).roots.length
  check(real === 10, '다시 앉혀도 상자는 **열**(다섯 + 다섯)이다 — 흐린 것이 진짜 상자로 굳지 않는다', String(real))
  check(rootN === 2, '뿌리는 **둘**이다 — 붙인 그림이 쪼개지지 않는다', String(rootN))
  check(again.overlapping === 0, '두 그림이 겹치지 않고 앉는다', String(again.overlapping))

  // 원본을 같이 안 담았으면 이을 데가 없다.
  const echo = page.els.find((e) => e.echoOf != null)
  const lone = pasteParts(copyParts(page, [echo.id]), taken, counter(900), 20, 20, true)
  check(lone.els.length === 1 && lone.els[0].echoOf == null,
    '원본 없이 흐린 상자만 붙이면 트리 쪽에서도 **보통 상자**다 — 가리킬 데가 없다', JSON.stringify(lone.els.map((e) => e.echoOf)))
}

// ── 2. 가진 것을 **골라 담지 않는다** ─────────────────────────
// 옛 cloneAt 은 w·h·text·color·fs·src 만 옮겼다. 마인드맵 중심(검은 바탕 · 흰 글자)을
// 붙이면 글자색이 떨어져 검은 바탕에 검은 글자가 됐다.
{
  const rich = box(1, 10, 20, {
    tcolor: '#ffffff', color: '#111318', bold: true, italic: true, underline: true, align: 'center',
    borderColor: '#2a78d6', borderWidth: 2, borderDash: 'dashed', rot: 15, opacity: 0.6, shadow: true,
    src: 'data:image/png;base64,AAAA', cells: [['가', '나'], ['다', '라']], rows: 2, cols: 2,
    blocks: [{ id: 7, type: 'text', text: '줄' }],
  })
  const out = pasteParts(copyParts({ els: [rich], conns: [] }, [1]), [], counter(500), 20, 30)
  const got = out.els[0] || {}
  const { id: _i, x: _x, y: _y, ...restGot } = got
  const { id: _i2, x: _x2, y: _y2, ...restWant } = rich
  check(JSON.stringify(restGot) === JSON.stringify(restWant), '**글자색 · 굵기 · 테두리 · 정렬 · 회전 · 표 칸**까지 그대로 온다', JSON.stringify(restGot))
  check(got.x === 30 && got.y === 50, '자리는 준 만큼만 민다', got.x + ',' + got.y)
  if (got.cells) got.cells[0][0] = '바뀜'
  check(!!got.cells && rich.cells[0][0] === '가', '**깊은 복사다** — 붙인 것을 고쳐도 원본 칸이 안 바뀐다')
}

// ── 3. 일부만 고르면, 밖으로 나가는 선은 두고 온다 ──────────────
// 한쪽 끝이 없는 선은 그릴 수 없다. 남겨 두면 없는 상자를 가리키는 선이 쪽에 쌓인다.
{
  const page = videoPage()
  const by = (t) => page.els.find((e) => e.text === t && e.echoOf == null).id
  const clip = copyParts(page, [by('기획'), by('설계')])
  check(clip.els.length === 2, '고른 둘만 담는다', String(clip.els.length))
  check(clip.conns.length === 1 && edgesOf(clip.els, clip.conns) === '기획>설계',
    '**둘 사이의 선 하나만** 온다 — 설계에서 밖으로 나가는 선은 두고 온다', edgesOf(clip.els, clip.conns))
  check(copyParts(page, [999999]).els.length === 0, '없는 id 는 조용히 건너뛴다')
}

// ── 4. 흐린 상자**만** 골랐을 때 ───────────────────────────────
// 이것도 **고른 모습 그대로** 붙는다. (처음에는 「원본의 색으로 바꿔」 냈는데, 본 것과 붙는 것이
// 다르면 안 된다는 같은 이유로 뒤집었다.)
{
  const page = videoPage()
  const echo = page.els.find((e) => e.echoOf != null)
  const out = pasteParts(copyParts(page, [echo.id]), [], counter(500), 20, 20, false)
  const got = out.els[0] || {}
  check(out.els.length === 1 && out.conns.length === 0, '상자 하나 · 선 없음', out.els.length + ' · ' + out.conns.length)
  check(look(got) === look(echo, 20, 20), '**고른 모습 그대로**다 — 흐린 색을 바꾸지 않는다', look(got))
  check(got.echoOf == null, '「다시 놓은 부모」 표시는 안 남는다')
}

// ── 5. 묶음(그룹)은 통째로 온다 ─────────────────────────────
// 화면에서 묶음의 하나를 누르면 전부 고른 것으로 친다(FreeLayer expandGroupIds). 복사도 같아야 한다.
{
  const page = { els: [box(1, 0, 0, { groupId: 77 }), box(2, 200, 0, { groupId: 77 }), box(3, 400, 0)], conns: [] }
  const clip = copyParts(page, [1])
  check(clip.els.length === 2, '묶음의 하나를 고르면 **나머지도 딸려 온다**', String(clip.els.length))
  const out = pasteParts(clip, [1, 2, 3], counter(500), 20, 20)
  const gids = [...new Set(out.els.map((e) => e.groupId))]
  check(gids.length === 1 && gids[0] != null, '붙인 것끼리 한 묶음이다', gids.join())
  check(gids[0] !== 77, '**원본과는 다른 묶음**이다 — 같은 번호면 붙인 것을 끌 때 원본까지 따라온다', String(gids[0]))
  const two = pasteParts(clip, [1, 2, 3], counter(600), 40, 40)
  const gid2 = (two.els[0] || {}).groupId
  check(gid2 != null && gid2 !== gids[0], '두 번 붙이면 묶음도 둘이다', String(gid2))
}

// ── 6. 이미 쓰는 id 는 건너뛴다 ─────────────────────────────
// echo 와 「＋ 가지」는 번호표를 안 뽑고 `가장 큰 id + 1` 을 쓴다(treeOps · RightPanel).
// 그래서 번호표가 **이미 쪽에 있는 id** 를 내줄 수 있다. 같은 id 가 둘이면 선이 엉뚱한 상자에 붙는다.
{
  const clip = copyParts({ els: [box(1, 0, 0), box(2, 200, 0)], conns: [{ from: 1, to: 2 }] }, [1, 2])
  const out = pasteParts(clip, [500, 501, 503], counter(500), 20, 20)
  const ids = out.els.map((e) => e.id)
  check(ids.join() === '502,504', '**쪽에 있는 id 를 피해** 받는다', ids.join())
  const c0 = out.conns[0] || {}
  check(c0.from === 502 && c0.to === 504, '선도 그 새 id 로 이어진다', JSON.stringify(c0))
}

// ── 7. **보이는 것만** 담는다 ───────────────────────────────
// 접힌 가지 아래 상자는 편집 화면에 안 그려진다(`hidden`). 그런데 끌어서 고르면 **자리만으로**
// 걸려든다 — 고르기는 그린 것이 아니라 쪽에 든 것을 본다(FreeLayer). 그대로 담으면 고른 적 없는
// 상자가 접기 전 자리 그대로 붙는다. `folded` 도 뗀다 — 붙인 곳에는 접을 아래가 없다.
{
  const page = {
    els: [box(1, 0, 0, { folded: true }), box(2, 0, 100, { hidden: true }), box(3, 0, 200, { hidden: true, groupId: 9 }), box(4, 300, 0, { groupId: 9 })],
    conns: [{ from: 1, to: 2 }, { from: 2, to: 3 }],
  }
  const clip = copyParts(page, [1, 2, 4])
  check(clip.els.map((e) => e.id).join() === '1,4', '**안 보이는 상자는 담지 않는다** — 묶음으로 딸려 오는 것도 보이는 것만', clip.els.map((e) => e.id).join())
  check(clip.conns.length === 0, '안 보이는 상자로 가던 선도 두고 온다', String(clip.conns.length))
  check(clip.els.every((e) => !('folded' in e) && !('hidden' in e)), '`folded` 표시를 뗀다', JSON.stringify(clip.els.map((e) => [e.folded, e.hidden])))
  // 안 보이는 것만 걸려들었으면 아무것도 안 담는다 — 그 묶음의 보이는 짝을 끌고 오지도 않는다.
  check(copyParts(page, [2, 3]).els.length === 0, '안 보이는 것만 골랐으면 **빈 채로** 둔다', String(copyParts(page, [2, 3]).els.length))
}

// ── 8. 선의 생김새와 꺾은 자리 ──────────────────────────────
// 꺾은 자리(`bend`)는 종이 위의 **절대 좌표**다(FreeLayer connPath). 상자만 밀고 이걸 두면
// 붙인 선이 원본 자리로 휘어 들어간다.
{
  const conn = { from: 1, to: 2, kind: 'curve', arrow: 'both', color: '#c23b48', width: 3, dash: true, bend: { x: 100, y: 40 } }
  const page = { els: [box(1, 0, 0), box(2, 200, 0)], conns: [conn] }
  const clip = copyParts(page, [1, 2])
  const out = pasteParts(clip, [1, 2], counter(500), 20, 30)
  const c = out.conns[0] || {}
  check(c.kind === 'curve' && c.arrow === 'both' && c.color === '#c23b48' && c.width === 3 && c.dash === true,
    '선의 종류 · 화살촉 · 색 · 굵기 · 점선이 그대로다', JSON.stringify(c))
  check(c.bend && c.bend.x === 120 && c.bend.y === 70, '**꺾은 자리도 같이 민다**', JSON.stringify(c.bend))
  const kept = (clip.conns[0] || {}).bend
  check(conn.bend.x === 100 && !!kept && kept.x === 100, '원본과 담아 둔 것의 꺾은 자리는 그대로다')
}

// ── 9. 있는 그대로 — 지어내지도 빼지도 않는다 ──────────────────
{
  // 같은 두 상자 사이에 선을 둘 그어 둔 사람이 있다. 하나로 줄이지 않는다.
  const twin = { els: [box(1, 0, 0), box(2, 200, 0)], conns: [{ from: 1, to: 2, kind: 'straight' }, { from: 1, to: 2, kind: 'curve' }] }
  check(copyParts(twin, [1, 2]).conns.length === 2, '사람이 그은 겹선은 **둘 다** 온다')

  // 흐린 상자에서 나간 선과 원본에서 나간 선이 **둘 다 그어져 있으면 둘 다** 온다 — 합치지 않는다.
  const both = {
    els: [box(1, 0, 0), box(2, 0, 100), box(3, 300, 0, { echoOf: 1 })],
    conns: [{ from: 1, to: 2 }, { from: 3, to: 2 }],
  }
  const c = copyParts(both, [1, 2, 3])
  check(c.els.length === 3 && c.conns.map((k) => k.from + '>' + k.to).join() === '1>2,3>2',
    '흐린 상자와 그 선을 **원본에 합치지 않는다**', c.els.length + ' · ' + c.conns.map((k) => k.from + '>' + k.to).join())

  // 겹치는 순서(뒤에 있는 것이 위)는 쪽에 놓인 순서다. 고른 순서로 뒤집히면 가려지는 것이 바뀐다.
  const z = { els: [box(1, 0, 0), box(2, 10, 10), box(3, 20, 20)], conns: [] }
  check(copyParts(z, [3, 1]).els.map((e) => e.id).join() === '1,3', '**쪽에 놓인 순서**대로 담는다 — 고른 순서가 아니다')
}

// ── 10. 단축키가 실제로 이 길을 쓴다 ───────────────────────────
// 함수만 만들어 두고 단축키가 옛 길(한 개짜리)로 남으면 화면에서는 아무것도 안 바뀐다.
{
  const hk = read('./src/builder/Hotkeys.tsx')
  check(!/cloneAt/.test(hk), '옛 한 개짜리 복제(cloneAt)가 안 남아 있다')
  check(/let CLIP: Clip \| null = null/.test(hk), '클립보드가 **요소 한 개가 아니라 묶음**을 든다')
  const line = (key) => (hk.split('\n').find((l) => new RegExp("mod && lower === '" + key + "'").test(l)) || '')
  const all = 'copyParts(selMany.page, selMany.els.map('
  check(line('c').includes(all), '⌘C 가 **고른 것 전부**를 담는다', line('c').trim())
  // 순서가 뒤집히면(지우고 나서 담으면) 빈 것을 담는다.
  const x = line('x')
  check(x.includes(all) && x.indexOf('copyParts(') < x.indexOf('removeEl('), '⌘X 가 **지우기 전에** 전부 담는다', x.trim())
  check(/putParts\(page, CLIP,/.test(line('v')), '⌘V 가 담아 둔 것을 통째로 넣는다', line('v').trim())
  check(line('d').includes('putParts(selMany.page, ' + all), '⌘D 도 **고른 것 전부**를 복제한다', line('d').trim())

  // **넣는 길은 하나다**(붙이기 · 복제 공용). 길이 둘이면 한쪽만 고쳐지는 날이 온다.
  const put = hk.slice(hk.indexOf('function putParts'), hk.indexOf('function onKey'))
  check(/pasteParts\(/.test(put), '넣는 길이 pasteParts 를 쓴다')
  // 넣기 직전을 기억해야 ⌘Z 로 돌아간다. 넣고 나서 기억하면 되돌릴 것이 없다.
  check(/snap\(page\)/.test(put) && put.indexOf('snap(page)') < put.indexOf('setCanvas('), '넣기 **직전**을 기억한다(⌘Z) — 붙이기 · 복제 둘 다 이 길을 지난다')
  // 안 보이는 것만 걸려들면 담긴 것이 없다. 그때 기억부터 하면 **아무것도 안 돌아가는 ⌘Z** 가 한 걸음 생긴다.
  check(/if \(!clip\.els\.length\) return/.test(put) && put.indexOf('clip.els.length') < put.indexOf('snap(page)'),
    '담긴 것이 없으면 **아무 일도 안 한다** — 빈 되돌리기 걸음을 안 남긴다')
  check(/page\.els\.map\(\(e\) => e\.id\)/.test(put), '그 쪽에 **이미 있는 id** 를 알려 준다 — 겹치지 않게')
  check((put.match(/setCanvas\(/g) || []).length === 1 && !/addEl\(|addConn\(/.test(put),
    '상자와 선을 **한 번에** 넣는다 — 하나씩 넣으면 중간 모습이 화면에 지나간다')
  check(/setSelMany\(/.test(put), '넣은 것을 **고른 채로** 둔다 — 바로 끌어 옮길 수 있게')
  check(/strokes: page\.strokes/.test(put), '펜으로 그은 것은 건드리지 않는다')
  // 「다시 놓은 부모」 표시를 남길지는 **붙이는 쪽이 트리인가**로 정한다(위 1-2).
  // 화면(FreeLayer · RightPanel)이 쓰는 것과 **같은 판정**을 쓴다 — 따로 재면 어긋난다.
  check(/pasteParts\(clip, .*, d, d, isTreePage\(page\)\)/.test(put), '붙이는 쪽이 **트리인지**를 넘긴다', (put.match(/pasteParts\([^\n]*/) || [''])[0])
  check(/import \{[^}]*\bisTreePage\b[^}]*\} from '\.\.\/cards\/treeOps'/.test(hk), '그 판정은 화면과 같은 것(cards/treeOps)이다')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
