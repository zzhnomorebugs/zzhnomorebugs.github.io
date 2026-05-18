(function () {
  "use strict";

  var HEADER_RESERVE_PCT = 13;
  var FOOTER_RESERVE_PCT = 5;

  function hexToRgb(hex) {
    var h = hex.replace("#", "");
    if (h.length === 3) {
      h = h.split("").map(function (c) {
        return c + c;
      }).join("");
    }
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }

  function isLightColor(hex) {
    var c = hexToRgb(hex);
    var lum = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
    return lum > 0.58;
  }

  function assignColumnColors(projects, columns) {
    if (!columns || !columns.length) return;

    columns.forEach(function (col, laneIdx) {
      var palette = col.palette && col.palette.length ? col.palette : [col.color];
      var laneProjects = projects
        .filter(function (p) {
          return p.lane === laneIdx;
        })
        .sort(function (a, b) {
          return a.startIdx - b.startIdx;
        });

      laneProjects.forEach(function (p, i) {
        p.color = palette[Math.min(i, palette.length - 1)];
      });
    });
  }

  function parseJsonEl(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    try {
      return JSON.parse(el.textContent);
    } catch (e) {
      return null;
    }
  }

  function parseMonth(str) {
    if (!str) return null;
    var parts = str.split("-");
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) || 1;
    return y * 12 + (m - 1);
  }

  function formatMonth(idx) {
    var y = Math.floor(idx / 12);
    var m = (idx % 12) + 1;
    return y + "-" + String(m).padStart(2, "0");
  }

  function formatLabel(idx) {
    var y = Math.floor(idx / 12);
    var m = (idx % 12) + 1;
    if (m === 1) return String(y);
    return y + "/" + m;
  }

  function currentMonth() {
    var now = new Date();
    return now.getFullYear() * 12 + now.getMonth();
  }

  function assignLanes(projects) {
    var manual = projects.every(function (p) {
      return p.lane !== null && p.lane !== undefined;
    });
    if (manual) return projects;

    var sorted = projects.slice().sort(function (a, b) {
      return a.startIdx - b.startIdx;
    });
    var laneEnds = [];

    sorted.forEach(function (p) {
      var placed = false;
      for (var i = 0; i < laneEnds.length; i++) {
        if (p.startIdx >= laneEnds[i]) {
          p.lane = i;
          laneEnds[i] = p.endIdx + 1;
          placed = true;
          break;
        }
      }
      if (!placed) {
        p.lane = laneEnds.length;
        laneEnds.push(p.endIdx + 1);
      }
    });

    return projects;
  }

  function renderAxis(axisEl, t0, t1) {
    axisEl.innerHTML = "";
    var span = t1 - t0;
    if (span <= 0) return;

    var startYear = Math.ceil(t0 / 12) * 12;

    for (var tick = startYear; tick <= t1; tick += 12) {
      var pct = ((tick - t0) / span) * 100;
      var item = document.createElement("div");
      item.className = "timeline__tick";
      item.style.bottom = pct + "%";
      item.innerHTML =
        '<span class="timeline__tick-line"></span>' +
        '<span class="timeline__tick-label">' +
        formatLabel(tick) +
        "</span>";
      axisEl.appendChild(item);
    }
  }

  function cssUrl(value) {
    return 'url("' + String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '")';
  }

  function appendBarContent(el, p) {
    var text = document.createElement("span");
    text.className = "timeline__bar-label";
    text.textContent = p.name;

    var period = document.createElement("span");
    period.className = "timeline__bar-period";
    period.textContent = formatMonth(p.startIdx) + " - " + formatMonth(p.endIdx);

    if (p.image) {
      el.classList.add("timeline__bar--has-image");
      el.style.setProperty("--timeline-col-color", p.color);
      el.style.setProperty("--timeline-bar-image", cssUrl(p.image));

      var media = document.createElement("span");
      media.className = "timeline__bar-media";
      media.setAttribute("aria-hidden", "true");

      var overlay = document.createElement("span");
      overlay.className = "timeline__bar-overlay";
      overlay.setAttribute("aria-hidden", "true");

      el.appendChild(media);
      el.appendChild(overlay);
      el.appendChild(text);
      el.appendChild(period);
      return;
    }

    el.style.backgroundColor = p.color;
    if (isLightColor(p.color)) {
      el.classList.add("timeline__bar--light");
    }
    el.appendChild(text);
    el.appendChild(period);
  }

  function laneGeometry(laneCount) {
    var gap = 0.04;
    var laneWidth = (100 - gap * (laneCount - 1)) / laneCount;
    return { gap: gap, laneWidth: laneWidth };
  }

  function laneLeft(lane, geom) {
    return lane * (geom.laneWidth + geom.gap);
  }

  function createColumnLabel(col, index, geom, placement) {
    var el = document.createElement("div");
    el.className = "timeline__col-label timeline__col-label--" + placement;
    el.style.left = laneLeft(index, geom) + "%";
    el.style.width = geom.laneWidth + "%";
    el.textContent = col.label;
    if (col.color) {
      el.style.setProperty("--timeline-col-color", col.color);
      el.style.color = col.color;
    }
    return el;
  }

  function renderColumnLabels(chartEl, columns, laneCount) {
    if (!columns || !columns.length) return;
    var geom = laneGeometry(laneCount);
    columns.forEach(function (col, i) {
      if (i >= laneCount) return;
      chartEl.appendChild(createColumnLabel(col, i, geom, "top"));
    });
  }

  function renderBars(chartEl, projects, t0, t1, laneCount, columns) {
    chartEl.innerHTML = "";
    var span = t1 - t0;
    if (span <= 0) return;

    var geom = laneGeometry(laneCount);

    var plotSpanPct = 100 - HEADER_RESERVE_PCT - FOOTER_RESERVE_PCT;
    var plotScale = plotSpanPct / 100;

    projects.forEach(function (p, i) {
      var rawBottom = ((p.startIdx - t0) / span) * 100;
      var rawHeight = ((p.endIdx - p.startIdx + 1) / span) * 100;
      rawHeight = Math.max(rawHeight * 1.14, 3.2);
      var bottomPct = FOOTER_RESERVE_PCT + rawBottom * plotScale;
      var heightPct = rawHeight * plotScale;

      var leftPct = laneLeft(p.lane, geom);
      var el;
      var title =
        p.name + " (" + formatMonth(p.startIdx) + " – " + formatMonth(p.endIdx) + ")";

      if (p.url) {
        el = document.createElement("a");
        el.href = p.url;
        el.className = "timeline__bar";
      } else {
        el = document.createElement("div");
        el.className = "timeline__bar timeline__bar--static";
      }

      el.style.bottom = bottomPct + "%";
      el.style.height = heightPct + "%";
      el.style.left = leftPct + "%";
      el.style.width = geom.laneWidth + "%";
      el.style.borderColor = "rgba(0, 0, 0, 0.12)";
      el.title = title;
      el.setAttribute("aria-label", title);

      appendBarContent(el, p);

      chartEl.appendChild(el);
    });

    renderColumnLabels(chartEl, columns, laneCount);
  }

  function init() {
    var projects = parseJsonEl("timeline-data");
    var range = parseJsonEl("timeline-range");
    var columns = parseJsonEl("timeline-columns");
    if (!projects || !projects.length) return;

    var chartEl = document.getElementById("timeline-chart");
    var axisEl = document.getElementById("timeline-axis");
    if (!chartEl || !axisEl) return;

    var now = currentMonth();

    projects.forEach(function (p) {
      p.startIdx = parseMonth(p.start);
      p.endIdx = p.end ? parseMonth(p.end) : now;
      if (p.endIdx < p.startIdx) p.endIdx = p.startIdx;
    });

    var t0 = range && range.start ? parseMonth(range.start) : null;
    var t1 = range && range.end ? parseMonth(range.end) : now;

    if (t0 === null) {
      t0 = projects.reduce(function (min, p) {
        return Math.min(min, p.startIdx);
      }, projects[0].startIdx);
    }
    if (t1 === null) {
      t1 = now;
    }

    assignLanes(projects);
    assignColumnColors(projects, columns);

    var laneCount = columns && columns.length
      ? columns.length
      : projects.reduce(function (max, p) {
          return Math.max(max, p.lane + 1);
        }, 1);

    chartEl.style.setProperty("--timeline-lanes", laneCount);

    renderAxis(axisEl, t0, t1);
    renderBars(chartEl, projects, t0, t1, laneCount, columns);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
