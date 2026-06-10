# 10 Minute A Day

하루 10분, 주식 동향과 내 포트폴리오를 확인하는 개인용 사이트.

## 페이지 구성

| 페이지 | 파일 | 설명 |
|---|---|---|
| 시황 (첫 페이지) | `index.html` | 코스피/코스닥 지수 요약 + 업종별 등락 히트맵(트리맵). 업종 순위 → 종목을 시가총액 비례 면적으로 표시, 등락률에 따라 파랑(하락)~빨강(상승) 색상 |
| 포트폴리오 | `portfolio.html` | 보유 종목·평가손익·수익률·자산 비중 차트. localStorage에 저장, 시황 데이터로 현재가 자동 연동 |
| 매매일지 | `journal.html` | 매수/매도 기록과 메모. localStorage에 저장 |

## 기술 스택

- **순수 HTML / CSS / JavaScript** — 빌드 도구·프레임워크·외부 라이브러리 없음
- 트리맵은 squarified treemap 알고리즘을 직접 구현 (`assets/js/heatmap.js`)
- 정적 파일이므로 GitHub Pages 등에 바로 배포 가능, 로컬에서 `index.html`을 더블클릭해도 동작

```
index.html            시황 히트맵 (첫 페이지)
portfolio.html        포트폴리오
journal.html          매매일지
assets/
  css/style.css       공통 스타일 (다크 테마, 모바일 대응)
  js/data.js          시황 데이터 (지수/업종/종목/등락률/현재가) — 스크립트가 재생성
  js/heatmap.js       트리맵 레이아웃 + 렌더링 + 지수 카드/툴팁/범례
  js/portfolio.js     보유 종목 CRUD + 손익 계산 + 자산 비중 차트 + 현재가 연동
  js/journal.js       매매 기록 CRUD
scripts/
  fetch-market.js     네이버 증권 API에서 지수·시세 수집 → data.js 재생성
.github/workflows/
  update-market-data.yml  평일 장 마감 후 데이터 갱신 + GitHub Pages 배포
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
node scripts/fetch-market.js --kospi 100 --kosdaq 50 --sectors 12 --top 8
```

GitHub Actions(`update-market-data.yml`)가 **평일 15:50 KST**(장 마감 후)에 자동 실행되어
데이터를 커밋하고 GitHub Pages에 배포한다. 수동 실행은 Actions 탭 → Run workflow.

> API 응답 형식이 바뀌어 수집이 실패하면 워크플로우가 실패로 끝나고 기존 데이터가 유지된다.

## 배포 (GitHub Pages)

1. 저장소 **Settings → Pages → Source**를 **GitHub Actions**로 설정
2. `main`에 push하거나 워크플로우를 수동 실행하면 배포됨

## 로드맵

- [x] 1단계 — 시황 히트맵 + 포트폴리오(localStorage)
- [x] 2단계 — 데이터 자동 수집(GitHub Actions) + Pages 배포 + 포트폴리오 현재가 자동 연동
- [x] 3단계 — 지수 요약 카드, 자산 비중 도넛 차트, 매매일지, 모바일 대응
- [ ] 확장(선택) — 증권사 OpenAPI 실시간 연동

### 증권사 OpenAPI 실시간 연동 (선택, API 키 필요)

한국투자증권 등 증권사 OpenAPI로 실시간 시세를 쓰려면 사용자 명의의 appkey/secret이 필요하다.
연동 시 수정 지점:

- `scripts/fetch-market.js` — 네이버 API 호출부를 OpenAPI 호출로 교체(또는 병행).
  키는 GitHub Actions Secrets(`Settings → Secrets and variables → Actions`)에 저장하고
  워크플로우에서 환경 변수로 주입
- 실시간(장중) 갱신이 필요하면 워크플로우 cron을 장중 10분 간격 등으로 조정
  (정적 사이트 구조는 그대로 유지된다)
