/* 업종별 등락 히트맵 (squarified treemap, 의존성 없음) */
(function () {
  "use strict";

  if (typeof MARKET_DATA === "undefined") {
    document.getElementById("heatmap").innerHTML =
      '<div class="empty-note" style="padding:40px">시황 데이터(assets/js/data.js)를 불러오지 못했습니다.</div>';
    return;
  }

  var SECTOR_GAP = 3;      // 업종 블록 사이 간격(px)
  var HEADER_H = 22;       // 업종 헤더 높이(px)
  var CLAMP = 3;           // 등락률 색상 포화 한계(±%)

  // 한국 시장 관례: 상승=빨강, 하락=파랑, 보합=어두운 회색
  var DOWN_COLOR = [72, 128, 238];  // #4880ee
  var FLAT_COLOR = [63, 71, 86];    // #3f4756
  var UP_COLOR = [229, 68, 60];     // #e5443c

  function lerp(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t)
    ];
  }

  function changeColor(change) {
    var t = Math.max(-1, Math.min(1, change / CLAMP));
    var rgb = t >= 0 ? lerp(FLAT_COLOR, UP_COLOR, t) : lerp(FLAT_COLOR, DOWN_COLOR, -t);
    return "rgb(" + rgb.join(",") + ")";
  }

  /* ---------- squarified treemap ---------- */

  function worstRatio(row, side) {
    var sum = 0, max = -Infinity, min = Infinity;
    for (var i = 0; i < row.length; i++) {
      sum += row[i];
      if (row[i] > max) max = row[i];
      if (row[i] < min) min = row[i];
    }
    var s2 = sum * sum, side2 = side * side;
    return Math.max(side2 * max / s2, s2 / (side2 * min));
  }

  // values(내림차순 권장)를 (x,y,w,h) 영역에 배치한 사각형 목록을 돌려준다
  function layoutTreemap(values, x, y, w, h) {
    var total = 0;
    for (var i = 0; i < values.length; i++) total += values[i];
    if (total <= 0 || w <= 0 || h <= 0) return values.map(function () {
      return { x: x, y: y, w: 0, h: 0 };
    });

    var areas = values.map(function (v) { return v * w * h / total; });
    var rects = new Array(values.length);
    var idx = 0;

    while (idx < areas.length) {
      var horizontal = w >= h;          // 가로로 넓으면 세로 줄을 쌓는다
      var side = horizontal ? h : w;
      var row = [areas[idx]];
      var next = idx + 1;

      while (next < areas.length) {
        var candidate = row.concat(areas[next]);
        if (worstRatio(candidate, side) <= worstRatio(row, side)) {
          row = candidate;
          next++;
        } else break;
      }

      var rowSum = 0;
      for (var r = 0; r < row.length; r++) rowSum += row[r];
      var thickness = rowSum / side;
      var offset = 0;

      for (var k = 0; k < row.length; k++) {
        var len = row[k] / thickness;
        rects[idx + k] = horizontal
          ? { x: x, y: y + offset, w: thickness, h: len }
          : { x: x + offset, y: y, w: len, h: thickness };
        offset += len;
      }

      if (horizontal) { x += thickness; w -= thickness; }
      else { y += thickness; h -= thickness; }
      idx = next;
    }
    return rects;
  }

  /* ---------- rendering ---------- */

  // 잘못된 weight(음수/NaN)가 들어와도 레이아웃이 깨지지 않게 0으로 보정
  function tileWeight(stock) {
    var w = Number(stock.weight);
    return Number.isFinite(w) && w > 0 ? w : 0;
  }

  var formatChange = TMAD.fmtPct;

  function makeTile(stock, sectorName, rect) {
    var tile = document.createElement("div");
    tile.className = "tile";
    tile.style.left = rect.x + "px";
    tile.style.top = rect.y + "px";
    tile.style.width = rect.w + "px";
    tile.style.height = rect.h + "px";
    tile.style.background = changeColor(stock.change);

    var fontSize = Math.max(10, Math.min(24, Math.sqrt(rect.w * rect.h) / 6));
    if (rect.w > 42 && rect.h > 20) {
      var name = document.createElement("div");
      name.className = "t-name";
      name.textContent = stock.name;
      name.style.fontSize = fontSize + "px";
      tile.appendChild(name);

      if (rect.h > fontSize * 2.6) {
        var chg = document.createElement("div");
        chg.className = "t-change";
        chg.textContent = formatChange(stock.change);
        chg.style.fontSize = Math.max(9, fontSize * 0.8) + "px";
        tile.appendChild(chg);
      }
    }

    tile.addEventListener("mousemove", function (e) { showTooltip(e, stock, sectorName); });
    tile.addEventListener("mouseleave", hideTooltip);
    tile.addEventListener("click", function () {
      hideTooltip();
      if (window.TMAD_DETAIL) window.TMAD_DETAIL.open(stock, sectorName);
    });
    return tile;
  }

  function render() {
    var container = document.getElementById("heatmap");
    container.innerHTML = "";

    var W = container.clientWidth;
    var H = container.clientHeight;
    if (W === 0 || H === 0) return;

    var sectors = MARKET_DATA.sectors.slice().sort(function (a, b) { return a.rank - b.rank; });
    var sectorWeights = sectors.map(function (s) {
      return s.stocks.reduce(function (sum, st) { return sum + tileWeight(st); }, 0);
    });

    var sectorRects = layoutTreemap(sectorWeights, 0, 0, W, H);

    sectors.forEach(function (sector, i) {
      var rect = sectorRects[i];
      var box = document.createElement("div");
      box.className = "sector";
      box.style.left = rect.x + "px";
      box.style.top = rect.y + "px";
      box.style.width = Math.max(0, rect.w - SECTOR_GAP) + "px";
      box.style.height = Math.max(0, rect.h - SECTOR_GAP) + "px";

      var innerW = Math.max(0, rect.w - SECTOR_GAP);
      var headerH = innerW > 60 ? HEADER_H : 0;
      var innerH = Math.max(0, rect.h - SECTOR_GAP - headerH);

      if (headerH > 0) {
        var header = document.createElement("div");
        header.className = "sector-header";
        header.style.height = headerH + "px";

        var badge = document.createElement("span");
        badge.className = "sector-rank";
        badge.textContent = sector.rank;
        header.appendChild(badge);
        header.appendChild(document.createTextNode(sector.name));
        box.appendChild(header);
      }

      var stocks = sector.stocks.slice().sort(function (a, b) { return tileWeight(b) - tileWeight(a); });
      var stockRects = layoutTreemap(
        stocks.map(tileWeight),
        0, headerH, innerW, innerH
      );

      stocks.forEach(function (stock, j) {
        box.appendChild(makeTile(stock, sector.name, stockRects[j]));
      });

      container.appendChild(box);
    });
  }

  /* ---------- tooltip ---------- */

  var tooltip = document.getElementById("tooltip");

  function showTooltip(e, stock, sectorName) {
    var cls = stock.change > 0 ? "tt-up" : stock.change < 0 ? "tt-down" : "tt-flat";
    var priceLine = stock.price != null
      ? '<div>' + stock.price.toLocaleString("ko-KR") + "원</div>"
      : "";
    tooltip.innerHTML =
      '<div class="tt-sector">' + TMAD.escapeHtml(sectorName) + "</div>" +
      '<div class="tt-name">' + TMAD.escapeHtml(stock.name) +
      " <span class='tt-sector'>" + TMAD.escapeHtml(stock.code) + "</span></div>" +
      priceLine +
      '<div class="' + cls + '">' + formatChange(stock.change) + "</div>";
    tooltip.hidden = false;

    var pad = 14;
    var x = e.clientX + pad, y = e.clientY + pad;
    var tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
    if (x + tw > window.innerWidth - 8) x = e.clientX - tw - pad;
    if (y + th > window.innerHeight - 8) y = e.clientY - th - pad;
    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";
  }

  function hideTooltip() {
    tooltip.hidden = true;
  }

  /* ---------- 지수 요약 ---------- */

  function renderIndices() {
    var wrap = document.getElementById("indices");
    if (!wrap || !MARKET_DATA.indices) return;
    MARKET_DATA.indices.forEach(function (idx) {
      var cls = idx.change > 0 ? "up" : idx.change < 0 ? "down" : "";
      var card = document.createElement("div");
      card.className = "index-card";
      card.innerHTML =
        '<span class="ix-name">' + TMAD.escapeHtml(idx.name) + "</span>" +
        '<span class="ix-value">' + idx.value.toLocaleString("ko-KR", { minimumFractionDigits: 2 }) + "</span>" +
        '<span class="ix-change ' + cls + '">' + formatChange(idx.change) + "</span>";
      wrap.appendChild(card);
    });
  }

  /* ---------- init ---------- */

  document.getElementById("asof").textContent = "기준: " + MARKET_DATA.asOf;
  renderIndices();
  render();

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 120);
  });
})();
