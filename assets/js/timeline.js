(function () {
  "use strict";

  var BOUNDARY_MONTH_HEIGHT = 12;
  var INTERIOR_MONTH_HEIGHT = 4;
  var CARD_INTERVAL_PADDING = 8;
  var CHART_PADDING = 8;

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

  function markBoundaryMonths(projects, t0, t1) {
    var boundary = {};

    projects.forEach(function (p) {
      var start = Math.max(p.layoutStartIdx, t0);
      var end = Math.min(p.layoutEndIdx, t1);
      if (start <= end) {
        boundary[start] = true;
        boundary[end] = true;
      }
    });

    return boundary;
  }

  function buildInitialMonthHeights(activeMonths, boundary) {
    return activeMonths.map(function (month) {
      return boundary[month] ? BOUNDARY_MONTH_HEIGHT : INTERIOR_MONTH_HEIGHT;
    });
  }

  function buildCumulative(monthHeights) {
    var cumulative = [CHART_PADDING];
    var i;

    for (i = 0; i < monthHeights.length; i++) {
      cumulative.push(cumulative[cumulative.length - 1] + monthHeights[i]);
    }

    return cumulative;
  }

  function barSpanPixels(startRank, endRank, cumulative, monthHeights) {
    return cumulative[endRank + 1] - cumulative[startRank];
  }

  function barLayout(startRank, endRank, cumulative) {
    return {
      top: cumulative[startRank],
      height: cumulative[endRank + 1] - cumulative[startRank]
    };
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

  function compressedPosition(y, gaps) {
    var offset = 0;

    for (var i = 0; i < gaps.length; i++) {
      if (y >= gaps[i].end) {
        offset += gaps[i].end - gaps[i].start;
      } else if (y > gaps[i].start) {
        return gaps[i].start - offset;
      } else {
        break;
      }
    }

    return y - offset;
  }

  function emptyGaps(cards, gridHeight) {
    var intervals = cards
      .map(function (card) {
        var top = Number(card.style.top.replace("px", ""));
        return {
          start: top,
          end: top + card.offsetHeight
        };
      })
      .sort(function (a, b) {
        return a.start - b.start;
      });

    var merged = [];
    intervals.forEach(function (interval) {
      var last = merged[merged.length - 1];
      if (last && interval.start <= last.end) {
        last.end = Math.max(last.end, interval.end);
      } else {
        merged.push({
          start: interval.start,
          end: interval.end
        });
      }
    });

    var gaps = [];
    for (var i = 1; i < merged.length; i++) {
      if (merged[i].start > merged[i - 1].end) {
        gaps.push({
          start: merged[i - 1].end,
          end: merged[i].start
        });
      }
    }

    var compressedHeight = compressedPosition(gridHeight, gaps);
    var contentBottom = merged.length ? merged[merged.length - 1].end : 0;

    return {
      gaps: gaps,
      height: Math.max(compressedHeight, contentBottom + CHART_PADDING)
    };
  }

  function renderAxis(axisEl, activeMonths, boundary, cumulative, gridTop, gaps, trimOffset, chartHeight) {
    axisEl.innerHTML = "";
    var years = {};
    var trim = trimOffset || 0;
    var axisHeight = chartHeight != null ? chartHeight : gridTop + compressedPosition(cumulative[cumulative.length - 1] + CHART_PADDING, gaps) - trim;

    axisEl.style.height = axisHeight + "px";

    activeMonths.forEach(function (month, i) {
      if (!boundary[month]) return;

      var year = Math.floor(month / 12);
      var top = gridTop + compressedPosition(cumulative[i], gaps) - trim;

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

  function measureMinBarHeight(card) {
    card.style.height = "";
    card.style.top = "";
    return card.offsetHeight;
  }

  function sortLaneCardsByCenter(laneCards, ranks, cumulative) {
    return laneCards.sort(function (a, b) {
      var aStart = Number(a.getAttribute("data-start-idx"));
      var aEnd = Number(a.getAttribute("data-end-idx"));
      var bStart = Number(b.getAttribute("data-start-idx"));
      var bEnd = Number(b.getAttribute("data-end-idx"));
      var aStartRank = ranks[aStart];
      var aEndRank = ranks[aEnd];
      var bStartRank = ranks[bStart];
      var bEndRank = ranks[bEnd];
      var aCenter = (cumulative[aStartRank] + cumulative[aEndRank + 1]) / 2;
      var bCenter = (cumulative[bStartRank] + cumulative[bEndRank + 1]) / 2;
      return bCenter - aCenter;
    });
  }

  function scaleMonthHeights(monthHeights, factor) {
    var i;
    for (i = 0; i < monthHeights.length; i++) {
      monthHeights[i] *= factor;
    }
  }

  function fitTimelineHeights(cards, ranks, monthHeights, minHeights) {
    var lanes = {};
    var iter;
    var laneKey;
    var laneCards;
    var j;
    var prevCard;
    var nextCard;
    var prevStartIdx;
    var prevEndIdx;
    var nextStartIdx;
    var nextEndIdx;
    var prevStartRank;
    var prevEndRank;
    var nextStartRank;
    var nextEndRank;
    var cumulative;
    var needsScale;
    var card;
    var startIdx;
    var endIdx;
    var startRank;
    var endRank;
    var span;
    var minH;
    var prevCenter;
    var nextCenter;
    var prevH;
    var nextH;
    var gap;

    cards.forEach(function (c) {
      var lane = c.getAttribute("data-lane");
      if (!lanes[lane]) lanes[lane] = [];
      lanes[lane].push(c);
    });

    for (iter = 0; iter < 48; iter++) {
      cumulative = buildCumulative(monthHeights);
      needsScale = 1;

      cards.forEach(function (c) {
        startIdx = Number(c.getAttribute("data-start-idx"));
        endIdx = Number(c.getAttribute("data-end-idx"));
        startRank = ranks[startIdx];
        endRank = ranks[endIdx];
        span = barSpanPixels(startRank, endRank, cumulative, monthHeights);
        minH = minHeights.get(c) || c.offsetHeight;
        if (span > 0) {
          needsScale = Math.max(needsScale, (minH + CARD_INTERVAL_PADDING) / span);
        }
      });

      Object.keys(lanes).forEach(function (key) {
        laneCards = sortLaneCardsByCenter(lanes[key].slice(), ranks, cumulative);

        for (j = 1; j < laneCards.length; j++) {
          prevCard = laneCards[j - 1];
          nextCard = laneCards[j];
          prevStartIdx = Number(prevCard.getAttribute("data-start-idx"));
          prevEndIdx = Number(prevCard.getAttribute("data-end-idx"));
          nextStartIdx = Number(nextCard.getAttribute("data-start-idx"));
          nextEndIdx = Number(nextCard.getAttribute("data-end-idx"));
          prevStartRank = ranks[prevStartIdx];
          prevEndRank = ranks[prevEndIdx];
          nextStartRank = ranks[nextStartIdx];
          nextEndRank = ranks[nextEndIdx];
          prevCenter = (cumulative[prevStartRank] + cumulative[prevEndRank + 1]) / 2;
          nextCenter = (cumulative[nextStartRank] + cumulative[nextEndRank + 1]) / 2;
          prevH = cumulative[prevEndRank + 1] - cumulative[prevStartRank];
          nextH = cumulative[nextEndRank + 1] - cumulative[nextStartRank];
          gap = prevCenter - nextCenter;

          if (gap > 0) {
            needsScale = Math.max(
              needsScale,
              (CARD_INTERVAL_PADDING + (prevH + nextH) / 2) / gap
            );
          }
        }
      });

      if (needsScale <= 1.002) {
        return buildCumulative(monthHeights);
      }

      scaleMonthHeights(monthHeights, needsScale);
    }

    return buildCumulative(monthHeights);
  }

  function layoutTimeline(axisEl, chartEl, activeMonths, ranks, boundary) {
    var grid = chartEl.querySelector(".timeline__grid");
    if (!grid) return;

    var cards = Array.prototype.slice.call(chartEl.querySelectorAll(".timeline__bar"));
    var activeCount = activeMonths.length;
    if (activeCount <= 0) return;

    var monthHeights = buildInitialMonthHeights(activeMonths, boundary);
    var minHeights = new WeakMap();

    cards.forEach(function (card) {
      minHeights.set(card, measureMinBarHeight(card));
    });

    var cumulative = fitTimelineHeights(cards, ranks, monthHeights, minHeights);
    var gridHeight = cumulative[cumulative.length - 1] + CHART_PADDING;

    grid.style.height = gridHeight + "px";

    cards.forEach(function (card) {
      var startIdx = Number(card.getAttribute("data-start-idx"));
      var endIdx = Number(card.getAttribute("data-end-idx"));
      var startRank = ranks[startIdx];
      var endRank = ranks[endIdx];
      var layout = barLayout(startRank, endRank, cumulative);

      card.style.top = layout.top + "px";
      card.style.height = Math.max(layout.height, 1) + "px";
      card.classList.add("timeline__bar--span");
    });

    var compression = emptyGaps(cards, gridHeight);
    grid.style.height = compression.height + "px";

    cards.forEach(function (card) {
      var top = Number(card.style.top.replace("px", ""));
      card.style.top = compressedPosition(top, compression.gaps) + "px";
    });

    var trim = 0;
    if (cards.length) {
      var minTop = cards.reduce(function (min, card) {
        return Math.min(min, Number(card.style.top.replace("px", "")));
      }, Infinity);
      trim = Math.max(0, minTop - CHART_PADDING);

      if (trim > 0) {
        cards.forEach(function (card) {
          var top = Number(card.style.top.replace("px", ""));
          card.style.top = top - trim + "px";
        });
        grid.style.height = Math.max(compression.height - trim, 0) + "px";
      }
    }

    renderAxis(
      axisEl,
      activeMonths,
      boundary,
      cumulative,
      grid.offsetTop,
      compression.gaps,
      trim,
      grid.offsetHeight
    );
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
    var boundary = markBoundaryMonths(projects, t0, t1);

    assignLanes(projects);
    assignColumnColors(projects, columns);

    var laneCount = columns && columns.length
      ? columns.length
      : projects.reduce(function (max, p) {
          return Math.max(max, p.lane + 1);
        }, 1);

    chartEl.style.setProperty("--timeline-lanes", laneCount);

    renderBars(chartEl, projects, laneCount, columns);
    layoutTimeline(axisEl, chartEl, activeMonths, ranks, boundary);

    Array.prototype.slice.call(chartEl.querySelectorAll("img")).forEach(function (img) {
      if (img.complete) {
        layoutTimeline(axisEl, chartEl, activeMonths, ranks, boundary);
      }
      img.addEventListener("load", function () {
        layoutTimeline(axisEl, chartEl, activeMonths, ranks, boundary);
      });
    });

    window.addEventListener("resize", function () {
      layoutTimeline(axisEl, chartEl, activeMonths, ranks, boundary);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
