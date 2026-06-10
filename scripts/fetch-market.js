#!/usr/bin/env node
/**
 * 네이버 증권(비공식 API)에서 시가총액 상위 종목을 수집해
 * 업종별로 묶은 뒤 assets/js/data.js 를 다시 생성한다.
 *
 * 사용법:
 *   node scripts/fetch-market.js [옵션]
 *
 * 옵션:
 *   --kospi N    KOSPI 시총 상위 N개 수집 (기본 80)
 *   --kosdaq N   KOSDAQ 시총 상위 N개 수집 (기본 40)
 *   --sectors N  표시할 업종 수 (기본 12)
 *   --top N      업종당 최대 종목 수 (기본 8)
 *   --history N  종목당 최근 N일 일별 종가 수집 (기본 30, 0이면 생략)
 *   --dry-run    파일을 쓰지 않고 결과만 출력
 *
 * Node 18+ (내장 fetch) 필요, 외부 의존성 없음.
 * GitHub Actions 스케줄(.github/workflows/update-market-data.yml)에서 주기 실행된다.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const BASE = "https://m.stock.naver.com/api";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Accept: "application/json",
};

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { kospi: 80, kosdaq: 40, sectors: 12, top: 8, history: 30, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") opts.dryRun = true;
    else if (args[i] === "--kospi") opts.kospi = Number(args[++i]);
    else if (args[i] === "--kosdaq") opts.kosdaq = Number(args[++i]);
    else if (args[i] === "--sectors") opts.sectors = Number(args[++i]);
    else if (args[i] === "--top") opts.top = Number(args[++i]);
    else if (args[i] === "--history") opts.history = Number(args[++i]);
  }
  return opts;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url, retries = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return await res.json();
    } catch (err) {
      if (attempt >= retries) throw err;
      await sleep(1000 * attempt);
    }
  }
}

// "414,887" / "-3.57" 같은 콤마 문자열을 숫자로
function num(v) {
  if (v == null) return NaN;
  return Number(String(v).replace(/,/g, ""));
}

// ETF/ETN/리츠 등 개별 기업이 아닌 상품은 히트맵에서 제외
var NON_STOCK_RE = /^(KODEX|TIGER|KBSTAR|RISE|ACE|SOL|PLUS|KOSEF|HANARO|ARIRANG|KIWOOM|WON|마이다스|에셋플러스)\s|ETN|레버리지|인버스|선물|채권|단기자금|머니마켓|리츠$/i;

/** 시장(KOSPI/KOSDAQ)별 시가총액 상위 종목 목록 */
async function getTopStocks(market, size) {
  const stocks = [];
  const seen = new Set();
  const pageSize = Math.min(size, 100);
  for (let page = 1; stocks.length < size; page++) {
    const data = await fetchJson(
      `${BASE}/stocks/marketValue/${market}?page=${page}&pageSize=${pageSize}`
    );
    const list = data && (data.stocks || data.result || []);
    if (!Array.isArray(list) || list.length === 0) break;
    const seenBefore = seen.size;
    for (const s of list) {
      if (seen.has(s.itemCode)) continue;
      seen.add(s.itemCode);
      if (NON_STOCK_RE.test(String(s.stockName || ""))) continue;
      stocks.push({
        name: s.stockName,
        code: s.itemCode,
        price: num(s.closePrice),
        change: num(s.fluctuationsRatio),
        marketValue: num(s.marketValue), // 억원
        volume: num(s.accumulatedTradingVolume),
        market,
      });
      if (stocks.length >= size) break;
    }
    if (seen.size === seenBefore) break; // 새 종목이 없으면(페이지 반복) 중단
  }
  return stocks;
}

/** 응답 객체 어디에 있든 업종명으로 보이는 필드를 찾아낸다 (API 스키마 변화 대비) */
function pickIndustry(obj, depth) {
  if (!obj || typeof obj !== "object" || depth > 2) return { name: null, code: null };
  let code = null;

  const consider = (v) => {
    if (typeof v !== "string" || !v.trim()) return null;
    const s = v.trim();
    if (/^\d+$/.test(s)) {
      if (!code) code = s; // 숫자만 있으면 업종 코드로 취급
      return null;
    }
    return s;
  };

  for (const key of Object.keys(obj)) {
    if (!/industry|upjong|sector/i.test(key)) continue;
    const v = obj[key];
    const direct = consider(v);
    if (direct) return { name: direct, code };
    if (v && typeof v === "object") {
      for (const f of ["industryGroupKor", "industryGroupName", "industryName", "name", "korName", "text"]) {
        const found = consider(v[f]);
        if (found) return { name: found, code };
      }
      const nested = pickIndustry(v, (depth || 0) + 1);
      if (nested.name) return nested;
      if (!code && nested.code) code = nested.code;
    }
  }
  return { name: null, code };
}

/** 네이버 업종 목록 페이지에서 업종코드 → 한글 업종명 매핑을 만든다 (EUC-KR) */
async function getUpjongMap() {
  try {
    const res = await fetch("https://finance.naver.com/sise/sise_group.naver?type=upjong", {
      headers: HEADERS,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    // 응답 헤더/메타의 charset 선언을 따른다 (이 페이지는 전통적으로 EUC-KR)
    const ct = (res.headers && res.headers.get && res.headers.get("content-type")) || "";
    let charset = (ct.match(/charset=([\w-]+)/i) || [])[1];
    if (!charset) {
      const head = new TextDecoder("latin1").decode(buf.slice(0, 1024));
      charset = (head.match(/charset=["']?([\w-]+)/i) || [])[1] || "euc-kr";
    }
    let html;
    try {
      html = new TextDecoder(charset).decode(buf);
    } catch (e) {
      html = new TextDecoder("utf-8").decode(buf);
    }
    const map = {};
    const re = /no=(\d+)[^>]*>([^<]+)</g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const name = m[2].trim();
      if (name && !/^\d+$/.test(name)) map[m[1]] = name;
    }
    console.log(`업종 코드 매핑 ${Object.keys(map).length}건 로드`);
    return map;
  } catch (err) {
    console.warn(`  [warn] 업종 목록 조회 실패: ${err.message}`);
    return {};
  }
}

/** 코스피/코스닥 지수 — 실패해도 전체 수집은 계속한다 */
async function getIndices() {
  var targets = [
    { api: "KOSPI", name: "코스피" },
    { api: "KOSDAQ", name: "코스닥" },
  ];
  var indices = [];
  for (const t of targets) {
    try {
      const data = await fetchJson(`${BASE}/index/${t.api}/basic`);
      const value = num(data.closePrice);
      const change = num(data.fluctuationsRatio);
      if (Number.isFinite(value)) {
        indices.push({ name: t.name, value, change: Number.isFinite(change) ? change : 0 });
      }
    } catch (err) {
      console.warn(`  [warn] ${t.api} 지수 조회 실패: ${err.message}`);
    }
  }
  return indices;
}

let industryDiagLogged = false;

async function getIndustry(code, upjongMap) {
  try {
    const data = await fetchJson(`${BASE}/stock/${code}/integration`);
    const picked = pickIndustry(data, 0);
    if (picked.name) return picked.name;
    if (picked.code && upjongMap[picked.code]) return upjongMap[picked.code];
    if (!industryDiagLogged) {
      industryDiagLogged = true;
      console.warn(`  [diag] ${code} 업종 해석 실패 — 응답 형태: ${JSON.stringify(data).slice(0, 500)}`);
    }
    return "기타";
  } catch (err) {
    console.warn(`  [warn] ${code} 업종 조회 실패: ${err.message}`);
    return "기타";
  }
}

/* ---------- 일별 시세 (종목 상세 차트용) ---------- */

// 응답 어딘가의 배열에서 {일자, 종가} 목록을 찾아낸다 (스키마 변화 대비)
function pickDailyCloses(data, days) {
  const arrays = [];
  if (Array.isArray(data)) arrays.push(data);
  else if (data && typeof data === "object") {
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key])) arrays.push(data[key]);
    }
  }
  for (const arr of arrays) {
    const points = arr
      .map((it) => {
        if (!it || typeof it !== "object") return null;
        const date = it.localDate || it.localTradedAt || it.dt || it.date;
        const close = num(it.closePrice != null ? it.closePrice : it.close);
        if (!date || !Number.isFinite(close)) return null;
        // '20260610' / '2026-06-10' / '2026-06-10T...' → 'YYYY-MM-DD'
        const d = String(date).replace(/T.*$/, "").replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
        return { d, c: close };
      })
      .filter(Boolean);
    if (points.length >= 2) {
      points.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
      return points.slice(-days);
    }
  }
  return null;
}

async function getDailyHistory(code, days) {
  const candidates = [
    `https://api.stock.naver.com/chart/domestic/item/${code}/day?stockExchangeType=KRX`,
    `${BASE}/stock/${code}/price?pageSize=${days}&page=1`,
  ];
  for (const url of candidates) {
    try {
      const data = await fetchJson(url, 1);
      const points = pickDailyCloses(data, days);
      if (points) return points;
    } catch (err) {
      // 다음 후보 엔드포인트 시도
    }
  }
  return null;
}

function buildDataJs(payload) {
  const lines = [];
  lines.push("/**");
  lines.push(" * 시황 데이터 — scripts/fetch-market.js 가 자동 생성하는 파일. 직접 수정하지 말 것.");
  lines.push(" *");
  lines.push(" * - rank   : 업종 표시 순서(업종 시가총액 합 순)");
  lines.push(" * - weight : 타일 면적 가중치(시가총액, 억원)");
  lines.push(" * - change : 전일 대비 등락률(%)");
  lines.push(" * - price  : 현재가(원)");
  lines.push(" */");
  lines.push("var MARKET_DATA = " + JSON.stringify(payload, null, 2) + ";");
  return lines.join("\n") + "\n";
}

function nowKst() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 16).replace("T", " ") + " KST";
}

async function main() {
  const opts = parseArgs();

  console.log("지수 수집...");
  const [indices, upjongMap] = await Promise.all([getIndices(), getUpjongMap()]);

  console.log(`KOSPI 상위 ${opts.kospi} / KOSDAQ 상위 ${opts.kosdaq} 종목 수집...`);
  const [kospi, kosdaq] = await Promise.all([
    getTopStocks("KOSPI", opts.kospi),
    getTopStocks("KOSDAQ", opts.kosdaq),
  ]);
  const all = kospi.concat(kosdaq).filter((s) => s.code && s.name);
  if (all.length === 0) throw new Error("종목 목록이 비어 있음 — API 응답 형식 확인 필요");
  console.log(`총 ${all.length}개 종목, 업종 조회 시작...`);

  for (const s of all) {
    s.sector = await getIndustry(s.code, upjongMap);
    await sleep(120); // API 부하 방지
  }

  // 업종 분류 실패('기타')가 과반이면 API 스키마가 바뀐 것 — 조용히 망가진 데이터를
  // 배포하는 대신 실패시켜 Actions 알림이 가게 한다
  const unknown = all.filter((s) => s.sector === "기타").length;
  if (unknown > all.length * 0.5) {
    throw new Error(`업종 분류 실패 비율이 너무 높음 (${unknown}/${all.length}) — API 응답 형식 확인 필요`);
  }

  // 업종별 그룹핑 → 시총 합 기준 상위 N개 업종
  const groups = new Map();
  for (const s of all) {
    if (!groups.has(s.sector)) groups.set(s.sector, []);
    groups.get(s.sector).push(s);
  }

  const ranked = [...groups.entries()]
    .filter(([name]) => name !== "기타")
    .map(([name, stocks]) => ({
      name,
      total: stocks.reduce((sum, s) => sum + (s.marketValue || 0), 0),
      stocks,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, opts.sectors);

  const sectors = ranked.map((g, i) => ({
    rank: i + 1,
    name: g.name,
    stocks: g.stocks
      .sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0))
      .slice(0, opts.top)
      .map((s) => ({
        name: s.name,
        code: s.code,
        weight: s.marketValue || 1,
        change: Number.isFinite(s.change) ? s.change : 0,
        price: Number.isFinite(s.price) ? s.price : null,
        volume: Number.isFinite(s.volume) ? s.volume : null,
      })),
  }));

  // 화면에 표시될 종목만 일별 시세 수집 (상세 패널 차트용)
  if (opts.history > 0) {
    const shown = sectors.flatMap((sec) => sec.stocks);
    console.log(`${shown.length}개 표시 종목의 최근 ${opts.history}일 시세 수집...`);
    let ok = 0;
    for (const s of shown) {
      const history = await getDailyHistory(s.code, opts.history);
      if (history) {
        s.history = history;
        ok++;
      }
      await sleep(120);
    }
    console.log(`  시세 수집 성공 ${ok}/${shown.length}`);
  }

  const content = buildDataJs({ asOf: nowKst(), indices, sectors });

  if (opts.dryRun) {
    console.log(content);
    return;
  }

  const outPath = path.join(__dirname, "..", "assets", "js", "data.js");
  fs.writeFileSync(outPath, content);
  console.log(`완료: ${outPath} (업종 ${sectors.length}개)`);
}

main().catch((err) => {
  console.error("실패:", err.message);
  process.exit(1);
});
