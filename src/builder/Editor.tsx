import { useBuilder } from '../state/store'
import { cardByKey } from '../cards/registry'
import { polishFields } from './polish'
// 빈 페이지 글은 **메모장 「지금 슬라이드」** 에서 고친다(2026-10-06 · 사용자 결정).
// 여기(오른쪽 패널 맨 아래 · 폭 316px)에서 고치던 편집기는 챗봇 단추에 가리고 좁았다 —
// 「메모랑 슬라이드 연결되면 굳이 필요없지 않을까?」. 그래서 메모장으로 가는 단추 하나만 둔다
// (`ebook:notes-slide` — Layout 이 메모장을 띄우고, 메모장이 지금 슬라이드 보기로 간다).
export default function Editor() {
  const pages = useBuilder((s) => s.pages)
  const sel = useBuilder((s) => s.selectedPageId)
  const updateField = useBuilder((s) => s.updateField)
  const page = pages.find((p) => p.id === sel)
  if (!page) return <div className="empty">페이지를 추가하면 여기서 내용을 채웁니다.<br />못 채운 칸이 있어도 이북은 만들어져요.</div>
  if (page.cardKey === 'slide' || page.cardKey === 'deckslide') return (<div className="edit-sub">이 슬라이드는 <b>캔버스에서 직접 편집</b>합니다. 글자·도형을 클릭(더블클릭=글자 편집)해 고치고, 위 툴바·아래 도구로 요소를 추가하세요.</div>)
  const c = cardByKey(page.cardKey)
  if (!c) return null
  if (c.kind === 'toc') return (<div><div className="edit-h">{c.label}</div><div className="edit-sub">목차는 고른 카드들로 자동 생성됩니다.</div></div>)
  if (c.viz === 'note') return (<div><div className="edit-h">빈 페이지</div><div className="edit-sub">블록으로 자유롭게 틀을 짜세요. 보이는 그대로 이북에 담깁니다.</div><button className="insp-pill" title="오른쪽 메모장 칸에서 이 쪽 글을 넓게 고칩니다" onClick={() => window.dispatchEvent(new CustomEvent('ebook:notes-slide'))}>📝 메모장에서 글 고치기</button><div className="polish-cap">글은 메모장 칸에서 넓게 고칩니다. 고치는 즉시 이 쪽에 반영돼요.</div></div>)
  function polishAll() {
    if (!page) return
    const cleaned = polishFields(page.fields)
    Object.keys(cleaned).forEach((k) => updateField(page.id, k, cleaned[k]))
  }
  return (<div>
    <div className="edit-h">{c.label} 카드</div>
    <div className="edit-sub">칸을 채우면 페이지에 바로 반영됩니다. 비워 두면 그 줄은 생략돼요.</div>
    {c.fields.map((fd) => (<div className="fld" key={fd.key}>
      <label>{fd.label}</label>
      {fd.textarea
        ? <textarea value={page.fields[fd.key] || ''} onChange={(e) => updateField(page.id, fd.key, e.target.value)} />
        : <input value={page.fields[fd.key] || ''} onChange={(e) => updateField(page.id, fd.key, e.target.value)} />}
      <div className="hint">비우면 이 줄은 생략돼요.</div>
    </div>))}
    <button className="polish-btn" onClick={polishAll}>✨ 문구 다듬기</button>
    <div className="polish-cap">공백·기호를 자동으로 깔끔하게 정리합니다.</div>
  </div>)
}
