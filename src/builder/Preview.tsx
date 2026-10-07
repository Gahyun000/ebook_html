import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useBuilder } from '../state/store'
import PageWithCanvas from '../cards/PageWithCanvas'
import { pageSize } from '../cards/sizing'
import { useKey } from '../ui/keyLabel'
import { fitScale, stepZoom, zoomKey } from './zoom'
import { EDGE, fitAvail, growOf, layout, revealScroll, strayCount } from './workArea'
import { useCanvasUI } from '../state/canvasUI'
import { tocItems } from './util'

/**
 * 미리보기(작업창).
 *
 * 종이는 **여기서 배율을 곱해 그린다**(EVER-SKETCH1 b721df0 맞춤 배율 · 1363964 사람이 바꾸는 배율).
 * 좌표계는 건드리지 않는다 — FreeEl 의 x/y 는 언제나 논리 좌표이고, 화면 배율은 FreeLayer 가
 * 자기 DOM 폭에서 되읽어 마우스 좌표를 나눈다(FreeLayer.zoomOf).
 * 배율을 좌표에 섞어 저장하면 창 크기에 따라 문서가 달라진다.
 *
 * **창 전체가 슬라이드다**(2026-10-06). 테두리도 뒷바탕도 없다 — 작업면은 그 쪽의 바탕색을 그대로 잇는다.
 * 도형이 기준 크기를 넘으면 슬라이드가 같은 비율로 늘어나고(workArea.growOf), 넘친 만큼 이 창 안에서 굴려 본다.
 * 이북 · 쪽 목록 · 발표에는 늘어난 슬라이드를 통째로 줄여 한 장에 담는다(cards/PageWithCanvas).
 * 막대가 설지 · 슬라이드가 어디 놓일지는 workArea 가 도형 좌표에서 정한다 — 화면을 되재지 않는다.
 */

/** 늘 보이는 스크롤 막대의 두께. 겹쳐 뜨는 막대(맥 기본)면 0. */
function barSize(): number {
  const d = document.createElement('div')
  d.style.cssText = 'position:absolute;top:-999px;width:80px;height:80px;overflow:scroll'
  document.body.appendChild(d)
  const n = d.offsetWidth - d.clientWidth
  d.remove()
  return n
}

export default function Preview() {
  const K = useKey()
  const pages = useBuilder((s) => s.pages)
  const selId = useBuilder((s) => s.selectedPageId)
  const orientation = useBuilder((s) => s.orientation)
  const size = useBuilder((s) => s.size)
  const font = useBuilder((s) => s.font)
  const title = useBuilder((s) => s.title)
  const page = pages.find((p) => p.id === selId)
  const items = tocItems(pages)
  const land = orientation === 'landscape'
  const { W, H } = pageSize(orientation)

  const stageRef = useRef<HTMLDivElement>(null)
  // 맞춤 배율(창에 맞춰 자동)과 사람이 정한 배율을 **따로** 둔다. null = 맞춤.
  // 한 값에 합치면 창 크기가 바뀔 때마다 「사람이 정한 걸 덮을까 말까」를 따져야 한다.
  const [fitZ, setFitZ] = useState(1)
  const [view, setView] = useState({ w: 0, h: 0 })
  const [sb] = useState(barSize)
  const [userZoom, setUserZoom] = useState<number | null>(null)
  const scale = userZoom ?? fitZ

  useEffect(() => {
    const node = stageRef.current
    if (!node) return
    const fit = () => {
      const r = node.getBoundingClientRect()
      // 막대 자리는 **늘** 뺀다 — 종이 밖 도형이 생겨 막대가 서도 배율이 안 바뀐다.
      const av = fitAvail(r.width, r.height, sb)
      const s = fitScale(av.w, av.h, W, H)
      if (s != null) setFitZ(s)
      setView((v) => (v.w === r.width && v.h === r.height ? v : { w: r.width, h: r.height }))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(node)
    return () => ro.disconnect()
  }, [W, H, sb])

  // 방향이 바뀌면 맞춤으로 되돌린다 — 세로에 맞춰 둔 배율이 가로에서 맞을 리 없다.
  useEffect(() => { setUserZoom(null) }, [W, H])

  const zoomBy = (dir: 'in' | 'out') => setUserZoom((z) => stepZoom(z ?? fitZ, dir))

  // ⌘/Ctrl + = − 0. 글자를 치는 중에는 가로채지 않는다(zoomKey).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const a = zoomKey(e)
      if (!a) return
      e.preventDefault()
      if (a === 'fit') setUserZoom(null); else zoomBy(a)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Ctrl + 휠. React 의 onWheel 은 passive 라 preventDefault 가 안 먹는다 —
  // 그러면 브라우저가 페이지 자체를 확대해 버린다. 직접 붙인다.
  useEffect(() => {
    const node = stageRef.current
    if (!node) return
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      zoomBy(e.deltaY < 0 ? 'in' : 'out')
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  })

  const pct = Math.round(scale * 100)

  // **누르고 있는 동안에는 슬라이드를 줄이지 않는다.** 굴려 둔 채 상자를 안쪽으로 끌면 넓이가 줄며
  // 브라우저가 스크롤을 당기고, FreeLayer 가 누를 때 잰 자리와 어긋난다. 뗄 때 다시 잰다.
  const downRef = useRef(false)
  const keepRef = useRef(1)
  const [, bump] = useState(0)
  useEffect(() => {
    const down = (e: PointerEvent) => {
      downRef.current = true
      // **작업면을 누르면 단추에 남은 초점을 푼다.** 도형은 누를 때 preventDefault 로 끌기를 시작해서 초점이 안 옮겨 온다 —
      // 그러면 방금 누른 단추(배율 − 등)가 초점을 쥔 채라, Space 가 가지를 붙이는 대신 그 단추를 또 누른다(2026-10-06).
      const a = document.activeElement as HTMLElement | null
      const node = stageRef.current
      if (a && node && node.contains(e.target as Node) && (a.tagName === 'BUTTON' || a.tagName === 'A' || a.tagName === 'SELECT')) a.blur()
    }
    const up = () => { downRef.current = false; bump((n) => n + 1) }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', up, true)
    return () => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', up, true)
    }
  }, [])
  const rawK = page ? growOf(page.els, page.strokes, W, H) : 1
  const k = downRef.current ? Math.max(rawK, keepRef.current) : rawK
  keepRef.current = k
  const stray = strayCount(page ? page.els : [])
  const lay = layout(view.w, view.h, sb, W, H, scale, k)

  // 작업면 바탕 = 그 쪽의 바탕색. 카드마다 · 테마마다 바탕을 정하는 곳이 달라, 그려진 것에서 읽는다.
  const theme = useBuilder((s) => s.theme)
  const [bg, setBg] = useState('#fff')
  useLayoutEffect(() => {
    const card = stageRef.current ? stageRef.current.querySelector('.pwc-bg > div > *') : null
    const c = card ? getComputedStyle(card).backgroundColor : ''
    const next = !c || c === 'transparent' || c === 'rgba(0, 0, 0, 0)' ? '#fff' : c
    if (next !== bg) setBg(next)
  }, [page, theme, bg])

  // **새 상자로 화면을 옮긴다** — 넓이가 새 크기로 놓인 뒤, 그리기 전에. 전에는 글칸에 초점을 줄 때
  // 브라우저가 알아서 굴렸다(그래서 종이가 밀렸다). 이제는 여기서만, 이 창만 굴린다.
  const revealId = useCanvasUI((s) => s.revealId)
  const setReveal = useCanvasUI((s) => s.setReveal)
  // 놓는 도구(도형 · 글상자 · 표 …)를 들고 있는가 — 고르기 · 연결선 · 펜 · 형광펜 · 지우개는 종이 밖에서도 뜻이 있어 빼고, 나머지는 종이 안에서만 놓인다.
  const tool = useCanvasUI((s) => s.tool)
  const placing = tool !== 'select' && tool !== 'connect' && tool !== 'pen' && tool !== 'highlighter' && tool !== 'eraser'
  useLayoutEffect(() => {
    if (revealId == null) return
    const node = stageRef.current
    const el = page ? page.els.find((e) => e.id === revealId) : null
    if (node && el) {
      const to = revealScroll(
        { w: node.clientWidth, h: node.clientHeight }, { x: node.scrollLeft, y: node.scrollTop },
        { x: lay.offX + el.x * scale, y: lay.offY + el.y * scale, w: el.w * scale, h: el.h * scale }, EDGE)
      node.scrollTo(to.x, to.y)
    }
    setReveal(null)
  })

  return (<>
    <div className="stage" ref={stageRef} style={{ overflowX: lay.needX ? 'scroll' : 'hidden', overflowY: lay.needY ? 'scroll' : 'hidden', background: bg }}
      // **종이 밖 빈 곳에서 끌면 고르기**(2026-10-07 · 불편점 4번). 종이(.pv-paper) 안은 FreeLayer 가 직접 받는다.
      onPointerDown={(e) => {
        if (e.button !== 0 || useCanvasUI.getState().tool !== 'select') return
        if ((e.target as HTMLElement).closest('.pv-paper')) return
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('ebook:marquee', { detail: { x: e.clientX, y: e.clientY } }))
      }}>
      {page
        ? (
          // 가운데 두기는 workArea.layout 이 맡는다 — 종이가 작업창보다 커지면 왼쪽 위 여백부터 구른다.
          <div className="pv-ext" style={{ width: lay.extW, height: lay.extH }}>
            {/* **놓는 중에는 종이의 가장자리를 점선으로 보인다**(2026-10-07 · 사용자: 「좌우로 안 보이는 경계선이 있는 것 같은데」). 작업면은 종이와 같은 색이고
                테두리가 없어(「창 전체가 슬라이드다」) 종이 밖 여백을 눌러도 아무 일이 없는 까닭을 알 수 없었다. 도구를 내려놓으면 사라진다. */}
            <div className={'pv-paper' + (placing ? ' placing' : '')} style={{ left: lay.offX, top: lay.offY, width: W * k * scale, height: H * k * scale }}>
              <div style={{ width: W * k, height: H * k, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                <PageWithCanvas page={page} docTitle={title} orientation={orientation} size={size} font={font} tocItems={items} interactive={true} grow={k} />
              </div>
            </div>
          </div>
        )
        : <div className="pv-empty">카드를 추가하세요</div>}
    </div>
    <div className="pv-cap">
      {land ? '가로 덱 (1.33:1)' : '세로 이북 (0.75:1)'}
      {' · '}
      {/* 배율은 여태 바꿀 수단이 없었다. 「맞춤」은 창에 맞추는 자동 상태로 되돌린다. */}
      {/* 배율 단추는 **초점을 가져가지 않는다** — 도형을 고른 채 배율을 바꾸고 바로 Space · Enter 를 치면 가지가 붙어야 한다. */}
      <span className="pv-zoom" onMouseDown={(e) => e.preventDefault()}>
        <button title={`축소 (${K('mod+-')})`} onClick={() => zoomBy('out')}>−</button>
        <span className="v" title="화면 배율">{pct}%</span>
        <button title={`확대 (${K('mod+=')})`} onClick={() => zoomBy('in')}>+</button>
        <button className={'fitb' + (userZoom === null ? ' on' : '')}
          title={`창에 맞추기 (${K('mod+0')})`} onClick={() => setUserZoom(null)}>맞춤</button>
      </span>
      {' · '}{font === 'auto' ? '자동 폰트' : '커스텀 폰트'} · 크기 {size === 's' ? '작게' : size === 'l' ? '크게' : '보통'}
      {/* 늘어난 슬라이드는 이북 · PDF · 발표 · 쪽 목록에 통째로 줄여 한 장에 담긴다. */}
      {k > 1 ? <span className="pv-out" title="슬라이드가 기준 크기보다 커졌습니다. 이북 · PDF · 발표에는 전체를 줄여 한 장에 담습니다">{' · '}이북에는 {Math.round(100 / k)}% 로 줄여 담김</span> : null}
      {stray > 0 ? <span className="pv-out" title="왼쪽 · 위쪽으로 나간 부분은 이북에서 잘립니다">{' · '}왼쪽·위로 벗어난 {stray}개(잘림)</span> : null}
    </div>
  </>)
}
