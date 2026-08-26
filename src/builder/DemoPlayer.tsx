import { useEffect, useRef, useState } from 'react'
import { useBuilder } from '../state/store'
import type { Page } from '../state/store'

// 인앱 가이드(예시영상) — 영상 파일 없이 앱이 실제 컴포넌트로 이북을 단계별 시연.
// 시작 시 현재 작업물을 스냅샷 → 데모 재생 → 종료 시 복원(사용자 작업 격리).

interface Snap { title: string; orientation: 'portrait' | 'landscape'; font: string; size: 's' | 'm' | 'l'; pages: Page[]; selectedPageId: number | null }
interface Step { cap: string; run: () => void; wait: number; hi?: string }

const g = () => useBuilder.getState()

const STEPS: Step[] = [
  { cap: '예시로 사업모델 이북 한 권을 함께 만들어 볼게요. 편히 보세요.', run: () => {}, wait: 1600 },
  { cap: '① 왼쪽에서 표지 카드를 추가합니다.', run: () => g().addCard('cover'), wait: 1500, hi: '.side.left' },
  { cap: '제목을 우리 회사 이름으로 바꿉니다.', run: () => { const id = g().selectedPageId!; g().updateField(id, 'title', '유니에버 품질 AX') }, wait: 1500 },
  { cap: '부제도 한 줄 적어요.', run: () => { const id = g().selectedPageId!; g().updateField(id, 'sub', '2026 경영보고') }, wait: 1300 },
  { cap: '② 로드맵 카드를 더합니다.', run: () => g().addCard('roadmap'), wait: 1500 },
  { cap: '단계를 채웁니다 — 예시가 미리 들어 있어 고쳐 쓰기만 하면 돼요.', run: () => { const id = g().selectedPageId!; g().updateField(id, 'title', '추진 로드맵'); g().updateField(id, 'p1', 'PoC : 1분기'); g().updateField(id, 'p2', '확산 : 3분기') }, wait: 1900 },
  { cap: '③ 성과(KPI) 카드로 숫자를 보여줍니다.', run: () => { g().addCard('kpi'); const id = g().selectedPageId!; g().updateField(id, 'k1', '불량률:-30%'); g().updateField(id, 'k2', '검사시간:-40%'); g().updateField(id, 'k3', 'ROI:14개월') }, wait: 1900 },
  { cap: '④ 빈 페이지 + 토글로 자유로운 틀도 짤 수 있어요.', run: () => g().addCard('note'), wait: 1600 },
  { cap: '가로 덱으로 바꾸면 발표용 슬라이드가 됩니다.', run: () => g().setOrientation('landscape'), wait: 1600 },
  { cap: '다시 세로 이북으로 돌립니다.', run: () => g().setOrientation('portrait'), wait: 1200 },
  { cap: '다 되면 오른쪽 위 「이북 만들기」를 누르면 끝이에요!', run: () => {}, wait: 2000, hi: '.make' },
  { cap: '이렇게 몇 분이면 한 권이 완성됩니다. 이제 직접 해보세요! 👋', run: () => {}, wait: 2200 },
]

export default function DemoPlayer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const [hi, setHi] = useState<string | null>(null)
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const snapRef = useRef<Snap | null>(null)
  const doneRef = useRef<Set<number>>(new Set())

  function capture(): Snap { const s = g(); return { title: s.title, orientation: s.orientation, font: s.font, size: s.size, pages: s.pages, selectedPageId: s.selectedPageId } }
  function resetForDemo() { useBuilder.setState({ pages: [], selectedPageId: null, orientation: 'portrait', size: 'm', font: 'auto', title: '유니에버 품질 AX' }) }

  // open/close 전환: 스냅샷 → 리셋 / 복원
  useEffect(() => {
    if (open) {
      snapRef.current = capture()
      resetForDemo()
      doneRef.current.clear()
      setIdx(0); setPaused(false)
    } else if (snapRef.current) {
      useBuilder.setState(snapRef.current)
      snapRef.current = null
      setHi(null)
    }
  }, [open])

  // 단계 재생
  useEffect(() => {
    if (!open || paused || idx >= STEPS.length) return
    if (!doneRef.current.has(idx)) { STEPS[idx].run(); doneRef.current.add(idx) }
    setHi(STEPS[idx].hi || null)
    const t = setTimeout(() => setIdx((i) => i + 1), STEPS[idx].wait)
    return () => clearTimeout(t)
  }, [open, paused, idx])

  // 하이라이트 링 위치 추적
  useEffect(() => {
    if (!hi) { setRect(null); return }
    const upd = () => { const el = document.querySelector(hi); if (el) { const r = el.getBoundingClientRect(); setRect({ x: r.left, y: r.top, w: r.width, h: r.height }) } }
    upd(); const iv = setInterval(upd, 250)
    return () => clearInterval(iv)
  }, [hi])

  if (!open) return null
  const finished = idx >= STEPS.length
  const cur = Math.min(idx, STEPS.length - 1)

  function restart() { resetForDemo(); doneRef.current.clear(); setIdx(0); setPaused(false) }

  return (
    <>
      {rect ? <div className="demo-ring" style={{ left: rect.x - 6, top: rect.y - 6, width: rect.w + 12, height: rect.h + 12 }} /> : null}
      <div className="demo-badge">● 예시영상 재생 중</div>
      <div className="demo-bar">
        <div className="demo-cap">{finished ? STEPS[STEPS.length - 1].cap : STEPS[cur].cap}</div>
        <div className="demo-dots">
          {STEPS.map((_, i) => <span key={i} className={'demo-dot' + (i <= cur ? ' on' : '')} />)}
        </div>
        <div className="demo-ctrls">
          {finished
            ? <button className="demo-btn" onClick={restart}>↻ 다시 보기</button>
            : <button className="demo-btn" onClick={() => setPaused((p) => !p)}>{paused ? '▶ 재생' : '⏸ 일시정지'}</button>}
          <button className="demo-btn" onClick={restart} title="처음부터">↻</button>
          <button className="demo-btn close" onClick={onClose}>✕ 닫기</button>
        </div>
      </div>
    </>
  )
}
