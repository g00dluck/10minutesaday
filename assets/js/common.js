/* 페이지 공통 유틸 — 모든 페이지 스크립트보다 먼저 로드할 것 */
var TMAD = (function () {
  "use strict";

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s == null ? "" : String(s);
    return div.innerHTML;
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

  function card(label, value, cls) {
    return '<div class="card"><div class="label">' + escapeHtml(label) +
      '</div><div class="value ' + cls + '">' + escapeHtml(value) + "</div></div>";
  }

  /* localStorage 배열 저장소. 항목에 고유 id를 보장한다(삭제를 인덱스가 아닌 id로). */
  function makeStore(key) {
    var seq = 0;

    function newId() {
      return Date.now().toString(36) + "-" + (seq++) + "-" + Math.random().toString(36).slice(2, 7);
    }

    function load() {
      var items;
      try {
        items = JSON.parse(localStorage.getItem(key));
      } catch (e) {
        items = null;
      }
      if (!Array.isArray(items)) return [];
      var changed = false;
      items.forEach(function (it) {
        if (it && typeof it === "object" && !it.id) {
          it.id = newId();
          changed = true;
        }
      });
      if (changed) save(items);
      return items;
    }

    function save(items) {
      localStorage.setItem(key, JSON.stringify(items));
    }

    function add(item) {
      var items = load();
      item.id = newId();
      items.push(item);
      save(items);
      return items;
    }

    function remove(id) {
      var items = load().filter(function (it) { return it.id !== id; });
      save(items);
      return items;
    }

    return { load: load, save: save, add: add, remove: remove };
  }

  return {
    escapeHtml: escapeHtml,
    fmtWon: fmtWon,
    fmtPct: fmtPct,
    signClass: signClass,
    card: card,
    makeStore: makeStore
  };
})();
