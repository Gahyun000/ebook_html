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

/** 캔버스에 글상자 하나를 놓고 고른 채로 둔다.
 *  4단계(EVER-SKETCH1 90e7439)부터 T 는 **누르는 즉시** 종이 한가운데에 놓고 커서까지 넣는다 —
 *  캔버스를 한 번 더 누르던 걸음이 없어졌다. (인자는 옛 호출과 맞추려고 남겨 둔다.) */
async function placeText(_dx = 200, _dy = 160) {
  await p.locator('.ib[title="텍스트"]').first().click()
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

/** 목록 화면으로 돌아가 스케치을 하나 연다. 앞 단계의 흔적 없이 시작한다. */
async function freshBook() {
  await p.goto(URL, { waitUntil: 'networkidle' })
  await p.locator('.lib-new').click()
  await p.waitForSelector('.ax-app .axth', { timeout: 15000 })
  await p.waitForTimeout(400)
}

// (추가 요청) 스케치을 열자마자 ⌘Z 를 누르면 첫 빈 슬라이드가 지워졌다.
// newProject 가 resetHistory() 를 addCard 보다 **먼저** 불러, 첫 장이 되돌릴 수 있는 일이 됐다.
STAGES.push(['2단계 · 스케치 직후 ⌘Z', async () => {
  await freshBook()
  const n0 = await thumbs.count()
  await p.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur() })   // 입력칸 밖에 초점
  await p.keyboard.press('ControlOrMeta+z'); await p.waitForTimeout(300)
  const n1 = await thumbs.count()
  ok('[스케치] 첫 슬라이드 한 장으로 시작한다', n0 === 1, String(n0))
  ok('[스케치] 바로 ⌘Z 를 눌러도 첫 슬라이드가 남는다', n1 === 1, `${n0} → ${n1}`)
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
  // 4단계(90e7439)부터 표 단추는 **누르는 즉시** 한가운데에 놓는다 — 캔버스를 한 번 더 누르지 않는다.
  await p.locator('.ib[title="표"]').first().click()
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

  await p.locator('.ib[title="표"]').first().click()   // 4단계부터 누르는 즉시 놓인다
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
  // **종이 좌표로 잰다**(2026-10-06). 화면 px 로 1.5 를 허용했더니 배율이 커지면(작업면을 꽉 채우며 종이가 커졌다) 같은 어긋남이
  // 그만큼 불어나 넘었다 — 창 높이 853 · 880 에서는 통과, 900 · 940 에서는 실패. 표 높이를 정수로 맞추며 생기는 어긋남(종이 좌표 약 1.4)이다.
  const zT = lb.width / (await layer().evaluate((n) => parseFloat(n.style.width)))
  ok('[표3] 남은 행의 높이는 그대로다', Math.abs(rh1 - rh0) / zT < 2, `${rh0.toFixed(1)} → ${rh1.toFixed(1)} (배율 ${zT.toFixed(3)})`)

  // ④ 병합 칸에 닿으면 범위가 커진다 · 머리 띠
  await drag(await center(cell(0, 0)), await center(cell(1, 0)))
  // 5단계(3c07f77)부터 병합은 **위 도구줄 한 곳**에 있다 — 패널의 맨 단추 둘은 지웠다.
  await p.locator('.ax-tbrow.ctx .tbtn', { hasText: '⤢ 병합' }).first().click(); await p.waitForTimeout(250)
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

// ── 4단계 ─────────────────────────────────────────────────
// 도구줄 색(8927a75) · 채우기(b1911d3·8513fe1·73b6825) · 테두리 선 모양(f586a7b·518611b) ·
// 요소 위에 놓기(46f155c) · 고르면 바로 놓기(e4dfbfd·90e7439) · 그리기 접기(5a4afce) · 새 슬라이드 자리(90e7439)
STAGES.push(['4단계 · PPT 식 도구줄 · 표 채우기 · 새 슬라이드 자리', async () => {
  await freshBook()
  const fels = () => layer().locator('.fel')
  const ctxRow = p.locator('.ax-tbrow.ctx')
  const grp = (name) => ctxRow.locator(`.ax-grp[title="${name}"]`)
  async function pickShape(label) {
    await p.locator('.ib.shp-btn').first().click(); await p.waitForTimeout(150)
    await p.locator(`.shp-pop .shp-cell[title="${label}"]`).click(); await p.waitForTimeout(250)
  }
  const lb = await layer().boundingBox()
  const blank = { x: lb.x + lb.width - 12, y: lb.y + lb.height - 12 }

  // ⑤ 그리기 도구는 접혀 있고, 눌러야 펴진다
  ok('[그리기] 처음엔 펜 칸이 접혀 있다', (await p.locator('.ib[title^="펜(두께"]').count()) === 0)
  await p.locator('.tbtn.draw-toggle').click(); await p.waitForTimeout(150)
  ok('[그리기] 「그리기 ▾」 를 누르면 펜·형광펜·지우개가 펴진다',
    (await p.locator('.ib[title^="펜(두께"]').count()) === 1 && (await p.locator('.ib[title^="지우개"]').count()) === 1)
  await p.locator('.tbtn.draw-toggle').click(); await p.waitForTimeout(150)

  // ① 도형은 고르는 즉시 놓인다 — 캔버스를 한 번 더 누르지 않는다
  const n0 = await fels().count()
  await pickShape('사각형')
  const n1 = await fels().count()
  ok('[바로 놓기] 도형을 고르면 캔버스를 안 눌러도 놓인다', n1 === n0 + 1, `${n0} → ${n1}`)
  const cur = await layer().evaluate((n) => n.style.cursor)
  ok('[바로 놓기] 놓고 나면 도구가 고르기로 돌아온다(십자 커서 아님)', cur !== 'crosshair', JSON.stringify(cur))
  await pickShape('사각형')
  const pos = await layer().locator('.fel.box').evaluateAll((ns) => ns.map((n) => [parseFloat(n.style.left), parseFloat(n.style.top)]))
  ok('[바로 놓기] 연달아 놓으면 16px 비껴 놓인다', pos.length === 2 && pos[1][0] - pos[0][0] === 16 && pos[1][1] - pos[0][1] === 16,
    JSON.stringify(pos))

  // ② 도형을 고르면 둘째 줄에 이름 붙은 「글자 색 · 채우기 · 테두리」
  const labs = await ctxRow.locator('.ax-grp > .lab').evaluateAll((ns) => ns.map((n) => n.textContent))
  ok('[도구줄] 도형을 고르면 글자 색 · 채우기 · 테두리가 이름 붙어 뜬다',
    ['글자 색', '채우기', '테두리'].every((t) => labs.includes(t)), labs.join(' · '))
  if (SHOT_DIR) await p.locator('.ax-tb').screenshot({ path: SHOT_DIR + '/stage4_toolbar_shape.png' })
  // ▾ 로 고른 색이 칠해지고, 띠가 그 색을 기억한다
  await grp('채우기').locator('.cp-caret').click(); await p.waitForTimeout(150)
  await p.locator('.cp-pop .cp-sw[title="#e0553c"]').first().click(); await p.waitForTimeout(200)
  const sel = () => layer().locator('.fel.sel').first()
  const bg = await sel().evaluate((n) => getComputedStyle(n).backgroundColor)
  ok('[채우기] ▾ 로 고른 색이 도형에 칠해진다', bg === 'rgb(224, 85, 60)', bg)
  const bar = await grp('채우기').locator('.ax-inkbar').evaluate((n) => getComputedStyle(n).backgroundColor)
  ok('[채우기] 단추 밑 띠가 그 색을 기억한다', bar === 'rgb(224, 85, 60)', bar)
  // 테두리 선 모양
  await grp('테두리').locator('button[title="파선"]').click(); await p.waitForTimeout(200)
  const bs = await sel().evaluate((n) => getComputedStyle(n).borderTopStyle)
  ok('[테두리] 「파선」 을 누르면 도형 테두리가 파선이 된다', bs === 'dashed', bs)

  // ③ 오려 만든 도형(마름모)에도 테두리가 선다
  await pickShape('마름모')
  const dia = layer().locator('.fel.diamond').last()
  const dInfo = await dia.evaluate((n) => ({ bw: getComputedStyle(n).borderTopWidth, clip: getComputedStyle(n).clipPath,
    poly: n.querySelector('svg.fel-outline polygon')?.getAttribute('points') || '' }))
  ok('[마름모] 모양대로 오리고 상자 테두리는 끈다', /polygon/.test(dInfo.clip) && dInfo.bw === '0px', JSON.stringify(dInfo))
  ok('[마름모] 그 위에 테두리 선(SVG)을 얹는다', dInfo.poly.split(' ').length === 4, dInfo.poly)
  await grp('테두리').locator('button[title="점선"]').click(); await p.waitForTimeout(200)
  const da = await dia.locator('svg.fel-outline polygon').getAttribute('stroke-dasharray')
  ok('[마름모] 점선을 고르면 선도 점선이 된다', !!da && /^0\.01 /.test(da), String(da))

  // ④ 글상자 위에도 도형이 그려진다(단축키로 든 도형 → 찍어서 놓기)
  await placeText()                                     // T 도 바로 놓이고 커서가 들어간다
  const editing = await p.evaluate(() => !!document.activeElement && document.activeElement.isContentEditable)
  ok('[바로 놓기] T 를 누르면 글상자가 놓이고 바로 쓸 수 있다', editing)
  await p.mouse.click(blank.x, blank.y); await p.waitForTimeout(200)
  const tb = await layer().locator('.fel.text').last().boundingBox()
  await p.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur() })
  await p.keyboard.press('r'); await p.waitForTimeout(100)
  const m0 = await fels().count()
  const at = { x: tb.x + tb.width / 2, y: tb.y + tb.height / 2 }
  await p.mouse.click(at.x, at.y); await p.waitForTimeout(250)
  const m1 = await fels().count()
  const nb = await layer().locator('.fel.box').last().boundingBox()
  ok('[요소 위] 글상자 위를 눌러도 도형이 생긴다', m1 === m0 + 1 && nb.x <= at.x && at.x <= nb.x + nb.width && nb.y <= at.y && at.y <= nb.y + nb.height,
    `${m0} → ${m1}`)

  // ⑥ 표 채우기 — 위 도구줄에서 (새 슬라이드에서)
  await thumbs.nth(0).click(); await p.keyboard.press('Enter'); await p.waitForTimeout(300)
  await p.locator('.ib[title="표"]').first().click(); await p.waitForTimeout(300)
  const tblFel = () => layer().locator('.fel:has(.feltable)').first()
  const cell = (r, c) => tblFel().locator(`.feltd[data-r="${r}"][data-c="${c}"]`)
  ok('[표 채우기] 칸을 안 고르면 채우기가 잠겨 있다',
    await ctxRow.locator('.ax-grp:has(> .lab:text-is("채우기")) .cp-trig').isDisabled())
  await cell(1, 1).click(); await p.waitForTimeout(150)
  await ctxRow.locator('.ax-grp:has(> .lab:text-is("채우기")) .cp-trig').click(); await p.waitForTimeout(150)
  const headN = await p.locator('.cp-pop .cp-lab', { hasText: '채우기' }).count()
  ok('[표 채우기] 고르개 맨 위에 「채우기」 자유 색 줄이 있다', headN === 1)
  await p.locator('.cp-pop .cp-sw[title="#FDF0F0"]').first().click(); await p.waitForTimeout(200)
  // 열 경계도 끌어 둔다(다시 열었을 때 colw 가 남는지 본다)
  const gc = layer().locator('.trk-grip.trk-col').first()
  const gb = await gc.boundingBox()
  await p.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2); await p.mouse.down()
  for (let i = 1; i <= 6; i++) await p.mouse.move(gb.x + gb.width / 2 + 7 * i, gb.y + gb.height / 2)
  await p.mouse.up(); await p.waitForTimeout(200)
  await p.mouse.click(blank.x, blank.y); await p.waitForTimeout(200)   // 칸 고르기를 풀어야 제 색이 보인다
  const cbg = await cell(1, 1).evaluate((n) => getComputedStyle(n).backgroundColor)
  ok('[표 채우기] 도구줄에서 고른 색이 그 칸에 칠해진다', cbg === 'rgb(253, 240, 240)', cbg)
  const other = await cell(1, 0).evaluate((n) => getComputedStyle(n).backgroundColor)
  ok('[표 채우기] 고르지 않은 칸은 그대로다', other !== 'rgb(253, 240, 240)', other)
  const cw = async () => (await cell(0, 0).boundingBox()).width / (await cell(0, 1).boundingBox()).width
  const ratio = await cw()
  ok('[표] 열 경계를 끌면 두 열 너비가 달라진다', ratio > 1.2, ratio.toFixed(3))

  // ⑦ 새 슬라이드는 **고른 것 바로 뒤**
  await thumbs.nth(1).click(); await p.keyboard.press('Enter'); await p.waitForTimeout(300)
  const k0 = await thumbs.count()
  await thumbs.nth(0).click(); await p.waitForTimeout(150)
  await p.keyboard.press('Enter'); await p.waitForTimeout(300)
  const k1 = await thumbs.count(), idx = await onIndex()
  ok('[새 슬라이드] 3장 중 1번째를 고르고 만들면 2번째에 들어간다', k0 === 3 && k1 === 4 && idx === 1, `${k0}→${k1} · 고른 자리 ${idx}`)
  ok('[새 슬라이드] 새 쪽은 비어 있다', (await layer().locator('.fel').count()) === 0)
  await thumbs.nth(2).click(); await p.waitForTimeout(200)
  ok('[새 슬라이드] 표가 있던 쪽은 한 칸 뒤(3번째)로 밀렸다', (await layer().locator('.feltable').count()) === 1)

  // ⑧ 다시 열어도 채우기 · 선 모양 · 열 너비가 남는다
  for (let i = 0; i < 30; i++) {
    const st = await p.locator('.save-lab').innerText().catch(() => '')
    if (st === '저장됨') break
    await p.waitForTimeout(300)
  }
  await p.waitForTimeout(1200)
  await p.goto(URL, { waitUntil: 'networkidle' })
  await p.locator('.lib-open-hit').first().click()
  await p.waitForSelector('.ax-app .axth', { timeout: 15000 }); await p.waitForTimeout(500)
  await thumbs.nth(0).click(); await p.waitForTimeout(250)
  const dashed = await layer().locator('.fel.box').evaluateAll((ns) => ns.filter((n) => getComputedStyle(n).borderTopStyle === 'dashed').length)
  ok('[다시 열기] 도형의 파선 테두리가 그대로다', dashed === 1, String(dashed))
  const fillKept = await layer().locator('.fel.box').evaluateAll((ns) => ns.some((n) => getComputedStyle(n).backgroundColor === 'rgb(224, 85, 60)'))
  ok('[다시 열기] 도형 채우기 색이 그대로다', fillKept)
  const da2 = await layer().locator('.fel.diamond svg.fel-outline polygon').first().getAttribute('stroke-dasharray')
  ok('[다시 열기] 마름모 점선 테두리가 그대로다', !!da2 && /^0\.01 /.test(da2), String(da2))
  await thumbs.nth(2).click(); await p.waitForTimeout(250)
  const cbg2 = await cell(1, 1).evaluate((n) => getComputedStyle(n).backgroundColor)
  ok('[다시 열기] 표 칸 채우기(cbg)가 그대로다', cbg2 === 'rgb(253, 240, 240)', cbg2)
  const ratio2 = await cw()
  ok('[다시 열기] 열 너비(colw)가 그대로다', Math.abs(ratio2 - ratio) < 0.02, `${ratio.toFixed(3)} → ${ratio2.toFixed(3)}`)
}])

// 새 페이지 목록 정리(EVER-SKETCH1 e8f80f7 중 카드 감추기만 · 사용자 요청)
STAGES.push(['4단계 · 새 페이지 목록 · 감춘 카드', async () => {
  await freshBook()
  const HIDDEN = ['덱 섹션', '한 줄 요약', '성과·KPI', '로드맵', '시장·경쟁', '프로세스(플로우)']
  await p.locator('.cardpick .add').click(); await p.waitForTimeout(250)
  const pop = p.locator('.cpk-pop')
  const txt = await pop.innerText()
  const quick = await pop.locator('.cpk-q').allInnerTexts()
  ok('[새 페이지] 「＋ 빈 슬라이드」 는 그대로 있다', quick.some((t) => t.includes('빈 슬라이드')), quick.join(' · '))
  ok('[새 페이지] 「＋ 덱 섹션」 빠른 단추가 없다', !quick.some((t) => t.includes('덱 섹션')), quick.join(' · '))
  const tiles = await pop.locator('.cpk-tile .cpk-nm').allInnerTexts()
  const leaked = HIDDEN.filter((h) => tiles.includes(h) || txt.includes(h))
  ok('[새 페이지] 감춘 여섯 카드가 목록에 없다', leaked.length === 0, leaked.join(' · ') || tiles.join(' · '))
  ok('[새 페이지] 빈 묶음 「경영 보고 보강」 은 이름도 안 그린다', !txt.includes('경영 보고 보강'))
  await p.locator('.cpk-search').fill('KPI'); await p.waitForTimeout(150)
  ok('[새 페이지] 검색해도 감춘 카드가 안 나온다', (await pop.locator('.cpk-tile').count()) === 0)
  await p.locator('.cpk-search').fill(''); await p.waitForTimeout(150)
  if (SHOT_DIR) await pop.screenshot({ path: SHOT_DIR + '/stage4_card_picker.png' })
  await p.keyboard.press('Escape'); await p.locator('.cpk-scrim').click().catch(() => {}); await p.waitForTimeout(150)
  let menuTxt = ''
  for (const m of ['삽입', '슬라이드']) {
    await p.locator('.ax-menu .ax-mwrap > button.m', { hasText: m }).first().click(); await p.waitForTimeout(120)
    menuTxt += await p.locator('.ax-mdrop').innerText()
    await p.locator('.ax-menu .ax-mwrap > button.m', { hasText: m }).first().click(); await p.waitForTimeout(80)
  }
  ok('[새 페이지] 메뉴바(삽입·슬라이드)에 「덱 섹션 카드」 가 없고 「새 슬라이드」 는 있다',
    !/덱 섹션/.test(menuTxt) && /새 슬라이드/.test(menuTxt), menuTxt.replace(/\n/g, ' · ').slice(0, 160))

  // 감춘 카드로 **이미 만든 쪽**은 그대로 그려진다 — 저장된 자료를 서버에 바로 넣고 연다.
  const state = { title: '감춘 카드 옛 자료', orientation: 'portrait', theme: 'light', font: 'auto', size: 'm', selectedPageId: 1,
    pages: [
      { id: 1, cardKey: 'kpi', fields: { title: '기대 성과', k1: '불량률:-30%', k2: '검사시간:-40%' }, free: false, els: [], conns: [], strokes: [] },
      { id: 2, cardKey: 'dsection', fields: { markN: '07', title: '옛 덱 섹션 제목', cols: '3', c1: '품질|찾고 봅니다' }, free: false, els: [], conns: [], strokes: [] },
    ] }
  const made = await p.evaluate(async (st) => {
    const r = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '감춘 카드 옛 자료', state: st }) })
    return r.ok
  }, state)
  ok('[옛 자료] 감춘 카드가 든 자료를 만들었다(서버)', made)
  await p.goto(URL, { waitUntil: 'networkidle' })
  await p.locator('.lib-open-hit', { hasText: '감춘 카드 옛 자료' }).first().click()
  await p.waitForSelector('.ax-app .axth', { timeout: 15000 }); await p.waitForTimeout(500)
  ok('[옛 자료] 두 쪽이 그대로 열린다', (await thumbs.count()) === 2, String(await thumbs.count()))
  const s1 = await p.locator('.stage').first().innerText()
  ok('[옛 자료] KPI 쪽 본문(지표)이 그려진다', /불량률/.test(s1) && /-30%/.test(s1), s1.slice(0, 80).replace(/\n/g, ' '))
  await thumbs.nth(1).click(); await p.waitForTimeout(300)
  const s2 = await p.locator('.stage').first().innerText()
  ok('[옛 자료] 덱 섹션 쪽 본문이 그려진다', /옛 덱 섹션 제목/.test(s2) && /찾고 봅니다/.test(s2), s2.slice(0, 80).replace(/\n/g, ' '))
}])

// ── 5단계 ─────────────────────────────────────────────────
// 오른쪽 패널: 탭 → 접이식 묶음 + 접힌 줄 요약(22dd552) · 병합은 도구줄 한 곳 · 무엇을 고치는지(3c07f77) ·
// 일 단위 묶음(93ecb00) · 묶음 부품을 바깥에(2846b9a — 값을 바꿔도 스크롤·포커스 유지) ·
// ▾ 고르개는 도구줄 밖을 눌러도 닫힌다(도구줄 줄이 container-type 이라 확인해 둔다).
STAGES.push(['5단계 · 오른쪽 패널 접이식 묶음', async () => {
  await freshBook()
  const panel = p.locator('.ax-inspector')
  const body = panel.locator('.insp-body')
  const accTexts = async () => (await panel.locator('.insp-acc').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').replace(/^[▾▸] /, '').trim())
  const acc = (t) => panel.locator('.insp-acc').filter({ has: p.locator('.t', { hasText: new RegExp('^' + t + '$') }) }).first()
  const subOf = async (t) => ((await acc(t).locator('.sub').innerText().catch(() => '')) || '').trim()
  async function openAcc(t) { if ((await acc(t).getAttribute('aria-expanded')) !== 'true') { await acc(t).click(); await p.waitForTimeout(150) } }
  async function closeAcc(t) { if ((await acc(t).getAttribute('aria-expanded')) === 'true') { await acc(t).click(); await p.waitForTimeout(150) } }
  const ctxRow = p.locator('.ax-tbrow.ctx')
  const lb = await layer().boundingBox()
  const blank = { x: lb.x + lb.width - 12, y: lb.y + lb.height - 12 }

  // ── 도형을 고르면 ──
  await p.locator('.ib.shp-btn').first().click(); await p.waitForTimeout(150)
  await p.locator('.shp-pop .shp-cell[title="사각형"]').click(); await p.waitForTimeout(300)
  ok('[패널] 탭 막대가 없다', (await p.locator('.insp-tabs').count()) === 0)
  const sa = await accTexts()
  ok('[패널] 도형은 네 묶음(모양 · 색 · 글자 · 크기 · 자리 · 효과 · 순서)',
    sa.length === 4 && ['모양 · 색', '글자', '크기 · 자리', '효과 · 순서'].every((t, i) => sa[i].startsWith(t)), JSON.stringify(sa))
  ok('[패널] 무엇을 골랐는지 맨 위에 적는다', (await panel.locator('.insp-who').innerText()).includes('도형'))
  ok('[요약] 글자 — 크기를 말한다', /\d+pt/.test(await subOf('글자')), await subOf('글자'))
  ok('[요약] 크기 · 자리 — 너비×높이를 말한다', /\d+×\d+/.test(await subOf('크기 · 자리')), await subOf('크기 · 자리'))
  ok('[요약] 모양 · 색 · 효과 · 순서 — 뭐라도 말한다', (await subOf('모양 · 색')).length > 0 && (await subOf('효과 · 순서')).length > 0)
  ok('[패널] 처음엔 모양 · 색 · 글자가 펴져 있고 크기 · 자리는 접혀 있다',
    (await acc('모양 · 색').getAttribute('aria-expanded')) === 'true' && (await acc('글자').getAttribute('aria-expanded')) === 'true'
    && (await acc('크기 · 자리').getAttribute('aria-expanded')) === 'false')
  // 4단계 도형 칸이 그대로 닿는가
  const bodyShape = await body.innerText()
  ok('[4단계 그대로] 도형 채우기 · 테두리 · 선 모양 · 불투명도', /채우기/.test(bodyShape) && /불투명도/.test(bodyShape)
    && (await body.locator('select[title="선 모양"]').count()) === 1)
  ok('[4단계 그대로] 글자 정렬은 그림 단추', (await body.locator('.insp-row.seg button svg').count()) >= 3)

  // 값을 바꿔도 패널을 새로 만들지 않는다(2846b9a) — 스크롤 · 포커스 유지
  await openAcc('크기 · 자리'); await openAcc('효과 · 순서')
  await p.setViewportSize({ width: 1440, height: 640 }); await p.waitForTimeout(300)
  const hIn = body.locator('input[aria-label="높이"]')
  await hIn.scrollIntoViewIfNeeded()
  await body.evaluate((n) => { n.scrollTop = Math.min(n.scrollHeight - n.clientHeight, n.scrollTop + 40) })
  await p.waitForTimeout(100)
  await body.evaluate((n) => { n.querySelector('input[aria-label="높이"]').dataset.mark = 'm5'; n.querySelector('.insp-acc').dataset.mark = 'a5' })
  const st0 = await body.evaluate((n) => n.scrollTop)
  const h0 = Number(await hIn.inputValue())
  await hIn.focus()
  await p.keyboard.press('ArrowUp'); await p.waitForTimeout(120)
  await p.keyboard.press('ArrowUp'); await p.waitForTimeout(200)
  const after = await body.evaluate((n) => ({ st: n.scrollTop, focus: (document.activeElement && document.activeElement.dataset.mark) || '',
    acc: !!n.querySelector('.insp-acc[data-mark="a5"]') }))
  const h1 = Number(await hIn.inputValue())
  ok('[고침 유지] (사전) 패널이 스크롤돼 있다', st0 > 0, String(st0))
  ok('[고침 유지] 높이 ▲ 두 번이 두 번 다 먹는다', h1 === h0 + 2, `${h0} → ${h1}`)
  ok('[고침 유지] 값을 바꿔도 스크롤이 제자리다', Math.abs(after.st - st0) < 2, `${st0} → ${after.st}`)
  ok('[고침 유지] 치던 칸에서 손이 안 떨어진다(같은 입력 칸에 포커스)', after.focus === 'm5', JSON.stringify(after.focus))
  ok('[고침 유지] 묶음 머리가 새로 만들어지지 않았다', after.acc)
  // 채우기 색 칩을 눌러도 그대로
  await body.locator('.insp-chip').nth(3).click(); await p.waitForTimeout(200)
  const after2 = await body.evaluate((n) => ({ st: n.scrollTop, acc: !!n.querySelector('.insp-acc[data-mark="a5"]'), inp: !!n.querySelector('input[data-mark="m5"]') }))
  ok('[고침 유지] 채우기를 바꿔도 묶음 · 입력 칸이 그대로다', after2.acc && after2.inp, JSON.stringify(after2))
  await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(250)
  // 글자 크기(NumInput) 도 같은 길
  const fsIn = body.locator('input[aria-label="글자 크기"]')
  await fsIn.evaluate((n) => { n.dataset.mark = 'f5' })
  const fs0 = Number(await fsIn.inputValue())
  await fsIn.focus(); await p.keyboard.press('ArrowUp'); await p.waitForTimeout(150); await p.keyboard.press('ArrowUp'); await p.waitForTimeout(200)
  const fsFocus = await p.evaluate(() => (document.activeElement && document.activeElement.dataset.mark) || '')
  const fs1 = Number(await fsIn.inputValue())
  ok('[고침 유지] 글자 크기 ▲ 두 번 — 포커스가 남고 두 번 다 먹는다', fsFocus === 'f5' && fs1 === fs0 + 2, `${fs0} → ${fs1} · ${fsFocus}`)
  await p.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur() })
  if (SHOT_DIR) await panel.screenshot({ path: SHOT_DIR + '/stage5_panel_shape.png' })

  // ▾ 고르개 — 도구줄 **밖**을 눌러도 닫힌다
  await ctxRow.locator('.ax-grp[title="채우기"] .cp-caret').click(); await p.waitForTimeout(150)
  ok('[▾] 고르개가 열렸다', (await p.locator('.ax-tbrow.ctx .cp-pop').count()) === 1)
  // **진짜 마우스로** 누른다 — locator.click 은 가림막이 가로막으면 누르지 않고 기다린다.
  const whoBox = await panel.locator('.insp-who').boundingBox()
  await p.mouse.click(whoBox.x + whoBox.width / 2, whoBox.y + whoBox.height / 2); await p.waitForTimeout(150)
  ok('[▾] 도구줄 밖(오른쪽 패널)을 누르면 닫힌다', (await p.locator('.ax-tbrow.ctx .cp-pop').count()) === 0)
  await ctxRow.locator('.ax-grp[title="테두리"] .cp-caret').click(); await p.waitForTimeout(150)
  const tbb = await p.locator('.ax-tb').boundingBox()
  await p.mouse.click(tbb.x + 4, tbb.y + tbb.height + 30); await p.waitForTimeout(150)
  ok('[▾] 도구줄 밖(작업창)을 누르면 닫힌다', (await p.locator('.ax-tbrow.ctx .cp-pop').count()) === 0)
  await ctxRow.locator('.ax-grp[title="채우기"] .cp-caret').click(); await p.waitForTimeout(150)
  await p.locator('.ax-tbrow.ctx .cp-pop .cp-lab').first().click(); await p.waitForTimeout(120)
  ok('[▾] 고르개 안을 누르면 안 닫힌다', (await p.locator('.ax-tbrow.ctx .cp-pop').count()) === 1)
  await p.mouse.click(whoBox.x + whoBox.width / 2, whoBox.y + whoBox.height / 2); await p.waitForTimeout(150)
  // 확인해 보니 가림막(.cp-back, fixed)은 도구줄의 container-type 에 갇히지 않고 **창 전체**를 덮는다 —
  // 밖을 누르면 그 가림막이 받아 닫는다. 고칠 것이 없어 코드는 그대로 두고, 이 검사로 지킨다.
  const backBox = await p.evaluate(() => { const n = document.querySelector('.cp-back'); return n ? n.getBoundingClientRect().toJSON() : null })
  ok('[▾] (닫힌 뒤) 가림막도 남지 않는다', backBox === null, JSON.stringify(backBox))

  // ── 표를 고르면 ──
  await p.mouse.click(blank.x, blank.y); await p.waitForTimeout(150)
  await p.locator('.ib[title="표"]').first().click(); await p.waitForTimeout(300)
  const tblFel = () => layer().locator('.fel:has(.feltable)').first()
  const cell = (r, c) => tblFel().locator(`.feltd[data-r="${r}"][data-c="${c}"]`)
  const ta = await accTexts()
  const TT = ['칸', '행', '채우기', '표 전체 글자', '크기 · 자리', '테두리 · 머리글']
  ok('[패널] 표는 여섯 묶음', ta.length === 6 && TT.every((t, i) => ta[i].startsWith(t)), JSON.stringify(ta))
  ok('[패널] 표를 골랐다고 적는다', (await panel.locator('.insp-who .insp-who-t').innerText()) === '표')
  ok('[요약] 행 — 몇 행 몇 열인지 말한다', /^\d+행 \d+열$/.test(await subOf('행')), await subOf('행'))
  ok('[요약] 칸 — 칸을 안 골랐다고 말한다', /칸 안 고름/.test(await subOf('칸')), await subOf('칸'))
  ok('[병합] 패널에는 병합 단추가 없다', (await body.locator('button', { hasText: '병합' }).count()) === 0)
  ok('[병합] 위 도구줄에 있다', (await ctxRow.locator('.tbtn', { hasText: '병합' }).count()) >= 1)
  await openAcc('채우기')
  ok('[병합] 패널은 그 자리를 알려만 준다', /위 툴바의 표 ⤢ 병합/.test(await body.innerText()))
  ok('[4단계 그대로] 칸을 안 고르면 채우기가 잠겨 있다', await body.locator('.es-cbg').first().isDisabled())
  await cell(1, 1).click(); await p.waitForTimeout(200)
  ok('[요약] 칸을 고르면 그 자리를 말한다', /^2행 2열/.test(await subOf('칸')), await subOf('칸'))
  await body.locator('.es-cbg').nth(2).click(); await p.waitForTimeout(200)
  const col = await body.locator('.es-cbg').nth(2).getAttribute('title')
  ok('[4단계 그대로] 패널 채우기로 칸을 칠한다', (await subOf('채우기')) === '칠함' && !!col, `${await subOf('채우기')} · ${col}`)
  await openAcc('테두리 · 머리글')
  const bsel = body.locator('select').filter({ has: p.locator('option', { hasText: '없음' }) })
  ok('[4단계 그대로] 표 테두리 「없음」 · 선 모양', (await bsel.count()) >= 1 && (await body.locator('select[title="선 모양"]').count()) === 1)
  ok('[4단계 그대로] 칸 정렬 그림 · 셀 글자 크기 NumInput',
    (await body.locator('input[aria-label="셀 글자 크기"]').count()) === 1 && (await body.locator('.insp-row.seg button svg').count()) >= 6)
  // 여러 묶음을 함께 펴 둔다
  await openAcc('표 전체 글자')
  const bt = await body.innerText()
  ok('[패널] 표 전체 글자를 펴도 칸 묶음이 안 접힌다', /활성 셀/.test(bt) && /서식 지우기/.test(bt))
  // 행 추가도 행 묶음에서
  const r0 = await tblFel().locator('.feltd[data-c="0"]').count()
  await body.locator('.insp-pill', { hasText: '↓ 아래 추가' }).click(); await p.waitForTimeout(250)
  ok('[패널] 행 묶음의 「↓ 아래 추가」', (await tblFel().locator('.feltd[data-c="0"]').count()) === r0 + 1)
  if (SHOT_DIR) await panel.screenshot({ path: SHOT_DIR + '/stage5_panel_table.png' })
  // 접은 것은 기억한다 — 다른 것을 골랐다 돌아와도 접힌 채
  await closeAcc('행')
  await p.mouse.click(blank.x, blank.y); await p.waitForTimeout(150)
  await p.locator('.ib.shp-btn').first().click(); await p.waitForTimeout(150)
  await p.locator('.shp-pop .shp-cell[title="사각형"]').click(); await p.waitForTimeout(250)
  ok('[기억] (사전) 도형으로 옮겨 갔다', (await panel.locator('.insp-who-t').innerText()) === '도형')
  // 도형이 표 가운데에 겹쳐 놓이므로 지우고 표로 돌아간다
  await p.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur() })
  await p.keyboard.press('Delete'); await p.waitForTimeout(200)
  await cell(0, 0).click(); await p.waitForTimeout(250)
  ok('[기억] 접어 둔 「행」 은 다시 골라도 접혀 있다', (await acc('행').getAttribute('aria-expanded')) === 'false')
  ok('[기억] 펴 둔 「테두리 · 머리글」 은 펴져 있다', (await acc('테두리 · 머리글').getAttribute('aria-expanded')) === 'true')
  await openAcc('행')
}])

// ── 6단계 ─────────────────────────────────────────────────
// 마인드맵을 요소로(68a5627 · 8c7c812) · 머메이드 TB·LR → 트리 요소(2b6abf0 · d716ae0 · c7effe6 · e8f80f7) ·
// 공용 창 껍데기(e0afde4 · 82d87f4 · 65f4df2).
const panel6 = () => p.locator('.ax-inspector')
/** 아무것도 안 고른 상태로 — 오른쪽 패널이 쪽 칸을 보여 준다. */
async function deselect() {
  await p.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur() })
  await p.keyboard.press('Escape'); await p.waitForTimeout(150)
  await p.keyboard.press('Escape'); await p.waitForTimeout(150)
}
async function waitSaved() {
  for (let i = 0; i < 30; i++) {
    const st = await p.locator('.save-lab').innerText().catch(() => '')
    if (st === '저장됨') break
    await p.waitForTimeout(300)
  }
  await p.waitForTimeout(1200)
}
async function openPicker() {
  await p.locator('.cardpick .add').click(); await p.waitForTimeout(250)
  return p.locator('.cpk-pop')
}
if (SHOT_DIR) { const fs = await import('node:fs'); fs.mkdirSync(SHOT_DIR + '/s6', { recursive: true }) }

STAGES.push(['6단계 · 마인드맵 요소 · 머메이드 · 다시 열기', async () => {
  await freshBook()
  const n0 = await thumbs.count()
  // ── 마인드맵: 가지 수를 고르고 요소로 펼친다 ──
  let pop = await openPicker()
  await pop.locator('.cpk-tile', { hasText: '마인드맵' }).first().click(); await p.waitForTimeout(200)
  const brs = await pop.locator('.cpk-br').allInnerTexts()
  ok('[마인드맵] 넣기 전에 가지 수 3~8 을 묻는다', brs.join(',') === '3,4,5,6,7,8', brs.join(','))
  ok('[마인드맵] 기본은 3', (await pop.locator('.cpk-br.def').innerText()).trim() === '3')
  await pop.locator('.cpk-br', { hasText: '5' }).click(); await p.waitForTimeout(500)
  ok('[마인드맵] 새 쪽이 생긴다', (await thumbs.count()) === n0 + 1, `${n0} → ${await thumbs.count()}`)
  const rounds = layer().locator('.fel.round')
  ok('[마인드맵] 중심 1 + 가지 5 가 **각각의 요소**로 들어온다', (await rounds.count()) === 6, String(await rounds.count()))
  const lines = await layer().locator('svg path[stroke="#c3cbdb"]').count()
  ok('[마인드맵] 중심과 가지를 잇는 선이 다섯', lines === 5, String(lines))

  // 중심을 끌면 움직인다
  const center = rounds.nth(0)
  /** 종이 안 좌표(패널이 바뀌면 화면 좌표는 밀린다). */
  const at = (loc) => loc.evaluate((n) => [parseFloat(n.style.left), parseFloat(n.style.top)])
  const c0 = await center.boundingBox()
  await p.mouse.move(c0.x + c0.width / 2, c0.y + c0.height / 2); await p.mouse.down()
  await p.mouse.move(c0.x + c0.width / 2 + 30, c0.y + c0.height / 2 + 20, { steps: 8 })
  await p.mouse.move(c0.x + c0.width / 2 + 60, c0.y + c0.height / 2 + 40, { steps: 8 })
  await p.mouse.up(); await p.waitForTimeout(300)
  const c1 = await center.boundingBox()
  const cAt = await at(center)
  ok('[마인드맵] 중심을 끌면 움직인다', Math.abs(c1.x - c0.x) > 30 && Math.abs(c1.y - c0.y) > 20,
    `(${Math.round(c0.x)},${Math.round(c0.y)}) → (${Math.round(c1.x)},${Math.round(c1.y)})`)

  // 가지를 고르고 오른쪽 아래 손잡이로 늘린다
  const br = rounds.nth(2)
  const b0 = await br.boundingBox()
  await br.click(); await p.waitForTimeout(250)
  ok('[마인드맵] 가지를 고르면 크기 손잡이 여덟이 나온다', (await layer().locator('.rs-h').count()) === 8, String(await layer().locator('.rs-h').count()))
  if (SHOT_DIR) await p.locator('.stage').first().screenshot({ path: SHOT_DIR + '/s6/stage6_mindmap_selected.png' })
  const hse = await layer().locator('.rs-h.rs-se').boundingBox()
  await p.mouse.move(hse.x + 5, hse.y + 5); await p.mouse.down()
  await p.mouse.move(hse.x + 30, hse.y + 15, { steps: 6 }); await p.mouse.move(hse.x + 55, hse.y + 25, { steps: 6 })
  await p.mouse.up(); await p.waitForTimeout(300)
  const b1 = await br.boundingBox()
  ok('[마인드맵] 가지 크기를 바꿀 수 있다', b1.width > b0.width + 30 && b1.height > b0.height + 10,
    `${Math.round(b0.width)}×${Math.round(b0.height)} → ${Math.round(b1.width)}×${Math.round(b1.height)}`)

  // 아무것도 안 고르면 쪽 칸에 「＋ 가지」
  await deselect()
  const addBr = panel6().locator('.insp-pill', { hasText: '＋ 가지' })
  ok('[마인드맵] 아무것도 안 고르면 「＋ 가지」 가 쪽 칸에 있다', (await addBr.count()) === 1)
  ok('[마인드맵] 지금 가지 수를 말한다', /지금 5개/.test(await panel6().innerText()))
  await addBr.click(); await p.waitForTimeout(300)
  ok('[마인드맵] 「＋ 가지」 가 하나 붙인다', (await rounds.count()) === 7, String(await rounds.count()))
  ok('[마인드맵] 단추가 그 자리에 남아 이어 붙일 수 있다', (await addBr.count()) === 1 && /지금 6개/.test(await panel6().innerText()))
  const cAt2 = await at(center)
  ok('[마인드맵] 붙여도 옮겨 둔 중심은 그대로다', cAt2[0] === cAt[0] && cAt2[1] === cAt[1], `${cAt} → ${cAt2}`)

  // ── 머메이드: 두 문 · 글로 뼈대 · 요소로 펼치기 ──
  // 세로 종이는 위→아래가 2칸뿐이라 고르는 창이 **가로를 권한다.** 권하는 대로 가로로 바꾸고 넣는다.
  pop = await openPicker()
  await pop.locator('.cpk-tile', { hasText: '머메이드 LR' }).click(); await p.waitForTimeout(200)
  ok('[머메이드] 세로 종이에서는 넣기 전에 말린다', (await p.locator('.cpk-mmwarn').count()) === 1)
  await p.keyboard.press('Escape'); await p.waitForTimeout(150)
  await deselect()
  await panel6().locator('.insp-row.seg button', { hasText: '가로' }).click(); await p.waitForTimeout(300)
  pop = await openPicker()
  const tiles = await pop.locator('.cpk-tile .cpk-nm').allInnerTexts()
  ok('[머메이드] 목록에 「머메이드 TB」·「머메이드 LR」 두 문이 있다', tiles.includes('머메이드 TB') && tiles.includes('머메이드 LR'), tiles.join(' · '))
  if (SHOT_DIR) await pop.screenshot({ path: SHOT_DIR + '/s6/stage6_card_picker.png' })
  await pop.locator('.cpk-tile', { hasText: '머메이드 TB' }).click(); await p.waitForTimeout(200)
  ok('[머메이드] TB 문은 「graph TB」 표본으로 연다', /^graph TB/.test(await p.locator('.cpk-mm').inputValue()))
  await p.locator('.cpk-back').click(); await p.waitForTimeout(150)
  await pop.locator('.cpk-tile', { hasText: '머메이드 LR' }).click(); await p.waitForTimeout(200)
  ok('[머메이드] LR 문은 「graph LR」 표본으로 연다', /^graph LR/.test(await p.locator('.cpk-mm').inputValue()))
  const go = p.locator('.cpk-mmgo')
  const goBg = await go.evaluate((n) => getComputedStyle(n).backgroundColor)
  ok('[머메이드] 「펼치기」 단추가 보인다(색 이름이 뜬창까지 닿는다)', goBg === 'rgb(42, 120, 214)', goBg)
  await p.locator('.cpk-mm').fill('graph LR\n  A[기획] --> B[설계]\n  이건 오타\n  A --> C[문서]\n  B --> D[개발]')
  await p.waitForTimeout(150)
  ok('[머메이드] 못 읽은 줄을 줄 번호와 함께 보여 준다', /3행/.test(await p.locator('.cpk-mmerr').innerText().catch(() => '')))
  ok('[머메이드] 상자 수를 미리 말한다', /펼치기 \(4개\)/.test(await go.innerText()), await go.innerText())
  await go.click(); await p.waitForTimeout(500)
  const boxes = () => layer().locator('.fel.box')
  ok('[머메이드] 글에 쓴 상자 넷이 요소로 펼쳐진다', (await boxes().count()) === 4, String(await boxes().count()))
  const names = (await boxes().allInnerTexts()).map((t) => t.trim()).sort().join(',')
  ok('[머메이드] 상자 글자가 글과 같다', names === ['개발', '기획', '문서', '설계'].sort().join(','), names)
  ok('[머메이드] 선(화살표)이 셋', (await layer().locator('svg path[stroke="#b9c2d4"]').count()) === 3)

  // ＋ 자식 · ＋ 형제
  await boxes().filter({ hasText: '설계' }).first().click(); await p.waitForTimeout(250)
  const kid = panel6().locator('.insp-pill', { hasText: '＋ 자식' })
  ok('[머메이드] 상자를 고르면 「＋ 자식」 이 있다', (await kid.count()) === 1)
  await kid.click(); await p.waitForTimeout(300)
  ok('[머메이드] ＋ 자식 → 상자 다섯', (await boxes().count()) === 5, String(await boxes().count()))
  await boxes().filter({ hasText: '설계' }).first().click(); await p.waitForTimeout(250)
  await panel6().locator('.insp-pill', { hasText: '＋ 형제' }).click(); await p.waitForTimeout(300)
  ok('[머메이드] ＋ 형제 → 상자 여섯', (await boxes().count()) === 6, String(await boxes().count()))
  await boxes().filter({ hasText: '기획' }).first().click(); await p.waitForTimeout(250)
  ok('[머메이드] 뿌리를 고르면 「＋ 형제」 가 「＋ 새 뿌리」 로 바뀐다',
    (await panel6().locator('.insp-pill', { hasText: '＋ 새 뿌리' }).count()) === 1 && (await panel6().locator('.insp-pill', { hasText: '＋ 형제' }).count()) === 0)

  // 접기 — 편집 화면에서만
  const folds = layer().locator('.tree-fold')
  ok('[머메이드] 자식이 있는 상자에 접기 손잡이가 있다', (await folds.count()) >= 2, String(await folds.count()))
  const shownBefore = await boxes().count()
  /** 뿌리(기획)의 접기 손잡이를 누른다 — 상자 왼쪽 아래 모서리 바로 밑. 접고 펼 때마다 트리가
   *  다시 앉아 자리가 바뀌므로 **매번 다시 찾는다.** */
  async function toggleRoot() {
    const rb = await boxes().filter({ hasText: '기획' }).first().boundingBox()
    const fb = await folds.evaluateAll((ns) => ns.map((n) => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y } }))
    const d = (q) => Math.hypot(q.x - rb.x, q.y - (rb.y + rb.height))
    const near = fb.reduce((a2, q) => (d(q) < d(a2) ? q : a2), fb[0])
    await p.mouse.click(near.x + 6, near.y + 6); await p.waitForTimeout(300)
  }
  await toggleRoot()
  const shownFolded = await boxes().count()
  ok('[머메이드] 뿌리를 접으면 아래 상자가 편집 화면에서 숨는다', shownFolded === 1, `${shownBefore} → ${shownFolded}`)
  ok('[머메이드] 접힌 상자 옆에 숨은 수(+N)가 보인다', /\+5/.test(await layer().locator('.tree-plusn').innerText().catch(() => '')))
  if (SHOT_DIR) {
    await toggleRoot()                                                         // 펴서 찍는다
    await boxes().filter({ hasText: '설계' }).first().click(); await p.waitForTimeout(250)
    await p.locator('.stage').first().screenshot({ path: SHOT_DIR + '/s6/stage6_mermaid_tree.png' })
    await deselect()
    await toggleRoot()                                                         // 다시 접는다
  }
  // 장 목록의 작은 그림은 편집 화면이 아니다(interactive=false) — 거기엔 다 펴져 그려진다.
  const thumbBoxes = await p.locator('.axth-list .axth.on .fel.box').count()
  ok('[머메이드] 접어도 편집 밖(장 목록 그림)에는 다 그려진다 — 접기는 편집 화면에서만', thumbBoxes === 6, String(thumbBoxes))
  await toggleRoot()
  ok('[머메이드] 다시 펴면 모두 돌아온다', (await boxes().count()) === 6, String(await boxes().count()))
  await deselect()
  ok('[머메이드] 아무것도 안 고르면 쪽 칸에 「＋ 새 뿌리」 · 뿌리 수', /지금 뿌리 1개/.test(await panel6().innerText()))

  // ── 다시 열어도 남는다 ──
  await waitSaved()
  await p.goto(URL, { waitUntil: 'networkidle' })
  await p.locator('.lib-open-hit').first().click()
  await p.waitForSelector('.ax-app .axth', { timeout: 15000 }); await p.waitForTimeout(600)
  ok('[다시 열기] 쪽 수 그대로', (await thumbs.count()) === n0 + 2, String(await thumbs.count()))
  await thumbs.nth(n0).click(); await p.waitForTimeout(300)
  ok('[다시 열기] 마인드맵 요소 일곱이 그대로다', (await layer().locator('.fel.round').count()) === 7, String(await layer().locator('.fel.round').count()))
  await deselect()
  ok('[다시 열기] 마인드맵 표시(mindmapCenter)가 남아 「＋ 가지」·「지금 6개」', /지금 6개/.test(await panel6().innerText()))
  await thumbs.nth(n0 + 1).click(); await p.waitForTimeout(300)
  ok('[다시 열기] 트리 상자 여섯이 그대로다', (await layer().locator('.fel.box').count()) === 6, String(await layer().locator('.fel.box').count()))
  await deselect()
  ok('[다시 열기] 트리 표시(treeRoot)가 남아 「지금 뿌리 1개」', /지금 뿌리 1개/.test(await panel6().innerText()))
}])

// 이미 **카드로 만들어 둔** 마인드맵은 열 때 저절로 바꾸지 않는다 — 「⤢ 요소로 펼치기」 를 누를 때만(68a5627).
STAGES.push(['6단계 · 옛 마인드맵 카드 펼치기', async () => {
  await freshBook()
  const state = { title: '옛 마인드맵', orientation: 'portrait', theme: 'light', font: 'auto', size: 'm', selectedPageId: 1,
    pages: [{ id: 1, cardKey: 'mindmap', fields: { title: '', center: '옛 중심', b1: '품질', b2: '생산', b3: '물류', b4: '경영' }, free: false, els: [], conns: [], strokes: [] }] }
  const made = await p.evaluate(async (st) => {
    const r = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '옛 마인드맵', state: st }) })
    return r.ok
  }, state)
  ok('[옛 마인드맵] 카드로 된 자료를 만들었다(서버)', made)
  await p.goto(URL, { waitUntil: 'networkidle' })
  await p.locator('.lib-open-hit', { hasText: '옛 마인드맵' }).first().click()
  await p.waitForSelector('.ax-app .axth', { timeout: 15000 }); await p.waitForTimeout(500)
  ok('[옛 마인드맵] 열어도 저절로 바뀌지 않는다(요소 0)', (await layer().locator('.fel').count()) === 0)
  await deselect()
  const ex = panel6().locator('.insp-pill', { hasText: '요소로 펼치기' })
  ok('[옛 마인드맵] 쪽 칸에 「⤢ 요소로 펼치기」 가 있다', (await ex.count()) === 1)
  await ex.click(); await p.waitForTimeout(400)
  const texts = (await layer().locator('.fel.round').allInnerTexts()).map((t) => t.trim())
  ok('[옛 마인드맵] 펼치면 중심 1 + 가지 4 가 요소가 된다(필드 글 그대로)', texts.length === 5 && texts.includes('옛 중심') && texts.includes('경영'), texts.join(','))
  await deselect()
  ok('[옛 마인드맵] 펼친 뒤에는 「＋ 가지」 가 뜬다', (await panel6().locator('.insp-pill', { hasText: '＋ 가지' }).count()) === 1)
  await p.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur() })
  await p.keyboard.press('ControlOrMeta+z'); await p.waitForTimeout(400)
  ok('[옛 마인드맵] ⌘Z 로 되돌린다 — 요소가 걷힌다', (await layer().locator('.fel').count()) === 0, String(await layer().locator('.fel').count()))
  // 요소만 걷히고 **카드가 빈 쪽**이 되면 안 된다 — 필드 글(옛 중심)과 「요소로 펼치기」 가 돌아와야 한다.
  const back = await p.locator('.stage').first().innerText()
  await deselect()
  ok('[옛 마인드맵] ⌘Z 뒤에도 카드 글이 그대로다(빈 쪽이 되지 않는다)', /옛 중심/.test(back) && (await ex.count()) === 1, back.slice(0, 60).replace(/\n/g, ' '))
}])

STAGES.push(['6단계 · 공용 창 껍데기', async () => {
  await freshBook()
  await p.goto(URL, { waitUntil: 'networkidle' })
  await p.waitForSelector('.lib-card', { timeout: 15000 })
  const cards0 = await p.locator('.lib-card').count()
  // Esc 로 닫힌다
  await p.locator('.lib-card .lib-act.danger').first().click(); await p.waitForTimeout(200)
  ok('[창] 이북 삭제는 공용 껍데기(ui-scrim)로 뜬다', (await p.locator('.ui-scrim.lib-confirm .ui-modal').count()) === 1)
  ok('[창] 나가는 버튼(취소)이 맨 앞이다', (await p.locator('.ui-modal-foot button').first().innerText()).trim() === '취소')
  await p.keyboard.press('Escape'); await p.waitForTimeout(200)
  ok('[창] Esc 로 닫힌다', (await p.locator('.ui-scrim').count()) === 0)
  ok('[창] 닫혀도 지워지지 않았다', (await p.locator('.lib-card').count()) === cards0)
  // 두 번 눌러도 한 번만 간다 — 응답을 400ms 늦춰 그 사이를 만든다.
  let dels = 0
  await p.route('**/api/projects/*', async (route) => {
    if (route.request().method() === 'DELETE') { dels++; await new Promise((r) => setTimeout(r, 400)) }
    await route.continue()
  })
  await p.locator('.lib-card .lib-act.danger').first().click(); await p.waitForTimeout(200)
  await p.locator('.ui-modal .lib-c-ok').dblclick()
  await p.waitForTimeout(150)
  const busyTxt = await p.locator('.ui-modal .lib-c-ok').innerText().catch(() => '')
  ok('[창] 처리 중에는 「삭제 중…」 으로 잠긴다', /삭제 중/.test(busyTxt), busyTxt)
  await p.keyboard.press('Escape'); await p.waitForTimeout(100)
  ok('[창] 처리 중에는 Esc 로도 안 닫힌다', (await p.locator('.ui-scrim').count()) === 1)
  await p.waitForTimeout(900)
  await p.unroute('**/api/projects/*')
  ok('[창] 확인을 두 번 눌러도 삭제 요청은 한 번', dels === 1, String(dels))
  ok('[창] 끝나면 창이 닫힌다', (await p.locator('.ui-scrim').count()) === 0)
  ok('[창] 한 권만 지워졌다', (await p.locator('.lib-card').count()) === cards0 - 1, `${cards0} → ${await p.locator('.lib-card').count()}`)
  ok('[창] 다음에 연 창에 지난 오류가 안 남는다', await (async () => {
    await p.locator('.lib-card .lib-act.danger').first().click(); await p.waitForTimeout(200)
    const n = await p.locator('.ui-modal .lib-delerr').count()
    await p.keyboard.press('Escape'); await p.waitForTimeout(150)
    return n === 0
  })())
}])

// ── 7단계 ─────────────────────────────────────────────────
// 2026-10-02 · 화면 기록 두 개에서 나온 것.
//   · 방향 줄의 「고른 것」 표시(EVER-SKETCH1 0398eb3 ①) — 가로·세로가 반대로 읽혔다.
//   · 여럿을 **선과 함께** 복사·붙여넣기(canvas/clipboard.ts) — 머메이드 트리를 통째로 붙이면 상자 하나만 왔다.
//   · 챗봇 패널 안 메모 탭(EVER-SKETCH1 fb61df4) — 떠 있는 단추 둘을 하나로.
if (SHOT_DIR) { const fs = await import('node:fs'); fs.mkdirSync(SHOT_DIR + '/s7', { recursive: true }) }
const BLUE = 'rgb(42, 120, 214)'
/** 화면 기록에 나온 그림. 가로 종이에서는 아래 띠로 접혀 「개발」 echo 가 하나 생긴다. */
const VIDEO_MM = 'graph TB\n  A[기획] --> B[설계]\n  B --> C[개발]\n  C --> D{검수}\n  D --> E[배포]\n  D --> B'
const fels = () => layer().locator('.fel')
const lines = () => layer().locator('svg path[stroke="#b9c2d4"]')
/** 종이 전체를 끌어서 그 위의 것을 전부 고른다. **빈 자리에서 눌러야** 끌어 고르기가 된다 —
 *  트리도 붙인 것도 왼쪽 위 모서리에는 안 놓인다. */
async function selectAllOnPaper() {
  const bb = await layer().boundingBox()
  await p.mouse.move(bb.x + 3, bb.y + 3)
  await p.mouse.down()
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 4 })
  await p.mouse.move(bb.x + bb.width - 3, bb.y + bb.height - 3, { steps: 4 })
  await p.mouse.up()
  await p.waitForTimeout(250)
}

STAGES.push(['7단계 · 방향 줄의 고름 표시', async () => {
  await freshBook()
  await deselect()
  const seg = (t) => panel6().locator('.insp-row.seg button', { hasText: t })
  const border = (loc) => loc.evaluate((n) => getComputedStyle(n).borderTopColor)
  const paper = async () => { const bb = await layer().boundingBox(); return bb.width > bb.height ? '가로' : '세로' }

  await seg('가로').click(); await p.waitForTimeout(350)
  ok('[방향] 「가로」를 누르면 종이가 가로다', (await paper()) === '가로')
  ok('[방향] 그때 **「가로」에 파란 테두리**가 붙는다', (await border(seg('가로'))) === BLUE, await border(seg('가로')))
  ok('[방향] 안 고른 「세로」에는 파란 테두리가 없다', (await border(seg('세로'))) !== BLUE, await border(seg('세로')))
  if (SHOT_DIR) await panel6().screenshot({ path: SHOT_DIR + '/s7/stage7_orientation_landscape.png' })

  await seg('세로').click(); await p.waitForTimeout(350)
  ok('[방향] 「세로」를 누르면 종이가 세로다', (await paper()) === '세로')
  ok('[방향] 파란 테두리가 「세로」로 옮겨 간다', (await border(seg('세로'))) === BLUE && (await border(seg('가로'))) !== BLUE,
    `세로 ${await border(seg('세로'))} · 가로 ${await border(seg('가로'))}`)
  // 거꾸로 읽히던 원인 — 한 테두리 안에 갇힌 단추 중 안 고른 것이 「흰 알약」으로 남았다.
  const wrap = await seg('세로').evaluate((n) => { const s = getComputedStyle(n.parentElement); return s.borderTopWidth + ' / ' + s.columnGap })
  ok('[방향] 단추들이 한 테두리 안에 갇혀 있지 않다(묶음 테두리 0 · 사이 띔)', /^0px \/ [1-9]/.test(wrap), wrap)
  // 옛 머리줄의 `.seg` 가 깔던 회색 받침 — 그 위의 흰 단추가 「고른 알약」으로 보였다.
  const tray = await seg('세로').evaluate((n) => { const s = getComputedStyle(n.parentElement); return s.backgroundColor + ' / ' + s.paddingTop })
  ok('[방향] 묶음에 회색 받침이 없다', tray === 'rgba(0, 0, 0, 0) / 0px', tray)
  // 같은 묶음을 쓰는 바로 위 「배경」도 같은 말을 한다.
  const bg = panel6().locator('.insp-row.seg button', { hasText: '밝게' })
  ok('[방향] 「배경」 줄도 고른 것에 파란 테두리', (await border(bg)) === BLUE, await border(bg))
  if (SHOT_DIR) await panel6().screenshot({ path: SHOT_DIR + '/s7/stage7_orientation_portrait.png' })
}])

STAGES.push(['7단계 · 여럿을 선과 함께 복사 · 붙여넣기', async () => {
  await freshBook()
  await deselect()
  await panel6().locator('.insp-row.seg button', { hasText: '가로' }).click(); await p.waitForTimeout(300)
  const pop = await openPicker()
  await pop.locator('.cpk-tile', { hasText: '머메이드 TB' }).click(); await p.waitForTimeout(200)
  await p.locator('.cpk-mm').fill(VIDEO_MM); await p.waitForTimeout(150)
  await p.locator('.cpk-mmgo').click(); await p.waitForTimeout(500)
  ok('[복사] (준비) 트리 쪽 — 상자 다섯 + 흐린 「개발」 하나 · 선 다섯', (await fels().count()) === 6 && (await lines().count()) === 5,
    `${await fels().count()} · ${await lines().count()}`)
  /**
   * 지금 종이에 **보이는 그림** — 상자마다 (모양 · 글자 · 자리 · 크기 · 채움 · 글자색), 선마다 지나는 점.
   * `shift` 만큼 되밀어서 낸다 — 붙인 쪽을 원본과 **글자 그대로** 맞대려고.
   *
   * 2026-10-02 오후 5.40 화면 기록: 여섯을 골라 붙였는데 다섯이 붙고, 흐린 「개발」 이 빠진 자리에
   * 왼쪽 아래 「개발」 에서 「검수」 로 꺾여 올라가는 선이 생겼다. 개수만 세어서는 그걸 못 잡는다 —
   * 그때 검사는 「상자 다섯 · 선 다섯」 을 **맞다고** 했다. 그래서 그림 자체를 잰다.
   */
  const picture = async (shift = 0) => {
    const boxes = await fels().evaluateAll((ns, s) => ns.map((n) => {
      const t = n.querySelector('.feltext')
      return [n.className.split(' ')[1], n.innerText.trim(), parseFloat(n.style.left) - s, parseFloat(n.style.top) - s,
        parseFloat(n.style.width), parseFloat(n.style.height),
        getComputedStyle(n).backgroundColor, t ? getComputedStyle(t).color : ''].join('|')
    }), shift)
    const paths = await lines().evaluateAll((ns, s) => ns.map((n) =>
      (n.getAttribute('d') || '').replace(/-?\d+(\.\d+)?/g, (m) => String(Math.round((parseFloat(m) - s) * 10) / 10))), shift)
    return { boxes: boxes.sort(), paths: paths.sort() }
  }
  const only = (a, b) => a.filter((x) => !b.includes(x)).join('  ‖  ') || '(같음)'
  const srcPic = await picture()
  if (SHOT_DIR) await p.locator('.stage').first().screenshot({ path: SHOT_DIR + '/s7/stage7_copy_source.png' })

  // 화면 기록 그대로: 끌어서 전부 고르고 → 복사 → 다른 쪽으로 가서 → 붙여넣기
  await selectAllOnPaper()
  ok('[복사] 끌어서 여섯을 고른다', /6개 고름/.test(await panel6().innerText()), (await panel6().innerText()).slice(0, 30).replace(/\n/g, ' '))
  await p.keyboard.press('ControlOrMeta+c'); await p.waitForTimeout(150)
  await thumbs.nth(0).click(); await p.waitForTimeout(300)
  ok('[복사] (준비) 붙일 쪽은 비어 있다', (await fels().count()) === 0)
  await p.keyboard.press('ControlOrMeta+v'); await p.waitForTimeout(350)
  ok('[붙여넣기] **고른 여섯이 전부** 붙는다 — 흐린 「개발」 도 상자다', (await fels().count()) === 6, String(await fels().count()))
  ok('[붙여넣기] **선 다섯도 따라온다**', (await lines().count()) === 5, String(await lines().count()))
  ok('[붙여넣기] 붙인 것이 고른 채로 남는다', /6개 고름/.test(await panel6().innerText()), (await panel6().innerText()).slice(0, 20).replace(/\n/g, ' '))
  // 보통 쪽에는 다시 앉히는 일이 없다 — 「앉힐 때마다 새로 그려집니다」 는 여기서 틀린 말이다.
  ok('[붙여넣기] 보통 쪽에서는 「다시 놓은 부모」 안내가 안 뜬다', !/다시 놓은 부모/.test(await panel6().innerText()))
  await deselect()
  const dstPic = await picture(20)
  ok('[붙여넣기] **붙인 그림이 원본과 같다** — 상자마다 모양 · 글자 · 자리 · 크기 · 채움 · 글자색',
    dstPic.boxes.join('\n') === srcPic.boxes.join('\n'), `붙인 쪽에만: ${only(dstPic.boxes, srcPic.boxes)} / 원본에만: ${only(srcPic.boxes, dstPic.boxes)}`)
  ok('[붙여넣기] **선도 원본과 같은 길**로 그어진다 — 꺾여 올라가는 새 선이 없다',
    dstPic.paths.join('\n') === srcPic.paths.join('\n'), `붙인 쪽에만: ${only(dstPic.paths, srcPic.paths)} / 원본에만: ${only(srcPic.paths, dstPic.paths)}`)
  if (SHOT_DIR) await p.locator('.stage').first().screenshot({ path: SHOT_DIR + '/s7/stage7_copy_pasted.png' })

  await p.keyboard.press('ControlOrMeta+z'); await p.waitForTimeout(300)
  ok('[붙여넣기] **⌘Z 한 번에** 전부 걷힌다', (await fels().count()) === 0 && (await lines().count()) === 0, `${await fels().count()} · ${await lines().count()}`)
  await p.keyboard.press('ControlOrMeta+Shift+z'); await p.waitForTimeout(300)
  ok('[붙여넣기] 다시 하면 전부 돌아온다', (await fels().count()) === 6 && (await lines().count()) === 5, `${await fels().count()} · ${await lines().count()}`)

  // 연달아 붙이면 포개지지 않는다 — 같은 자리면 붙은 줄 모른다.
  await p.keyboard.press('ControlOrMeta+v'); await p.waitForTimeout(350)
  const spots = await fels().evaluateAll((ns) => ns.map((n) => n.style.left + ',' + n.style.top))
  ok('[붙여넣기] 한 번 더 붙이면 열둘 · 선 열', spots.length === 12 && (await lines().count()) === 10, `${spots.length} · ${await lines().count()}`)
  ok('[붙여넣기] 두 번째 것이 **첫 번째 위에 포개지지 않는다**', new Set(spots).size === 12, String(new Set(spots).size))

  // 복제(⌘D)도 고른 것 전부 — 방금 붙인 여섯이 고른 채다.
  await p.keyboard.press('ControlOrMeta+d'); await p.waitForTimeout(350)
  ok('[복제] ⌘D 가 고른 여섯을 **선과 함께** 복제한다', (await fels().count()) === 18 && (await lines().count()) === 15, `${await fels().count()} · ${await lines().count()}`)

  // 잘라내기(⌘X) — 전에는 하나만 담고 전부 지웠다.
  await selectAllOnPaper()
  await p.keyboard.press('ControlOrMeta+x'); await p.waitForTimeout(300)
  ok('[잘라내기] 고른 것이 전부 걷힌다', (await fels().count()) === 0 && (await lines().count()) === 0, `${await fels().count()} · ${await lines().count()}`)
  await p.keyboard.press('ControlOrMeta+v'); await p.waitForTimeout(350)
  ok('[잘라내기] 붙이면 **전부 돌아온다** — 하나만 남지 않는다', (await fels().count()) === 18 && (await lines().count()) === 15, `${await fels().count()} · ${await lines().count()}`)

  // 원본 쪽은 그대로다.
  await thumbs.nth(1).click(); await p.waitForTimeout(300)
  const stillPic = await picture()
  ok('[복사] 원본 트리 쪽은 그대로다', stillPic.boxes.join('\n') === srcPic.boxes.join('\n') && stillPic.paths.join('\n') === srcPic.paths.join('\n'),
    `${await fels().count()} · ${await lines().count()}`)

  // 머메이드(트리) 쪽에 붙이면 **구조까지** 그대로다. 여기서는 흐린 상자가 「다시 놓은 부모」 로 남아야 한다 —
  // 그 표시를 떼면 흐린 상자가 진짜 뿌리로 굳어, 다시 앉힐 때 붙인 그림이 둘로 쪼개진다.
  await selectAllOnPaper()
  await p.keyboard.press('ControlOrMeta+c'); await p.waitForTimeout(150)
  await p.keyboard.press('ControlOrMeta+v'); await p.waitForTimeout(350)
  ok('[트리 쪽] 같은 쪽에 붙이면 상자 여섯 · 선 다섯이 는다', (await fels().count()) === 12 && (await lines().count()) === 10, `${await fels().count()} · ${await lines().count()}`)
  // 붙인 것 중 마지막(= 흐린 사본)이 고른 것이라, 패널이 그것을 두고 말한다.
  ok('[트리 쪽] 붙인 흐린 상자는 여기서도 「다시 놓은 부모」 다', /다시 놓은 부모/.test(await panel6().innerText()))
  if (SHOT_DIR) await p.locator('.stage').first().screenshot({ path: SHOT_DIR + '/s7/stage7_tree_pasted.png' })
  await deselect()
  /** 첫 「기획」(원본 뿌리)의 접기 손잡이를 누른다 — 접든 펴든 **쪽 전체가 다시 앉는다.**
   *  앉을 때마다 자리가 바뀌므로 매번 다시 찾는다(6단계 toggleRoot 와 같은 길). */
  async function toggleFirstRoot() {
    const rb = await layer().locator('.fel', { hasText: '기획' }).first().boundingBox()
    const fb = await layer().locator('.tree-fold').evaluateAll((ns) => ns.map((n) => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y } }))
    const d = (q) => Math.hypot(q.x - rb.x, q.y - (rb.y + rb.height))
    const near = fb.reduce((a2, q) => (d(q) < d(a2) ? q : a2), fb[0])
    await p.mouse.click(near.x + 6, near.y + 6); await p.waitForTimeout(350)
  }
  await toggleFirstRoot()                       // 접는다
  await toggleFirstRoot()                       // 편다 — 붙인 것까지 한꺼번에 다시 앉는다
  const after = (await fels().allInnerTexts()).map((t) => t.trim())
  ok('[트리 쪽] 다시 앉혀도 **두 그림이 다 남는다**',
    ['기획', '설계', '검수', '배포'].every((t) => after.filter((a) => a === t).length === 2), after.join(','))
  // 상자 열 + 흐린 것 둘. 흐린 사본이 진짜 상자로 굳었다면 「개발」 이 다섯(상자 열하나 + 흐린 것 …)이 된다.
  ok('[트리 쪽] 「개발」 은 넷이다 — 진짜 둘 + 흐린 것 둘(붙인 흐린 상자가 진짜 상자로 굳지 않는다)',
    after.length === 12 && after.filter((a) => a === '개발').length === 4, `${after.length}개 · 개발 ${after.filter((a) => a === '개발').length}`)
  ok('[트리 쪽] 다시 앉힌 뒤에도 선이 열 그대로다', (await lines().count()) === 10, String(await lines().count()))
  const rects = await fels().evaluateAll((ns) => ns.map((n) => { const r = n.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom] }))
  let over = 0
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], c = rects[j]
    if (a[0] < c[2] - 1 && c[0] < a[2] - 1 && a[1] < c[3] - 1 && c[1] < a[3] - 1) over++
  }
  ok('[트리 쪽] 다시 앉힌 두 그림이 **서로 안 겹친다**', over === 0, `겹친 쌍 ${over} · 상자 ${rects.length}`)
  if (SHOT_DIR) { await deselect(); await p.locator('.stage').first().screenshot({ path: SHOT_DIR + '/s7/stage7_tree_reseated.png' }) }
}])

STAGES.push(['7단계 · 챗봇 패널 안 메모 탭', async () => {
  await freshBook()
  ok('[메모] 왼쪽 아래 메모 단추가 없다', (await p.locator('.np-fab').count()) === 0)
  ok('[메모] 떠 있는 단추는 챗봇 **하나**', (await p.locator('.chat-fab').count()) === 1)
  const tabs = p.locator('.side-tabs button')
  const box = async (sel) => { const b2 = await p.locator(sel).boundingBox(); return [b2.x, b2.y, b2.width, b2.height].map((v) => Math.round(v)).join(',') }

  await p.locator('.chat-fab').click(); await p.waitForTimeout(450)
  ok('[메모] 챗봇을 열면 머리 아래에 탭이 둘', (await tabs.count()) === 2, (await tabs.allInnerTexts()).join(' | '))
  ok('[메모] 지금 선 칸은 챗봇', (await tabs.nth(0).getAttribute('aria-selected')) === 'true' && (await tabs.nth(1).getAttribute('aria-selected')) === 'false')
  ok('[메모] 열려 있는 동안 떠 있는 단추는 없다', (await p.locator('.chat-fab').count()) === 0)
  const chatBox = await box('.chat-panel')
  if (SHOT_DIR) await p.screenshot({ path: SHOT_DIR + '/s7/stage7_side_chat.png' })

  await tabs.filter({ hasText: '메모' }).click(); await p.waitForTimeout(450)
  ok('[메모] 메모 탭을 누르면 메모장이 뜬다', (await p.locator('.np-panel').count()) === 1)
  ok('[메모] 탭은 여전히 **둘**이다(닫힌 챗봇의 탭이 남아 네 칸이 되지 않는다)', (await tabs.count()) === 2, String(await tabs.count()))
  ok('[메모] 지금 선 칸은 메모', (await tabs.nth(1).getAttribute('aria-selected')) === 'true')
  const noteBox = await box('.np-panel')
  ok('[메모] **같은 자리 · 같은 폭**이다 — 탭을 눌러도 패널이 안 움직인다', chatBox === noteBox, `챗봇 ${chatBox} · 메모 ${noteBox}`)

  // 「적어 둔 게 있다」 — 없앤 단추의 파란 점이 탭으로 옮겨 왔다.
  await p.locator('.np-new').click(); await p.waitForTimeout(400)
  if (SHOT_DIR) await p.screenshot({ path: SHOT_DIR + '/s7/stage7_side_notes.png' })
  await tabs.filter({ hasText: '챗봇' }).click(); await p.waitForTimeout(450)
  ok('[메모] 챗봇으로 돌아가면 메모장은 걷힌다(둘이 동시에 안 뜬다)', (await p.locator('.np-panel').count()) === 0 && (await p.locator('.chat-panel.open').count()) === 1)
  ok('[메모] 메모가 있으면 챗봇 쪽 「메모」 탭에 **파란 점**', (await p.locator('.side-tabs .side-dot').count()) === 1)

  await p.locator('.chat-panel header button[title="닫기"]').click(); await p.waitForTimeout(450)
  ok('[메모] 닫으면 챗봇 단추가 돌아온다', (await p.locator('.chat-fab').count()) === 1 && (await p.locator('.chat-panel.open').count()) === 0)

  // 챗봇을 안 여는 사람의 길 — 도구 ▸ 메모장
  await p.locator('.ax-menu .ax-mwrap button.m', { hasText: '도구' }).click(); await p.waitForTimeout(200)
  await p.locator('.ax-mdrop .ax-mitem', { hasText: '메모장' }).click(); await p.waitForTimeout(450)
  ok('[메모] **도구 ▸ 메모장** 으로도 열린다', (await p.locator('.np-panel').count()) === 1 && (await tabs.count()) === 2)
  // 메모장은 닫혀 있어도 사라지지 않는다 — 쓰던 메모가 열린 채로 돌아온다.
  ok('[메모] 다시 열면 **쓰던 메모가 그대로** 열려 있다', (await p.locator('.np-title-in').count()) === 1)
  await p.locator('.np-back').click(); await p.waitForTimeout(250)
  ok('[메모] 목록에 적어 둔 메모가 하나 있다', (await p.locator('.np-item').count()) === 1, String(await p.locator('.np-item').count()))
  await p.locator('.np-x').click(); await p.waitForTimeout(300)
  ok('[메모] 메모장을 닫으면 챗봇 단추가 돌아온다', (await p.locator('.np-panel').count()) === 0 && (await p.locator('.chat-fab').count()) === 1)
}])

// ── 8단계 ─────────────────────────────────────────────────
// 2026-10-02 오후 5.41 화면 기록 · **한글 조합 중 Enter**(src/lib/ime.ts).
// 메모장에서 「ㅌ + Enter」 한 번에 줄이 둘 생기고 같은 글자가 한 번 더 찍혔다. 맥 크롬은 조합 중 Enter 에
// keydown 을 **두 번** 보낸다 — 그 순서를 CDP 로 그대로 넣는다:
//   ① 조합 시작(밑줄 친 글자)  ② 조합 중 Enter(isComposing=true · 229)
//   ③ 입력기가 글자를 확정      ④ Enter 한 번 더(isComposing=false · 13)
// 같은 모양의 Enter 처리가 있던 다섯 자리를 모두 잰다.
if (SHOT_DIR) { const fs = await import('node:fs'); fs.mkdirSync(SHOT_DIR + '/s8', { recursive: true }) }

STAGES.push(['8단계 · 한글 조합 중 Enter', async () => {
  await freshBook()
  const cdp = await p.context().newCDPSession(p)
  /** 지금 초점이 있는 칸에 「글자 + Enter」 를 한글 입력기처럼 넣는다. */
  async function imeEnter(ch) {
    await cdp.send('Input.imeSetComposition', { text: ch, selectionStart: ch.length, selectionEnd: ch.length }); await p.waitForTimeout(60)
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 229, nativeVirtualKeyCode: 229 }); await p.waitForTimeout(60)
    await cdp.send('Input.insertText', { text: ch }); await p.waitForTimeout(60)
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: '\r' })
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 })
    await p.waitForTimeout(300)
  }

  // ① 메모장 — 화면 기록의 그 자리
  await p.locator('.chat-fab').click(); await p.waitForTimeout(400)
  await p.locator('.side-tabs button', { hasText: '메모' }).click(); await p.waitForTimeout(400)
  await p.locator('.np-new').click(); await p.waitForTimeout(400)
  const memo = () => p.locator('.pn-ta').evaluateAll((ns) => ns.map((n) => n.value))
  await p.locator('.pn-ta').first().click(); await p.waitForTimeout(150)
  await imeEnter('ㅌ')
  ok('[한글 Enter] 메모장 — 「ㅌ + Enter」 한 번에 **한 줄**만 는다', JSON.stringify(await memo()) === '["ㅌ",""]', JSON.stringify(await memo()))
  await imeEnter('ㅌ')
  ok('[한글 Enter] 메모장 — 두 번 치면 두 줄 · 같은 글자가 두 번 찍히지 않는다', JSON.stringify(await memo()) === '["ㅌ","ㅌ",""]', JSON.stringify(await memo()))
  await p.keyboard.type('x'); await p.keyboard.press('Enter'); await p.waitForTimeout(250)
  ok('[한글 Enter] (견줄 것) 영문 「x + Enter」 도 한 줄', JSON.stringify(await memo()) === '["ㅌ","ㅌ","x",""]', JSON.stringify(await memo()))
  if (SHOT_DIR) await p.locator('.np-panel').screenshot({ path: SHOT_DIR + '/s8/stage8_memo_ime.png' })
  await p.locator('.np-x').click(); await p.waitForTimeout(300)

  // ② 챗봇 입력창 — 마지막 글자를 한 번 더 보내던 것
  await p.locator('.chat-fab').click(); await p.waitForTimeout(400)
  const chatIn = p.locator('.chat-panel footer input')
  await chatIn.click(); await p.keyboard.type('hi '); await p.waitForTimeout(100)
  await imeEnter('요'); await p.waitForTimeout(600)
  const sent = await p.locator('.chat-panel').evaluate((n) => Array.from(n.querySelectorAll('[class*="user"]')).map((x) => x.textContent.trim()).filter(Boolean))
  ok('[한글 Enter] 챗봇 — 「hi 요 + Enter」 는 **한 번만** 보낸다', sent.length === 1 && /^hi 요/.test(sent[0]), JSON.stringify(sent))
  ok('[한글 Enter] 챗봇 — 보낸 뒤 입력창이 비어 있다', (await chatIn.inputValue()) === '', JSON.stringify(await chatIn.inputValue()))
  await p.locator('.chat-panel header button[title="닫기"]').click(); await p.waitForTimeout(400)

  // ③ 표 칸 — 영문과 같이 아래 칸만 골라야 한다(편집 상태로 열리면 안 된다)
  await p.locator('.ax-menu .ax-mwrap button.m', { hasText: '삽입' }).click(); await p.waitForTimeout(200)
  await p.locator('.ax-mdrop .ax-mitem', { hasText: '표' }).click(); await p.waitForTimeout(500)
  const cells = () => layer().locator('.fel.table').first().evaluate((t) => {
    const cs = Array.from(t.querySelectorAll('.feltd'))
    return { t01: cs.find((c) => c.getAttribute('data-rc') === '0_1').innerText, editing: cs.filter((c) => c.getAttribute('contenteditable') === 'true').length,
      picked: cs.filter((c) => c.classList.contains('cellsel')).map((c) => c.getAttribute('data-rc')).join() }
  })
  await layer().locator('.feltd[data-rc="0_1"]').dblclick(); await p.waitForTimeout(300)
  await p.keyboard.press('ControlOrMeta+a'); await p.keyboard.press('Backspace'); await p.waitForTimeout(100)
  await imeEnter('ㅌ')
  const tc = await cells()
  ok('[한글 Enter] 표 칸 — 글자는 한 번 · 편집을 끝내고 **아래 칸만 고른다**(영문과 같다)',
    tc.t01 === 'ㅌ' && tc.editing === 0 && tc.picked === '1_1', JSON.stringify(tc))
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.waitForTimeout(200)

  // ④ 「빈 페이지」 블록 편집기 — 2026-10-06 부터 오른쪽 아래가 아니라 **메모장 「지금 슬라이드」** 에서 고친다(9단계).
  await p.locator('.cardpick .add').click(); await p.waitForTimeout(250)
  await p.locator('.cpk-pop .cpk-tile', { hasText: '빈 페이지' }).click(); await p.waitForTimeout(500)
  await panel6().locator('button', { hasText: '메모장에서 글 고치기' }).click(); await p.waitForTimeout(450)
  const be = p.locator('.np-panel .be-ta')
  await be.nth(1).click(); await p.waitForTimeout(150)
  await imeEnter('ㅌ')
  const bv = await be.evaluateAll((ns) => ns.map((n) => n.value))
  ok('[한글 Enter] 블록 편집기 — 한 줄만 는다', JSON.stringify(bv) === '["","ㅌ",""]', JSON.stringify(bv))
  await p.locator('.np-x').click(); await p.waitForTimeout(300)

  // ⑤ 카드 글자 칸 — Enter 로 빠져나갈 때 마지막 글자가 두 번 찍히던 것
  await p.locator('.cardpick .add').click(); await p.waitForTimeout(250)
  await p.locator('.cpk-pop .cpk-tile', { hasText: '표지' }).first().click(); await p.waitForTimeout(600)
  const fields = p.locator('.stage .cardedit')
  await fields.first().click(); await p.waitForTimeout(250)
  await imeEnter('가')
  const ft = await fields.first().textContent()
  ok('[한글 Enter] 카드 글자 칸 — 글자가 **한 번만** 들어가고 칸을 빠져나간다',
    ft === '가' && (await p.evaluate(() => document.activeElement === document.body)), JSON.stringify(ft))
}])

// ── 9단계 ─────────────────────────────────────────────────
// 2026-10-06 · 메모장에서 **지금 슬라이드** 글을 고친다(memo_slide.test.mjs).
// 사용자: 「메모랑 슬라이드랑 연동되게 / 오른쪽 하단에서 글씨 수정 너무 불편함」. 빈 페이지 글을 고치는 곳이
// 오른쪽 속성 패널 맨 아래 한 군데였고, 챗봇 단추가 마지막 줄을 가렸다. 그 편집기를 넓은 메모장으로 옮겼다 —
// 글은 슬라이드 한 곳에만 있고, 메모장은 그것을 고치는 **창**이다.
if (SHOT_DIR) { const fs = await import('node:fs'); fs.mkdirSync(SHOT_DIR + '/s9', { recursive: true }) }

STAGES.push(['9단계 · 메모장에서 슬라이드 글 고치기', async () => {
  await freshBook()
  const pop = await openPicker()
  await pop.locator('.cpk-tile', { hasText: '빈 페이지' }).click(); await p.waitForTimeout(500)
  const nPages = await thumbs.count()
  const be = p.locator('.np-panel .be-ta')
  const stageText = () => p.locator('.stage').first().innerText()

  // 오른쪽 「내용」 — 글 편집 칸 대신 단추 하나
  ok('[메모↔슬라이드] 오른쪽 「내용」 에 글 편집 칸이 **없다**', (await panel6().locator('.be-ta').count()) === 0, String(await panel6().locator('.be-ta').count()))
  const go = panel6().locator('button', { hasText: '메모장에서 글 고치기' })
  ok('[메모↔슬라이드] 대신 「메모장에서 글 고치기」 단추가 있다', (await go.count()) === 1)
  if (SHOT_DIR) await panel6().screenshot({ path: SHOT_DIR + '/s9/stage9_right_panel.png' })
  await go.click(); await p.waitForTimeout(450)
  ok('[메모↔슬라이드] 누르면 메모장이 열린다', (await p.locator('.np-panel').count()) === 1)
  ok('[메모↔슬라이드] 메모장에 **지금 슬라이드의 글 칸**이 열린다(제목 · 본문)', (await be.count()) === 2, String(await be.count()))
  ok('[메모↔슬라이드] 몇 쪽을 고치는지 말한다', new RegExp(nPages + '쪽').test(await p.locator('.np-panel').innerText()))

  // 고치는 즉시 종이에
  await be.nth(0).click(); await p.keyboard.type('회의 정리'); await p.waitForTimeout(200)
  await be.nth(1).click(); await p.keyboard.type('다음 주 일정 확인'); await p.waitForTimeout(250)
  const st1 = await stageText()
  ok('[메모↔슬라이드] 고치는 즉시 **종이에 보인다**', /회의 정리/.test(st1) && /다음 주 일정 확인/.test(st1), st1.slice(0, 80).replace(/\n/g, ' '))
  await p.keyboard.press('Enter'); await p.keyboard.type('담당 정하기'); await p.waitForTimeout(250)
  ok('[메모↔슬라이드] Enter 로 새 줄 — 종이에도 줄이 는다', (await be.count()) === 3 && /담당 정하기/.test(await stageText()), String(await be.count()))
  if (SHOT_DIR) await p.screenshot({ path: SHOT_DIR + '/s9/stage9_memo_slide.png' })

  // 목록 맨 위의 「지금 슬라이드」 줄
  await p.locator('.np-panel .np-back').click(); await p.waitForTimeout(250)
  const row = p.locator('.np-panel .np-slide')
  const rowText = async () => (await row.innerText().catch(() => '')).replace(/\n/g, ' ')
  ok('[메모↔슬라이드] 목록 맨 위에 「지금 슬라이드 · N쪽」', (await row.count()) === 1 && new RegExp('지금 슬라이드.*' + nPages + '쪽').test(await rowText()), await rowText())
  ok('[메모↔슬라이드] 그 줄에 첫 글이 미리 보인다', /회의 정리/.test(await rowText()), await rowText())
  if (SHOT_DIR) await p.locator('.np-panel').screenshot({ path: SHOT_DIR + '/s9/stage9_memo_list.png' })

  // 빈 페이지가 아닌 쪽에서는 줄이 없다 — 그런 쪽은 종이 위에서 바로 고친다
  await thumbs.nth(0).click(); await p.waitForTimeout(300)
  ok('[메모↔슬라이드] 빈 페이지가 아닌 쪽에서는 그 줄이 없다', (await row.count()) === 0)
  await thumbs.nth(nPages - 1).click(); await p.waitForTimeout(300)
  await row.click(); await p.waitForTimeout(300)
  ok('[메모↔슬라이드] 줄을 누르면 그 슬라이드 글 칸이 다시 열린다', (await be.count()) === 3 && (await be.nth(0).inputValue()) === '회의 정리')

  // 「슬라이드로」 보낸 메모 — 보낸 뒤에는 그 새 슬라이드를 고치는 보기로 넘어간다
  await p.locator('.np-panel .np-back').click(); await p.waitForTimeout(200)
  await p.locator('.np-panel .np-new').click(); await p.waitForTimeout(300)
  await p.locator('.np-panel .np-title-in').fill('보낼 메모'); await p.waitForTimeout(200)
  await p.locator('.np-panel .np-act', { hasText: '슬라이드로' }).click(); await p.waitForTimeout(500)
  ok('[메모↔슬라이드] 「슬라이드로」 보내면 새 쪽이 생긴다', (await thumbs.count()) === nPages + 1, String(await thumbs.count()))
  ok('[메모↔슬라이드] 보낸 뒤에는 **그 새 슬라이드의 글 칸**으로 넘어간다 — 메모를 고치며 슬라이드가 안 바뀐다고 헷갈리지 않게',
    (await be.count()) >= 1 && (await be.nth(0).inputValue()) === '보낼 메모' && new RegExp((nPages + 1) + '쪽').test(await p.locator('.np-panel').innerText()),
    (await be.count()) + ' · ' + (await be.nth(0).inputValue().catch(() => '')))
  await p.locator('.np-x').click(); await p.waitForTimeout(300)
}])

// ── 10단계 ────────────────────────────────────────────────
// 2026-10-06 · 트리 「＋ 자식」 이 선 없이 왼쪽 위에 포개지던 것 · 마인드맵 「＋ 가지」 번호 겹침(tree_ids.test.mjs).
// echo 와 「＋ 가지」 가 번호표를 안 뽑고 `가장 큰 id + 1` 로 번호를 받아, 다음에 뽑은 번호가 그것과 같았다.
STAGES.push(['10단계 · ＋ 자식 · ＋ 가지 번호', async () => {
  await freshBook()
  await deselect()
  await panel6().locator('.insp-row.seg button', { hasText: '가로' }).click(); await p.waitForTimeout(300)
  let pop = await openPicker()
  await pop.locator('.cpk-tile', { hasText: '머메이드 TB' }).click(); await p.waitForTimeout(200)
  await p.locator('.cpk-mm').fill(VIDEO_MM); await p.waitForTimeout(150)
  await p.locator('.cpk-mmgo').click(); await p.waitForTimeout(500)
  const ids = () => layer().locator('.fel').evaluateAll((ns) => ns.map((n) => n.getAttribute('data-el-id')))
  const allUnique = async () => { const v = await ids(); return new Set(v).size === v.length }
  ok('[＋ 자식] (준비) 화면 기록의 그림 — 상자 다섯 + echo · 선 다섯', (await fels().count()) === 6 && (await lines().count()) === 5)
  // **종이 안 좌표**로 잰다 — 화면 좌표는 오른쪽 패널이 바뀔 때 몇 px 밀려서, 처음 짠 검사가 포개진 것을 놓쳤다.
  const spot = (loc) => loc.evaluate((n) => [parseFloat(n.style.left), parseFloat(n.style.top)])
  async function addChildOf(t) {
    await deselect()
    await layer().locator('.fel', { hasText: t }).first().click(); await p.waitForTimeout(250)
    await panel6().locator('.insp-pill', { hasText: '＋ 자식' }).click(); await p.waitForTimeout(400)
  }

  await addChildOf('배포')
  ok('[＋ 자식] 선이 하나 는다(5 → 6) — 새 상자가 「배포」 에 이어진다', (await lines().count()) === 6, String(await lines().count()))
  const nbLoc = layer().locator('.fel', { hasText: '새 상자' }).first()
  const nb = (await nbLoc.count()) ? await spot(nbLoc) : null
  const rt = await spot(layer().locator('.fel', { hasText: '기획' }).first())
  ok('[＋ 자식] 새 상자가 **왼쪽 위 뿌리 자리에 포개지지 않는다**', !!nb && !(nb[0] === rt[0] && nb[1] === rt[1]),
    nb ? `새 상자 ${nb} · 뿌리 ${rt}` : '새 상자 없음')
  ok('[＋ 자식] 한 쪽 안의 번호가 모두 다르다', await allUnique(), JSON.stringify(await ids()))
  if (SHOT_DIR) { await deselect(); await p.locator('.stage').first().screenshot({ path: SHOT_DIR + '/s9/stage10_tree_child.png' }) }
  await addChildOf('배포')
  ok('[＋ 자식] 한 번 더 — 선이 또 는다(6 → 7)', (await lines().count()) === 7, String(await lines().count()))
  ok('[＋ 자식] 두 번째 뒤에도 번호가 모두 다르다', await allUnique())

  // 마인드맵 「＋ 가지」 뒤에 놓은 글상자와 번호가 겹치지 않는다
  pop = await openPicker()
  await pop.locator('.cpk-tile', { hasText: '마인드맵' }).first().click(); await p.waitForTimeout(200)
  await pop.locator('.cpk-br', { hasText: '4' }).click(); await p.waitForTimeout(500)
  await deselect()
  await panel6().locator('.insp-pill', { hasText: '＋ 가지' }).click(); await p.waitForTimeout(300)
  await placeText(); await p.keyboard.press('Escape'); await p.waitForTimeout(200)
  ok('[＋ 가지] 가지를 붙인 뒤 놓은 글상자와 **번호가 겹치지 않는다**', await allUnique(), JSON.stringify(await ids()))
}])

// ── 11단계 ────────────────────────────────────────────────
// 2026-10-06 · 머리줄 오른쪽 끝 「가」 동그라미 — 하는 일이 없는 장식이라 걷었다(title_bar.test.mjs).
// 단추 글자는 바뀌는 중이라(「＋ 새 이북」 → 「＋ 스케치」) 글자가 아니라 자리(클래스)로 찾는다.
STAGES.push(['11단계 · 머리줄 동그라미', async () => {
  await freshBook()
  ok('[머리줄] 하는 일 없는 동그라미 「가」 가 없다', (await p.locator('.ax-title .av').count()) === 0, String(await p.locator('.ax-title .av').count()))
  const bar = await p.locator('.ax-title').boundingBox()
  const end = await p.locator('.ax-title .rbtn.pri').boundingBox()
  const gap = Math.round(bar.x + bar.width - (end.x + end.width))
  ok('[머리줄] 새로 만들기 단추가 **오른쪽 끝**에 선다(머리줄 안쪽 여백 16px)', gap >= 14 && gap <= 18, gap + 'px')
  if (SHOT_DIR) await p.locator('.ax-title').screenshot({ path: SHOT_DIR + '/s9/stage11_title_bar.png' })
}])

// ── 12단계 ────────────────────────────────────────────────
// 2026-10-06 · 쪽 목록 폭이 **종이 방향을 따른다**(film_width.test.mjs). 사용자: 「왼쪽 폭이 세로기준이라
// 가로슬라이드는 살짝 잘리는거」 — 화면 기록 끝에서 경계를 끌어 「이 정도 폭」(232px)을 보여 줬다.
// 헤드리스 크롬은 스크롤 막대를 감춰 띄운다(--hide-scrollbars) — 막대 모양을 입혀도 자리를 안 차지한다.
// 사용자 화면처럼 **막대가 15px 를 차지하는** 조건을, 목록 오른쪽에 15px 테두리를 둬서 만든다(안쪽 폭이 똑같이 준다).
STAGES.push(['12단계 · 쪽 목록 폭', async () => {
  await freshBook()
  const bar = await p.addStyleTag({ content: '.axth-list{border-right:15px solid #e3e6ec}' })
  const film = () => p.locator('.ax-film').evaluate((n) => Math.round(n.getBoundingClientRect().width))
  /** 목록이 넘치는가 · 칸 안쪽을 넘는(=잘리는) 종이 그림이 몇인가. */
  const fit = () => p.evaluate(() => {
    const list = document.querySelector('.axth-list')
    const sb = list.offsetWidth - list.clientWidth
    const right = list.getBoundingClientRect().right - sb
    const bad = Array.from(document.querySelectorAll('.axth-mini')).filter((m) => {
      const r = m.firstElementChild.getBoundingClientRect()
      return r.width > m.clientWidth + 0.5 || r.height > m.clientHeight + 0.5 || m.getBoundingClientRect().right > right + 0.5
    }).length
    return { over: list.scrollWidth > list.clientWidth, bad, sb }
  })
  await deselect()
  ok('[쪽 목록] 세로 새 이북 — 목록 폭 212', (await film()) === 212, String(await film()))
  await panel6().locator('.insp-row.seg button', { hasText: '가로' }).click(); await p.waitForTimeout(350)
  ok('[쪽 목록] 가로로 바꾸면 **232**(사용자가 끌어 보인 폭)', (await film()) === 232, String(await film()))
  for (let i = 0; i < 3; i++) { await thumbs.last().click(); await p.keyboard.press('Enter'); await p.waitForTimeout(200) }
  const f1 = await fit()
  ok('[쪽 목록] 가로 · 쪽 넷 — 목록이 옆으로 넘치지 않는다', !f1.over, JSON.stringify(f1))
  ok('[쪽 목록] 가로 그림이 **잘리지 않는다**(종이 그림이 칸 안쪽 안에)', f1.bad === 0, JSON.stringify(f1))
  if (SHOT_DIR) await p.locator('.ax-film').screenshot({ path: SHOT_DIR + '/s9/stage12_film_landscape.png' })
  await deselect()
  await panel6().locator('.insp-row.seg button', { hasText: '세로' }).click(); await p.waitForTimeout(350)
  ok('[쪽 목록] 다시 세로 → 212', (await film()) === 212, String(await film()))
  const f2 = await fit()
  ok('[쪽 목록] 세로에서도 넘침 · 잘림 없음', !f2.over && f2.bad === 0, JSON.stringify(f2))

  // 사람이 경계를 끌어 정한 폭은 방향을 바꿔도 그대로
  const h = await p.locator('.ax-resize.l').boundingBox()
  await p.mouse.move(h.x + h.width / 2, h.y + 40); await p.mouse.down()
  await p.mouse.move(h.x + h.width / 2 + 24, h.y + 40, { steps: 4 })
  await p.mouse.move(h.x + h.width / 2 + 48, h.y + 40, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(250)
  const dragged = await film()
  ok('[쪽 목록] 경계를 끌면 그 폭이 된다', dragged >= 255 && dragged <= 265, String(dragged))
  await deselect()
  await panel6().locator('.insp-row.seg button', { hasText: '가로' }).click(); await p.waitForTimeout(350)
  ok('[쪽 목록] **끌어 정한 폭은** 방향을 바꿔도 그대로', (await film()) === dragged, `${dragged} → ${await film()}`)

  // 쪽을 끝까지 지워도 화면이 멈추지 않는다(React #300 — 훅이 「쪽이 없으면 일찍 돌아가기」 뒤에 있었다)
  const before = errs.length
  while ((await thumbs.count()) > 0) {
    const t = thumbs.first(); await t.hover(); await p.waitForTimeout(80)
    await t.locator('.axth-tools .del').click({ force: true }); await p.waitForTimeout(220)
    if (errs.length > before) break
  }
  ok('[쪽 목록] 쪽을 끝까지 지워도 **화면 오류가 없다**', errs.length === before, errs.slice(before).join(' | ').slice(0, 120))
  ok('[쪽 목록] 빈 목록 안내가 보인다', (await p.locator('.axth-empty').count()) === 1)
  await bar.evaluate((n) => n.remove())
}])

// ── 13단계 ────────────────────────────────────────────────
// 2026-10-06 · **작업면 꽉 채우기 + 알마인드식 가지 키**(work_area · mind_keys · tree_keys.test.mjs).
// 화면 기록(오후 3.38.49): 가로 덱에서 파란 ＋ 점으로 붙인 상자가 종이 밖에 생기자 회색 작업창이 통째로 구르고 종이가 밀렸다.
// **창 전체가 슬라이드다**(slide_grow.test.mjs) — 테두리도 뒷바탕도 없고, 넘치면 슬라이드가 비율대로 늘어나 이 창 안에서 굴려 본다.
// 쪽 목록 · 발표 · 내보내기에는 늘어난 슬라이드를 통째로 줄여 **한 장에 전부** 담는다(잘리는 것 없음).
// 상자를 고르고 Space · Enter 로 가지를 붙이면 그 묶음이 **기준 크기 안에** 다시 앉는다.
STAGES.push(['13단계 · 작업면 · 가지 키', async () => {
  await freshBook()
  await deselect()
  await panel6().locator('.insp-row.seg button', { hasText: '가로' }).click(); await p.waitForTimeout(350)
  const stage = p.locator('.stage').first()
  const st = () => stage.evaluate((n) => { const c = getComputedStyle(n); return {
    ox: c.overflowX, oy: c.overflowY, bg: c.backgroundColor, sw: n.scrollWidth, cw: n.clientWidth, sh: n.scrollHeight, ch: n.clientHeight, sl: n.scrollLeft } })
  /** 종이 자리(넓이 div 안 좌표)와 배율 — 화면 좌표는 굴리면 바뀌므로 쓰지 않는다. */
  const paper = () => p.locator('.stage .pv-paper').evaluate((n) => ({ left: parseFloat(n.style.left), top: parseFloat(n.style.top), w: parseFloat(n.style.width) }))
  const spots = () => layer().locator('.fel').evaluateAll((ns) => ns.map((n) => [parseFloat(n.style.left), parseFloat(n.style.top), parseFloat(n.style.width), parseFloat(n.style.height)]))
  const inPaper = async () => (await spots()).every(([x, y, w, h]) => x >= 0 && y >= 0 && x + w <= 640 && y + h <= 482)
  const pct = async () => parseInt(await p.locator('.pv-zoom .v').innerText(), 10)

  const s0 = await st()
  ok('[작업면] 「미리보기」 글자 줄이 없다', (await p.locator('.pv-h').count()) === 0)
  const cardBg = await p.locator('.stage .pwc-bg > div > *').first().evaluate((n) => getComputedStyle(n).backgroundColor)
  ok('[작업면] 뒷바탕이 따로 없다 — 작업면 색 = **그 쪽의 바탕색**', s0.bg === cardBg && s0.bg !== 'rgba(0, 0, 0, 0)', `${s0.bg} / ${cardBg}`)
  ok('[작업면] 슬라이드 **테두리 선 · 그림자가 없다**', await p.locator('.stage .pv-paper').evaluate((n) => getComputedStyle(n).outlineStyle === 'none')
    && await p.locator('.stage .pwc-bg').evaluate((n) => getComputedStyle(n).overflow === 'hidden'))
  ok('[작업면] 종이 안에만 있을 때 막대가 없다', s0.ox === 'hidden' && s0.oy === 'hidden', JSON.stringify(s0))
  const sbox = await stage.boundingBox()
  const wrap = await p.locator('.ax-stage-wrap').boundingBox()
  ok('[작업면] 작업면이 가운데 칸의 **폭을 꽉** 채운다', Math.abs(sbox.width - wrap.width) < 1 && Math.abs(sbox.x - wrap.x) < 1, `${Math.round(sbox.width)} / ${Math.round(wrap.width)}`)

  // 영상의 그림 — 종이 오른쪽 끝 가까이에 상자를 놓고, 파란 ＋ 점(오른쪽)으로 하나 더 붙인다.
  const lb = await layer().boundingBox(); const z = lb.width / 640
  await p.keyboard.press('r')
  await p.mouse.click(lb.x + 540 * z, lb.y + 240 * z); await p.waitForTimeout(250)
  await deselect()
  const p0 = await paper(), z0 = await pct()
  const first = layer().locator('.fel').first()
  await first.hover(); await p.waitForTimeout(200)
  const dots = await layer().locator('.cpt').evaluateAll((ns) => ns.map((n) => { const r = n.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2] }))
  const dot = dots.slice().sort((a, b) => b[0] - a[0])[0]
  ok('[＋ 점] (준비) 상자에 올리면 파란 점 넷이 뜬다', dots.length === 4, String(dots.length))
  // 점을 **끌어서** 종이 밖(x=700)에 놓는다 — 영상에서 한 그대로.
  await p.mouse.move(dot[0], dot[1]); await p.mouse.down()
  await p.mouse.move(lb.x + 660 * z, lb.y + 243 * z, { steps: 4 }); await p.mouse.move(lb.x + 700 * z, lb.y + 243 * z, { steps: 4 })
  await p.mouse.up(); await p.waitForTimeout(400)
  const sp = await spots()
  ok('[＋ 점] (준비) 새 상자가 **기준 크기 밖**(오른쪽)에 생겼다 — 영상의 그 상태', sp.length === 2 && sp[1][0] + sp[1][2] > 640, JSON.stringify(sp))
  const s1 = await st()
  const lw = await layer().evaluate((n) => [parseFloat(n.style.width), parseFloat(n.style.height)])
  ok('[작업면] **슬라이드가 늘어난다** — 새 상자까지가 슬라이드다(도형 층이 기준 640×482 보다 크고 비율은 같다)',
    lw[0] >= sp[1][0] + sp[1][2] && Math.abs(lw[0] / lw[1] - 640 / 482) < 0.001, JSON.stringify(lw))
  ok('[작업면] 넘친 만큼 이 창 안에서 굴려 본다', s1.ox === 'scroll' && s1.oy === 'scroll' && s1.sw > s1.cw, JSON.stringify(s1))
  const nb = await layer().locator('.fel').nth(1).boundingBox(), sb2 = await stage.boundingBox()
  ok('[작업면] 새 상자가 **창 안에 다 보인다**(그 상자로 굴렸다)', nb.x >= sb2.x && nb.x + nb.width <= sb2.x + sb2.width && nb.y >= sb2.y && nb.y + nb.height <= sb2.y + sb2.height,
    `상자 ${Math.round(nb.x)}~${Math.round(nb.x + nb.width)} · 창 ${Math.round(sb2.x)}~${Math.round(sb2.x + sb2.width)} · 굴린 양 ${s1.sl}`)
  ok('[작업면] 종이 밖으로 나간 **선이 잘리지 않는다**', (await layer().locator('svg.freeconn').evaluate((n) => getComputedStyle(n).overflow)) === 'visible')
  const capTxt = (await p.locator('.pv-cap').innerText()).replace(/\s+/g, ' ')
  ok('[작업면] 「이북에는 N% 로 줄여 담김」 을 알려 준다(「안 담김」 이 아니다)', /이북에는 \d+% 로 줄여 담김/.test(capTxt) && !/안 담김/.test(capTxt), capTxt.slice(-40))
  // 같은 상태(아무것도 안 고름)끼리 견준다 — 글을 고치는 동안에는 위 도구줄 높이가 달라져 작업면 높이도 몇 px 달라진다.
  await deselect()
  const p1 = await paper()
  ok('[작업면] 슬라이드 자리 · 배율이 **그대로**다(밀리지 않고 오른쪽 · 아래로만 늘어난다)', p1.left === p0.left && p1.top === p0.top && p1.w > p0.w && (await pct()) === z0, `${JSON.stringify(p0)} → ${JSON.stringify(p1)}`)
  if (SHOT_DIR) await p.locator('.ax-stage-wrap').screenshot({ path: SHOT_DIR + '/s9/stage13_off_paper.png' })

  // **한 장에 전부 담긴다** — 쪽 목록 그림 · 내보내기 노드 · 발표. 두 상자의 경계가 모두 그 장 안에 있어야 한다.
  const allInside = (rootSel) => p.evaluate((sel) => Array.from(document.querySelectorAll(sel)).map((root) => {
    const r = root.getBoundingClientRect()
    const fs = Array.from(root.querySelectorAll('.fel')).map((n) => n.getBoundingClientRect())
    return { n: fs.length, ok: fs.every((f) => f.left >= r.left - 0.5 && f.top >= r.top - 0.5 && f.right <= r.right + 0.5 && f.bottom <= r.bottom + 0.5) }
  }).filter((v) => v.n > 0), rootSel)
  const film = await allInside('.axth.on .axth-mini')
  ok('[한 장에] **쪽 목록 그림**에 두 상자가 모두 들어 있다(줄여 담김)', film.length === 1 && film[0].n === 2 && film[0].ok, JSON.stringify(film))
  const exp = await allInside('[id^="export-page-"]')
  ok('[한 장에] **내보내기(이북 PNG · PDF)** 장에 두 상자가 모두 들어 있다', exp.length === 1 && exp[0].n === 2 && exp[0].ok, JSON.stringify(exp))
  if (SHOT_DIR) await p.locator('.axth.on').screenshot({ path: SHOT_DIR + '/s9/stage13_film_shrunk.png' })

  // 확대는 그대로 있다
  await deselect()
  await p.locator('.pv-zoom button', { hasText: '+' }).first().click(); await p.waitForTimeout(250)
  ok('[작업면] 확대(+)가 그대로 듣는다', (await pct()) > z0, `${z0}% → ${await pct()}%`)
  await p.locator('.pv-zoom .fitb').click(); await p.waitForTimeout(250)
  ok('[작업면] 「맞춤」 이 처음 배율로 되돌린다', (await pct()) === z0, `${await pct()}%`)

  // 발표는 종이에서 자른다(이북과 같게)
  await p.keyboard.press('F5'); await p.waitForTimeout(400)
  const pres = await allInside('.present .ptrans > div')
  ok('[한 장에] **발표**에도 두 상자가 모두 보인다(잘리지 않고 줄여 담김)', pres.length === 1 && pres[0].n === 2 && pres[0].ok, JSON.stringify(pres))
  if (SHOT_DIR) await p.screenshot({ path: SHOT_DIR + '/s9/stage13_present.png' })
  await p.keyboard.press('Escape'); await p.waitForTimeout(300)

  // ── 알마인드식 가지 키 ──
  await deselect()
  await layer().locator('.fel').first().click(); await p.waitForTimeout(200)
  await p.keyboard.press('Space'); await p.waitForTimeout(450)
  ok('[가지 키] Space = 자식 — 상자가 하나 는다(2 → 3)', (await layer().locator('.fel').count()) === 3, String(await layer().locator('.fel').count()))
  ok('[가지 키] 붙이자마자 **글을 친다**(글칸에 초점)', await p.evaluate(() => !!document.activeElement && document.activeElement.isContentEditable))
  ok('[가지 키] 붙이면 묶음이 **기준 크기 안에 다시 앉는다**', await inPaper(), JSON.stringify(await spots()))
  const s2 = await st()
  ok('[가지 키] 넘치는 것이 없어지니 슬라이드가 제 크기로 돌아온다 — 막대도 · 안내도 없다', s2.ox === 'hidden' && s2.oy === 'hidden' && (await p.locator('.pv-out').count()) === 0, JSON.stringify(s2))
  await p.keyboard.type('alpha'); await p.keyboard.press('Enter'); await p.waitForTimeout(300)
  ok('[가지 키] 글칸의 Enter = 글 끝내기(저장) — 줄을 나누지 않는다',
    (await layer().locator('.fel', { hasText: 'alpha' }).count()) === 1 && !(await p.evaluate(() => !!document.activeElement && document.activeElement.isContentEditable)))
  await p.keyboard.press('Enter'); await p.waitForTimeout(450)
  ok('[가지 키] 이어서 Enter = 형제(3 → 4)', (await layer().locator('.fel').count()) === 4, String(await layer().locator('.fel').count()))
  await p.keyboard.type('beta'); await p.keyboard.press('Enter'); await p.waitForTimeout(300)
  const ya = (await layer().locator('.fel', { hasText: 'alpha' }).evaluate((n) => parseFloat(n.style.top)))
  const yb = (await layer().locator('.fel', { hasText: 'beta' }).evaluate((n) => parseFloat(n.style.top)))
  ok('[가지 키] 형제는 고른 상자 **바로 아래**에 앉는다', yb > ya, `alpha ${ya} · beta ${yb}`)
  await p.keyboard.press('Shift+Enter'); await p.waitForTimeout(450)
  await p.keyboard.type('mid'); await p.keyboard.press('Enter'); await p.waitForTimeout(300)
  const ym = (await layer().locator('.fel', { hasText: 'mid' }).evaluate((n) => parseFloat(n.style.top)))
  const yb2 = (await layer().locator('.fel', { hasText: 'beta' }).evaluate((n) => parseFloat(n.style.top)))
  ok('[가지 키] Shift+Enter = 앞 형제 — alpha · mid · beta 순', ya < ym && ym < yb2, `alpha ${ya} · mid ${ym} · beta ${yb2}`)
  ok('[가지 키] 다섯 상자가 모두 종이 안 · 겹침 없음', (await inPaper()) && await (async () => {
    const v = await spots(); for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) {
      const a = v[i], b2 = v[j]; if (a[0] < b2[0] + b2[2] && b2[0] < a[0] + a[2] && a[1] < b2[1] + b2[3] && b2[1] < a[1] + a[3]) return false }
    return true })(), JSON.stringify(await spots()))
  if (SHOT_DIR) await p.locator('.ax-stage-wrap').screenshot({ path: SHOT_DIR + '/s9/stage13_mind_keys.png' })

  // 방향키 = 토픽 이동(고른 상자가 바뀌고 자리는 그대로) · Alt+방향키 = 1px
  const selText = () => p.locator('.stage .fel.sel').first().innerText().catch(() => '')
  const before = await spots()
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(200)
  ok('[가지 키] ↓ = 다음 형제(mid → beta)로 **고른 것이 옮겨 간다**', (await selText()).trim() === 'beta', await selText())
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(200)
  ok('[가지 키] ← = 부모로', (await selText()).trim() !== 'beta' && (await selText()).trim() !== '', await selText())
  ok('[가지 키] 방향키로는 **상자가 움직이지 않는다**', JSON.stringify(await spots()) === JSON.stringify(before))
  // 첫 자식은 파란 ＋ 점으로 먼저 붙인 상자(맨 윗줄)다. 거기서 ↓ 가 alpha.
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(200)
  const selTop = await p.locator('.stage .fel.sel').first().evaluate((n) => parseFloat(n.style.top)).catch(() => -1)
  ok('[가지 키] → = **첫 자식**(맨 윗줄 상자)', selTop === Math.min(...before.filter((v) => v[0] > 24).map((v) => v[1])), String(selTop))
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(200)
  ok('[가지 키] ↓ = 그 아래 형제(alpha)', (await selText()).trim() === 'alpha', await selText())
  await p.keyboard.press('Alt+ArrowRight'); await p.waitForTimeout(200)
  const moved = await layer().locator('.fel', { hasText: 'alpha' }).evaluate((n) => parseFloat(n.style.left))
  const was = before[(await layer().locator('.fel').evaluateAll((ns) => ns.findIndex((n) => n.textContent.trim() === 'alpha')))][0]
  ok('[가지 키] Alt+→ = 1px 이동(예전 방향키)', moved === was + 1, `${was} → ${moved}`)

  // Delete = 가지째 · ⌘Z 로 돌아온다
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(200)        // 부모(첫 상자)
  const n0 = await layer().locator('.fel').count()
  await p.keyboard.press('Delete'); await p.waitForTimeout(350)
  ok('[가지 키] Delete = **가지째** 지운다(고른 상자 + 그 아래 전부)', (await layer().locator('.fel').count()) === 0, `${n0} → ${await layer().locator('.fel').count()}`)
  await p.keyboard.press('ControlOrMeta+z'); await p.waitForTimeout(350)
  ok('[가지 키] ⌘/Ctrl+Z 한 번으로 돌아온다', (await layer().locator('.fel').count()) === n0, String(await layer().locator('.fel').count()))

  // **Space 가 확대/축소 단추를 누르던 것**(화면 기록 오후 5.10.16 — 배율이 100 → 80 → 64% 로 내려가 있었다).
  // 배율 단추를 누르면 초점이 그 단추에 남고, 도형을 눌러도 초점은 안 옮겨 가서 Space 가 단추를 또 눌렀다.
  await deselect()
  await p.locator('.pv-zoom button', { hasText: '−' }).first().click(); await p.waitForTimeout(250)
  const zA = await pct(), nA = await layer().locator('.fel').count()
  await layer().locator('.fel', { hasText: 'beta' }).first().click(); await p.waitForTimeout(200)
  await p.keyboard.press('Space'); await p.waitForTimeout(450)
  ok('[가지 키] 배율 단추를 누른 뒤 도형을 고르고 Space — **배율은 그대로, 자식이 붙는다**',
    (await pct()) === zA && (await layer().locator('.fel').count()) === nA + 1, `배율 ${zA}% → ${await pct()}% · 상자 ${nA} → ${await layer().locator('.fel').count()}`)
  await p.keyboard.press('Enter'); await p.waitForTimeout(250)                   // 글 끝내기(고른 채로 남는다)
  // 도형을 고른 채 배율 단추를 누르고 곧바로 Space — 단추가 초점을 가져가지 않는다.
  await p.locator('.pv-zoom button', { hasText: '+' }).first().click(); await p.waitForTimeout(250)
  const zB = await pct(), nB = await layer().locator('.fel').count()
  await p.keyboard.press('Space'); await p.waitForTimeout(450)
  ok('[가지 키] 도형을 고른 채 배율 단추를 누르고 바로 Space — 배율은 그대로, 자식이 붙는다',
    (await pct()) === zB && (await layer().locator('.fel').count()) === nB + 1, `배율 ${zB}% → ${await pct()}% · 상자 ${nB} → ${await layer().locator('.fel').count()}`)
  await p.keyboard.press('Escape'); await p.locator('.pv-zoom .fitb').click(); await p.waitForTimeout(200)
}])

// 2026-10-06 · 화면 기록 오후 5.10.16 — 자식 다섯 + 손자, 거기서 **넷째 단**. 가로 종이는 세 단까지라 아래 띠로 접히며
// 위 띠와 포개졌다(흐린 상자가 끼어들고 상자가 겹침). 이제 포개지 않고 더 큰 슬라이드에 앉힌다(tree_keys.test.mjs 7번).
STAGES.push(['13단계 · 넷째 단(영상의 그림)', async () => {
  await freshBook()
  await deselect()
  await panel6().locator('.insp-row.seg button', { hasText: '가로' }).click(); await p.waitForTimeout(350)
  const lb = await layer().boundingBox(); const z = lb.width / 640
  await p.keyboard.press('r'); await p.mouse.click(lb.x + 120 * z, lb.y + 240 * z); await p.waitForTimeout(250)
  const key = async (k, n = 1) => { for (let i = 0; i < n; i++) { await p.keyboard.press(k); await p.waitForTimeout(260) } }
  await key('Space'); await key('Enter')                       // 자식 1 (글 끝내기)
  for (let i = 0; i < 4; i++) { await key('Enter'); await key('Enter') }   // 형제 넷 → 자식 다섯
  await key('ArrowUp', 4)                                      // 첫 자식으로
  await key('Space'); await key('Enter')                       // 손자(셋째 단)
  const spots = () => layer().locator('.fel').evaluateAll((ns) => ns.map((n) => [parseFloat(n.style.left), parseFloat(n.style.top), parseFloat(n.style.width), parseFloat(n.style.height)]))
  const overlaps = (v) => { let n = 0; for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) {
    const a = v[i], b2 = v[j]; if (a[0] < b2[0] + b2[2] && b2[0] < a[0] + a[2] && a[1] < b2[1] + b2[3] && b2[1] < a[1] + a[3]) n++ } return n }
  const v0 = await spots()
  ok('[넷째 단] (준비) 뿌리 + 자식 다섯 + 손자 = 일곱 · 겹침 없음', v0.length === 7 && overlaps(v0) === 0, `${v0.length}개 · 겹친 쌍 ${overlaps(v0)}`)
  await key('Space'); await key('Enter')                       // 넷째 단 — 영상에서 뒤엉킨 자리
  const v1 = await spots()
  ok('[넷째 단] 손자에 자식을 붙여도 **포개지지 않는다**(흐린 상자도 안 끼어든다)', v1.length === 8 && overlaps(v1) === 0, `${v1.length}개 · 겹친 쌍 ${overlaps(v1)} · ${JSON.stringify(v1.map((a) => [a[0], a[1]]))}`)
  await key('Enter'); await key('Enter'); await key('Enter'); await key('Enter')   // 그 형제 둘
  const v2 = await spots()
  ok('[넷째 단] 거기에 형제를 더 붙여도 겹침 없음', v2.length === 10 && overlaps(v2) === 0, `${v2.length}개 · 겹친 쌍 ${overlaps(v2)}`)
  const cap = (await p.locator('.pv-cap').innerText()).replace(/\s+/g, ' ')
  ok('[넷째 단] 종이에 다 안 들어가면 슬라이드가 늘어난다 — 「줄여 담김」 안내', v2.some((a) => a[0] + a[2] > 640 || a[1] + a[3] > 482) && /줄여 담김/.test(cap), cap.slice(-30))
  if (SHOT_DIR) { await deselect(); await p.locator('.ax-stage-wrap').screenshot({ path: SHOT_DIR + '/s9/stage13_fourth_level.png' }); await p.locator('.axth.on').screenshot({ path: SHOT_DIR + '/s9/stage13_fourth_level_film.png' }) }
}])

// ONLY=5단계 처럼 주면 그 이름이 든 단계만 돈다(고치는 동안 빨리 돌리려고). 비우면 전부.
const ONLY = process.env.ONLY || ''
for (const [name, run] of STAGES) {
  if (ONLY && !name.includes(ONLY)) continue
  console.log(`\n# ${name}`)
  try { await run() } catch (e) { ok(`${name} 실행 중 예외 없음`, false, String(e && e.message || e)) }
}

ok('페이지 오류 없음(pageerror)', errs.length === 0, errs.join(' | '))
await b.close()
console.log(fail ? `\n=== FAIL (${fail}) ===` : '\n=== ALL PASS ===')
process.exit(fail ? 1 : 0)
