import { useCanvasUI } from '../../state/canvasUI'
import type { Tool } from '../../state/canvasUI'
import { useSelEl } from '../useSelEl'

const TEXT_COLORS = ['#1a1a1a', '#2a78d6', '#0f9d58', '#c5501f', '#4a3aa7', '#ffffff']

export default function EditToolbar() {
  const tool = useCanvasUI((s) => s.tool)
  const setTool = useCanvasUI((s) => s.setTool)
  const { el, patch } = useSelEl()
  const emit = (name: string) => window.dispatchEvent(new CustomEvent(name))

  const gsTools: { t: Tool; icon: string; title: string }[] = [
    { t: 'select', icon: '▣', title: '선택' },
    { t: 'text', icon: 'T', title: '텍스트' },
    { t: 'box', icon: '◇', title: '도형' },
    { t: 'pen', icon: '╱', title: '선/펜' },
    { t: 'image', icon: '🖼', title: '이미지' },
    { t: 'table', icon: '▦', title: '표' },
  ]
  const size = el ? el.fs : 30
  function setSize(v: number) { if (el) patch({ fs: Math.max(6, Math.min(120, v)) }) }
  function cycleColor() {
    if (!el) return
    const i = TEXT_COLORS.indexOf(el.tcolor || '#1a1a1a')
    patch({ tcolor: TEXT_COLORS[(i + 1) % TEXT_COLORS.length] })
  }

  return (
    <div className="ax-tb">
      <button className="ib" title="실행취소 (⌘/Ctrl+Z)" onClick={() => emit('ebook:undo')}>↺</button>
      <button className="ib" title="다시실행 (⌘/Ctrl+Shift+Z)" onClick={() => emit('ebook:redo')}>↻</button>
      <button className="ib" title="이북 만들기" onClick={() => emit('ebook:build')}>🖨</button>
      <button className="ib" title="서식 복사(선택 요소)">🖌</button>
      <span className="dv" />

      <span className="ax-grp gs">
        <span className="lab">글꼴</span>
        <select className="ax-fsel" defaultValue="Pretendard" title="글꼴">
          <option>Pretendard</option><option>맑은 고딕</option><option>본고딕</option>
        </select>
        <input className="ax-fnum" type="number" value={size} onChange={(e) => setSize(Number(e.target.value))} title="글자 크기(선택 요소)" />
        <button className={'ib' + (el?.bold ? ' on' : '')} title="굵게(선택 요소)" onClick={() => el && patch({ bold: !el.bold })}><b>B</b></button>
        <button className="ib" title="기울임"><i>I</i></button>
        <button className="ib" title="밑줄"><u>U</u></button>
        <button className="ib" title="글자색(선택 요소)" onClick={cycleColor} style={{ color: el?.tcolor || undefined }}>A</button>
      </span>

      <span className="ax-grp gs">
        <span className="lab">구글 슬라이드</span>
        {gsTools.map((g) => (
          <button key={g.t} className={'ib' + (tool === g.t ? ' on' : '')} title={g.title} onClick={() => setTool(g.t)}>{g.icon}</button>
        ))}
        <button className="ax-tbtn" title="배경/레이아웃" onClick={() => emit('ebook:bg-toggle')}>배경</button>
        <button className="ax-tbtn" title="레이아웃">레이아웃</button>
        <button className="ax-tbtn" title="테마" onClick={() => emit('ebook:bg-toggle')}>테마</button>
        <button className="ax-tbtn" title="전환">전환</button>
      </span>

      <span className="ax-grp hwp">
        <span className="lab">HWP(한글)</span>
        <button className="ax-tbtn" title="글자모양(글자 크기·굵기·색)" onClick={() => el && patch({ bold: !el.bold })}>글자모양</button>
        <button className="ax-tbtn" title="문단모양">문단모양</button>
        <button className={'ax-tbtn' + (tool === 'table' ? ' on' : '')} title="표" onClick={() => setTool('table')}>표</button>
        <button className={'ax-tbtn' + (tool === 'wordart' ? ' on' : '')} title="글맵시" onClick={() => setTool('wordart')}>글맵시</button>
        <button className="ax-tbtn" title="맞춤법(준비 중)">맞춤법</button>
      </span>
    </div>
  )
}
