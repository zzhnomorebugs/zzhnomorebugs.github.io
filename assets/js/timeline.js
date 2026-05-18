(function () {
  "use strict";

  var BASE_MONTH_HEIGHT = 24;
  var CARD_INTERVAL_PADDING = 32;
  var CHART_PADDING = 24;

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

  function currentMonth() {
    var now = new Date();
    return now.getFullYear() * 12 + now.getMonth();
  }

  function buildActiveMonths(projects, t0, t1) {
    var active = {};

    projects.forEach(function (p) {
      var start = Math.max(p.startIdx, t0);
      var end = Math.min(p.endIdx, t1);

      for (var month = start; month <= end; month++) {
        active[month] = true;
      }
    });

    return Object.keys(active)
      .map(function (month) {
        return Number(month);
      })
      .sort(function (a, b) {
        return a - b;
      });
  }

  function activeMonthRanks(activeMonths) {
    var ranks = {};

    activeMonths.forEach(function (month, i) {
      ranks[month] = i;
    });

    return ranks;
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

  function createYearTick(year, top) {
    var item = document.createElement("div");
    item.className = "timeline__tick";
    item.style.top = top + "px";
    item.innerHTML =
      '<span class="timeline__tick-line"></span>' +
      '<span class="timeline__tick-label">' +
      year +
      "</span>";
    return item;
  }

  function renderAxis(axisEl, activeMonths, ranks, scale, gridTop) {
    axisEl.innerHTML = "";
    var activeCount = activeMonths.length;
    var years = {};
    var axisHeight = gridTop + CHART_PADDING * 2 + activeCount * scale;

    axisEl.style.height = axisHeight + "px";

    activeMonths.forEach(function (month) {
      var year = Math.floor(month / 12);
      var rank = ranks[month];
      var top = gridTop + CHART_PADDING + (activeCount - 1 - rank) * scale;

      if (!Object.prototype.hasOwnProperty.call(years, year) || top < years[year]) {
        years[year] = top;
      }
    });

    Object.keys(years)
      .sort(function (a, b) {
        return Number(b) - Number(a);
      })
      .forEach(function (year) {
        axisEl.appendChild(createYearTick(year, years[year]));
      });
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

      var media = document.createElement("span");
      media.className = "timeline__bar-media";

      var img = document.createElement("img");
      img.className = "timeline__bar-image";
      img.src = p.image;
      img.alt = "";
      img.loading = "lazy";

      var content = document.createElement("span");
      content.className = "timeline__bar-content";

      media.appendChild(img);
      content.appendChild(text);
      content.appendChild(period);
      el.appendChild(media);
      el.appendChild(content);
      return;
    }

    el.style.setProperty("--timeline-col-color", p.color);

    var fallbackContent = document.createElement("span");
    fallbackContent.className = "timeline__bar-content";
    fallbackContent.appendChild(text);
    fallbackContent.appendChild(period);
    el.appendChild(fallbackContent);
  }

  function createColumnLabel(col) {
    var el = document.createElement("div");
    el.className = "timeline__col-label";
    el.textContent = col.label;
    if (col.color) {
      el.style.setProperty("--timeline-col-color", col.color);
      el.style.color = col.color;
    }
    return el;
  }

  function createBar(p) {
    var el;
    var title =
      p.name + " (" + formatMonth(p.startIdx) + " - " + formatMonth(p.endIdx) + ")";

    if (p.url) {
      el = document.createElement("a");
      el.href = p.url;
      el.className = "timeline__bar";
    } else {
      el = document.createElement("div");
      el.className = "timeline__bar timeline__bar--static";
    }

    el.title = title;
    el.setAttribute("aria-label", title);
    el.setAttribute("data-start-idx", p.layoutStartIdx);
    el.setAttribute("data-end-idx", p.layoutEndIdx);
    el.setAttribute("data-lane", p.lane);
    if (p.color) {
      el.style.setProperty("--timeline-col-color", p.color);
    }
    appendBarContent(el, p);
    return el;
  }

  function renderBars(chartEl, projects, laneCount, columns) {
    chartEl.innerHTML = "";
    var labels = document.createElement("div");
    labels.className = "timeline__columns";

    var grid = document.createElement("div");
    grid.className = "timeline__grid";

    for (var i = 0; i < laneCount; i++) {
      var col = columns && columns[i] ? columns[i] : null;
      var lane = document.createElement("div");
      lane.className = "timeline__lane";

      if (col) {
        labels.appendChild(createColumnLabel(col));
      } else {
        labels.appendChild(document.createElement("div"));
      }

      projects
        .filter(function (p) {
          return p.lane === i && p.layoutStartIdx <= p.layoutEndIdx;
        })
        .sort(function (a, b) {
          if (b.endIdx !== a.endIdx) return b.endIdx - a.endIdx;
          return b.startIdx - a.startIdx;
        })
        .forEach(function (p) {
          lane.appendChild(createBar(p));
        });

      grid.appendChild(lane);
    }

    chartEl.appendChild(labels);
    chartEl.appendChild(grid);
  }

  function requiredScale(cards, ranks) {
    var scale = cards.reduce(function (value, card) {
      var startIdx = Number(card.getAttribute("data-start-idx"));
      var endIdx = Number(card.getAttribute("data-end-idx"));
      var duration = Math.max(ranks[endIdx] - ranks[startIdx] + 1, 1);
      var cardHeight = card.offsetHeight;
      return Math.max(value, (cardHeight + CARD_INTERVAL_PADDING) / duration);
    }, BASE_MONTH_HEIGHT);

    var lanes = {};
    cards.forEach(function (card) {
      var lane = card.getAttribute("data-lane");
      if (!lanes[lane]) lanes[lane] = [];
      lanes[lane].push(card);
    });

    Object.keys(lanes).forEach(function (lane) {
      var laneCards = lanes[lane].sort(function (a, b) {
        var aStart = Number(a.getAttribute("data-start-idx"));
        var aEnd = Number(a.getAttribute("data-end-idx"));
        var bStart = Number(b.getAttribute("data-start-idx"));
        var bEnd = Number(b.getAttribute("data-end-idx"));
        var aStartRank = ranks[aStart];
        var aEndRank = ranks[aEnd];
        var bStartRank = ranks[bStart];
        var bEndRank = ranks[bEnd];
        var aCenter = aEndRank - (aEndRank - aStartRank + 1) / 2;
        var bCenter = bEndRank - (bEndRank - bStartRank + 1) / 2;
        return bCenter - aCenter;
      });

      for (var i = 1; i < laneCards.length; i++) {
        var prev = laneCards[i - 1];
        var next = laneCards[i];
        var prevStart = Number(prev.getAttribute("data-start-idx"));
        var prevEnd = Number(prev.getAttribute("data-end-idx"));
        var nextStart = Number(next.getAttribute("data-start-idx"));
        var nextEnd = Number(next.getAttribute("data-end-idx"));
        var prevStartRank = ranks[prevStart];
        var prevEndRank = ranks[prevEnd];
        var nextStartRank = ranks[nextStart];
        var nextEndRank = ranks[nextEnd];
        var prevCenter = prevEndRank - (prevEndRank - prevStartRank + 1) / 2;
        var nextCenter = nextEndRank - (nextEndRank - nextStartRank + 1) / 2;
        var distance = prevCenter - nextCenter;

        if (distance > 0) {
          scale = Math.max(
            scale,
            (CARD_INTERVAL_PADDING + (prev.offsetHeight + next.offsetHeight) / 2) / distance
          );
        }
      }
    });

    return scale;
  }

  function layoutTimeline(axisEl, chartEl, activeMonths, ranks) {
    var grid = chartEl.querySelector(".timeline__grid");
    if (!grid) return;

    var cards = Array.prototype.slice.call(chartEl.querySelectorAll(".timeline__bar"));
    var activeCount = activeMonths.length;
    if (activeCount <= 0) return;

    var scale = requiredScale(cards, ranks);
    var gridHeight = CHART_PADDING * 2 + activeCount * scale;
    grid.style.height = gridHeight + "px";

    cards.forEach(function (card) {
      var startIdx = Number(card.getAttribute("data-start-idx"));
      var endIdx = Number(card.getAttribute("data-end-idx"));
      var startRank = ranks[startIdx];
      var endRank = ranks[endIdx];
      var intervalTop = CHART_PADDING + (activeCount - 1 - endRank) * scale;
      var intervalHeight = (endRank - startRank + 1) * scale;
      var top = intervalTop + Math.max((intervalHeight - card.offsetHeight) / 2, 0);
      card.style.top = top + "px";
    });

    renderAxis(axisEl, activeMonths, ranks, scale, grid.offsetTop);
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

    projects.forEach(function (p) {
      p.layoutStartIdx = Math.max(p.startIdx, t0);
      p.layoutEndIdx = Math.min(p.endIdx, t1);
    });

    var activeMonths = buildActiveMonths(projects, t0, t1);
    var ranks = activeMonthRanks(activeMonths);

    assignLanes(projects);
    assignColumnColors(projects, columns);

    var laneCount = columns && columns.length
      ? columns.length
      : projects.reduce(function (max, p) {
          return Math.max(max, p.lane + 1);
        }, 1);

    chartEl.style.setProperty("--timeline-lanes", laneCount);

    renderBars(chartEl, projects, laneCount, columns);
    layoutTimeline(axisEl, chartEl, activeMonths, ranks);

    Array.prototype.slice.call(chartEl.querySelectorAll("img")).forEach(function (img) {
      if (img.complete) {
        layoutTimeline(axisEl, chartEl, activeMonths, ranks);
      }
      img.addEventListener("load", function () {
        layoutTimeline(axisEl, chartEl, activeMonths, ranks);
      });
    });

    window.addEventListener("resize", function () {
      layoutTimeline(axisEl, chartEl, activeMonths, ranks);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
