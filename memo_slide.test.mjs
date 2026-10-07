// 메모장에서 **지금 슬라이드** 글을 고친다 — 오른쪽 아래 「내용」 편집기를 메모장으로 옮겼다(2026-10-06).
//
// **왜 생겼나.** 사용자: 「메모랑 슬라이드랑 연동되게 / 오른쪽 하단에서 글씨 수정 너무 불편함」.
// 「빈 페이지」 글은 종이 위에서 못 고치고, 고치는 곳은 오른쪽 속성 패널 **맨 아래**(배경·종이·전환·방향 다음)
// 한 군데였다. 폭 316px · 아래 여백 22px 이라 💬 챗봇 단추가 마지막 줄을 가렸다. 메모장은 넓지만
// 슬라이드와 이어져 있지 않았다 — 「슬라이드로」 는 한 번 복사할 뿐이라, 그 뒤 메모를 고쳐도 슬라이드는 그대로였다.
//
// 사용자가 고른 것: 메모장 맨 위 「📄 지금 슬라이드」 에서 **그 슬라이드의 글을** 고친다. 글은 슬라이드 한 곳에만
// 있다(두 벌로 두면 어긋난다). 그리고 「연결되면 굳이 필요없지 않을까?」 — 오른쪽 아래 글 편집기는 없애고
// 메모장으로 가는 단추 하나만 남긴다.
//
// 실행: node --experimental-strip-types --import ./ts_register.mjs memo_slide.test.mjs

import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(p, import.meta.url).pathname, 'utf8')
const bare = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
let pass = 0, fail = 0
const check = (c, label, extra = '') => {
  if (c) { pass++; return }
  fail++
  console.log('  X ' + label + (extra ? '  — ' + extra : ''))
}

const ed = bare(read('./src/builder/Editor.tsx'))
const np = bare(read('./src/notes/NotesPanel.tsx'))
const lay = bare(read('./src/builder/Layout.tsx'))

// ── 1. 오른쪽 「내용」 에는 단추 하나 ─────────────────────────
{
  const line = ed.split('\n').find((l) => /c\.viz === 'note'/.test(l)) || ''
  check(!!line, '(준비) 빈 페이지 갈래를 찾았다')
  check(!/BlockEditor/.test(line), '빈 페이지 「내용」 에 **글 편집기가 없다** — 메모장으로 옮겼다', line.trim().slice(0, 160))
  check(/ebook:notes-slide/.test(line) && /메모장에서 글 고치기/.test(line), '대신 「메모장에서 글 고치기」 단추가 메모장을 부른다')
  check(!/import BlockEditor/.test(ed), '쓰지 않게 된 BlockEditor 를 들여오지 않는다')
}

// ── 2. 메모장 — 「지금 슬라이드」 ───────────────────────────
{
  check(/useState<'list' \| 'editor' \| 'slide'>/.test(np), '메모장에 **슬라이드 보기**가 있다')
  check(/import BlockEditor from '\.\.\/builder\/BlockEditor'/.test(np) && (np.match(/<BlockEditor pageId=\{/g) || []).length === 1,
    '슬라이드 글은 **오른쪽 패널에 있던 그 편집기**로 고친다(BlockEditor 그대로)')
  // 메모용 편집기는 토글 · 강조 상자 · 구분선 · 정렬 · 글자 크기를 모르고 평범한 글로 눌러 버린다(normalizePlain).
  // 슬라이드 글을 그 편집기에 넣으면 고치는 순간 망가진다.
  check((np.match(/<PlainEditor /g) || []).length === 1, '메모용 편집기(PlainEditor)는 메모에만 쓴다 — 슬라이드 글을 거기 넣지 않는다')
  check(/cardByKey\([^)]*\)\?\.viz === 'note'/.test(np), '「지금 슬라이드」 는 **빈 페이지일 때만** — 다른 쪽은 종이 위에서 바로 고친다')
  check(/지금 슬라이드/.test(np), '목록 맨 위에 「지금 슬라이드」 줄이 있다')
  check(/addEventListener\('ebook:notes-slide'/.test(np), '오른쪽 패널 단추를 들으면 슬라이드 보기로 간다')
  const send = np.slice(np.indexOf('function sendToSlide'), np.indexOf('}', np.indexOf('setBlocks(pid, blocks)')) + 1)
  check(/setView\('slide'\)/.test(send), '「슬라이드로」 보낸 뒤에는 **그 슬라이드를 고치는 보기**로 넘어간다 — 메모를 고치며 슬라이드가 안 바뀐다고 헷갈리지 않게', send.replace(/\s+/g, ' ').slice(0, 160))
}

// ── 3. 메모장을 여는 길 ───────────────────────────────────
{
  const i = lay.indexOf("'ebook:notes-slide'")
  const around = i < 0 ? '' : lay.slice(Math.max(0, i - 200), i + 200)
  check(i >= 0 && /setSide\('notes'\)/.test(around), '단추를 누르면 **메모장이 열린다**(Layout 의 곁자리)', around.replace(/\s+/g, ' ').slice(0, 160))
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
