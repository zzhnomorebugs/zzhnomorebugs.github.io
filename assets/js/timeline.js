(function () {
  "use strict";

  var CHART_PADDING = 16;
  var BAR_GAP = 10;

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

  function measureMinBarHeight(card) {
    card.style.height = "";
    card.style.top = "";
    return card.offsetHeight;
  }

  function laneStackHeight(cards) {
    if (!cards.length) return CHART_PADDING * 2;

    return (
      CHART_PADDING * 2 +
      cards.reduce(function (sum, card, index) {
        return sum + card._minHeight + (index > 0 ? BAR_GAP : 0);
      }, 0)
    );
  }

  function renderAxisFromBars(axisEl, chartEl, gridEl) {
    axisEl.innerHTML = "";
    axisEl.style.height = chartEl.offsetHeight + "px";

    var gridTop = gridEl.offsetTop;
    var cards = Array.prototype.slice.call(
      gridEl.querySelectorAll(".timeline__bar")
    );
    var years = {};

    cards.forEach(function (card) {
      var startIdx = Number(card.getAttribute("data-start-idx"));
      var endIdx = Number(card.getAttribute("data-end-idx"));
      var top = Number(card.style.top.replace("px", ""));
      var lane = card.closest(".timeline__lane");
      var laneOffset = lane ? lane.offsetTop : 0;
      var center = gridTop + laneOffset + top + card.offsetHeight / 2;

      for (var month = startIdx; month <= endIdx; month++) {
        var year = Math.floor(month / 12);
        if (!years[year]) years[year] = { sum: 0, count: 0 };
        years[year].sum += center;
        years[year].count += 1;
      }
    });

    Object.keys(years)
      .sort(function (a, b) {
        return Number(b) - Number(a);
      })
      .forEach(function (year) {
        var tickTop = years[year].sum / years[year].count;
        axisEl.appendChild(createYearTick(year, tickTop));
      });
  }

  function layoutTimeline(axisEl, chartEl) {
    var grid = chartEl.querySelector(".timeline__grid");
    if (!grid) return;

    var lanes = Array.prototype.slice.call(grid.querySelectorAll(".timeline__lane"));
    var maxLaneHeight = 0;

    lanes.forEach(function (lane) {
      var cards = Array.prototype.slice.call(lane.querySelectorAll(".timeline__bar"));
      cards.forEach(function (card) {
        card._minHeight = measureMinBarHeight(card);
      });

      var laneHeight = laneStackHeight(cards);
      maxLaneHeight = Math.max(maxLaneHeight, laneHeight);
      lane.style.height = laneHeight + "px";

      var cardsSorted = cards.slice().sort(function (a, b) {
        return (
          Number(a.getAttribute("data-start-idx")) -
          Number(b.getAttribute("data-start-idx"))
        );
      });

      var y = laneHeight - CHART_PADDING;

      cardsSorted.forEach(function (card) {
        var height = card._minHeight;
        y -= height;
        card.style.top = y + "px";
        card.style.height = height + "px";
        card.classList.add("timeline__bar--span");
        y -= BAR_GAP;
      });
    });

    if (maxLaneHeight <= 0) return;

    grid.style.height = maxLaneHeight + "px";
    renderAxisFromBars(axisEl, chartEl, grid);
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

    assignLanes(projects);
    assignColumnColors(projects, columns);

    var laneCount = columns && columns.length
      ? columns.length
      : projects.reduce(function (max, p) {
          return Math.max(max, p.lane + 1);
        }, 1);

    chartEl.style.setProperty("--timeline-lanes", laneCount);

    renderBars(chartEl, projects, laneCount, columns);
    layoutTimeline(axisEl, chartEl);

    Array.prototype.slice.call(chartEl.querySelectorAll("img")).forEach(function (img) {
      if (img.complete) {
        layoutTimeline(axisEl, chartEl);
      }
      img.addEventListener("load", function () {
        layoutTimeline(axisEl, chartEl);
      });
    });

    window.addEventListener("resize", function () {
      layoutTimeline(axisEl, chartEl);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
