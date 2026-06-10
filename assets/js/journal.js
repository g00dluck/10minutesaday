/* 매매일지: localStorage 기반 매매 기록 (최신순 표시) */
(function () {
  "use strict";

  var STORAGE_KEY = "tmad.journal.v1";

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function save(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function fmtWon(n) {
    return Math.round(n).toLocaleString("ko-KR") + "원";
  }

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function render() {
    var entries = load();
    var tbody = document.getElementById("journal-body");
    var summary = document.getElementById("summary");
    tbody.innerHTML = "";

    var buyTotal = 0, sellTotal = 0;

    // 최신 일자 우선, 같은 일자면 나중에 기록한 것 우선
    var ordered = entries
      .map(function (e, i) { return { e: e, i: i }; })
      .sort(function (a, b) {
        return a.e.date === b.e.date ? b.i - a.i : (a.e.date < b.e.date ? 1 : -1);
      });

    ordered.forEach(function (item) {
      var e = item.e;
      var amount = e.qty * e.price;
      if (e.side === "buy") buyTotal += amount;
      else sellTotal += amount;

      var sideCls = e.side === "buy" ? "up" : "down";
      var sideLabel = e.side === "buy" ? "매수" : "매도";
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + e.date + "</td>" +
        "<td>" + escapeHtml(e.name) + "</td>" +
        '<td class="' + sideCls + '">' + sideLabel + "</td>" +
        "<td>" + e.qty.toLocaleString("ko-KR") + "</td>" +
        "<td>" + fmtWon(e.price) + "</td>" +
        "<td>" + fmtWon(amount) + "</td>" +
        '<td class="memo">' + escapeHtml(e.memo || "") + "</td>" +
        '<td><button type="button" class="del-btn" data-i="' + item.i + '">삭제</button></td>';
      tbody.appendChild(tr);
    });

    if (entries.length === 0) {
      var tr = document.createElement("tr");
      tr.innerHTML = '<td colspan="8" class="empty-note">아래에서 매매 내역을 기록해 보세요.</td>';
      tbody.appendChild(tr);
    }

    summary.innerHTML =
      card("기록 수", entries.length + "건", "") +
      card("총 매수금액", fmtWon(buyTotal), "up") +
      card("총 매도금액", fmtWon(sellTotal), "down");
  }

  function card(label, value, cls) {
    return '<div class="card"><div class="label">' + label +
      '</div><div class="value ' + cls + '">' + value + "</div></div>";
  }

  /* ---------- 종목명 자동완성 ---------- */

  var datalist = document.getElementById("stock-names");
  if (typeof MARKET_DATA !== "undefined") {
    var names = [];
    MARKET_DATA.sectors.forEach(function (sector) {
      sector.stocks.forEach(function (s) { names.push(s.name); });
    });
    names.sort().forEach(function (name) {
      var opt = document.createElement("option");
      opt.value = name;
      datalist.appendChild(opt);
    });
    document.getElementById("asof").textContent = "시황 기준: " + MARKET_DATA.asOf;
  }

  /* ---------- 추가 / 삭제 ---------- */

  document.getElementById("add-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var entries = load();
    entries.push({
      date: document.getElementById("f-date").value,
      name: document.getElementById("f-name").value.trim(),
      side: document.getElementById("f-side").value,
      qty: Number(document.getElementById("f-qty").value),
      price: Number(document.getElementById("f-price").value),
      memo: document.getElementById("f-memo").value.trim()
    });
    save(entries);
    e.target.reset();
    setToday();
    render();
  });

  document.getElementById("journal-body").addEventListener("click", function (e) {
    var btn = e.target.closest(".del-btn");
    if (!btn) return;
    var entries = load();
    entries.splice(Number(btn.dataset.i), 1);
    save(entries);
    render();
  });

  /* ---------- init ---------- */

  function setToday() {
    var kst = new Date(Date.now() + 9 * 3600 * 1000);
    document.getElementById("f-date").value = kst.toISOString().slice(0, 10);
  }

  setToday();
  render();
})();
