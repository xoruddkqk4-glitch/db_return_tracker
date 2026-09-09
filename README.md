# DB Return Tracker - 디벗 양품화 제출 현황

Google Apps Script 기반의 디벗(학생용 스마트기기) 양품화 및 반납 제출 현황 관리 웹 애플리케이션입니다.

## 📌 주요 기능

### 1. 학생용 제출 폼
- 학번/이름 자동 매칭 및 제출 현황 조회
- 8가지 반납/양품화 체크리스트 항목 입력:
  1. 디벗 기기를 학급 디벗함 본인 번호에 제출 여부
  2. 가방에 학번&이름 라벨지 부착 후 큰 박스 제출 여부
  3. 충전 어댑터 제출 여부
  4. 충전 케이블 제출 여부
  5. 스타일러스 펜 제출 여부
  6. USB 형태 펜 홀더 제출 여부
  7. 디벗 반납 점검표 작성 및 담임선생님 제출 여부
  8. 지퍼백에 학번&이름 라벨지 부착 후 작은 박스 제출 여부

### 2. 교사용 대시보드
- 담임교사 비밀번호 인증 로그인
- 학급별 학생들의 8개 항목 제출 현황 실시간 조회 및 모니터링
- 전 항목 제출 완료(양품화 완료) 여부 자동 판별 및 통계 확인

### 3. Google Spreadsheet 백엔드 연동
- `학생명단`: 학년, 반, 번호, 학번, 이름 데이터 관리
- `제출현황`: 학생별 체크리스트 제출 상태 저장 및 업데이트
- `담임교사명단`: 학급별 교사 인증 정보 관리

---

## 🛠️ 기술 스택
- **Backend**: Google Apps Script (GAS)
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla JS), Bootstrap / Responsive Web Design
- **Database**: Google Sheets (Google Spreadsheet API)

---

## 📅 업데이트 이력

## [2026-09-09] 업데이트 이력 (Commit ID: 23e51e0)
- **수정 내용**: `.agents` 스킬(git-commit) 적용 및 GitHub 원격 저장소(`https://github.com/xoruddkqk4-glitch/db_return_tracker`) 연동, `README.md` 문서 작성 및 프로젝트 구성 파일(Code.gs, index.html) 동기화
- **검증 결과**: Git repository 초기화, 원격 저장소 연결, 코드 및 문서 검증 완료
