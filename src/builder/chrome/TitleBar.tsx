import { useBuilder } from '../../state/store'

export default function TitleBar({ onPresent }: { onPresent: () => void }) {
  const title = useBuilder((s) => s.title)
  const setTitle = useBuilder((s) => s.setTitle)
  // 한글은 폭이 약 1em, 라틴/숫자는 약 0.58em — 내용에 맞춰 입력 폭 산정(잘림 방지)
  const units = [...(title || '')].reduce((n, c) => n + (/[ -ÿ]/.test(c) ? 0.58 : 1.02), 0)
  const w = Math.min(Math.max(units + 1.4, 6), 40)
  return (
    <div className="ax-title">
      <div className="logo">AX</div>
      <input className="ttl" style={{ width: w + 'em' }} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="문서 제목" />
      <span className="save" title="자동 저장"><span className="dot" />저장됨</span>
      <span className="sp" />
      <button className="rbtn" onClick={onPresent} title="구글 슬라이드식 슬라이드쇼">▷ 슬라이드쇼 ▾</button>
      <button className="rbtn pri" onClick={() => window.dispatchEvent(new CustomEvent('ebook:build'))} title="이북(PDF) 만들기 / 공유">↥ 공유</button>
      <div className="av">가</div>
    </div>
  )
}
