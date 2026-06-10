/* 포트폴리오: localStorage 기반 보유 종목 관리 (1단계 — 현재가 수동 입력) */
(function () {
  "use strict";

  var STORAGE_KEY = "tmad.holdings.v1";

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

  document.getElementById("add-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var holdings = load();
    holdings.push({
      name: document.getElementById("f-name").value.trim(),
      qty: Number(document.getElementById("f-qty").value),
      avgPrice: Number(document.getElementById("f-avg").value),
      curPrice: Number(document.getElementById("f-cur").value)
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

  render();
})();
