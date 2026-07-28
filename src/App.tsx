import { CARD_REGISTRY } from './cards/registry'
import { colors } from './design/tokens'

const GROUPS: { key: string; label: string }[] = [
  { key: 'frame', label: '틀 구조' },
  { key: 'model', label: '비즈니스 모델(BMC)' },
  { key: 'extra', label: '경영 보고 보강' },
  { key: 'viz', label: '다이어그램·비주얼' },
]

export default function App() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 760, margin: '56px auto', padding: '0 20px', color: colors.ink }}>
      <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: 1, color: colors.accent }}>EBOOK_HTML · M0</div>
      <h1 style={{ fontSize: 28, margin: '8px 0 4px' }}>틀 빌더 — 스캐폴드 준비 완료</h1>
      <p style={{ color: colors.muted }}>
        카드 {CARD_REGISTRY.length}종 등록 · default_skill 표준 스킬 이식 완료.
      </p>
      <p style={{ color: colors.muted }}>
        다음: <b>M1</b> — 카드 1장 → PNG(html-to-image) → 폴더 → generator.py → 이북 종단 검증.
      </p>
      <div style={{ marginTop: 20, display: 'grid', gap: 10 }}>
        {GROUPS.map((g) => (
          <div key={g.key} style={{ border: `1px solid ${colors.line}`, borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{g.label}</div>
            <div style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>
              {CARD_REGISTRY.filter((c) => c.group === g.key).map((c) => c.label).join(' · ')}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
