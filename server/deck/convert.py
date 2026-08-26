# -*- coding: utf-8 -*-
"""HTML → 편집 가능한 덱 PPTX(+PDF·썸네일). html_pdf_agent 변환 이식.

'HTML 가져오기' 버튼이 호출한다. extractor(범용 파서) → 덱 IR → deck_builder.js(pptxgenjs)
→ PPTX. LibreOffice(soffice)+PyMuPDF 가 있으면 PDF·슬라이드 썸네일까지 만든다(없으면 생략).
"""
import json
import os
import re
import secrets
import shutil
import subprocess
import tempfile
import time
import pathlib

from .extractor import extract

HERE = pathlib.Path(__file__).resolve().parent
EB_ROOT = HERE.parent.parent                 # ebook_html 루트
DECK_BUILDER = HERE / "deck_builder.js"
NODE_MODULES = EB_ROOT / "node_modules"      # pptxgenjs 위치
OUT = EB_ROOT / "_deck_out"
OUT.mkdir(parents=True, exist_ok=True)


def _which(*names):
    for n in names:
        p = shutil.which(n)
        if p:
            return p
    return None


def _find_soffice():
    p = _which("soffice", "libreoffice")
    if p:
        return p
    for c in ["/Applications/LibreOffice.app/Contents/MacOS/soffice",
              os.path.expanduser("~/Applications/LibreOffice.app/Contents/MacOS/soffice"),
              "/opt/homebrew/bin/soffice", "/usr/local/bin/soffice"]:
        if os.path.exists(c):
            return c
    return None


NODE = _which("node")
SOFFICE = _find_soffice()


def _slug(name: str) -> str:
    base = re.sub(r"\.html?$", "", name or "", flags=re.I)
    base = re.sub(r"[^0-9A-Za-z가-힣._-]+", "_", base).strip("_")
    return base[:60] or "deck"


def convert(html: str, theme: str, source_name: str) -> dict:
    if NODE is None:
        raise RuntimeError("node 를 찾을 수 없습니다. run.command 로 실행하세요.")
    if not DECK_BUILDER.exists():
        raise RuntimeError("deck_builder.js 가 없습니다.")
    ir = extract(html, theme=("dark" if theme == "dark" else "light"), title=source_name)
    base = _slug(source_name)
    token = time.strftime("%Y%m%d_%H%M%S") + "_" + secrets.token_hex(2)
    workdir = OUT / token
    workdir.mkdir(parents=True, exist_ok=True)

    ir_path = workdir / "deck.ir.json"
    json.dump(ir, open(ir_path, "w", encoding="utf-8"), ensure_ascii=False)
    pptx = workdir / (base + ".pptx")
    env = dict(os.environ)
    env["NODE_PATH"] = str(NODE_MODULES)
    r = subprocess.run([NODE, str(DECK_BUILDER), str(ir_path), str(pptx)],
                       capture_output=True, text=True, env=env)
    if r.returncode != 0 or not pptx.exists():
        raise RuntimeError("덱 빌드 실패: " + (r.stderr or r.stdout or "")[-400:])

    result = {"token": token, "pptx": pptx.name, "pdf": None, "thumbs": [],
              "pages": len(ir["pages"]), "ir": ir}

    if SOFFICE:
        try:
            import fitz  # PyMuPDF
            tmp = tempfile.mkdtemp(prefix="deck_")
            tp = f"{tmp}/{base}.pptx"
            shutil.copyfile(pptx, tp)
            subprocess.run([SOFFICE, "--headless", "--convert-to", "pdf", "--outdir", tmp, tp],
                           capture_output=True, text=True)
            pdf = f"{tmp}/{base}.pdf"
            if os.path.exists(pdf):
                shutil.copyfile(pdf, workdir / (base + ".pdf"))
                result["pdf"] = base + ".pdf"
                doc = fitz.open(pdf)
                for i, page in enumerate(doc, 1):
                    pix = page.get_pixmap(matrix=fitz.Matrix(1.6, 1.6))   # 캔버스 표시용 고해상
                    fn = "%02d.png" % i
                    pix.save(str(workdir / fn))
                    result["thumbs"].append(fn)
                doc.close()
            shutil.rmtree(tmp, ignore_errors=True)
        except Exception:
            pass

    return result
