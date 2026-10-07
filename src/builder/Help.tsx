import { useKey, useKeyStyle, detectMac, type KeyStyle } from '../ui/keyLabel'
import Modal from '../ui/Modal'

/**
 * 단축키 표(EVER-SKETCH1 d41f51f).
 *
 * **여기서 거짓말을 하나 찾았다.** `⌘S` 를 「이북 만들기」라고 적어 뒀는데
 * `Hotkeys.tsx` 에서 그 키는 **저장**이고, 이북 만들기는 `⌘↵` 다. 그리고 `⌘↵` 는 표에
 * 아예 없었다. 둘 다 바로잡는다.
 *
 * 키 글자는 **중립 표기로만 적는다**(`mod+shift+Z`). 맥 글자와 윈도우 글자를 둘 다
 * 적어 두면 두 벌이 되고, 두 벌은 언젠가 한쪽만 고쳐진다.
 */
function shortcuts(K: (s: string) => string): { k: string; d: string }[] {
  return [
    { k: K('mod+Z'), d: '되돌리기' },
    { k: K('mod+shift+Z'), d: '다시 실행' },
    { k: K('del'), d: '선택한 도형 삭제 (트리 상자는 그 아래 가지째)' },
    { k: K('mod+D'), d: '복제' },
    { k: `${K('mod+C')} · ${K('mod+V')} · ${K('mod+X')}`, d: '복사 · 붙여넣기 · 잘라내기' },
    { k: `방향키 / ${K('shift')}+방향키`, d: `도형 조금씩 이동 (${K('shift')}=10px)` },
    // 알마인드식 가지 키(2026-10-06). 상자 하나를 고른 채 누른다 — 붙일 때마다 종이 안에 다시 앉힌다.
    { k: `Space · ${K('enter')} · ${K('shift+enter')}`, d: '상자에 가지 붙이기 — Space = 자식(오른쪽) · Enter = 형제(같은 부모 · 바로 아래) · Shift+Enter = 앞 형제 (붙인 뒤 글자를 치면 이름, 안 치고 또 누르면 이어 붙임 · 같은 부모의 자식은 일곱까지 부모 가운데에 · 자손이 있는 형제는 그만큼 벌어짐 · 열 밖으로 옮긴 상자는 안 움직임)' },
    { k: `방향키 / ${K('alt')}+방향키`, d: `트리에서 — 부모 · 자식 · 형제로 옮겨 가기 (${K('alt')}=1px 이동)` },
    { k: `${K('shift+alt')}+－ · ${K('shift+alt')}+＋ · ${K('shift+alt+A')}`, d: '트리에서 — 하위 접기 · 펴기 · 모두 펴기' },
    { k: `${K('mod')} + ] · [`, d: '맨 앞으로 · 맨 뒤로' },
    { k: 'Esc', d: '글 편집 끝내기(상자는 고른 채) · 한 번 더 누르면 선택 해제 · 도구 취소(연결 모드 · 무장한 도형도)' },
    { k: 'V R O D T S I C P', d: '도구 전환(선택·사각형·원·마름모·글자·스티키·이미지·연결·펜)' },
    // 2026-10-07 사용자 결정(EverSketch 불편점 6번): 고르면 바로 놓이지 않고 **찍은 자리**에 놓인다.
    { k: '도구줄 · 삽입 메뉴', d: '도형 · 글상자 · 표 · 글맵시를 고르고 → 빈 곳을 눌러 놓기 (찍은 점이 가운데 · Esc 로 내려놓기)' },
    { k: 'PageUp / PageDown', d: '이전 / 다음 페이지' },
    // 목록 안에서만 듣는 키라, **여기 안 적으면 아무도 모른다**(EVER-SKETCH1 1219bbd).
    { k: '↑ ↓ · Enter', d: '슬라이드 목록에서 — 위아래로 옮기기 · 새 슬라이드(고른 것 바로 뒤)' },
    { k: K('mod+S'), d: '저장' },
    { k: K('mod+enter'), d: '이북(웹) 만들기' },
    { k: `${K('mod+shift+P')} · F5`, d: '발표 시작' },
  ]
}

/**
 * **표기를 사람이 고를 수 있게 둔다**(자동 · 맥 · 윈도우).
 *
 * 판별이 틀려도 기능은 안 깨진다 — 단축키를 받는 자리는 전부 `metaKey || ctrlKey` 로
 * 둘 다 받고, 여기서 정하는 것은 글자뿐이다. 그래도 맥인데 윈도우로 잘못 보면 맥 쓰는
 * 사람이 `Ctrl` 을 보게 되므로, 한 번 눌러 고칠 길을 둔다.
 */
function StyleSwitch() {
  const style = useKeyStyle((s) => s.style)
  const setStyle = useKeyStyle((s) => s.setStyle)
  const opts: { v: KeyStyle; t: string }[] = [
    { v: 'auto', t: '자동' }, { v: 'mac', t: '맥' }, { v: 'win', t: '윈도우' },
  ]
  return (
    <span className="help-keys-os" title="단축키를 어느 키보드 글자로 보여 줄지">
      {opts.map((o) => (
        <button key={o.v} className={style === o.v ? 'on' : ''} onClick={() => setStyle(o.v)}>{o.t}</button>
      ))}
      {style === 'auto' ? <em>{detectMac() ? '맥으로 봤어요' : '윈도우로 봤어요'}</em> : null}
    </span>
  )
}

export default function Help({ open, onClose, onStartTutorial }: { open: boolean; onClose: () => void; onStartTutorial: () => void }) {
  const K = useKey()
  if (!open) return null
  // 예전에는 손으로 그린 덮개였다 — Esc 는 Hotkeys 가 따로 받아 주고 있었지만
  // 포커스 가두기·되돌리기·배경 스크롤 잠금은 없었다. 껍데기를 쓰면 다 따라온다(EVER-SKETCH1 65f4df2).
  return (
    <Modal title="이렇게 쓰면 됩니다" onClose={onClose} size="sm"
      scrimClassName="scrim on" className="modal"
      cancel={{ label: '확인', onClick: onClose }}>
      <ol>
        <li>왼쪽에서 <b>카드</b>를 고릅니다 (표지·가치제안·성과 등).</li>
        <li>오른쪽에서 <b>칸을 채웁니다</b> — 예시가 들어 있어 그대로 둬도 돼요.</li>
        <li>가운데 <b>미리보기</b>로 확인합니다.</li>
        <li>다 되면 <b>이북 만들기</b> 한 번.</li>
      </ol>
      <p className="help-tip">못 채운 칸이 있어도 이북은 만들어집니다. 편하게 시작하세요.</p>
      <div className="help-tut">
        <div className="help-tut-t">자유 캔버스가 처음이신가요?</div>
        <div className="help-tut-d">도형·화살표·펜을 직접 해보며 배우는 짧은 튜토리얼이 있어요.</div>
        <button className="help-tut-btn" onClick={onStartTutorial}>▶ 자유 캔버스 튜토리얼 시작</button>
      </div>
      <div className="help-keys">
        <div className="help-keys-t">⌨ 키보드 단축키 <small>(마우스로도 다 됩니다)</small><StyleSwitch /></div>
        <table className="kbd-tbl"><tbody>
          {shortcuts(K).map((s) => (<tr key={s.k}><td className="kbd-k">{s.k}</td><td className="kbd-d">{s.d}</td></tr>))}
        </tbody></table>
      </div>
    </Modal>
  )
}
