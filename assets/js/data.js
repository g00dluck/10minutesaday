/**
 * 시황 데이터 (샘플 스냅샷)
 *
 * scripts/fetch-market.js 실행 시 이 파일이 실데이터로 재생성된다.
 * (GitHub Actions 스케줄: .github/workflows/update-market-data.yml)
 *
 * - rank   : 업종 표시 순서(시가총액 순)
 * - weight : 타일 면적 가중치(시가총액 비례, 단위는 상대값)
 * - change : 전일 대비 등락률(%)
 * - price  : 현재가(원)
 * - code   : 종목코드
 */
var MARKET_DATA = {
  asOf: "2026-06-09 15:30 KST (샘플)",
  indices: [
    { name: "코스피", value: 2745.32, change: -1.82 },
    { name: "코스닥", value: 845.1, change: -2.31 }
  ],
  sectors: [
    {
      rank: 1,
      name: "반도체와반도체장비",
      stocks: [
        { name: "SK하이닉스", code: "000660", weight: 100, change: -4.42, price: 195000 },
        { name: "삼성전자", code: "005930", weight: 92, change: -3.57, price: 69500 },
        { name: "한미반도체", code: "042700", weight: 17, change: -3.44, price: 95000 },
        { name: "원익IPS", code: "240810", weight: 6, change: -2.81, price: 32000 },
        { name: "피에스케이홀딩스", code: "031980", weight: 5, change: -3.12, price: 45000 }
      ]
    },
    {
      rank: 2,
      name: "전자장비와기기",
      stocks: [
        { name: "삼성전기", code: "009150", weight: 30, change: -2.13, price: 145000 },
        { name: "LG이노텍", code: "011070", weight: 16, change: -3.87, price: 240000 },
        { name: "이수페타시스", code: "007660", weight: 8, change: -1.92, price: 42000 },
        { name: "코리아써키트", code: "007810", weight: 6, change: -3.24, price: 18000 },
        { name: "대주전자재료", code: "078600", weight: 5, change: 3.41, price: 110000 }
      ]
    },
    {
      rank: 3,
      name: "양방향미디어와서비스",
      stocks: [
        { name: "NAVER", code: "035420", weight: 42, change: -4.28, price: 215000 },
        { name: "카카오", code: "035720", weight: 12, change: -1.63, price: 48000 },
        { name: "SOOP", code: "067160", weight: 2, change: -0.84, price: 95000 },
        { name: "디어유", code: "376300", weight: 1.2, change: -2.1, price: 35000 }
      ]
    },
    {
      rank: 4,
      name: "복합기업",
      stocks: [
        { name: "SK스퀘어", code: "402340", weight: 20, change: -5.28, price: 85000 },
        { name: "삼성물산", code: "028260", weight: 10, change: -1.21, price: 145000 },
        { name: "LG", code: "003550", weight: 9, change: -4.26, price: 78000 },
        { name: "두산", code: "000150", weight: 8, change: -0.96, price: 185000 }
      ]
    },
    {
      rank: 5,
      name: "IT서비스",
      stocks: [
        { name: "LG씨엔에스", code: "064400", weight: 10, change: -4.44, price: 58000 },
        { name: "삼성에스디에스", code: "018260", weight: 9, change: -6.34, price: 145000 },
        { name: "현대오토에버", code: "307950", weight: 7, change: -2.18, price: 165000 }
      ]
    },
    {
      rank: 6,
      name: "기계",
      stocks: [
        { name: "두산로보틱스", code: "454910", weight: 8, change: -3.86, price: 65000 },
        { name: "두산에너빌리티", code: "034020", weight: 7, change: -2.49, price: 21000 },
        { name: "로보스타", code: "090360", weight: 4, change: -7.14, price: 28000 },
        { name: "레인보우로보틱스", code: "277810", weight: 2, change: -5.23, price: 135000 },
        { name: "로보티즈", code: "108490", weight: 1.5, change: -4.81, price: 25000 }
      ]
    },
    {
      rank: 7,
      name: "자동차부품",
      stocks: [
        { name: "현대모비스", code: "012330", weight: 14, change: -2.18, price: 245000 },
        { name: "HL만도", code: "204320", weight: 3, change: -1.42, price: 38000 },
        { name: "현대위아", code: "011210", weight: 2.5, change: -0.87, price: 58000 }
      ]
    },
    {
      rank: 8,
      name: "화학",
      stocks: [
        { name: "에코프로", code: "086520", weight: 6, change: 0.28, price: 95000 },
        { name: "후성", code: "093370", weight: 5, change: 2.81, price: 8500 },
        { name: "OCI홀딩스", code: "010060", weight: 5, change: 12.11, price: 105000 }
      ]
    },
    {
      rank: 9,
      name: "전기제품",
      stocks: [
        { name: "삼성SDI", code: "006400", weight: 10, change: -1.55, price: 285000 },
        { name: "LG에너지솔루션", code: "373220", weight: 6, change: 0.88, price: 385000 },
        { name: "에코프로비엠", code: "247540", weight: 4, change: -0.72, price: 145000 }
      ]
    },
    {
      rank: 10,
      name: "조선",
      stocks: [
        { name: "HD현대중공업", code: "329180", weight: 6, change: 1.84, price: 195000 },
        { name: "HD한국조선해양", code: "009540", weight: 3, change: 0.92, price: 145000 },
        { name: "HD현대미포", code: "010620", weight: 2, change: 1.26, price: 95000 }
      ]
    },
    {
      rank: 11,
      name: "전기장비",
      stocks: [
        { name: "LS ELECTRIC", code: "010120", weight: 5, change: -2.73, price: 185000 },
        { name: "효성중공업", code: "298040", weight: 4, change: -1.13, price: 285000 },
        { name: "LS", code: "006260", weight: 2.5, change: -0.54, price: 125000 }
      ]
    },
    {
      rank: 12,
      name: "우주항공과국방",
      stocks: [
        { name: "LIG넥스원", code: "079550", weight: 4, change: 2.07, price: 245000 },
        { name: "한화에어로스페이스", code: "012450", weight: 3.5, change: 1.32, price: 285000 },
        { name: "한국항공우주", code: "047810", weight: 2.5, change: 0.61, price: 58000 }
      ]
    }
  ]
};
