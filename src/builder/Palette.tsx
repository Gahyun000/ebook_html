import { CARD_REGISTRY } from '../cards/registry'
import { useBuilder } from '../state/store'
const GROUPS = [
  { key: 'frame', label: '틀 구조' },
  { key: 'extra', label: '경영 보고 보강' },
  { key: 'viz', label: '다이어그램·비주얼' },
]
export default function Palette() {
  const addCard = useBuilder((s) => s.addCard)
  return (<div>
    {GROUPS.map((g) => (<div key={g.key}>
      <div className="grp">{g.label}</div>
      {/* 감춘 카드는 여기에도 안 나온다(registry.ts `hidden` · EVER-SKETCH1 e8f80f7). 지금 그리는 곳이
          안 보여도 걸어 둔다 — 되살아났을 때 「목록에서 뺐는데 어딘가엔 있다」가 되면 찾기 어렵다. */}
      {CARD_REGISTRY.filter((c) => c.group === g.key && !c.hidden).map((c) => (
        <button key={c.key} className="chip" onClick={() => addCard(c.key)}>{c.label}<span className="plus">＋</span></button>
      ))}
    </div>))}
  </div>)
}
