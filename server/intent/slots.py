"""결정론 슬롯 추출(이북판) — HELIX slot_extractor 의 '규칙 우선' 원칙 계승.

편집 명령에서 도형종류·테마·방향·정렬방향을 뽑는다. LLM 없이 동작.
"""
from __future__ import annotations

import re
from typing import Any

# 도형 키워드 → 캔버스 도구
_SHAPE = [
    (r"둥근\s*(사각|네모)", "round"),
    (r"(사각형|네모|박스)", "box"),
    (r"(동그라미|타원|원)", "ellipse"),
    (r"마름모", "diamond"),
    (r"삼각형", "triangle"),
    (r"(별|아이콘)", "icon"),
]


def extract(question: str) -> dict[str, Any]:
    q = question or ""
    slots: dict[str, Any] = {}

    for pat, tool in _SHAPE:
        if re.search(pat, q):
            slots["shape"] = tool
            break

    if re.search(r"(다크|어둡|어두운)", q):
        slots["theme"] = "dark"
    elif re.search(r"(라이트|밝게|밝은)", q):
        slots["theme"] = "light"

    if "가로" in q:
        slots["orientation"] = "landscape"
    elif "세로" in q:
        slots["orientation"] = "portrait"

    if re.search(r"(맨\s*앞|앞으로|위로\s*올려|위로)", q):
        slots["direction"] = "front"
    elif re.search(r"(맨\s*뒤|뒤로|아래로\s*내려|아래로)", q):
        slots["direction"] = "back"

    return slots
