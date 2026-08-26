#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""_deck_state5.json 을 EVER-SKETCH 라이브러리에 새 이북으로 넣는다.
   사용법:  cd ~/Desktop/git/ebook_html && python3 import_deck.py
   (앱 서버가 떠 있으면 먼저 끄고 실행 → 끝나면 다시 켜고 '내 이북' 새로고침)"""
import sqlite3, json, time, uuid, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DB   = os.path.join(HERE, 'server', 'ebook_html.db')
SRC  = os.path.join(HERE, '_deck_state5.json')

if not os.path.exists(DB):  sys.exit('DB를 못 찾음: ' + DB)
if not os.path.exists(SRC): sys.exit('JSON을 못 찾음: ' + SRC)

state = json.load(open(SRC, encoding='utf-8'))
pages = state.get('pages') or []
if not pages: sys.exit('pages 가 비어 있음')

pid = 'p' + uuid.uuid4().hex[:12]
ts  = int(time.time() * 1000)          # 앱은 ms 단위를 쓴다

con = sqlite3.connect(DB)
try:
    con.execute(
        "INSERT INTO Projects(id,name,created_at,updated_at,published_id,page_count,state)"
        " VALUES(?,?,?,?,?,?,?)",
        (pid, state.get('title') or '가져온 이북', ts, ts, None, len(pages),
         json.dumps(state, ensure_ascii=False)))
    con.commit()
finally:
    con.close()

print('완료 — 라이브러리에 추가되었습니다.')
print('  제목  :', state.get('title'))
print('  페이지:', len(pages), '장')
print('  방향  :', state.get('orientation'))
print('  id    :', pid)
print()
print('이제 ./run.command 로 앱을 켜고 “내 이북”에서 여세요.')
