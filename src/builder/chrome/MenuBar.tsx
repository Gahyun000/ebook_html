import { useState, useRef, useEffect } from 'react'
import { useBuilder } from '../../state/store'
import { useProjects } from '../../persistence/projects'
import { useCanvasUI } from '../../state/canvasUI'
import { useKey } from '../../ui/keyLabel'
import { useAutosave } from '../../persistence/autosave'
import type { Tool } from '../../state/canvasUI'

interface MItem { label?: string; sc?: string; run?: () => void; disabled?: boolean; sep?: boolean }
interface Menu { label: string; hwp?: boolean; items: MItem[] }

// 구글 슬라이드식 드롭다운 메뉴. 실동작 가능한 항목은 연결, 미구현은 비활성 표시.
export default function MenuBar({ onHelp, onTutorial, onSettings, onImport, onPresent }: { onHelp: () => void; onTutorial: () => void; onSettings: () => void; onImport: () => void; onPresent: () => void }) {
  const addCard = useBuilder((s) => s.addCard)
  const backToLibrary = useProjects((s) => s.backToLibrary)
  const setPageBg = useBuilder((s) => s.setPageBg)
  const removePage = useBuilder((s) => s.removePage)
  const duplicatePage = useBuilder((s) => s.duplicatePage)
  const selId = useBuilder((s) => s.selectedPageId)
  const setTool = useCanvasUI((s) => s.setTool)
  const saveNow = useAutosave((s) => s.saveNow)
  const [open, setOpen] = useState<number | null>(null)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(null) }
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [])

  const emit = (n: string) => window.dispatchEvent(new CustomEvent(n))
  // 단축키 글자는 **보는 사람 키보드에 있는 것**으로 적는다(ui/keyLabel · EVER-SKETCH1 d41f51f).
  // 「＋ 새 슬라이드」의 ⌘M 표기는 뺐다 — 받는 곳이 아예 없었다.
  const K = useKey()
  const tool = (t: Tool) => setTool(t)
  /** 캔버스에 「이걸 놓아 달라」고 알린다 — 놓는 일은 캔버스가 한다(FreeLayer 의 ebook:place · EVER-SKETCH1 90e7439). */
  const place = (t: Tool) => window.dispatchEvent(new CustomEvent('ebook:place', { detail: { type: t } }))
  const curBg = (d: boolean) => { if (selId != null) setPageBg(selId, d ? '#0e1c30' : '') }

  const MENUS: Menu[] = [
    { label: '파일', items: [
      { label: '📄 HTML 가져오기', sc: K('alt+O'), run: onImport },
      { sep: true },
      { label: '💾 저장', sc: K('mod+S'), run: () => { void saveNow() } },
      { sep: true },
      { label: '🖼 PDF로 내보내기 (이미지)', run: () => emit('ebook:export-pdf') },
      { label: '📊 PPT로 내보내기 (편집 가능)', run: () => emit('ebook:export-pptx') },
      { label: '↧ 이북(웹) 만들기', sc: K('mod+enter'), run: () => emit('ebook:build') },
      { sep: true },
      { label: '▷ 슬라이드쇼 (미리 보기)', run: onPresent },
      { sep: true },
      { label: '⚙ 환경설정', run: onSettings },
    ] },
    { label: '수정', items: [
      { label: '실행취소', sc: K('mod+Z'), run: () => emit('ebook:undo') },
      { label: '재실행', sc: K('mod+Y'), run: () => emit('ebook:redo') },
      { sep: true },
      { label: '선택 요소 복제', sc: K('mod+D'), run: () => emit('ebook:dup') },
      { label: '선택 요소 삭제', sc: K('del'), run: () => emit('ebook:del') },
    ] },
    { label: '보기', items: [
      { label: '▶ 예시영상', run: () => emit('ebook:demo') },
      { label: '도움말', run: onHelp },
    ] },
    { label: '삽입', items: [
      // **여기 셋도 고르면 바로 놓인다**(EVER-SKETCH1 90e7439). 도구줄과 같은 길을 쓴다 —
      // 메뉴와 도구줄이 다른 길을 쓰면 한쪽만 고쳐지는 날이 온다.
      { label: 'T  텍스트 상자', run: () => place('text') },
      { label: '🖼  이미지', run: () => emit('ebook:insert-image') },
      // **도구줄의 도형 팝업을 연다**(EVER-SKETCH1 b1911d3). 전에는 사각형 하나를 무장시켰는데,
      // 팝업에는 열네 가지가 있어서 같은 이름이 두 곳에서 다른 말을 했다.
      // 목록을 여기에도 적지 않는다 — 두 벌이 되면 한쪽만 는다.
      { label: '◇  도형…', run: () => emit('ebook:pick-shape') },
      { label: '▦  표', run: () => place('table') },
      { label: '╱  선', run: () => tool('pen') },
      { label: '🅰  Word Art (글맵시)', run: () => place('wordart') },
      { sep: true },
      // 「＋ 덱 섹션 카드」는 뺐다 — 덱 섹션은 감춘 카드다(registry.ts `hidden` · EVER-SKETCH1 e8f80f7).
      { label: '＋ 새 슬라이드', run: () => addCard('slide') },
    ] },
    { label: '서식', items: [
      { label: '굵게 (선택 요소)', run: () => emit('ebook:fmt-bold') },
      { label: '글자색 (선택 요소)', run: () => emit('ebook:fmt-color') },
      { sep: true },
      { label: '정렬 및 들여쓰기', run: () => emit('ebook:align-cycle') },
      { label: '글머리기호', run: () => emit('ebook:bullet') },
      { label: '서식 지우기', run: () => emit('ebook:fmt-clear') },
    ] },
    { label: '슬라이드', items: [
      { label: '▷ 슬라이드쇼', run: onPresent },
      { sep: true },
      { label: '＋ 새 슬라이드', run: () => addCard('slide') },
      { label: '⧉ 슬라이드 복제', run: () => { if (selId != null) duplicatePage(selId) } },
      { label: '🗑 슬라이드 삭제', run: () => { if (selId != null) removePage(selId) } },
      { sep: true },
      { label: '◻ 배경 — 라이트', run: () => curBg(false) },
      { label: '◼ 배경 — 다크', run: () => curBg(true) },
      { label: '테마 변경(라이트/다크)', run: () => emit('ebook:bg-toggle') },
    ] },
    { label: '정렬', items: [
      { label: '맨 앞으로', run: () => emit('ebook:z-front') },
      { label: '맨 뒤로', run: () => emit('ebook:z-back') },
      { sep: true },
      { label: '페이지 중앙 배치', run: () => emit('ebook:el-center') },
      { label: '회전 (+15°)', run: () => emit('ebook:el-rotate') },
    ] },
    { label: '도구', items: [
      { label: '⚙ 환경설정', run: onSettings },
      { label: '맞춤법 검사 켜기/끄기', run: () => { const c = useCanvasUI.getState(); c.setSpell(!c.spell) } },
    ] },
    { label: '도움말', items: [
      { label: '도움말 열기', run: onHelp },
      { label: '▶ 튜토리얼 (30초 시연)', run: onTutorial },
    ] },
  ]

  return (
    <div className="ax-menu" ref={wrap}>
      <button className="ax-lib" title="내 이북(라이브러리로 돌아가기)" onClick={() => void backToLibrary()}>☰ 내 이북</button>
      {MENUS.map((m, i) => (
        <div key={m.label} className="ax-mwrap">
          <button
            className={'m' + (m.hwp ? ' hwp' : '') + (open === i ? ' active' : '')}
            onClick={() => setOpen(open === i ? null : i)}
            onMouseEnter={() => { if (open !== null) setOpen(i) }}
          >{m.label}</button>
          {open === i ? (
            <div className="ax-mdrop">
              {m.items.map((it, j) => it.sep
                ? <div key={j} className="ax-msep" />
                : <button key={j} className={'ax-mitem' + (it.disabled ? ' dis' : '')} disabled={it.disabled}
                    onClick={() => { if (!it.disabled && it.run) { it.run(); setOpen(null) } }}>
                    <span>{it.label}</span>{it.sc ? <span className="sc">{it.sc}</span> : null}
                  </button>
              )}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
