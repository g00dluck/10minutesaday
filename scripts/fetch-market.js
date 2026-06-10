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
  const opts = { kospi: 80, kosdaq: 40, sectors: 12, top: 8, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") opts.dryRun = true;
    else if (args[i] === "--kospi") opts.kospi = Number(args[++i]);
    else if (args[i] === "--kosdaq") opts.kosdaq = Number(args[++i]);
    else if (args[i] === "--sectors") opts.sectors = Number(args[++i]);
    else if (args[i] === "--top") opts.top = Number(args[++i]);
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

/** 시장(KOSPI/KOSDAQ)별 시가총액 상위 종목 목록 */
async function getTopStocks(market, size) {
  const stocks = [];
  const pageSize = Math.min(size, 100);
  for (let page = 1; stocks.length < size; page++) {
    const data = await fetchJson(
      `${BASE}/stocks/marketValue/${market}?page=${page}&pageSize=${pageSize}`
    );
    const list = data && (data.stocks || data.result || []);
    if (!Array.isArray(list) || list.length === 0) break;
    for (const s of list) {
      stocks.push({
        name: s.stockName,
        code: s.itemCode,
        price: num(s.closePrice),
        change: num(s.fluctuationsRatio),
        marketValue: num(s.marketValue), // 억원
        market,
      });
      if (stocks.length >= size) break;
    }
  }
  return stocks;
}

/** 응답 객체 어디에 있든 업종명으로 보이는 필드를 찾아낸다 (API 스키마 변화 대비) */
function pickIndustryName(obj) {
  if (!obj || typeof obj !== "object") return null;
  const candidates = [
    obj.industryCodeType,
    obj.industryCode,
    obj.industry,
    obj.upjong,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
    if (c && typeof c === "object") {
      const name = c.industryGroupKor || c.name || c.korName || c.text;
      if (typeof name === "string" && name.trim()) return name.trim();
    }
  }
  // 깊이 1 안에서 industry* 키 탐색
  for (const key of Object.keys(obj)) {
    if (/industry/i.test(key)) {
      const found = pickIndustryName({ industry: obj[key] });
      if (found) return found;
    }
  }
  return null;
}

async function getIndustry(code) {
  try {
    const data = await fetchJson(`${BASE}/stock/${code}/integration`);
    return pickIndustryName(data) || "기타";
  } catch (err) {
    console.warn(`  [warn] ${code} 업종 조회 실패: ${err.message}`);
    return "기타";
  }
}

function buildDataJs(sectors, asOf) {
  const lines = [];
  lines.push("/**");
  lines.push(" * 시황 데이터 — scripts/fetch-market.js 가 자동 생성하는 파일. 직접 수정하지 말 것.");
  lines.push(" *");
  lines.push(" * - rank   : 업종 표시 순서(업종 시가총액 합 순)");
  lines.push(" * - weight : 타일 면적 가중치(시가총액, 억원)");
  lines.push(" * - change : 전일 대비 등락률(%)");
  lines.push(" * - price  : 현재가(원)");
  lines.push(" */");
  lines.push("var MARKET_DATA = " + JSON.stringify({ asOf, sectors }, null, 2) + ";");
  return lines.join("\n") + "\n";
}

function nowKst() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 16).replace("T", " ") + " KST";
}

async function main() {
  const opts = parseArgs();

  console.log(`KOSPI 상위 ${opts.kospi} / KOSDAQ 상위 ${opts.kosdaq} 종목 수집...`);
  const [kospi, kosdaq] = [
    await getTopStocks("KOSPI", opts.kospi),
    await getTopStocks("KOSDAQ", opts.kosdaq),
  ];
  const all = kospi.concat(kosdaq).filter((s) => s.code && s.name);
  if (all.length === 0) throw new Error("종목 목록이 비어 있음 — API 응답 형식 확인 필요");
  console.log(`총 ${all.length}개 종목, 업종 조회 시작...`);

  for (const s of all) {
    s.sector = await getIndustry(s.code);
    await sleep(120); // API 부하 방지
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
      })),
  }));

  const content = buildDataJs(sectors, nowKst());

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
