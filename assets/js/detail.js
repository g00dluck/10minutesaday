/* 종목 상세 패널: 히트맵 타일 클릭 시 열린다.
 * 가격 차트(최근 일별 종가), 시세 정보, 내 보유 현황, 외부 상세 페이지 링크. */
(function () {
  "use strict";

  var backdrop = document.getElementById("detail-backdrop");
  if (!backdrop) return;

  var holdingsStore = TMAD.makeStore("tmad.holdings.v1");

  var els = {
    name: document.getElementById("d-name"),
    sub: document.getElementById("d-sub"),
    price: document.getElementById("d-price"),
    change: document.getElementById("d-change"),
    chart: document.getElementById("d-chart"),
    chartMeta: document.getElementById("d-chart-meta"),
    stats: document.getElementById("d-stats"),
    position: document.getElementById("d-position"),
    linkNaver: document.getElementById("d-link-naver"),
    linkToss: document.getElementById("d-link-toss")
  };

  var UP = "#ff6b61", DOWN = "#6e9bff", FLAT = "#8a90a0";

  function changeColorOf(change) {
    return change > 0 ? UP : change < 0 ? DOWN : FLAT;
  }

  /* ---------- 가격 차트 (SVG 라인) ---------- */

  function renderChart(stock) {
    var svg = els.chart;
    svg.innerHTML = "";
    var history = Array.isArray(stock.history) ? stock.history.filter(function (p) {
      return p && Number.isFinite(Number(p.c));
    }) : [];

    if (history.length < 2) {
      els.chartMeta.textContent = "가격 추이 데이터가 없습니다. 데이터 자동 수집이 켜지면 최근 시세가 함께 저장됩니다.";
      svg.style.display = "none";
      return;
    }
    svg.style.display = "";

    var W = 560, H = 180, PAD_X = 6, PAD_TOP = 16, PAD_BOT = 10;
    var closes = history.map(function (p) { return Number(p.c); });
    var min = Math.min.apply(null, closes);
    var max = Math.max.apply(null, closes);
    if (max === min) { max += 1; min -= 1; }

    function x(i) { return PAD_X + (i / (closes.length - 1)) * (W - PAD_X * 2); }
    function y(v) { return PAD_TOP + (1 - (v - min) / (max - min)) * (H - PAD_TOP - PAD_BOT); }

    var trendUp = closes[closes.length - 1] >= closes[0];
    var color = trendUp ? UP : DOWN;

    var linePts = closes.map(function (v, i) { return x(i) + "," + y(v); }).join(" ");

    // 면 채우기(은은한 그라데이션 대용으로 반투명 단색)
    var area = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    area.setAttribute("points", PAD_X + "," + (H - PAD_BOT) + " " + linePts + " " + x(closes.length - 1) + "," + (H - PAD_BOT));
    area.setAttribute("fill", color);
    area.setAttribute("opacity", "0.12");
    svg.appendChild(area);

    var line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    line.setAttribute("points", linePts);
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", color);
    line.setAttribute("stroke-width", "2");
    line.setAttribute("stroke-linejoin", "round");
    svg.appendChild(line);

    // 마지막 지점 강조
    var dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", x(closes.length - 1));
    dot.setAttribute("cy", y(closes[closes.length - 1]));
    dot.setAttribute("r", "3.5");
    dot.setAttribute("fill", color);
    svg.appendChild(dot);

    var first = history[0], last = history[history.length - 1];
    var periodChange = ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100;
    els.chartMeta.innerHTML =
      "<span>" + TMAD.escapeHtml(first.d) + " ~ " + TMAD.escapeHtml(last.d) + " (" + history.length + "일)</span>" +
      '<span>최저 ' + TMAD.fmtWon(min) + " · 최고 " + TMAD.fmtWon(max) + "</span>" +
      '<span style="color:' + changeColorOf(periodChange) + '">기간 ' + TMAD.fmtPct(periodChange) + "</span>";
  }

  /* ---------- 시세 정보 ---------- */

  function statItem(label, value) {
    return '<div class="stat"><span class="s-label">' + TMAD.escapeHtml(label) +
      '</span><span class="s-value">' + TMAD.escapeHtml(value) + "</span></div>";
  }

  function fmtMarketCap(weight) {
    // weight는 시가총액(억원). 샘플 데이터처럼 상대값이면 표시하지 않는다.
    if (!Number.isFinite(weight) || weight < 1000) return null;
    if (weight >= 10000) return (weight / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 1 }) + "조원";
    return Math.round(weight).toLocaleString("ko-KR") + "억원";
  }

  function renderStats(stock, sectorName) {
    var html = "";
    html += statItem("업종", sectorName);
    if (stock.price != null) {
      var prevClose = stock.price / (1 + stock.change / 100);
      html += statItem("전일 종가(추정)", TMAD.fmtWon(prevClose));
      html += statItem("전일 대비", TMAD.fmtWon(stock.price - prevClose));
    }
    var cap = fmtMarketCap(Number(stock.weight));
    if (cap) html += statItem("시가총액", cap);
    if (stock.volume != null) {
      html += statItem("거래량", Number(stock.volume).toLocaleString("ko-KR") + "주");
    }
    els.stats.innerHTML = html;
  }

  /* ---------- 내 보유 현황 ---------- */

  function renderPosition(stock) {
    var holdings = holdingsStore.load().filter(function (h) {
      return (h.code && h.code === stock.code) || h.name === stock.name;
    });
    if (holdings.length === 0) {
      els.position.hidden = true;
      return;
    }
    var qty = 0, cost = 0;
    holdings.forEach(function (h) {
      qty += h.qty;
      cost += h.qty * h.avgPrice;
    });
    var cur = stock.price != null ? stock.price : (holdings[0].curPrice || 0);
    var value = qty * cur;
    var pl = value - cost;
    var rate = cost > 0 ? (pl / cost) * 100 : 0;

    els.position.hidden = false;
    els.position.innerHTML =
      '<div class="pos-title">내 보유 현황</div>' +
      '<div class="pos-grid">' +
      statItem("보유 수량", qty.toLocaleString("ko-KR") + "주") +
      statItem("평균 단가", TMAD.fmtWon(cost / qty)) +
      statItem("평가 금액", TMAD.fmtWon(value)) +
      '<div class="stat"><span class="s-label">평가 손익</span><span class="s-value" style="color:' +
      changeColorOf(pl) + '">' + TMAD.fmtWon(pl) + " (" + TMAD.fmtPct(rate) + ")</span></div>" +
      "</div>";
  }

  /* ---------- 열기/닫기 ---------- */

  function open(stock, sectorName) {
    els.name.textContent = stock.name;
    els.sub.textContent = stock.code + (sectorName ? " · " + sectorName : "");
    els.price.textContent = stock.price != null ? TMAD.fmtWon(stock.price) : "-";
    els.change.textContent = TMAD.fmtPct(stock.change);
    els.change.style.color = changeColorOf(stock.change);

    renderChart(stock);
    renderStats(stock, sectorName);
    renderPosition(stock);

    els.linkNaver.href = "https://m.stock.naver.com/domestic/stock/" + encodeURIComponent(stock.code) + "/total";
    els.linkToss.href = "https://tossinvest.com/stocks/A" + encodeURIComponent(stock.code);

    backdrop.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function close() {
    backdrop.hidden = true;
    document.body.style.overflow = "";
  }

  backdrop.addEventListener("click", function (e) {
    if (e.target === backdrop) close();
  });
  document.getElementById("detail-close").addEventListener("click", close);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !backdrop.hidden) close();
  });

  window.TMAD_DETAIL = { open: open, close: close };
})();
