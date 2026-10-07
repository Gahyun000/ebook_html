// 복사 · 잘라내기 · 붙여넣기 · 복제가 옮기는 것 — **고른 상자들과 그 사이의 선**(2026-10-02).
//
// ── 왜 따로 두나 ─────────────────────────────────
// 전에는 단축키(Hotkeys)가 요소 **한 개**를 들고 있었다. 머메이드로 펼친 트리를 전부 골라
// 복사해도 마지막에 고른 하나만 붙었고, 선은 요소 밖(`page.conns`)에 있어 아예 안 따라왔다.
// 옮길 칸도 골라 담아서(w·h·text·color·fs) 글자색·굵기·테두리·정렬이 떨어져 나갔다.
//
// 그래서 **담기**(`copyParts`)와 **꺼내기**(`pasteParts`)를 화면 밖으로 뺐다. 둘 다 받은 것을
// 고치지 않고 새 것을 돌려준다 — 그래야 검사가 화면 없이 잴 수 있다(clipboard.test.mjs).
//
// ── 흐린 상자(echo) — **보이는 그대로** 옮긴다 ──────────────
// 트리가 아래 띠로 접히면 띠 머리에 부모를 흐리게 다시 놓는다(echo · treeOps).
//
// 처음에는 「그건 그림이지 상자가 아니다」 라며 **원본으로 되돌려** 담았다 — echo 는 버리고, echo 에서
// 나간 선은 원본에서 나간 선으로. 구조로는 맞는 말인데 화면에서는 틀렸다. 여섯을 골랐는데 다섯이 붙고,
// 흐린 상자가 빠진 자리에 원본에서 꺾여 올라가는 선이 새로 생겼다. 사용자가 돌려 보고 「복붙 제대로
// 안되는데」 라고 했다(2026-10-02 오후 5.40 화면 기록). **사람은 구조가 아니라 그림을 복사한다.**
//
// 그래서 흐린 상자도 상자로, 그 선도 그어진 그대로 옮긴다. `echoOf` 표시만 **붙이는 쪽에 따라** 가른다
// (`pasteParts` 의 `keepEcho`).

import type { FreeEl, Conn } from '../state/store'

/** 담아 둔 것. `conns` 의 양 끝은 늘 `els` 안에 있다. 흐린 상자의 `echoOf` 는 **담은 쪽의 id** 그대로다. */
export interface Clip { els: FreeEl[]; conns: Conn[] }

const deep = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

/**
 * 이 쪽에서 `ids` 를 담는다.
 *
 * - **보이는 것만** — 접힌 가지 아래 상자(`hidden`)는 편집 화면에 안 그려지는데, 끌어서 고르면
 *   자리만으로 걸려든다(고르기는 쪽에 든 것을 본다). 담으면 고른 적 없는 상자가 접기 전 자리로 붙는다.
 * - **묶음은 통째로** — 화면에서 묶음의 하나를 누르면 전부 고른 것으로 친다(FreeLayer `expandGroupIds`).
 * - **선은 양 끝이 다 담겼을 때만, 그어진 그대로** — 한쪽 끝이 없는 선은 그릴 수 없다.
 * - **`folded` 는 뗀다** — 접어서 안 보이던 아래를 두고 왔으니, 붙인 곳에는 접을 것이 없다.
 * - **쪽에 놓인 순서**를 지킨다 — 고른 순서로 담으면 겹치는 순서가 뒤집힌다.
 */
export function copyParts(page: { els: FreeEl[]; conns: Conn[] }, ids: number[]): Clip {
  const all = (page.els || []).filter((e) => e && !e.hidden)
  const byId = new Map(all.map((e) => [e.id, e]))

  const picked = new Set<number>()
  for (const id of ids) {
    const e = byId.get(id)
    if (!e) continue
    if (e.groupId == null) { picked.add(e.id); continue }
    for (const g of all) if (g.groupId === e.groupId) picked.add(g.id)
  }

  const els = all.filter((e) => picked.has(e.id)).map((e) => {
    const n = deep(e)
    delete n.folded
    return n
  })
  const conns = (page.conns || []).filter((c) => c && picked.has(c.from) && picked.has(c.to)).map((c) => deep(c))

  return { els, conns }
}

/**
 * 담아 둔 것을 **새 id** 로 꺼낸다. `(dx, dy)` 만큼 민다.
 *
 * `taken` 은 붙일 쪽에 이미 있는 id 다. echo 는 번호표(`nextElId`)를 안 뽑고 `가장 큰 id + 1` 을 쓴다(treeOps).
 * 스토어가 트리를 앉힌 뒤 번호표를 그 위로 올려 두지만(store `claimIds` · 2026-10-06), 예전에 저장된 자료처럼
 * 번호표가 **이미 쪽에 있는 id** 를 내줄 수 있는 경우가 남는다. 같은 id 가 둘이면 선이 엉뚱한 상자에 붙는다 —
 * 그래서 여기서도 한 번 더 피한다.
 *
 * 묶음 번호도 새로 받는다. 원본과 같은 번호면 붙인 것을 끌 때 원본까지 따라온다.
 * 선의 꺾은 자리(`bend`)는 종이 위의 절대 좌표라(FreeLayer `connPath`) 상자와 같이 민다.
 *
 * ── `keepEcho` — 붙이는 쪽이 **머메이드(트리) 쪽**인가 ──
 * 그림은 어느 쪽에 붙이든 같다. 갈리는 것은 흐린 상자의 `echoOf`(「다시 놓은 부모」 표시)뿐이다.
 *  - **트리 쪽**: 표시를 **붙인 원본의 새 id** 로 다시 잇는다. 거기서는 다시 앉힐 때 이 표시로 구조를
 *    읽는다(treeOps) — 떼면 흐린 상자가 진짜 뿌리로 굳어 붙인 그림이 둘로 쪼개진다.
 *    원본을 같이 안 담았으면 이을 데가 없으니 뗀다.
 *  - **보통 쪽**: 뗀다. 남기면 패널이 「여기 것은 앉힐 때마다 새로 그려집니다」 라고 말하는데(RightPanel),
 *    보통 쪽에는 다시 앉히는 일이 없다 — 같은 모습의 보통 상자면 된다.
 */
export function pasteParts(clip: Clip, taken: Iterable<number>, nextId: () => number, dx: number, dy: number, keepEcho = false): Clip {
  const used = new Set(taken)
  const fresh = () => {
    let id = nextId()
    while (used.has(id)) id = nextId()
    used.add(id)
    return id
  }

  const elMap = new Map<number, number>()
  const groupMap = new Map<number, number>()
  const els = clip.els.map((e) => {
    const n = deep(e)
    n.id = fresh()
    elMap.set(e.id, n.id)
    n.x = e.x + dx
    n.y = e.y + dy
    if (e.groupId != null) {
      if (!groupMap.has(e.groupId)) groupMap.set(e.groupId, fresh())
      n.groupId = groupMap.get(e.groupId)
    }
    return n
  })
  // 표가 다 찬 뒤에 잇는다 — 흐린 상자가 원본보다 먼저 놓여 있을 수도 있다.
  for (const n of els) {
    if (n.echoOf == null) continue
    const origin = keepEcho ? elMap.get(n.echoOf) : undefined
    if (origin != null) n.echoOf = origin
    else delete n.echoOf
  }

  const conns = clip.conns.flatMap((c) => {
    const from = elMap.get(c.from), to = elMap.get(c.to)
    if (from == null || to == null) return []
    const n = deep(c)
    n.from = from
    n.to = to
    if (n.bend) n.bend = { x: n.bend.x + dx, y: n.bend.y + dy }
    return [n]
  })

  return { els, conns }
}
