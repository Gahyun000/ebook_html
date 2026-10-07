import { useEffect, useRef } from 'react'
import { useBuilder, nextElId } from '../state/store'
import type { FreeEl, Page } from '../state/store'
import { useCanvasUI } from '../state/canvasUI'
import type { Tool } from '../state/canvasUI'
import { pushSnap, popSnap, pushRedo, popRedo, pushUndoRaw, nextUndoKind, nextRedoKind } from '../canvas/model'
import { copyParts, pasteParts } from '../canvas/clipboard'
import type { Clip } from '../canvas/clipboard'
import { isTreePage, treeShape, knownOf } from '../cards/treeOps'
import { mindKey, navTarget } from './mindKeys'

interface Props {
  presentOpen: boolean; helpOpen: boolean; tutorialOpen: boolean
  onBuild: () => void; onPresent: () => void; onHelp: () => void; onSave: () => void
  onCloseHelp: () => void; onCloseTutorial: () => void
}

// 컴포넌트 밖 모듈 스코프 클립보드(복사/붙여넣기용).
// **고른 것 전부와 그 사이의 선**을 든다(2026-10-02 · canvas/clipboard.ts). 전에는 요소 한 개라
// 머메이드 트리를 통째로 골라 복사해도 마지막 상자 하나만 붙었다.
let CLIP: Clip | null = null
// 같은 것을 **몇 번째** 붙이는가. 붙일 때마다 한 칸씩 더 민다 — 늘 같은 자리면 여럿이라
// 정확히 포개져서 붙은 줄을 모른다. 새로 복사하면 처음으로 돌아간다.
let PASTED = 0

// 단일 키 → 도구 (Whimsical/Figma식)
const TOOL_KEYS: Record<string, Tool> = {
  v: 'select', r: 'box', o: 'ellipse', d: 'diamond', t: 'text',
  s: 'sticky', i: 'image', c: 'connect', p: 'pen',
}

export default function Hotkeys(props: Props) {
  const ref = useRef(props)
  ref.current = props

  useEffect(() => {
    function curPage(): Page | null {
      const bs = useBuilder.getState()
      return bs.pages.find((p) => p.id === bs.selectedPageId) || null
    }
    function snapStr(p: Page): string { return JSON.stringify({ els: p.els, conns: p.conns, strokes: p.strokes }) }
    function snap(p: Page) { pushSnap(p.id, snapStr(p)) }
    function selectedEl(): { page: Page; el: FreeEl } | null {
      const p = curPage(); if (!p) return null
      const id = useCanvasUI.getState().selEl; if (id == null) return null
      const el = p.els.find((e) => e.id === id); if (!el) return null
      return { page: p, el }
    }
    // 삭제·잘라내기는 다중 선택 전부를 대상으로 한다.
    // (버튼·메뉴는 useCanvasCommands.del() 로 이미 전부 지우는데 단축키만 1개만 지우고 있었다)
    function selectedEls(): { page: Page; els: FreeEl[] } | null {
      const p = curPage(); if (!p) return null
      const ui = useCanvasUI.getState()
      const ids = ui.selEls.length ? ui.selEls : (ui.selEl != null ? [ui.selEl] : [])
      const els = ids.map((id) => p.els.find((e) => e.id === id)).filter((e): e is FreeEl => !!e)
      return els.length ? { page: p, els } : null
    }
    /** 담아 둔 것을 `d` 만큼 밀어 이 쪽에 넣고, **넣은 것을 고른 채로** 둔다(붙이기 · 복제 공용).
     *  상자와 선을 한 번에 넣는다 — 하나씩 넣으면 선 없는 중간 모습이 화면에 지나간다.
     *  담긴 것이 없으면(안 보이는 상자만 걸려들었을 때) 기억도 하지 않는다 — 빈 ⌘Z 걸음이 남는다.
     *  **그림은 어디에 붙이든 같다.** 붙이는 쪽이 머메이드(트리) 쪽일 때만 흐린 상자의 「다시 놓은 부모」
     *  표시를 살려 둔다 — 화면(FreeLayer · RightPanel)과 같은 판정(`isTreePage`)으로 가른다. */
    function putParts(page: Page, clip: Clip, d: number) {
      if (!clip.els.length) return
      snap(page)
      const out = pasteParts(clip, page.els.map((e) => e.id), nextElId, d, d, isTreePage(page))
      useBuilder.getState().setCanvas(page.id, { els: [...page.els, ...out.els], conns: [...page.conns, ...out.conns], strokes: page.strokes })
      useCanvasUI.getState().setSelMany(out.els.map((e) => e.id))
    }

    function onKey(e: KeyboardEvent) {
      const p = ref.current
      // 발표/도움말/튜토리얼이 열려 있으면 그쪽이 키를 처리 (발표는 자체 핸들러)
      if (p.presentOpen) return
      if (p.helpOpen) { if (e.key === 'Escape') { e.preventDefault(); p.onCloseHelp() } return }
      if (p.tutorialOpen) { if (e.key === 'Escape') { e.preventDefault(); p.onCloseTutorial() } return }

      const target = e.target as HTMLElement | null
      const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      const mod = e.metaKey || e.ctrlKey
      const k = e.key
      const lower = k.length === 1 ? k.toLowerCase() : k

      // --- 문서 단축키: 입력 중에도 동작 ---
      // ⌘S 는 메뉴가 '💾 저장 ⌘S' 로 안내하는 대로 저장이어야 한다.
      // 이북 빌드(전 페이지 PNG 캡처)는 수십 초 걸리는 무거운 작업이라 ⌘Enter 로 분리했다.
      if (mod && lower === 's') { e.preventDefault(); p.onSave(); return }
      if (mod && k === 'Enter') { e.preventDefault(); p.onBuild(); return }
      if (mod && e.shiftKey && lower === 'p') { e.preventDefault(); p.onPresent(); return }
      if (k === 'F5') { e.preventDefault(); p.onPresent(); return }
      if (k === 'F1') { e.preventDefault(); p.onHelp(); return }

      if (typing) return // 아래는 칸에 글자 입력 중이 아닐 때만

      const bs = useBuilder.getState()
      const ui = useCanvasUI.getState()
      const page = curPage()

      // 되돌리기 / 다시 실행
      /**
       * **쪽 안의 일과 쪽 자체의 일 중, 나중에 한 것부터**(EVER-SKETCH1 9eabded).
       *
       * 되돌리기 이력이 쪽마다 따로라 쪽을 더하거나 지운 일은 어느 쪽의 것도 아니었고,
       * 그래서 ⌘Z 가 죽은 것처럼 보였다. 이제 문서 단위 이력(canvas/history.ts)이 따로
       * 있고, 둘 중 **번호가 큰**(= 나중에 쌓인) 것을 먼저 되돌린다.
       *
       * 쪽이 하나도 없을 때(마지막 쪽을 지운 직후)는 문서 이력만 본다.
       */
      /**
       * **되돌린 뒤에도 고른 것을 놓지 않는다**(EVER-SKETCH1 e6bc1d2). 예전에는 늘 `setSel(null)` 이라,
       * 연달아 되돌리면 어디를 보고 있었는지 매번 잃었다. 다만 되돌린 모습에 **그 요소가 없으면**
       * 붙잡고 있을 수 없으니 그때만 놓는다. 칸 범위(`tableSel`)는 늘 푼다 — 표의 행·열이
       * 달라졌을 수 있어 옛 범위는 못 믿는다(`setSel` 이 범위를 같이 비운다).
       */
      const restore = (pageId: number, snapJson: string) => {
        const keep = ui.selEl
        bs.setCanvas(pageId, JSON.parse(snapJson))
        const now = useBuilder.getState().pages.find((p) => p.id === pageId)
        const alive = keep != null && !!now && now.els.some((el) => el.id === keep)
        ui.setSel(alive ? keep : null)
      }
      const undoOnce = () => {
        if (!page) { bs.undoDoc(); ui.setSel(null); return }
        if (nextUndoKind(page.id) === 'doc') { bs.undoDoc(); ui.setSel(null); return }
        const s = popSnap(page.id); if (s) { pushRedo(page.id, snapStr(page)); restore(page.id, s) }
      }
      const redoOnce = () => {
        if (!page) { bs.redoDoc(); ui.setSel(null); return }
        if (nextRedoKind(page.id) === 'doc') { bs.redoDoc(); ui.setSel(null); return }
        const s = popRedo(page.id); if (s) { pushUndoRaw(page.id, snapStr(page)); restore(page.id, s) }
      }
      if (mod && lower === 'z') {
        e.preventDefault()
        if (e.shiftKey) redoOnce(); else undoOnce()
        return
      }
      if (mod && lower === 'y') { e.preventDefault(); redoOnce(); return }

      // Esc: 도구 취소 + 선택 해제
      if (k === 'Escape') { ui.setTool('select'); ui.setSel(null); ui.setConnSrc(null); return }

      // 페이지 이동 (이전/다음)
      if (k === 'PageUp' || k === 'PageDown') {
        e.preventDefault(); if (!bs.pages.length) return
        const idx = bs.pages.findIndex((pg) => pg.id === bs.selectedPageId)
        const c = idx < 0 ? 0 : idx
        const next = k === 'PageUp' ? Math.max(0, c - 1) : Math.min(bs.pages.length - 1, c + 1)
        bs.selectPage(bs.pages[next].id); ui.setSel(null); return
      }
      // 페이지 순서 이동: ⌘/Ctrl+Shift+↑/↓
      if (mod && e.shiftKey && (k === 'ArrowUp' || k === 'ArrowDown')) {
        e.preventDefault(); if (bs.selectedPageId != null) bs.movePage(bs.selectedPageId, k === 'ArrowUp' ? -1 : 1); return
      }

      const sel = selectedEl()

      /**
       * **알마인드식 가지 키**(2026-10-06 · mindKeys.ts). 상자 **하나**를 고른 채 —
       *   Space · Insert 자식 / Enter 형제 / Shift+Enter 앞 형제 → 붙이고 곧바로 글을 친다.
       *   방향키 = 부모 · 자식 · 형제로 옮겨 가기 / Delete = 가지째 / 접기 · 펴기.
       * 붙일 때마다 스토어가 트리를 **종이 안에** 다시 앉힌다(`treeAdd` → `layoutTree`).
       *
       * 손으로 놓은 일반 쪽에서도 **붙이는 키**는 듣는다 — 그 순간 그 쪽이 트리 쪽이 된다.
       * 옮겨 가기 · 가지째 지우기 · 접기는 **트리 쪽에서만** 듣는다. 손으로 이어 둔 그림에서 Delete 한 번에
       * 가지가 통째로 사라지거나 방향키가 1px 이동을 안 하면, 그건 고른 적 없는 동작이다.
       * 마인드맵 카드 쪽은 건드리지 않는다(가지가 한 단뿐이고 자리 규칙이 다르다).
       */
      const mind = (() => {
        if (!sel || ui.selEls.length > 1 || ui.tool !== 'select') return null
        if (sel.page.mindmapCenter != null || sel.el.locked) return null
        if (['text', 'icon', 'wordart', 'note', 'table', 'image'].includes(sel.el.type)) return null
        // 초점이 단추 · 고르기 칸에 있으면 Space · Enter 는 그것을 누르는 키다.
        const tag = target ? target.tagName : ''
        if (tag === 'BUTTON' || tag === 'SELECT' || tag === 'A') return null
        const id = sel.el.echoOf ?? sel.el.id          // 아래 띠에 다시 놓은 부모를 골랐으면 원본을 본다
        const shape = treeShape(sel.page.els, sel.page.conns, knownOf(sel.page))
        return { page: sel.page, id, shape, tree: isTreePage(sel.page) && shape.members.includes(id) }
      })()
      if (mind) {
        const act = mindKey(e)
        if (act === 'child' || act === 'sibling' || act === 'before') {
          e.preventDefault()
          if (e.repeat) return
          snap(mind.page)
          // 접힌 상자에 자식을 붙이면 붙이자마자 안 보인다 — 먼저 편다.
          if (act === 'child' && mind.page.els.some((x) => x.id === mind.id && x.folded)) bs.treeFold(mind.page.id, mind.id)
          const had = new Set(mind.page.els.map((x) => x.id))
          bs.treeAdd(mind.page.id, mind.id, act)
          const now = useBuilder.getState().pages.find((pg) => pg.id === mind.page.id)
          const made = now ? now.els.find((x) => !had.has(x.id) && x.echoOf == null) : null
          if (made) { ui.setSel(made.id); ui.requestEdit(made.id); ui.setReveal(made.id) }
          return
        }
        if (mind.tree && (act === 'fold' || act === 'unfold' || act === 'unfoldAll')) {
          e.preventDefault()
          const folded = (id: number) => mind.page.els.some((x) => x.id === id && x.folded)
          const kids = (mind.shape.kids.get(mind.id) || []).length
          const ids = act === 'unfoldAll' ? mind.page.els.filter((x) => x.folded && x.echoOf == null).map((x) => x.id)
            : act === 'fold' ? (kids > 0 && !folded(mind.id) ? [mind.id] : [])
            : (folded(mind.id) ? [mind.id] : [])
          if (ids.length) { snap(mind.page); ids.forEach((id) => bs.treeFold(mind.page.id, id)) }
          return
        }
        if (mind.tree && (k === 'Delete' || k === 'Backspace')) {
          e.preventDefault(); snap(mind.page)
          const up = mind.shape.parent.get(mind.id)
          bs.treeRemove(mind.page.id, mind.id)
          ui.setSel(up ?? null)
          return
        }
        // 토픽 사이 옮겨 가기. **Alt · Shift 를 누르면 건너뛴다** — 아래의 1px(Shift=10px) 이동으로 간다.
        if (mind.tree && !mod && !e.altKey && !e.shiftKey && (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight')) {
          e.preventDefault()
          const to = navTarget(mind.shape, sel!.page.treeDir || 'LR', mind.id, k)
          if (to != null) { ui.setSel(to); ui.setReveal(to) }
          return
        }
      }

      // 삭제
      const selMany = selectedEls()
      if ((k === 'Delete' || k === 'Backspace') && selMany) { e.preventDefault(); snap(selMany.page); selMany.els.forEach((el) => bs.removeEl(selMany.page.id, el.id)); ui.setSel(null); return }

      // 복제 — 삭제·잘라내기처럼 **고른 것 전부**가 대상이다(그 사이의 선까지).
      if (mod && lower === 'd' && selMany) { e.preventDefault(); putParts(selMany.page, copyParts(selMany.page, selMany.els.map((el) => el.id)), 16); return }

      // 복사 / 잘라내기 / 붙여넣기
      // 잘라내기는 **지우기 전에** 담는다. 전에는 마지막 하나만 담고 전부 지워서 나머지가 사라졌다.
      if (mod && lower === 'c' && selMany) { e.preventDefault(); CLIP = copyParts(selMany.page, selMany.els.map((el) => el.id)); PASTED = 0; return }
      if (mod && lower === 'x' && selMany) { e.preventDefault(); CLIP = copyParts(selMany.page, selMany.els.map((el) => el.id)); PASTED = 0; snap(selMany.page); selMany.els.forEach((el) => bs.removeEl(selMany.page.id, el.id)); ui.setSel(null); return }
      if (mod && lower === 'v' && CLIP && page) { e.preventDefault(); putParts(page, CLIP, 20 * ++PASTED); return }

      // 앞으로/뒤로: ⌘/Ctrl + ] / [
      if (mod && (k === ']' || k === '[') && sel) { e.preventDefault(); snap(sel.page); bs.reorderEl(sel.page.id, sel.el.id, k === ']'); return }

      // 방향키로 이동 (Shift=10px)
      if (!mod && (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') && sel) {
        e.preventDefault(); if (!e.repeat) snap(sel.page)
        const step = e.shiftKey ? 10 : 1
        let x = sel.el.x, y = sel.el.y
        if (k === 'ArrowUp') y -= step; else if (k === 'ArrowDown') y += step; else if (k === 'ArrowLeft') x -= step; else x += step
        bs.updateEl(sel.page.id, sel.el.id, { x, y }); return
      }

      // 도구 단축키 (단일 키)
      if (!mod && !e.shiftKey && !e.altKey && lower.length === 1 && TOOL_KEYS[lower]) { ui.setTool(TOOL_KEYS[lower]); return }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return null
}
