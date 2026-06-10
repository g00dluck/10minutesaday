/* 포트폴리오: localStorage 기반 보유 종목 관리
 * 시황 데이터(MARKET_DATA)에 있는 종목은 현재가를 자동으로 채우고 일괄 갱신할 수 있다. */
(function () {
  "use strict";

  var STORAGE_KEY = "tmad.holdings.v1";

  /* ---------- 시황 데이터 색인 (종목명 → {code, price}) ---------- */

  var stockIndex = {};
  if (typeof MARKET_DATA !== "undefined") {
    MARKET_DATA.sectors.forEach(function (sector) {
      sector.stocks.forEach(function (s) {
        if (s.price != null) stockIndex[s.name] = { code: s.code, price: s.price };
      });
    });
  }

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function save(holdings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings));
  }

  function fmtWon(n) {
    return Math.round(n).toLocaleString("ko-KR") + "원";
  }

  function fmtPct(n) {
    return (n > 0 ? "+" : "") + n.toFixed(2) + "%";
  }

  function signClass(n) {
    return n > 0 ? "up" : n < 0 ? "down" : "";
  }

  function render() {
    var holdings = load();
    var tbody = document.getElementById("holdings-body");
    var summary = document.getElementById("summary");
    tbody.innerHTML = "";

    var totalCost = 0, totalValue = 0;

    holdings.forEach(function (h, i) {
      var cost = h.qty * h.avgPrice;
      var value = h.qty * h.curPrice;
      var pl = value - cost;
      var rate = cost > 0 ? (pl / cost) * 100 : 0;
      totalCost += cost;
      totalValue += value;

      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + escapeHtml(h.name) + "</td>" +
        "<td>" + h.qty.toLocaleString("ko-KR") + "</td>" +
        "<td>" + fmtWon(h.avgPrice) + "</td>" +
        "<td>" + fmtWon(h.curPrice) + "</td>" +
        "<td>" + fmtWon(value) + "</td>" +
        '<td class="' + signClass(pl) + '">' + fmtWon(pl) + "</td>" +
        '<td class="' + signClass(rate) + '">' + fmtPct(rate) + "</td>" +
        '<td><button type="button" class="del-btn" data-i="' + i + '">삭제</button></td>';
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
      card("총 매입금액", fmtWon(totalCost), "") +
      card("총 평가금액", fmtWon(totalValue), "") +
      card("평가손익", fmtWon(totalPl), signClass(totalPl)) +
      card("수익률", fmtPct(totalRate), signClass(totalRate));
  }

  function card(label, value, cls) {
    return '<div class="card"><div class="label">' + label +
      '</div><div class="value ' + cls + '">' + value + "</div></div>";
  }

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  /* ---------- 종목명 자동완성 + 현재가 자동 채움 ---------- */

  var nameInput = document.getElementById("f-name");
  var curInput = document.getElementById("f-cur");

  var datalist = document.getElementById("stock-names");
  Object.keys(stockIndex).sort().forEach(function (name) {
    var opt = document.createElement("option");
    opt.value = name;
    datalist.appendChild(opt);
  });

  nameInput.addEventListener("change", function () {
    var found = stockIndex[nameInput.value.trim()];
    if (found && !curInput.value) curInput.value = found.price;
  });

  /* ---------- 시황 데이터로 현재가 일괄 갱신 ---------- */

  document.getElementById("sync-btn").addEventListener("click", function () {
    var holdings = load();
    var updated = 0;
    holdings.forEach(function (h) {
      var found = stockIndex[h.name];
      if (found) {
        h.curPrice = found.price;
        updated++;
      }
    });
    save(holdings);
    render();
    var note = document.getElementById("sync-note");
    note.textContent = updated > 0
      ? updated + "개 종목 현재가를 시황 데이터(" + MARKET_DATA.asOf + ") 기준으로 갱신했습니다."
      : "시황 데이터에서 일치하는 종목을 찾지 못했습니다.";
  });

  /* ---------- 추가 / 삭제 ---------- */

  document.getElementById("add-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var holdings = load();
    holdings.push({
      name: nameInput.value.trim(),
      qty: Number(document.getElementById("f-qty").value),
      avgPrice: Number(document.getElementById("f-avg").value),
      curPrice: Number(curInput.value)
    });
    save(holdings);
    e.target.reset();
    render();
  });

  document.getElementById("holdings-body").addEventListener("click", function (e) {
    var btn = e.target.closest(".del-btn");
    if (!btn) return;
    var holdings = load();
    holdings.splice(Number(btn.dataset.i), 1);
    save(holdings);
    render();
  });

  /* ---------- init ---------- */

  if (typeof MARKET_DATA !== "undefined") {
    document.getElementById("asof").textContent = "시황 기준: " + MARKET_DATA.asOf;
  }
  render();
})();
