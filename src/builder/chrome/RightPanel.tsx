import { useEffect, useState } from 'react'
import { useBuilder } from '../../state/store'
import { useCanvasUI } from '../../state/canvasUI'
import { useSelEl } from '../useSelEl'
import Editor from '../Editor'

const FILL_COLORS = ['#2a78d6', '#0e1c30', '#128a62', '#c5501f', '#4a3aa7', '#ffffff']
const ICONS = [
  { k: '슬라이드', g: '▤' }, { k: '레이아웃', g: '▦' }, { k: '테마', g: '🎨' },
  { k: '전환', g: '✨' }, { k: '이미지', g: '🖼' }, { k: '글맵시', g: '🅰' },
  { k: '맞춤법', g: '🔤' }, { k: '변환', g: '⤓' },
]

// 우측 속성 패널 + 아이콘 열. 기존 카드/블록 편집(Editor)은 아래에 유지.
export default function RightPanel() {
  const tool = useCanvasUI((s) => s.tool)
  const setTool = useCanvasUI((s) => s.setTool)
  const pages = useBuilder((s) => s.pages)
  const selId = useBuilder((s) => s.selectedPageId)
  const setPageBg = useBuilder((s) => s.setPageBg)
  const { el, patch } = useSelEl()
  const [icon, setIcon] = useState('슬라이드')
  const page = pages.find((p) => p.id === selId)
  const dark = !!(page && page.bg)

  function setBg(d: boolean) { if (page) setPageBg(page.id, d ? '#0e1c30' : '') }
  useEffect(() => {
    const bg = () => setBg(!dark)
    const bold = () => { if (el) patch({ bold: !el.bold }) }
    const color = () => { if (!el) return; const cs = ['#1a1a1a', '#2a78d6', '#0f9d58', '#c5501f', '#4a3aa7']; const i = cs.indexOf(el.tcolor || '#1a1a1a'); patch({ tcolor: cs[(i + 1) % cs.length] }) }
    window.addEventListener('ebook:bg-toggle', bg)
    window.addEventListener('ebook:fmt-bold', bold)
    window.addEventListener('ebook:fmt-color', color)
    return () => { window.removeEventListener('ebook:bg-toggle', bg); window.removeEventListener('ebook:fmt-bold', bold); window.removeEventListener('ebook:fmt-color', color) }
  })

  return (
    <div className="ax-panelcol">
      <div className="ax-panel">
        <h4>선택 · 텍스트 <span className="ax-tag gs">구글</span></h4>
        <div className="ax-selline">
          <select defaultValue="Pretendard"><option>Pretendard</option><option>맑은 고딕</option><option>본고딕</option></select>
          <input value={el ? el.fs : 30} onChange={(e) => el && patch({ fs: Math.max(6, Number(e.target.value) || 6) })} style={{ width: 46 }} />
        </div>
        <div className="ax-selline">
          <button className={'ax-mini-b' + (el?.bold ? ' on' : '')} onClick={() => el && patch({ bold: !el.bold })}><b>B</b></button>
          <button className="ax-mini-b"><i>I</i></button>
          <button className="ax-mini-b"><u>U</u></button>
          <span style={{ color: '#aaa' }}>{el ? '선택됨' : '요소를 선택하세요'}</span>
        </div>

        <h4>글자모양 · 문단모양 <span className="ax-tag hwp">HWP</span></h4>
        <div className="ax-selline"><span>글자색</span>
          {['#1a1a1a', '#2a78d6', '#0f9d58', '#c5501f'].map((c) => (
            <span key={c} className={'ax-sw' + (el?.tcolor === c ? ' on' : '')} style={{ background: c }} onClick={() => el && patch({ tcolor: c })} />
          ))}
        </div>
        <div className="ax-row">
          <span className="ax-pill hwp" onClick={() => setTool('text')}>글머리표</span>
          <span className="ax-pill hwp">개요 수준</span>
          <span className="ax-pill hwp">각주</span>
        </div>

        <h4>레이아웃 · 테마 <span className="ax-tag gs">구글</span></h4>
        <div className="ax-row">
          <span className={'ax-pill gs' + (!dark ? ' on' : '')} onClick={() => setBg(false)}>라이트</span>
          <span className={'ax-pill gs' + (dark ? ' on' : '')} onClick={() => setBg(true)}>다크</span>
        </div>

        <h4>글맵시 · 표 · 도형 <span className="ax-tag hwp">HWP</span></h4>
        <div className="ax-row">
          <span className={'ax-pill hwp' + (tool === 'wordart' ? ' on' : '')} onClick={() => setTool('wordart')}>글맵시</span>
          <span className={'ax-pill gs' + (tool === 'table' ? ' on' : '')} onClick={() => setTool('table')}>표 삽입</span>
          <span className={'ax-pill gs' + (tool === 'box' ? ' on' : '')} onClick={() => setTool('box')}>도형</span>
        </div>

        <h4>채우기 · 색</h4>
        <div className="ax-swrow">
          {FILL_COLORS.map((c) => (
            <span key={c} className={'ax-sw' + (el?.color === c ? ' on' : '')} style={{ background: c }} onClick={() => el && patch({ color: c })} />
          ))}
        </div>

        <div className="ax-editwrap"><Editor /></div>
      </div>
      <div className="ax-iconcol">
        {ICONS.map((i) => (<button key={i.k} className={'ax-ic' + (icon === i.k ? ' on' : '')} onClick={() => setIcon(i.k)}><span className="g">{i.g}</span>{i.k}</button>))}
      </div>
    </div>
  )
}
