// 사람이 마지막으로 고른 화면 설정. **이 브라우저에만** 남는다(EVER-SKETCH1 a48539f C-2).
//
// 문서의 성질이 아니라 **그 사람의 손버릇**이라 서버가 아니라 브라우저에 둔다.
// 못 읽어도 잃을 게 없다 — 기본값으로 열린다.
//
// 저장이 막힌 브라우저(시크릿 창, 사이트 데이터 차단)에서는 읽기도 쓰기도 **던진다.**
// 그래서 전부 try/catch 로 감싼다 — 기본값 하나 못 읽었다고 화면이 안 뜨면 안 된다.
//
// (원본의 방향 기억 · 셸 사이드바 · 목록 칸 폭은 이 저장소에 해당 화면이 없어 옮기지 않았다.)

// ── 오른쪽 패널에서 펴 둔 묶음 ────────────────────────
//
// 탭을 접이식으로 바꾸면서 「접고 편 상태를 기억한다」가 시안의 약속이었다.
// 안 기억하면 **고를 때마다 처음으로 돌아간다** — 표를 고칠 때마다 「크기·자리」를
// 다시 펴야 하고, 그건 탭을 다시 누르는 것과 같은 손품이다.

const SEC_KEY = 'ebook_panel_open'

/** 모르는 이름은 버린다. 예전 판이 남긴 키가 화면에 안 보이는 묶음을 열어 둔 채로
 *  숫자만 늘리는 일을 막는다. */
export function openSections<K extends string>(
  known: readonly K[], fallback: Record<K, boolean>,
): Record<K, boolean> {
  let saved: unknown = null
  try { saved = JSON.parse(localStorage.getItem(SEC_KEY) || 'null') } catch { saved = null }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return { ...fallback }
  const src = saved as Record<string, unknown>
  const out = { ...fallback }
  for (const k of known) if (typeof src[k] === 'boolean') out[k] = src[k] as boolean
  return out
}

export function rememberOpenSections(v: Record<string, boolean>): void {
  try { localStorage.setItem(SEC_KEY, JSON.stringify(v)) } catch { /* 저장이 막힌 브라우저 */ }
}
