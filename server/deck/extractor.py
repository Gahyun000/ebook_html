# -*- coding: utf-8 -*-
"""HTML → 덱 IR(dict). 범용 파서(ebook_html htmlImport.ts 이식).

원본 서식은 버리고 내용만 가져온다. 어떤 계열의 HTML이든 h1/h2/문단/목록/콜아웃을
표지·목차·섹션으로 분해한 뒤, 소제목(h3)은 카드로 재구성해 표지틀 덱 IR 로 만든다.
브라우저 DOMParser 대신 BeautifulSoup 를 쓴다(동작 규칙은 원본과 동일).
"""
import re
from copy import copy as _copy
from bs4 import BeautifulSoup, Tag

# 강조박스(콜아웃) 선택자 — 원본과 동일
CALLOUT_SEL = (".note,.warn,.warning,.caution,.danger,.alert,.ok,.ok-box,.success,"
               ".tip,.key,.info,.q,.callout,.hint,blockquote")
CALLOUT_CLASSNAMES = [c.strip(".") for c in CALLOUT_SEL.split(",") if c.startswith(".")]
TONE_LABEL = {"info": "정보", "key": "핵심", "warn": "주의"}


def _clean(s) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()


def _classes(el) -> str:
    c = el.get("class") if isinstance(el, Tag) else None
    return " ".join(c) if c else ""


def _is_callout(el) -> bool:
    if not isinstance(el, Tag):
        return False
    if el.name == "blockquote":
        return True
    cls = set((el.get("class") or []))
    return any(cn in cls for cn in CALLOUT_CLASSNAMES)


def _callout_tone(el) -> str:
    cls = (_classes(el) + " " + el.name).lower()
    if re.search(r"\b(ok|success|tip|key|good|done)\b", cls):
        return "key"
    if re.search(r"\b(warn|warning|caution|danger|alert|note)\b", cls):
        return "warn"
    return "info"


def _heading_text(el) -> str:
    clone = BeautifulSoup(str(el), "html.parser")
    for x in clone.select(".n, .no, .num, .step, .tag, .badge, .chip, .pill, sup"):
        x.decompose()
    t = _clean(clone.get_text(" "))
    t = re.sub(r"^(\d{1,2})[.)\]]\s+", "", t)   # 선행 목록번호 제거(연도 4자리는 보존)
    return t


def _cover_subtitle(soup) -> str:
    sub = _clean((soup.select_one(".lede, .lead, .subtitle, .sub") or {}).get_text(" ")
                 if soup.select_one(".lede, .lead, .subtitle, .sub") else "")
    if not sub:
        p = soup.find("p")
        sub = _clean(p.get_text(" ")) if p else ""
    if len(sub) > 140:
        cut = sub[:140]
        sp = cut.rfind(" ")
        sub = (cut[:sp] if sp > 80 else cut).strip() + "…"
    return sub


def parse_html(html: str) -> dict:
    """HTML → {title, cover:{title,sub}, sections:[{title, blocks:[{type,text,tone?}]}]}."""
    soup = BeautifulSoup(html, "html.parser")
    doc_title = _clean(soup.title.get_text() if soup.title else "")
    first_h1 = soup.find("h1")
    cover_title = (_heading_text(first_h1) if first_h1 else "") or doc_title or "가져온 문서"
    cover_sub = _cover_subtitle(soup)

    sections = []
    cur = None
    saw_first_h1 = False
    body = soup.body or soup
    els = body.select("h1, h2, h3, p, ul, ol, hr, " + CALLOUT_SEL)

    for el in els:
        tag = el.name.lower()
        if tag == "h1":
            if not saw_first_h1:
                saw_first_h1 = True
                continue                      # 첫 H1 = 표지
            cur = {"title": _heading_text(el) or "페이지", "blocks": []}
            sections.append(cur)
            continue
        if tag == "h2":
            cur = {"title": _heading_text(el) or "페이지", "blocks": []}
            sections.append(cur)
            continue
        if cur is None:
            continue                          # 첫 섹션 이전(표지 리드문 등) 건너뜀
        if el.find_parent("li"):
            continue
        if _is_callout(el):
            t = _clean(el.get_text(" "))
            if t:
                cur["blocks"].append({"type": "callout", "text": t, "tone": _callout_tone(el)})
            continue
        if el.find_parent(lambda p: _is_callout(p)):
            continue                          # 콜아웃 내부 요소는 위에서 통째 처리
        if tag == "h3":
            t = _heading_text(el)
            if t:
                cur["blocks"].append({"type": "h2", "text": t})
        elif tag == "p":
            t = _clean(el.get_text(" "))
            if t:
                cur["blocks"].append({"type": "text", "text": t})
        elif tag == "hr":
            cur["blocks"].append({"type": "divider", "text": ""})
        elif tag in ("ul", "ol"):
            for li in el.find_all("li", recursive=False):
                t = _clean(li.get_text(" "))
                if t:
                    cur["blocks"].append({"type": "bullet", "text": t})

    return {"title": doc_title or cover_title,
            "cover": {"title": cover_title, "sub": cover_sub},
            "sections": sections}


# ── 덱 IR 매핑 ──────────────────────────────────────────────
def _short(text: str, n: int = 120) -> str:
    text = re.sub(r"\s+", " ", text or "").strip()
    if len(text) <= n:
        return text
    cut = re.split(r"(?<=[.。])\s", text)[0]
    return cut if len(cut) <= n else text[: n - 1].rstrip() + "…"


def _cols(n: int) -> str:
    return "c2" if n in (2, 4) else "c3"


def _section_cards(blocks):
    """블록 → (lead, cards). h3 소제목마다 카드 시작, 이후 문단/불릿은 그 카드 설명으로.
    콜아웃은 별도 카드(색조 라벨). 소제목 없는 텍스트/불릿은 lead 또는 낱개 카드로."""
    lead = ""
    cards = []
    cur = None

    def flush():
        nonlocal cur
        if cur is not None:
            cur["desc"] = _short(" ".join(cur.pop("_d")), 130)
            cards.append(cur)
            cur = None

    loose = []
    for b in blocks:
        t = b["type"]
        if t == "h2":
            flush()
            cur = {"type": "kick", "title": b["text"], "_d": []}
        elif t == "callout":
            flush()
            cards.append({"type": "kick", "kick": TONE_LABEL.get(b.get("tone", "info"), "정보"),
                          "title": "", "desc": _short(b["text"], 130)})
        elif t in ("text", "bullet"):
            if cur is not None:
                cur["_d"].append(b["text"])
            elif not lead and t == "text":
                lead = _short(b["text"], 150)
            else:
                loose.append(b["text"])
        # divider 무시
    flush()
    for x in loose:
        cards.append({"type": "kick", "title": "", "desc": _short(x, 130)})
    return lead, cards


def extract(html: str, theme: str = "light", title: str | None = None) -> dict:
    doc = parse_html(html)
    doc_title = title or doc["title"] or "문서"

    pages = []
    # 표지
    cover_cards = []
    if doc["sections"]:
        _, c0 = _section_cards(doc["sections"][0]["blocks"])
        for i, c in enumerate([x for x in c0 if x.get("title")][:3]):
            cover_cards.append({"type": "dot", "dot": ["aqua", "orange", "blue"][i % 3],
                                "title": c["title"], "desc": c.get("desc", "")})
    pages.append({"type": "cover", "heading": doc["cover"]["title"], "headingSize": 40,
                  "sub": doc["cover"]["sub"], "eyebrow": "", "cards": cover_cards})

    # 본문 섹션
    body_pages = []
    toc_items = []
    for idx, sec in enumerate(doc["sections"], 1):
        lead, cards = _section_cards(sec["blocks"])
        markN = "%02d" % idx
        n = len(cards)
        small = n >= 6
        page = {"type": "section", "markN": markN, "markEn": "",
                "heading": sec["title"], "sub": lead, "eyebrow": "",
                "cols": _cols(n if not small else 3), "cards": cards, "small": small}
        if small:
            page.update(cardsY=4.95, cardsH=4.25, eyebrowY=4.55, subH=0.6)
        elif n == 0:
            page["titleH"] = 1.0             # 카드 없는 페이지는 제목·리드 위주
        body_pages.append(page)
        toc_items.append([markN, sec["title"][:20], _short(lead, 16), "%02d" % (3 + idx - 1)])

    toc = {"type": "toc", "markEn": "CONTENTS", "title": "목차",
           "sub": _short(doc["cover"]["sub"] or "문서의 주요 섹션입니다.", 60), "items": toc_items}
    pages = [pages[0], toc] + body_pages

    footer_left = re.sub(r"\.html?$", "", doc_title)
    return {
        "meta": {
            "title": doc_title, "footerLeft": footer_left[:40],
            "theme": "dark" if theme == "dark" else "light",
            "brandTop": "UNIEVER CO., LTD.", "brandTopRight": "AX TRANSFORMATION · 2026",
            "wordmark": {"a": "UNIEVER", "b": "AX", "sub": "AI TRANSFORMATION PROGRAM"},
        },
        "pages": pages,
    }


if __name__ == "__main__":
    import sys, json
    html = open(sys.argv[1], encoding="utf-8").read()
    theme = sys.argv[2] if len(sys.argv) > 2 else "light"
    print(json.dumps(extract(html, theme), ensure_ascii=False, indent=2))
