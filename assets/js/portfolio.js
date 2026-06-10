/* 포트폴리오: localStorage 기반 보유 종목 관리
 * 시황 데이터(MARKET_DATA)에 있는 종목은 현재가를 자동으로 채우고 일괄 갱신할 수 있다.
 * 종목 매칭은 종목코드 우선, 없으면 종목명으로 한다. */
(function () {
  "use strict";

  var store = TMAD.makeStore("tmad.holdings.v1");
  var fmtWon = TMAD.fmtWon, fmtPct = TMAD.fmtPct, signClass = TMAD.signClass;

  /* ---------- 시황 데이터 색인 ---------- */

  var byName = {}, byCode = {};
  if (typeof MARKET_DATA !== "undefined") {
    MARKET_DATA.sectors.forEach(function (sector) {
      sector.stocks.forEach(function (s) {
        if (s.price == null) return;
        byName[s.name] = s;
        if (s.code) byCode[s.code] = s;
      });
    });
  }

  function findStock(holding) {
    if (holding.code && byCode[holding.code]) return byCode[holding.code];
    return byName[holding.name] || null;
  }

  /* ---------- 렌더링 ---------- */

  function render() {
    var holdings = store.load();
    var tbody = document.getElementById("holdings-body");
    var summary = document.getElementById("summary");
    tbody.innerHTML = "";

    var totalCost = 0, totalValue = 0;

    holdings.forEach(function (h) {
      var cost = h.qty * h.avgPrice;
      var value = h.qty * h.curPrice;
      var pl = value - cost;
      var rate = cost > 0 ? (pl / cost) * 100 : 0;
      totalCost += cost;
      totalValue += value;

      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + TMAD.escapeHtml(h.name) + "</td>" +
        "<td>" + h.qty.toLocaleString("ko-KR") + "</td>" +
        "<td>" + fmtWon(h.avgPrice) + "</td>" +
        "<td>" + fmtWon(h.curPrice) + "</td>" +
        "<td>" + fmtWon(value) + "</td>" +
        '<td class="' + signClass(pl) + '">' + fmtWon(pl) + "</td>" +
        '<td class="' + signClass(rate) + '">' + fmtPct(rate) + "</td>" +
        '<td><button type="button" class="del-btn" data-id="' + h.id + '">삭제</button></td>';
      tbody.appendChild(tr);
    });

    if (holdings.length === 0) {
      var tr = document.createElement("tr");
      tr.innerHTML = '<td colspan="8" class="empty-note">아래에서 보유 종목을 추가해 보세요.</td>';
      tbody.appendChild(tr);
    }

    var totalPl = totalValue - totalCost;
    var totalRate = totalCost > 0 ? (totalPl / totalCost) * 100 : 0;
    summary.innerHTML =
      TMAD.card("총 매입금액", fmtWon(totalCost), "") +
      TMAD.card("총 평가금액", fmtWon(totalValue), "") +
      TMAD.card("평가손익", fmtWon(totalPl), signClass(totalPl)) +
      TMAD.card("수익률", fmtPct(totalRate), signClass(totalRate));

    renderChart(holdings, totalValue);
  }

  /* ---------- 자산 비중 도넛 차트 ---------- */

  var CHART_COLORS = [
    "#4880ee", "#e5443c", "#f2a93b", "#3bbf8a", "#9b6ef3",
    "#e96fae", "#5bc8e8", "#aab84c", "#d98452", "#7a86a8"
  ];

  function renderChart(holdings, totalValue) {
    var chartCard = document.getElementById("chart-card");
    var svg = document.getElementById("donut");
    var legend = document.getElementById("chart-legend");

    if (holdings.length === 0 || totalValue <= 0) {
      chartCard.hidden = true;
      return;
    }
    chartCard.hidden = false;
    svg.innerHTML = "";
    legend.innerHTML = "";

    // 평가금액 큰 순서로 정렬
    var items = holdings
      .map(function (h) { return { name: h.name, value: h.qty * h.curPrice }; })
      .filter(function (it) { return it.value > 0; })
      .sort(function (a, b) { return b.value - a.value; });

    var R = 60, CX = 80, CY = 80;
    var C = 2 * Math.PI * R;
    var offset = C / 4; // 12시 방향에서 시작

    items.forEach(function (it, i) {
      var color = CHART_COLORS[i % CHART_COLORS.length];
      var frac = it.value / totalValue;
      var len = frac * C;
      var seg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      seg.setAttribute("cx", CX);
      seg.setAttribute("cy", CY);
      seg.setAttribute("r", R);
      seg.setAttribute("fill", "none");
      seg.setAttribute("stroke", color);
      seg.setAttribute("stroke-width", 26);
      seg.setAttribute("stroke-dasharray", Math.max(0, len - 1.5) + " " + (C - len + 1.5));
      seg.setAttribute("stroke-dashoffset", offset);
      svg.appendChild(seg);
      offset -= len;

      var li = document.createElement("li");
      var dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = color;
      var name = document.createElement("span");
      name.textContent = it.name;
      var pct = document.createElement("span");
      pct.className = "pct";
      pct.textContent = (frac * 100).toFixed(1) + "%";
      li.appendChild(dot);
      li.appendChild(name);
      li.appendChild(pct);
      legend.appendChild(li);
    });
  }

  /* ---------- 종목명 자동완성 + 현재가 자동 채움 ---------- */

  var nameInput = document.getElementById("f-name");
  var curInput = document.getElementById("f-cur");

  var datalist = document.getElementById("stock-names");
  Object.keys(byName).sort().forEach(function (name) {
    var opt = document.createElement("option");
    opt.value = name;
    datalist.appendChild(opt);
  });

  nameInput.addEventListener("change", function () {
    var found = byName[nameInput.value.trim()];
    if (found && !curInput.value) curInput.value = found.price;
  });

  /* ---------- 시황 데이터로 현재가 일괄 갱신 ---------- */

  document.getElementById("sync-btn").addEventListener("click", function () {
    var holdings = store.load();
    var updated = 0;
    holdings.forEach(function (h) {
      var found = findStock(h);
      if (found) {
        h.curPrice = found.price;
        if (!h.code) h.code = found.code; // 이름으로 찾았으면 코드를 기억해 둔다
        updated++;
      }
    });
    store.save(holdings);
    render();
    var note = document.getElementById("sync-note");
    note.textContent = updated > 0
      ? updated + "개 종목 현재가를 시황 데이터(" + MARKET_DATA.asOf + ") 기준으로 갱신했습니다."
      : "시황 데이터에서 일치하는 종목을 찾지 못했습니다.";
  });

  /* ---------- 추가 / 삭제 ---------- */

  document.getElementById("add-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var name = nameInput.value.trim();
    var matched = byName[name];
    store.add({
      name: name,
      code: matched ? matched.code : null,
      qty: Number(document.getElementById("f-qty").value),
      avgPrice: Number(document.getElementById("f-avg").value),
      curPrice: Number(curInput.value)
    });
    e.target.reset();
    render();
  });

  document.getElementById("holdings-body").addEventListener("click", function (e) {
    var btn = e.target.closest(".del-btn");
    if (!btn) return;
    store.remove(btn.dataset.id);
    render();
  });

  /* ---------- init ---------- */

  if (typeof MARKET_DATA !== "undefined") {
    document.getElementById("asof").textContent = "시황 기준: " + MARKET_DATA.asOf;
  }
  render();
})();
