// **AI 마인드맵의 재료 — 슬라이드 · 메모 · 붙여 넣은 글을 자르지 않고 글로 모은다.**
//
// 챗봇이 쓰는 문서 요약(chat/bookState.ts)은 쪽마다 120자뿐이라 마인드맵 재료로는 모자란다. 여기서는 **전부** 모은다.
//
// 실행: node --experimental-strip-types --import ./ts_register.mjs source_text.test.mjs
const T = await import('./src/ai/sourceText.ts')

let pass = 0, fail = 0
const check = (c, label, extra = '') => {
  if (c) { pass++; return }
  fail++; console.log('  X ' + label + (extra ? '  — ' + extra : ''))
}
const blk = (text, children) => ({ id: 1, type: 'text', text, children })
const LONG = '가나다라마바사아자차'.repeat(30)        // 300자

// ── ① 슬라이드 ───────────────────────────────────────────
{
  const pages = [
    { id: 1, cardKey: 'cover', fields: { title: '표지 제목', sub: '부제' }, free: false, els: [], conns: [], strokes: [] },
    { id: 2, cardKey: 'note', fields: {}, free: false, els: [], conns: [], strokes: [], blocks: [blk(LONG), blk('위', [blk('아래 줄', [blk('더 아래')])])] },
    { id: 3, cardKey: 'slide', fields: {}, free: true, conns: [], strokes: [], els: [
      { id: 10, type: 'box', x: 0, y: 0, w: 1, h: 1, text: '상자 글', color: '', fs: 12 },
      { id: 11, type: 'table', x: 0, y: 0, w: 1, h: 1, text: '', color: '', fs: 12, rows: 2, cols: 2, cells: [['머리1', '머리2'], ['값1', '값2']] },
      { id: 12, type: 'note', x: 0, y: 0, w: 1, h: 1, text: '', color: '', fs: 12, blocks: [blk('메모 요소 글')] },
      { id: 13, type: 'box', x: 0, y: 0, w: 1, h: 1, text: '흐린 사본', color: '', fs: 12, echoOf: 10 },
      { id: 14, type: 'box', x: 0, y: 0, w: 1, h: 1, text: '접혀 숨은 상자', color: '', fs: 12, hidden: true },
    ] },
    { id: 4, cardKey: 'slide', fields: {}, free: true, els: [], conns: [], strokes: [] },
  ]
  const t = T.pagesText(pages)
  check(t.includes('표지 제목') && t.includes('부제'), '카드의 모든 필드')
  check(t.includes(LONG), '**긴 글이 잘리지 않는다**(챗봇 요약은 120자에서 자른다)')
  check(t.includes('아래 줄') && t.includes('더 아래'), '하위 블록까지')
  check(t.includes('상자 글') && ['머리1', '머리2', '값1', '값2'].every((c) => t.includes(c)) && t.includes('메모 요소 글'), '도형 글 · 표 칸 · 메모 요소')
  check(!t.includes('흐린 사본'), '다시 놓은 부모(흐린 사본)는 한 번만 — 원본만 읽는다')
  check(t.includes('접혀 숨은 상자'), '접혀서 안 보이는 상자도 자료다')
  check((t.match(/\[슬라이드 \d+\]/g) || []).length === 3, '쪽마다 구분 머리 · 빈 쪽은 뺀다', String((t.match(/\[슬라이드 \d+\]/g) || []).length))
  check(T.pagesText([]) === '' && T.pagesText(undefined) === '', '쪽이 없으면 빈 글')
}

// ── ② 메모 ─────────────────────────────────────────────
{
  const t = T.notesText([{ id: 'a', title: '회의 메모', blocks: [blk('첫 줄'), blk('둘째', [blk('딸린 줄')])], pinned: false, sort: 0 },
                         { id: 'b', title: '', blocks: [], pinned: false, sort: 1 }])
  check(t.includes('회의 메모') && t.includes('첫 줄') && t.includes('딸린 줄'), '메모 제목과 글(하위 포함)')
  check((t.match(/\[메모\]/g) || []).length === 1, '빈 메모는 뺀다')
}

// ── ③ 합치기 ────────────────────────────────────────────
{
  const c = T.combine([{ label: '슬라이드', text: '가나다' }, { label: '메모', text: '  ' }, { label: '붙여 넣은 글', text: '라마' }])
  check(c.text.includes('가나다') && c.text.includes('라마') && c.text.indexOf('가나다') < c.text.indexOf('라마'), '고른 재료를 순서대로 잇는다')
  check(c.counts.length === 2 && c.counts[0].chars === 3 && c.counts[1].label === '붙여 넣은 글', '재료별 글자 수(빈 것은 뺀다)', JSON.stringify(c.counts))
  check(c.chars === c.text.length, '전체 글자 수')
}

// ── ④ 파일 — 글 파일만 ─────────────────────────────────────
{
  check(T.readableFile('회의록.txt', 1000).ok && T.readableFile('a.MD', 10).ok && T.readableFile('표.csv', 10).ok && T.readableFile('x.html', 10).ok, 'txt · md · csv · html 은 받는다')
  const pdf = T.readableFile('보고서.pdf', 1000), ppt = T.readableFile('발표.pptx', 1000), doc = T.readableFile('문서.docx', 10), hwp = T.readableFile('한글.hwp', 10)
  check(!pdf.ok && !ppt.ok && !doc.ok && !hwp.ok, '**PDF · 오피스 · 한글 문서는 받지 않는다** — 억지로 읽으면 그럴듯하게 틀린다')
  check(/글로/.test(pdf.reason), '어떻게 하면 되는지 말해 준다(글로 바꿔 붙여 넣기)', pdf.reason)
  check(!T.readableFile('큰.txt', 11 * 1024 * 1024).ok, '10MB 를 넘으면 받지 않는다')
  check(!T.readableFile('그림.png', 10).ok, '그림은 받지 않는다')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
