// EVER-SKETCH1 → ebook_html 스케치 개선 이식 스모크(실서버 · 임시 DB).
//
// 단계마다 확인할 것을 아래 STAGES 에 **덧붙인다**. 한 단계가 다른 단계의 결과를 흐리지
// 않도록, 각 검사는 스스로 준비하고(쪽 추가·요소 놓기) 스스로 확인한다.
//
// 실행(서버는 dist 를 내보내므로 먼저 `npm run build`):
//   S=<scratch>; rm -f $S/ebk.db
//   (EBOOK_HTML_DB=$S/ebk.db server/.venv/bin/python -m uvicorn server.app:app --host 127.0.0.1 --port 8899 > $S/uv.log 2>&1 &)
//   node e2e/sketch_port_smoke.mjs
// **실제 server/ebook_html.db 에 대고 돌리지 않는다.**
import { chromium } from 'playwright'

const URL = process.env.URL || 'http://127.0.0.1:8899/'
const PW = process.env.PW_CHROME || undefined

let fail = 0
const ok = (name, cond, extra = '') => {
  console.log((cond ? '  PASS ' : '  FAIL ') + name + (extra !== '' ? '  — ' + extra : ''))
  if (!cond) fail++
}

const b = await chromium.launch({ executablePath: PW })
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []
p.on('pageerror', (e) => errs.push(String(e.message)))

// ── 편집기로 들어간다 ─────────────────────────────────────
await p.goto(URL, { waitUntil: 'networkidle' })
await p.locator('.lib-new').click()
await p.waitForSelector('.ax-app .axth', { timeout: 15000 })
await p.waitForTimeout(300)

const thumbs = p.locator('.axth-list .axth')
const onIndex = () => p.evaluate(() => Array.from(document.querySelectorAll('.axth-list .axth')).findIndex((n) => n.classList.contains('on')))
const layer = () => p.locator('.stage .freelayer:not(.off)').first()

/** 캔버스에 글상자 하나를 놓고 고른 채로 둔다. */
async function placeText(dx = 200, dy = 160) {
  const bb = await layer().boundingBox()
  await p.locator('.ib[title="텍스트"]').first().click()
  await p.mouse.click(bb.x + dx, bb.y + dy)
  await p.waitForTimeout(250)
}

const STAGES = []

// ── 1단계 ─────────────────────────────────────────────────
STAGES.push(['1단계', async () => {
  // ⑥ 쪽 추가 ⌘Z (9eabded) + ③ 장 목록 키 (1219bbd)
  const n0 = await thumbs.count()
  await thumbs.nth(0).click()
  await p.keyboard.press('Enter')                    // 목록에서 Enter = 새 슬라이드
  await p.waitForTimeout(250)
  const n1 = await thumbs.count()
  ok('[장 목록] Enter 로 새 슬라이드가 생긴다', n1 === n0 + 1, `${n0} → ${n1}`)

  await thumbs.nth(0).click()
  const i0 = await onIndex()
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(150)
  const i1 = await onIndex()
  ok('[장 목록] ↓ 로 다음 슬라이드를 고른다', i0 === 0 && i1 === 1, `${i0} → ${i1}`)
  const focusedOn = await p.evaluate(() => document.activeElement?.classList.contains('on') === true)
  ok('[장 목록] 초점이 고른 쪽을 따라간다', focusedOn)
  await p.keyboard.press('ArrowUp'); await p.waitForTimeout(150)
  ok('[장 목록] ↑ 로 이전 슬라이드', (await onIndex()) === 0)

  await p.keyboard.press('ControlOrMeta+z'); await p.waitForTimeout(250)
  const n2 = await thumbs.count()
  ok('[⌘Z] 쪽을 더한 일이 되돌아간다', n2 === n0, `${n1} → ${n2}`)
  await p.keyboard.press('ControlOrMeta+Shift+z'); await p.waitForTimeout(250)
  const n3 = await thumbs.count()
  ok('[⌘⇧Z] 다시 하면 쪽이 돌아온다', n3 === n0 + 1, `${n2} → ${n3}`)

  // ② 글자 크기 칸 (3b4846c) — 「60 → 50 이 6 에 박힌다」
  await thumbs.nth(0).click(); await p.waitForTimeout(200)
  await placeText()
  const fsIn = p.locator('input[aria-label="글자 크기"]')
  const hasFs = await fsIn.count()
  ok('[글자 크기] 글상자를 고르면 칸이 뜬다', hasFs > 0)
  if (hasFs) {
    await fsIn.click(); await fsIn.fill('60'); await fsIn.press('Tab'); await p.waitForTimeout(150)
    const v60 = await fsIn.inputValue()
    await fsIn.click()
    await fsIn.press('End'); await fsIn.press('Backspace'); await fsIn.press('Backspace')
    await p.keyboard.type('5')
    const mid = await fsIn.inputValue()
    await p.keyboard.type('0')
    await fsIn.press('Enter'); await p.waitForTimeout(150)
    const v50 = await fsIn.inputValue()
    ok('[글자 크기] 60 을 친다', v60 === '60', v60)
    ok('[글자 크기] 치는 도중 5 가 6 으로 깎이지 않는다', mid === '5', mid)
    ok('[글자 크기] 60 → 50 으로 고쳐진다', v50 === '50', v50)
    await fsIn.click(); await fsIn.press('ArrowDown'); await p.waitForTimeout(100)
    ok('[글자 크기] 아래 화살표도 동작한다', (await fsIn.inputValue()) === '49', await fsIn.inputValue())
    await fsIn.press('Escape')
  }

  // ⑧ 낱말 고르기 (wordSelect) — 글상자 더블클릭은 띄어쓰기 기준
  {
    // 위에서 글자를 49 로 키운 글상자는 상자 밖으로 넘친다 — 새 쪽에 기본 크기로 새로 놓는다.
    await thumbs.nth(1).click(); await p.waitForTimeout(200)
    await placeText()
    const bb = await layer().boundingBox()
    const txt = layer().locator('.fel .feltext').last()
    // 글을 바꿔 넣는다: 더블클릭으로 열고 → 전체 고르기 → 치기 → 바깥을 눌러 저장.
    await txt.dblclick(); await p.waitForTimeout(250)
    await p.keyboard.press('ControlOrMeta+a')
    await p.keyboard.type('성번02_. SAMPLE')
    await p.mouse.click(bb.x + bb.width - 20, bb.y + bb.height - 20); await p.waitForTimeout(250)
    const saved = await txt.textContent()
    ok('[낱말] 글상자에 「성번02_. SAMPLE」 이 들어갔다', saved === '성번02_. SAMPLE', JSON.stringify(saved))
    /** 글상자 안 i 번째 글자의 가운데 좌표. */
    const at = (i) => txt.evaluate((n, i) => {
      const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT); const t = w.nextNode()
      const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 1)
      const b = r.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }
    }, i)
    // (가) 편집 전 — 더블클릭으로 켜면서 누른 낱말까지
    const a = await at(1)
    await p.mouse.dblclick(a.x, a.y); await p.waitForTimeout(300)
    const w1 = await p.evaluate(() => String(window.getSelection()))
    ok('[낱말] 더블클릭으로 켜면 「성번02_.」 가 통째로 골라진다(밑줄·마침표에서 안 쪼갬)', w1 === '성번02_.', JSON.stringify(w1))
    // (나) 편집 중 — 다른 낱말 더블클릭
    const c = await at(11)
    await p.mouse.dblclick(c.x, c.y); await p.waitForTimeout(250)
    const w2 = await p.evaluate(() => String(window.getSelection()))
    ok('[낱말] 편집 중 더블클릭은 「SAMPLE」', w2 === 'SAMPLE', JSON.stringify(w2))
    await p.mouse.click(bb.x + bb.width - 20, bb.y + bb.height - 20); await p.keyboard.press('Escape'); await p.waitForTimeout(150)
  }

  // ⑦ 발표 Esc (bab224b)
  await p.keyboard.press('F5'); await p.waitForTimeout(300)
  const pOpen = await p.locator('.present').count()
  await p.keyboard.press('Escape'); await p.waitForTimeout(250)
  const pAfter = await p.locator('.present').count()
  ok('[발표] F5 로 열리고 Esc 로 닫힌다', pOpen === 1 && pAfter === 0, `${pOpen} → ${pAfter}`)

  // ⑥ 단축키 표기 (d41f51f)
  await p.keyboard.press('F1'); await p.waitForTimeout(250)
  const sw = await p.locator('.help-keys-os button').count()
  const tbl = await p.locator('.kbd-tbl').innerText().catch(() => '')
  ok('[단축키] 도움말에 표기 고르기(자동·맥·윈도우)가 있다', sw === 3, String(sw))
  ok('[단축키] 표에 맥/윈도우 섞인 「⌘/Ctrl」 이 없다', tbl.length > 0 && !tbl.includes('⌘/Ctrl'))
  ok('[단축키] 저장 · 이북 만들기가 제 키로 적혀 있다', /저장/.test(tbl) && /이북\(웹\) 만들기/.test(tbl))
  await p.keyboard.press('Escape'); await p.waitForTimeout(150)

  // ⑤ 패널 자동 접기 (31b27ae) — 좁은 창에서 가로 종이일 때 필름부터 접힌다.
  //   세로 종이(기본)는 작아서 안 접힌다 — 먼저 그것부터 본다.
  await p.setViewportSize({ width: 1024, height: 800 }); await p.waitForTimeout(300)
  const leftNamed = await p.locator('.ax-edge.l.named').count()
  ok('[패널] 세로 종이 · 1024 에서는 안 접는다', leftNamed === 0)
  await p.setViewportSize({ width: 700, height: 800 }); await p.waitForTimeout(300)
  const leftNamed2 = await p.locator('.ax-edge.l.named').count()
  ok('[패널] 아주 좁으면(700) 쪽 목록을 접고 이름을 보여 준다', leftNamed2 === 1)
  await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(300)
  ok('[패널] 넓히면 다시 편다', (await p.locator('.ax-edge.l.named').count()) === 0)
}])

// ── 2단계 ─────────────────────────────────────────────────
const SHOT_DIR = process.env.SHOT_DIR || ''

/** 목록 화면으로 돌아가 새 이북을 하나 연다. 앞 단계의 흔적 없이 시작한다. */
async function freshBook() {
  await p.goto(URL, { waitUntil: 'networkidle' })
  await p.locator('.lib-new').click()
  await p.waitForSelector('.ax-app .axth', { timeout: 15000 })
  await p.waitForTimeout(400)
}

// (추가 요청) 새 이북을 열자마자 ⌘Z 를 누르면 첫 빈 슬라이드가 지워졌다.
// newProject 가 resetHistory() 를 addCard 보다 **먼저** 불러, 첫 장이 되돌릴 수 있는 일이 됐다.
STAGES.push(['2단계 · 새 이북 직후 ⌘Z', async () => {
  await freshBook()
  const n0 = await thumbs.count()
  await p.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur() })   // 입력칸 밖에 초점
  await p.keyboard.press('ControlOrMeta+z'); await p.waitForTimeout(300)
  const n1 = await thumbs.count()
  ok('[새 이북] 첫 슬라이드 한 장으로 시작한다', n0 === 1, String(n0))
  ok('[새 이북] 바로 ⌘Z 를 눌러도 첫 슬라이드가 남는다', n1 === 1, `${n0} → ${n1}`)
}])

// ① 화면 배율 (EVER-SKETCH1 1363964 배율 부분) — 원본 e2e/zoom_smoke.mjs 를 옮김
STAGES.push(['2단계 · 화면 배율', async () => {
  const pct = async () => Number((await p.locator('.pv-zoom .v').innerText()).replace('%', ''))
  /** 숫자가 아니라 **눈에 보이는 종이**를 잰다. */
  const paper = async () => (await p.locator('.stage .freelayer').first().boundingBox()).width
  const fitOn = async () => (await p.locator('.pv-zoom .fitb.on').count()) === 1
  const plus = p.locator('.pv-zoom button', { hasText: '+' }).first()
  const minus = p.locator('.pv-zoom button', { hasText: '−' }).first()

  ok('[배율] 상태막대에 배율 조절이 있다', (await p.locator('.pv-zoom').count()) === 1)
  ok('[배율] 처음엔 「맞춤」이 켜져 있다', await fitOn())
  const tips = await p.locator('.pv-zoom button').evaluateAll((bs) => bs.map((b) => b.title).join(' | '))
  ok('[배율] 툴팁에 그 사람 키보드 글자(⌘/Ctrl 섞어 쓰기 없음)', !tips.includes('⌘/Ctrl') && /[⌘]|Ctrl/.test(tips), tips)

  const z0 = await pct(), w0 = await paper()
  await plus.click(); await p.waitForTimeout(300)
  const z1 = await pct(), w1 = await paper()
  ok('[배율] + 를 누르면 % 와 종이가 커진다', z1 > z0 && w1 > w0 + 20, `${z0}% ${Math.round(w0)}px → ${z1}% ${Math.round(w1)}px`)
  ok('[배율] 사람이 손대면 「맞춤」이 꺼진다', !(await fitOn()))
  await minus.click(); await minus.click(); await p.waitForTimeout(300)
  const z2 = await pct(), w2 = await paper()
  ok('[배율] − 를 누르면 작아진다', z2 < z1 && w2 < w1 - 20, `${z1}% ${Math.round(w1)}px → ${z2}% ${Math.round(w2)}px`)
  await p.locator('.pv-zoom .fitb').click(); await p.waitForTimeout(300)
  ok('[배율] 「맞춤」이 창에 맞춘 배율로 되돌린다', (await pct()) === z0 && await fitOn(), `${z2}% → ${await pct()}% (처음 ${z0}%)`)

  await p.keyboard.press('ControlOrMeta+Equal'); await p.waitForTimeout(300)
  ok('[배율] ⌘/Ctrl = 로도 커진다', (await pct()) > z0, `${await pct()}%`)
  await p.keyboard.press('ControlOrMeta+Minus'); await p.keyboard.press('ControlOrMeta+Minus'); await p.waitForTimeout(300)
  ok('[배율] ⌘/Ctrl − 로 작아진다', (await pct()) < z0, `${await pct()}%`)
  await p.keyboard.press('ControlOrMeta+Digit0'); await p.waitForTimeout(300)
  ok('[배율] ⌘/Ctrl 0 이 맞춤으로 되돌린다', (await pct()) === z0 && await fitOn())

  // Ctrl+휠 — 브라우저가 페이지째 확대하지 않고 우리가 받는다.
  const sb = await p.locator('.stage').first().boundingBox()
  await p.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2)
  await p.keyboard.down('Control'); await p.mouse.wheel(0, -100); await p.keyboard.up('Control'); await p.waitForTimeout(300)
  ok('[배율] Ctrl+휠 위로 = 확대', (await pct()) > z0, `${await pct()}%`)
  await p.keyboard.press('ControlOrMeta+Digit0'); await p.waitForTimeout(200)

  // 100% 를 넘을 수 있다 — 상한이 남아 있으면 + 를 눌러도·창을 키워도 100 에서 멈춘다.
  for (let i = 0; i < 4; i++) { await plus.click(); await p.waitForTimeout(80) }
  const zBig = await pct()
  ok('[배율] + 로 100% 를 넘긴다', zBig > 100, `${zBig}%`)
  // 종이가 작업창보다 커져도 왼쪽 끝이 잘려 나가지 않는다(스크롤로 닿는다).
  const st = await p.locator('.stage').first().boundingBox()
  const pl = await p.locator('.stage .freelayer').first().boundingBox()
  ok('[배율] 작업창보다 커진 종이의 왼쪽 끝이 잘리지 않는다', pl.width > st.width && pl.x >= st.x - 1,
    `작업창 x ${Math.round(st.x)} · 종이 x ${Math.round(pl.x)} · 폭 ${Math.round(pl.width)}`)
  await p.locator('.pv-zoom .fitb').click()
  await p.setViewportSize({ width: 2200, height: 1400 }); await p.waitForTimeout(500)
  ok('[배율] 창을 키우면 맞춤 배율이 100% 를 넘는다(상한이 풀렸다)', (await pct()) > 100, `${await pct()}%`)
  await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(400)
}])

// 표 — 칸을 끌면 범위 선택, 표는 ⠿ 손잡이로만 움직인다 (b721df0 기반 · 8cb80f5 손잡이 자리)
STAGES.push(['2단계 · 표 칸 끌기 · ⠿ 이동 · 다시 열기', async () => {
  const tblFel = () => layer().locator('.fel:has(.feltable)').first()
  const lb = await layer().boundingBox()
  await p.locator('.ib[title="표"]').first().click()
  await p.mouse.click(lb.x + lb.width * 0.4, lb.y + lb.height * 0.35)
  await p.waitForTimeout(300)
  ok('[표] 표가 놓였다', (await layer().locator('.feltable').count()) === 1)

  const cell = (r, c) => tblFel().locator(`.feltd[data-r="${r}"][data-c="${c}"]`)
  const center = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } }
  const box0 = await tblFel().boundingBox()
  const a = await center(cell(0, 0)), z = await center(cell(1, 1))
  await p.mouse.move(a.x, a.y); await p.mouse.down()
  for (let i = 1; i <= 6; i++) await p.mouse.move(a.x + (z.x - a.x) * i / 6, a.y + (z.y - a.y) * i / 6)
  await p.mouse.up(); await p.waitForTimeout(200)
  const box1 = await tblFel().boundingBox()
  const nSel = await tblFel().locator('.feltd.cellsel').count()
  ok('[표] 칸에서 칸으로 끌면 범위가 골라진다(2×2)', nSel === 4, `골라진 칸 ${nSel}`)
  const hint = await p.locator('.ax-tbrow.ctx .tbtn-hint').first().innerText().catch(() => '')
  ok('[표] 둘째 줄 표 도구가 범위를 말해 준다', /2×2/.test(hint), JSON.stringify(hint))
  ok('[표] 칸을 끌어도 표는 제자리다', Math.abs(box1.x - box0.x) < 1 && Math.abs(box1.y - box0.y) < 1,
    `(${Math.round(box0.x)},${Math.round(box0.y)}) → (${Math.round(box1.x)},${Math.round(box1.y)})`)

  // ⠿ 손잡이는 **확대한 상태에서** 끈다 — 표가 커서를 그대로 따라오면 zoomOf 가 좌표를 나눈 것이다.
  await p.locator('.pv-zoom button', { hasText: '+' }).first().click(); await p.waitForTimeout(300)
  const handle = layer().locator('.tbl-move')
  ok('[표] 표를 고르면 ⠿ 손잡이가 보인다', (await handle.count()) === 1)
  const hb = await handle.boundingBox(); const tb0 = await tblFel().boundingBox()
  await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await p.mouse.down()
  for (let i = 1; i <= 6; i++) await p.mouse.move(hb.x + hb.width / 2 + 10 * i, hb.y + hb.height / 2 + 7 * i)
  await p.mouse.up(); await p.waitForTimeout(250)
  const tb1 = await tblFel().boundingBox()
  const dx = tb1.x - tb0.x, dy = tb1.y - tb0.y
  ok('[표] ⠿ 를 끌면 표가 움직인다', dx > 40 && dy > 25, `dx ${dx.toFixed(1)} dy ${dy.toFixed(1)}`)
  ok('[표] 확대 중에도 표가 커서를 그대로 따라온다(배율로 나눔)', Math.abs(dx - 60) < 4 && Math.abs(dy - 42) < 4,
    `커서 (60,42) · 표 (${dx.toFixed(1)},${dy.toFixed(1)})`)
  if (SHOT_DIR) {
    const z = (await p.locator('.pv-zoom .v').innerText()).replace('%', '')
    await p.screenshot({ path: SHOT_DIR + '/stage2_zoom_' + z + 'pct.png' })
  }
  await p.locator('.pv-zoom .fitb').click(); await p.waitForTimeout(300)

  // 칸 더블클릭 = 그 칸에 바로 쓰기
  await cell(1, 0).dblclick(); await p.waitForTimeout(300)
  const focused = await p.evaluate(() => { const a = document.activeElement; return a ? a.getAttribute('data-rc') : null })
  ok('[표] 칸을 더블클릭하면 그 칸에 커서가 선다', focused === '1_0', String(focused))
  await p.keyboard.press('ControlOrMeta+a')   // 새 표 칸의 기본 글(「내용」 등)을 갈아 쓴다
  await p.keyboard.type('이식2')
  await p.mouse.click(lb.x + lb.width - 15, lb.y + lb.height - 15); await p.waitForTimeout(200)
  ok('[표] 친 글이 칸에 남는다', (await cell(1, 0).innerText()) === '이식2', await cell(1, 0).innerText())

  // 저장을 기다렸다 다시 연다
  for (let i = 0; i < 30; i++) {
    const s = await p.locator('.save-lab').innerText().catch(() => '')
    if (s === '저장됨') break
    await p.waitForTimeout(300)
  }
  await p.waitForTimeout(1200)
  await p.goto(URL, { waitUntil: 'networkidle' })
  await p.locator('.lib-open-hit').first().click()
  await p.waitForSelector('.ax-app .axth', { timeout: 15000 }); await p.waitForTimeout(500)
  const again = layer().locator('.fel:has(.feltable)')
  const text = await again.locator('.feltd[data-r="1"][data-c="0"]').innerText().catch(() => '')
  ok('[표] 다시 열어도 표와 글이 그대로다', (await again.count()) === 1 && text === '이식2', `표 ${await again.count()} · ${JSON.stringify(text)}`)
}])

// ── 3단계 ─────────────────────────────────────────────────
// 표 편집(6817694 경계 끌기 · 17cb06d 보이게 · bc8baa1 행=표 높이 · e38d357 병합 넓히기·머리 띠 ·
// 824ec0e 표엔 연결점 없음 · e6bc1d2 칸 ⌘Z · 미커밋 편집 중 다른 칸/테두리 · d57203f 한글 한 번)
STAGES.push(['3단계 · 표 편집 · 한글 입력', async () => {
  await freshBook()
  const tblFel = () => layer().locator('.fel:has(.feltable)').first()
  const cell = (r, c) => tblFel().locator(`.feltd[data-r="${r}"][data-c="${c}"]`)
  const center = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } }
  const nSel = () => tblFel().locator('.feltd.cellsel').count()
  const nEditing = () => layer().locator('.feltd[contenteditable="true"]').count()
  const drag = async (from, to, steps = 6) => {
    await p.mouse.move(from.x, from.y); await p.mouse.down()
    for (let i = 1; i <= steps; i++) await p.mouse.move(from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps)
    await p.mouse.up(); await p.waitForTimeout(200)
  }
  const lb = await layer().boundingBox()
  const blank = { x: lb.x + lb.width - 15, y: lb.y + lb.height - 15 }

  await p.locator('.ib[title="표"]').first().click()
  await p.mouse.click(lb.x + lb.width * 0.3, lb.y + lb.height * 0.35)
  await p.waitForTimeout(300)
  ok('[표3] 표가 놓였다', (await layer().locator('.feltable').count()) === 1)

  // ① 칸을 골라도 크기 손잡이가 Esc 없이 보인다 + 경계선 손잡이
  await cell(0, 0).click(); await p.waitForTimeout(200)
  ok('[표3] 칸을 골라도 크기 손잡이 8개가 그대로 보인다(Esc 없이)', (await layer().locator('.rs-h').count()) === 8,
    String(await layer().locator('.rs-h').count()))
  const gc = layer().locator('.trk-grip.trk-col'), gr = layer().locator('.trk-grip.trk-row')
  ok('[표3] 열 경계 손잡이 1 · 행 경계 손잡이 1 (2×2 표)', (await gc.count()) === 1 && (await gr.count()) === 1,
    `${await gc.count()} · ${await gr.count()}`)
  const op = await gc.first().evaluate((n) => Number(getComputedStyle(n, '::before').opacity))
  ok('[표3] 경계 손잡이가 **보인다**(opacity ≥ .5)', op >= 0.5, String(op))
  if (SHOT_DIR) {
    const tb = await tblFel().boundingBox()
    await p.screenshot({ path: SHOT_DIR + '/stage3_table_handles.png',
      clip: { x: tb.x - 60, y: tb.y - 60, width: tb.width + 120, height: tb.height + 120 } })
  }

  // ② 열 경계를 끌면 두 열 너비가 바뀌고 표 폭은 그대로
  const w00 = (await cell(0, 0).boundingBox()).width, w01 = (await cell(0, 1).boundingBox()).width
  const tw0 = (await tblFel().boundingBox()).width
  await drag(await center(gc.first()), { ...(await center(gc.first())), x: (await center(gc.first())).x + 40 })
  const w10 = (await cell(0, 0).boundingBox()).width, w11 = (await cell(0, 1).boundingBox()).width
  const tw1 = (await tblFel().boundingBox()).width
  ok('[표3] 열 경계를 끌면 왼쪽 열이 넓어지고 오른쪽이 좁아진다', w10 > w00 + 25 && w11 < w01 - 25,
    `${w00.toFixed(1)}/${w01.toFixed(1)} → ${w10.toFixed(1)}/${w11.toFixed(1)}`)
  ok('[표3] 표 전체 폭은 그대로다', Math.abs(tw1 - tw0) < 1, `${tw0.toFixed(1)} → ${tw1.toFixed(1)}`)
  // 행 경계도
  const h00 = (await cell(0, 0).boundingBox()).height, th0 = (await tblFel().boundingBox()).height
  const rg = await center(gr.first())
  await drag(rg, { x: rg.x, y: rg.y + 12 })
  const h10 = (await cell(0, 0).boundingBox()).height, th1 = (await tblFel().boundingBox()).height
  ok('[표3] 행 경계를 끌면 위 행이 높아지고 표 높이는 그대로다', h10 > h00 + 6 && Math.abs(th1 - th0) < 1,
    `행 ${h00.toFixed(1)} → ${h10.toFixed(1)} · 표 ${th0.toFixed(1)} → ${th1.toFixed(1)}`)

  // ③ 행을 넣으면 표가 그만큼 커진다(남은 행은 그대로)
  await cell(1, 0).click(); await p.waitForTimeout(150)
  const rh0 = (await cell(1, 0).boundingBox()).height, T0 = (await tblFel().boundingBox()).height
  await p.locator('.insp-pill', { hasText: '↓ 아래 추가' }).first().click(); await p.waitForTimeout(250)
  const rh1 = (await cell(1, 0).boundingBox()).height, T1 = (await tblFel().boundingBox()).height
  ok('[표3] 행을 넣으면 표가 한 행만큼 커진다', T1 > T0 + rh0 * 0.8 && (await tblFel().locator('.feltd[data-c="0"]').count()) === 3,
    `표 ${T0.toFixed(1)} → ${T1.toFixed(1)} (행 ${rh0.toFixed(1)})`)
  ok('[표3] 남은 행의 높이는 그대로다', Math.abs(rh1 - rh0) < 1.5, `${rh0.toFixed(1)} → ${rh1.toFixed(1)}`)

  // ④ 병합 칸에 닿으면 범위가 커진다 · 머리 띠
  await drag(await center(cell(0, 0)), await center(cell(1, 0)))
  await p.locator('.insp-pill', { hasText: '⤢ 병합' }).first().click(); await p.waitForTimeout(250)
  ok('[표3] (0,0)~(1,0) 을 병합했다', (await cell(1, 0).count()) === 0)
  const tbA = await tblFel().boundingBox()
  await drag(await center(cell(0, 1)), await center(cell(0, 0)))
  ok('[표3] 0행에서 2행 병합 칸으로 끌면 범위가 1행까지 커진다(병합·(0,1)·(1,1) = 3칸)', (await nSel()) === 3, String(await nSel()))
  const tbB = await tblFel().boundingBox()
  ok('[표3] 칸 안에서 끌어도 표는 제자리다', Math.abs(tbA.x - tbB.x) < 1 && Math.abs(tbA.y - tbB.y) < 1)
  const bands = layer().locator('.trk-band.trk-band-col')
  await bands.nth(1).click(); await p.waitForTimeout(150)
  ok('[표3] 열 머리 띠를 누르면 그 열 통째로(3칸)', (await nSel()) === 3, String(await nSel()))

  // ⑤ 편집 중 다른 칸을 누르면 편집이 끝나고 그 칸이 골라진다 → 그대로 끌면 범위
  await cell(2, 0).dblclick(); await p.waitForTimeout(300)
  ok('[표3] 칸 더블클릭 = 편집', (await nEditing()) > 0)
  await p.keyboard.type('ab')
  await drag(await center(cell(2, 1)), await center(cell(1, 1)))
  ok('[표3] 편집 중 다른 칸을 누르면 편집이 끝난다', (await nEditing()) === 0, String(await nEditing()))
  ok('[표3] …그리고 그대로 끌면 범위가 골라진다(2칸)', (await nSel()) === 2, String(await nSel()))
  ok('[표3] 편집하던 칸의 글은 저장됐다', (await cell(2, 0).innerText()) === 'ab', JSON.stringify(await cell(2, 0).innerText()))

  // ⑥ 편집 중 표 테두리를 잡으면 편집이 풀리고 표가 움직인다
  await cell(2, 1).dblclick(); await p.waitForTimeout(300)
  const tb2 = await tblFel().boundingBox()
  await drag({ x: tb2.x + 2, y: tb2.y + tb2.height / 2 }, { x: tb2.x + 22, y: tb2.y + tb2.height / 2 + 10 })
  const tb3 = await tblFel().boundingBox()
  ok('[표3] 편집 중 표 테두리를 잡으면 편집이 풀린다', (await nEditing()) === 0, String(await nEditing()))
  ok('[표3] …그리고 표가 움직인다', tb3.x - tb2.x > 10, `dx ${(tb3.x - tb2.x).toFixed(1)}`)

  // ⑦ 칸 글자를 고치고 나온 뒤 ⌘Z 하면 고치기 전 글로
  await cell(0, 1).dblclick(); await p.waitForTimeout(300)
  const beforeTxt = await cell(0, 1).innerText()
  await p.keyboard.press('ControlOrMeta+a'); await p.keyboard.type('고침')
  await p.mouse.click(blank.x, blank.y); await p.waitForTimeout(250)
  const midTxt = await cell(0, 1).innerText()
  await p.keyboard.press('ControlOrMeta+z'); await p.waitForTimeout(250)
  const undoTxt = await cell(0, 1).innerText()
  ok('[표3] 칸 글을 고치고 나온 뒤 ⌘Z → 고치기 전 글', midTxt === '고침' && undoTxt === beforeTxt,
    `${JSON.stringify(beforeTxt)} → ${JSON.stringify(midTxt)} → ⌘Z ${JSON.stringify(undoTxt)}`)

  // ⑧ 한글 「가나」 가 한 번만 찍힌다 — IME 조합을 흉내 낸다(CDP imeSetComposition → insertText)
  const cdp = await p.context().newCDPSession(p)
  const ime = async (syllables) => {
    for (const [mid, fin] of syllables) {
      await cdp.send('Input.imeSetComposition', { text: mid, selectionStart: mid.length, selectionEnd: mid.length })
      await cdp.send('Input.imeSetComposition', { text: fin, selectionStart: fin.length, selectionEnd: fin.length })
      await cdp.send('Input.insertText', { text: fin })
    }
  }
  // (가) 빈 칸을 더블클릭해 쓰기
  await cell(2, 1).dblclick(); await p.waitForTimeout(300)
  await ime([['ㄱ', '가'], ['ㄴ', '나']]); await p.waitForTimeout(150)
  const typing = await cell(2, 1).innerText()
  await p.mouse.click(blank.x, blank.y); await p.waitForTimeout(250)
  const typed = await cell(2, 1).innerText()
  ok('[표3] 빈 칸에 한글 「가나」 를 치면 「가나」 한 번(치는 중)', typing === '가나', JSON.stringify(typing))
  ok('[표3] …나온 뒤에도 「가나」 한 번', typed === '가나', JSON.stringify(typed))
  // (나) 칸을 고르고 곧바로 한글 — keydown 'Process'(IME) 가 편집을 켜고 첫 글자가 안 씹힌다
  await cell(1, 1).click(); await p.waitForTimeout(150)
  await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Process', code: 'KeyR', windowsVirtualKeyCode: 229, nativeVirtualKeyCode: 229 })
  await ime([['ㄱ', '가'], ['ㄴ', '나']])
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Process', code: 'KeyR', windowsVirtualKeyCode: 229, nativeVirtualKeyCode: 229 })
  await p.waitForTimeout(150)
  await p.mouse.click(blank.x, blank.y); await p.waitForTimeout(250)
  const typed2 = await cell(1, 1).innerText()
  ok('[표3] 칸을 고르고 바로 한글을 쳐도 「가나」 한 번(칸을 갈아 씀)', typed2 === '가나', JSON.stringify(typed2))

  // ⑨ 표 칸을 잡아 끌어도 연결선이 생기지 않는다(표에는 연결점이 없다)
  const conns0 = await layer().locator('.freeconn path[marker-end]').count()
  const c11 = await center(cell(1, 1))
  await p.mouse.click(blank.x, blank.y); await p.waitForTimeout(150)   // 표 고르기 풀기(연결점은 안 고른 요소에 뜬다)
  await p.mouse.move(c11.x, c11.y); await p.waitForTimeout(200)
  ok('[표3] 표에 마우스를 올려도 연결점이 안 뜬다', (await layer().locator('.cpt').count()) === 0, String(await layer().locator('.cpt').count()))
  await drag(c11, { x: lb.x + lb.width * 0.8, y: lb.y + lb.height * 0.8 })
  ok('[표3] 표 칸을 잡아 끌어도 연결선이 안 생긴다', (await layer().locator('.freeconn path[marker-end]').count()) === conns0)

  // ⑩ 다시 열어도 열 너비·행 높이·칸 글이 그대로
  const wA = (await cell(0, 0).boundingBox()).width, wB = (await cell(0, 1).boundingBox()).width
  const TH = (await tblFel().boundingBox()).height
  const hR = (await cell(0, 1).boundingBox()).height / (await cell(1, 1).boundingBox()).height
  for (let i = 0; i < 30; i++) {
    const s = await p.locator('.save-lab').innerText().catch(() => '')
    if (s === '저장됨') break
    await p.waitForTimeout(300)
  }
  await p.waitForTimeout(1200)
  await p.goto(URL, { waitUntil: 'networkidle' })
  await p.locator('.lib-open-hit').first().click()
  await p.waitForSelector('.ax-app .axth', { timeout: 15000 }); await p.waitForTimeout(500)
  const wA2 = (await cell(0, 0).boundingBox()).width, wB2 = (await cell(0, 1).boundingBox()).width
  const TH2 = (await tblFel().boundingBox()).height
  const hR2 = (await cell(0, 1).boundingBox()).height / (await cell(1, 1).boundingBox()).height
  ok('[표3] 다시 열어도 행 높이 비율이 그대로다', Math.abs(hR2 - hR) < 0.02 && hR > 1.1, `${hR.toFixed(3)} → ${hR2.toFixed(3)}`)
  ok('[표3] 다시 열어도 열 너비 비율이 그대로다', Math.abs(wA2 / wB2 - wA / wB) < 0.02, `${(wA / wB).toFixed(3)} → ${(wA2 / wB2).toFixed(3)}`)
  ok('[표3] 다시 열어도 표 높이(행 추가분)가 그대로다', Math.abs(TH2 - TH) < 1, `${TH.toFixed(1)} → ${TH2.toFixed(1)}`)
  const t21 = await cell(2, 1).innerText(), t11 = await cell(1, 1).innerText(), t20 = await cell(2, 0).innerText()
  ok('[표3] 다시 열어도 칸 글(「ab」·「가나」·「가나」)이 그대로다', t20 === 'ab' && t21 === '가나' && t11 === '가나',
    [t20, t21, t11].map((s) => JSON.stringify(s)).join(' · '))
}])

for (const [name, run] of STAGES) {
  console.log(`\n# ${name}`)
  try { await run() } catch (e) { ok(`${name} 실행 중 예외 없음`, false, String(e && e.message || e)) }
}

ok('페이지 오류 없음(pageerror)', errs.length === 0, errs.join(' | '))
await b.close()
console.log(fail ? `\n=== FAIL (${fail}) ===` : '\n=== ALL PASS ===')
process.exit(fail ? 1 : 0)
