// 알마인드식 **가지 키의 규칙**(2026-10-06). 화면에 붙이는 일은 Hotkeys 가 한다(mind_keys.test.mjs).
//
// 상자를 고른 채 Space 로 자식, Enter 로 형제를 붙이고 방향키로 토픽 사이를 옮겨 다닌다.
// 붙이고 지우는 일 자체는 스토어(treeAdd · treeRemove · treeFold)가 하고, 그때마다 트리를 다시 앉힌다.
import type { Shape } from '../cards/treeOps'
import type { TreeDir } from '../cards/treeEls'

export type MindAct = 'child' | 'sibling' | 'before' | 'fold' | 'unfold' | 'unfoldAll'

interface KeyLike {
  key: string; code?: string
  shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean
  isComposing?: boolean
}

/**
 * 이 키가 가지 동작인가. **글자를 치는 중인지는 부르는 쪽이 가린다.**
 *
 * 접기 · 펴기는 글자(`key`)가 아니라 자리(`code`)로 본다 — 맥은 Alt 를 누르면 글자가 바뀐다(Alt+= → ≠).
 */
export function mindKey(e: KeyLike): MindAct | null {
  if (e.isComposing) return null
  const mod = e.metaKey || e.ctrlKey
  if (!mod && !e.altKey) {
    if (!e.shiftKey && (e.key === ' ' || e.key === 'Insert')) return 'child'
    if (e.key === 'Enter') return e.shiftKey ? 'before' : 'sibling'
    return null
  }
  if (e.altKey && e.shiftKey && !mod && e.code === 'Minus') return 'fold'
  if (e.altKey && e.shiftKey && !mod && e.code === 'Equal') return 'unfold'
  if (e.altKey && e.shiftKey && !mod && e.code === 'KeyA') return 'unfoldAll'
  return null
}

/**
 * 방향키로 옮겨 갈 상자. 없으면 null(그 자리에 머문다).
 *
 * 왼→오른 트리는 오른쪽이 자식 · 왼쪽이 부모 · 위아래가 형제, 위→아래 트리는 그것을 90° 돌린 것이다.
 * 접혀서 안 보이는 상자로는 가지 않는다.
 */
export function navTarget(shape: Shape, dir: TreeDir, id: number, key: string): number | null {
  if (!shape.members.includes(id)) return null
  const toKid = dir === 'LR' ? 'ArrowRight' : 'ArrowDown'
  const toParent = dir === 'LR' ? 'ArrowLeft' : 'ArrowUp'
  const prev = dir === 'LR' ? 'ArrowUp' : 'ArrowLeft'
  const next = dir === 'LR' ? 'ArrowDown' : 'ArrowRight'
  const seen = (x: number) => !shape.hidden.has(x)
  const parent = shape.parent.get(id)
  if (key === toKid) return (shape.kids.get(id) || []).find(seen) ?? null
  if (key === toParent) return parent ?? null
  if (key !== prev && key !== next) return null
  const row = (parent != null ? (shape.kids.get(parent) || []) : shape.roots).filter(seen)
  const i = row.indexOf(id)
  if (i < 0) return null
  return row[key === prev ? i - 1 : i + 1] ?? null
}
