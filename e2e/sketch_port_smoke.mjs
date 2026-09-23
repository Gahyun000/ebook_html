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
  ok('[표3] 남은 행의 높이는 그대로다', Math.abs(rh1 - rh0) < 1.5, `${rh0.toFixed(1)} → ${rh1.toFixed(1)}`)

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
