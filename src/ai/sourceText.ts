// **AI 마인드맵의 재료를 글로 모은다**(2026-10-08 · source_text.test.mjs).
//
// 챗봇이 서버로 보내는 문서 요약(chat/bookState.ts)은 쪽마다 120자에서 자른다 — 「어떤 쪽이 있나」 를 알리는 용도라 그렇다.
// 마인드맵은 **내용 전체**를 읽어야 하므로 여기서는 자르지 않는다. 길이 한도는 서버 하네스가 정하고, 못 읽은 부분은 알려 준다.
import type { Block, Page } from '../state/store'

function blocksText(bs: Block[] | undefined, out: string[]): void {
  for (const b of bs || []) {
    const t = (b.text || '').trim()
    if (t) out.push(t)
    blocksText(b.children, out)
  }
}

/** 쪽마다 「[슬라이드 n]」 머리 아래에 카드 필드 · 블록 · 도형 글 · 표 칸을 적는다. 글이 없는 쪽은 뺀다. */
export function pagesText(pages: Page[] | undefined): string {
  const parts: string[] = []
  ;(pages || []).forEach((p, i) => {
    const lines: string[] = []
    for (const v of Object.values(p.fields || {})) { const t = String(v ?? '').trim(); if (t) lines.push(t) }
    blocksText(p.blocks, lines)
    for (const e of p.els || []) {
      if (!e || e.echoOf != null) continue            // 아래 띠에 다시 놓은 부모는 원본과 같은 글이다
      const t = (e.text || '').trim()
      if (t) lines.push(t)
      for (const row of e.cells || []) { const r = (row || []).map((c) => (c || '').trim()).filter(Boolean); if (r.length) lines.push(r.join(' | ')) }
      blocksText(e.blocks, lines)
    }
    if (lines.length) parts.push(`[슬라이드 ${i + 1}]\n` + lines.join('\n'))
  })
  return parts.join('\n\n')
}

/** 메모마다 「[메모] 제목」 아래에 글을 적는다. 빈 메모는 뺀다. */
export function notesText(notes: { title: string; blocks: Block[] }[] | undefined): string {
  const parts: string[] = []
  for (const n of notes || []) {
    const lines: string[] = []
    blocksText(n.blocks, lines)
    const title = (n.title || '').trim()
    if (!title && !lines.length) continue
    parts.push(`[메모] ${title}\n` + lines.join('\n'))
  }
  return parts.join('\n\n')
}

export interface Combined { text: string; chars: number; counts: { label: string; chars: number }[] }

/** 고른 재료를 순서대로 잇는다. 빈 재료는 뺀다. 재료별 글자 수는 만들기 창이 보여 준다. */
export function combine(parts: { label: string; text: string }[]): Combined {
  const live = parts.map((p) => ({ label: p.label, text: (p.text || '').trim() })).filter((p) => p.text)
  const text = live.map((p) => p.text).join('\n\n')
  return { text, chars: text.length, counts: live.map((p) => ({ label: p.label, chars: p.text.length })) }
}

const TEXT_EXT = ['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'jsonl', 'log', 'xml', 'yaml', 'yml', 'ini', 'html', 'htm', 'sql']
const DOC_EXT = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'hwp', 'hwpx']
const MAX_FILE = 10 * 1024 * 1024

/**
 * 이 파일을 글로 읽어도 되는가. **PDF · 오피스 · 한글 문서는 받지 않는다** — 글자로 억지로 읽으면 깨진 글이 되고,
 * LLM 은 그걸로 그럴듯하게 틀린 지도를 만든다(게이트웨이의 파일 규칙과 같다 · API_INTERFACE_SPEC §2.2).
 */
export function readableFile(name: string, size: number): { ok: boolean; reason: string } {
  const ext = (name.split('.').pop() || '').toLowerCase()
  if (DOC_EXT.includes(ext)) return { ok: false, reason: `${ext.toUpperCase()} 문서는 바로 읽지 못해요. 내용을 글로 복사해 붙여 넣어 주세요.` }
  if (!TEXT_EXT.includes(ext)) return { ok: false, reason: '글 파일(txt · md · csv · json · html 등)만 읽을 수 있어요. 내용을 글로 붙여 넣어 주세요.' }
  if (size > MAX_FILE) return { ok: false, reason: '파일이 너무 커요(10MB 까지). 필요한 부분만 붙여 넣어 주세요.' }
  return { ok: true, reason: '' }
}
