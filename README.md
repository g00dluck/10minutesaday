# 10 Minutes A Day

하루 10분, 주식 동향과 내 포트폴리오를 확인하는 개인용 사이트.

## 페이지 구성

| 페이지 | 파일 | 설명 |
|---|---|---|
| 시황 (첫 페이지) | `index.html` | 코스피/코스닥 지수 요약 + 업종별 등락 히트맵(트리맵). 종목 클릭 시 상세 패널: 최근 30일 가격 차트, 시세 정보, 내 보유 현황, 네이버/토스증권 바로가기 |
| 포트폴리오 | `portfolio.html` | 보유 종목·평가손익·수익률·자산 비중 차트. localStorage에 저장, 시황 데이터로 현재가 자동 연동 |
| 매매일지 | `journal.html` | 매수/매도 기록과 메모. localStorage에 저장 |

## 기술 스택

- **순수 HTML / CSS / JavaScript** — 빌드 도구·프레임워크·외부 라이브러리 없음
- 트리맵은 squarified treemap 알고리즘을 직접 구현 (`assets/js/heatmap.js`)
- 정적 파일이므로 GitHub Pages 등에 바로 배포 가능, 로컬에서 `index.html`을 더블클릭해도 동작

```
index.html            시황 히트맵 (첫 페이지) + 종목 상세 패널
portfolio.html        포트폴리오
journal.html          매매일지
assets/
  css/style.css       공통 스타일 (다크 테마, 모바일 대응)
  js/common.js        공통 유틸 (포맷터, escapeHtml, localStorage 저장소)
  js/data.js          시황 데이터 (지수/업종/종목/시세/30일 종가) — 스크립트가 재생성
  js/heatmap.js       트리맵 레이아웃 + 렌더링 + 지수 카드/툴팁/범례
  js/detail.js        종목 상세 패널 (가격 차트, 보유 현황, 외부 링크)
  js/portfolio.js     보유 종목 CRUD + 손익 계산 + 자산 비중 차트 + 현재가 연동
  js/journal.js       매매 기록 CRUD
scripts/
  fetch-market.js     네이버 증권 API에서 지수·시세·일별 종가 수집 → data.js 재생성
.github/workflows/
  market-data.yml       매일 08~20시 KST 5분 간격 데이터 갱신 + GitHub Pages 배포
```

## 시황 히트맵 동작 방식

1. `data.js`의 업종 목록을 순위(`rank`) 순으로 정렬하고, 업종별 가중치 합으로 1차 트리맵 배치
2. 각 업종 블록 안에서 종목 `weight`(시가총액 비례)로 2차 트리맵 배치
3. 타일 색상은 등락률 ±3%에서 포화되는 선형 보간: 하락 `#4880ee` ← 보합 `#3f4756` → 상승 `#e5443c` (국내 관례: 상승=빨강)
4. 타일 크기에 따라 글자 크기 자동 조절, 작은 타일은 텍스트 생략(툴팁으로 확인)

## 데이터 갱신

`scripts/fetch-market.js`가 네이버 증권(비공식 API)에서 KOSPI/KOSDAQ 시가총액 상위 종목과
업종 정보를 수집해 `assets/js/data.js`를 재생성한다.

```bash
# 로컬 실행 (Node 18+)
node scripts/fetch-market.js                 # data.js 재생성
node scripts/fetch-market.js --dry-run       # 파일을 쓰지 않고 결과만 출력
node scripts/fetch-market.js --kospi 100 --kosdaq 50 --sectors 12 --top 8 --history 30
```

업종 분류 실패가 과반이면(API 스키마 변경 신호) 스크립트가 실패해 Actions 알림이 가고,
기존 데이터가 유지된다. 종목 상세 차트용 일별 종가는 화면에 표시되는 종목만 수집한다.

GitHub Actions(`market-data.yml`)가 **매일 08:00~20:00 KST, 5분 간격**으로 자동 실행되어
데이터 변경이 있을 때만 커밋하고 GitHub Pages에 배포한다. 수동 실행은 Actions 탭 → Run workflow.
GitHub 스케줄 특성상 실행이 몇 분 지연되거나 일부 회차가 건너뛰어질 수 있다.

> API 응답 형식이 바뀌어 수집이 실패하면 워크플로우가 실패로 끝나고 기존 데이터가 유지된다.

## 배포 (GitHub Pages)

1. 워크플로우가 `gh-pages` 브랜치로 배포하며, 브랜치가 생기면 GitHub Pages가 자동 활성화된다
   (Settings → Pages의 Source가 "Deploy from a branch: gh-pages"로 잡힘)
2. `main`에 push하거나 워크플로우를 수동 실행하면 배포됨

## 로드맵

- [x] 1단계 — 시황 히트맵 + 포트폴리오(localStorage)
- [x] 2단계 — 데이터 자동 수집(GitHub Actions) + Pages 배포 + 포트폴리오 현재가 자동 연동
- [x] 3단계 — 지수 요약 카드, 자산 비중 도넛 차트, 매매일지, 모바일 대응
- [x] 4단계 — 종목 상세 패널(30일 가격 차트·시세·보유 현황·외부 링크), 공통 모듈 정리
- [ ] 확장(선택) — 증권사 OpenAPI 실시간 연동

### 증권사 OpenAPI 실시간 연동 (선택, API 키 필요)

한국투자증권 등 증권사 OpenAPI로 실시간 시세를 쓰려면 사용자 명의의 appkey/secret이 필요하다.
연동 시 수정 지점:

- `scripts/fetch-market.js` — 네이버 API 호출부를 OpenAPI 호출로 교체(또는 병행).
  키는 GitHub Actions Secrets(`Settings → Secrets and variables → Actions`)에 저장하고
  워크플로우에서 환경 변수로 주입
- 워크플로우 cron은 이미 장중 5분 간격으로 동작하므로 수집부 교체만으로 연동된다
  (정적 사이트 구조는 그대로 유지된다)
