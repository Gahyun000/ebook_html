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

// ── (2단계부터 여기에 덧붙인다) ────────────────────────────

for (const [name, run] of STAGES) {
  console.log(`\n# ${name}`)
  try { await run() } catch (e) { ok(`${name} 실행 중 예외 없음`, false, String(e && e.message || e)) }
}

ok('페이지 오류 없음(pageerror)', errs.length === 0, errs.join(' | '))
await b.close()
console.log(fail ? `\n=== FAIL (${fail}) ===` : '\n=== ALL PASS ===')
process.exit(fail ? 1 : 0)
