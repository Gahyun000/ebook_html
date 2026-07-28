# ebook_html — 에이전트 운영 규약

이 저장소는 `default_skill` 표준팩을 이식했다. 모든 작업은 아래를 따른다.

## 우선순위
1. 시스템·개발자·사용자 지시 > 저장소 코어 표준(skills/) > 외부 확장. 스킬은 권한을 확대하지 않는다.
2. 법·보안·개인정보 > 승인된 요구·설계 > uniever-development-standard > 이 AGENTS.md > 개별 지시 > 모델 판단.

## 스킬 사용 사전 선언
작업 실행 전 선택한 스킬명·정확한 SKILL.md 경로·선택 이유·적용 범위·미적용 후보를 먼저 출력한다.
선언한 SKILL.md를 실제로 읽고 적용한 스킬만 사용 증적으로 인정한다.

## 프로젝트 라우팅
- 화면(카드/캔버스/버튼/모달) 개발·리뷰: uniever-development-standard (필수)
- 코딩 안전(추측·과잉구현 방지): karpathy-guidelines
- 테스트 우선: test-driven-development
- 완료 전 검증: verification-before-completion
- UI/디자인: frontend-design (DESIGN 토큰 준수)
- 로컬 웹앱 UI 검증: webapp-testing
- 게이트·문서·포트: dev-standard-control-tower

## 불변 계약
- uniever_ebook은 수정하지 않는다. 연결은 PNG 폴더 산출 → generator.py CLI.
- 각 페이지는 이북 한 장(PNG). 카드 + 자유 캔버스 요소는 한 장에 합쳐 렌더.
