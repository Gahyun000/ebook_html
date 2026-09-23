import { useEffect, useRef, useState } from 'react'
import { useBuilder } from '../state/store'
import PageWithCanvas from '../cards/PageWithCanvas'
import { pageSize } from '../cards/sizing'
import { useKey } from '../ui/keyLabel'
import { fitScale, stepZoom, zoomKey } from './zoom'
import { tocItems } from './util'

/**
 * 미리보기(작업창).
 *
 * 종이는 **여기서 배율을 곱해 그린다**(EVER-SKETCH1 b721df0 맞춤 배율 · 1363964 사람이 바꾸는 배율).
 * 좌표계는 건드리지 않는다 — FreeEl 의 x/y 는 언제나 논리 좌표이고, 화면 배율은 FreeLayer 가
 * 자기 DOM 폭에서 되읽어 마우스 좌표를 나눈다(FreeLayer.zoomOf).
 * 배율을 좌표에 섞어 저장하면 창 크기에 따라 문서가 달라진다.
 */
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
  const [userZoom, setUserZoom] = useState<number | null>(null)
  const scale = userZoom ?? fitZ

  useEffect(() => {
    const node = stageRef.current
    if (!node) return
    const fit = () => {
      const r = node.getBoundingClientRect()
      const s = fitScale(r.width - 32, r.height - 32, W, H)     // .stage 패딩 16px 양쪽
      if (s != null) setFitZ(s)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(node)
    return () => ro.disconnect()
  }, [W, H])

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

  return (<>
    <div className="pv-h">미리보기</div>
    <div className="stage" ref={stageRef}>
      {page
        ? (
          // 가운데 두기는 chrome.css 의 auto 여백이 맡는다 — 종이가 작업창보다 커져도 왼쪽이 안 잘린다.
          <div style={{ width: W * scale, height: H * scale, flex: '0 0 auto' }}>
            <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <PageWithCanvas page={page} docTitle={title} orientation={orientation} size={size} font={font} tocItems={items} interactive={true} />
            </div>
          </div>
        )
        : <div className="pv-empty">카드를 추가하세요</div>}
    </div>
    <div className="pv-cap">
      {land ? '가로 덱 (1.33:1)' : '세로 이북 (0.75:1)'}
      {' · '}
      {/* 배율은 여태 바꿀 수단이 없었다. 「맞춤」은 창에 맞추는 자동 상태로 되돌린다. */}
      <span className="pv-zoom">
        <button title={`축소 (${K('mod+-')})`} onClick={() => zoomBy('out')}>−</button>
        <span className="v" title="화면 배율">{pct}%</span>
        <button title={`확대 (${K('mod+=')})`} onClick={() => zoomBy('in')}>+</button>
        <button className={'fitb' + (userZoom === null ? ' on' : '')}
          title={`창에 맞추기 (${K('mod+0')})`} onClick={() => setUserZoom(null)}>맞춤</button>
      </span>
      {' · '}{font === 'auto' ? '자동 폰트' : '커스텀 폰트'} · 크기 {size === 's' ? '작게' : size === 'l' ? '크게' : '보통'}
    </div>
  </>)
}
