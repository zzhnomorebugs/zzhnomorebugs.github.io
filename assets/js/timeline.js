(function () {
  "use strict";

  var BASE_MONTH_HEIGHT = 18;
  var CARD_INTERVAL_PADDING = 14;
  var CHART_PADDING = 14;

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
        p.topic = col.label;
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
    var months = [];
    for (var month = t0; month <= t1; month++) {
      months.push(month);
    }
    return months;
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

  function compressedPosition(y, gaps) {
    var offset = 0;

    for (var i = 0; i < gaps.length; i++) {
      var gapSize = gaps[i].end - gaps[i].start;
      var keptSize = gaps[i].keep || 0;
      var removedSize = gapSize - keptSize;
      if (y >= gaps[i].end) {
        offset += removedSize;
      } else if (y > gaps[i].start) {
        return (
          gaps[i].start -
          offset +
          ((y - gaps[i].start) / gapSize) * keptSize
        );
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
    var keptGap = 30;

    function addGap(start, end) {
      if (end - start > keptGap) {
        gaps.push({
          start: start,
          end: end,
          keep: keptGap
        });
      }
    }

    if (merged.length) {
      addGap(CHART_PADDING, merged[0].start);
    }

    for (var i = 1; i < merged.length; i++) {
      if (merged[i].start > merged[i - 1].end) {
        addGap(merged[i - 1].end, merged[i].start);
      }
    }

    if (merged.length) {
      addGap(merged[merged.length - 1].end, gridHeight - CHART_PADDING);
    }

    return {
      gaps: gaps,
      height: compressedPosition(gridHeight, gaps)
    };
  }

  function renderAxis(axisEl, activeMonths, ranks, scale, gridTop, gaps) {
    axisEl.innerHTML = "";
    var activeCount = activeMonths.length;
    var years = {};
    var axisHeight = gridTop + compressedPosition(CHART_PADDING * 2 + activeCount * scale, gaps);

    axisEl.style.height = axisHeight + "px";

    activeMonths.forEach(function (month) {
      var year = Math.floor(month / 12);
      var rank = ranks[month];
      var top = gridTop + compressedPosition(CHART_PADDING + (activeCount - 1 - rank) * scale, gaps);

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

  function barDurationRanks(card, ranks) {
    var startIdx = Number(card.getAttribute("data-start-idx"));
    var endIdx = Number(card.getAttribute("data-end-idx"));
    var startRank = ranks[startIdx];
    var endRank = ranks[endIdx];
    return Math.max(endRank - startRank + 1, 1);
  }

  function measureMinBarHeight(card) {
    card.style.height = "";
    card.style.top = "";
    return card.offsetHeight;
  }

  function sortLaneCardsByCenter(laneCards, ranks) {
    return laneCards.sort(function (a, b) {
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
  }

  function requiredScale(cards, ranks) {
    var minHeights = new WeakMap();
    cards.forEach(function (card) {
      minHeights.set(card, measureMinBarHeight(card));
    });

    var lanes = {};
    cards.forEach(function (card) {
      var lane = card.getAttribute("data-lane");
      if (!lanes[lane]) lanes[lane] = [];
      lanes[lane].push(card);
    });

    var scale = BASE_MONTH_HEIGHT;

    for (var iter = 0; iter < 8; iter++) {
      var nextScale = cards.reduce(function (value, card) {
        var duration = barDurationRanks(card, ranks);
        var minH = minHeights.get(card) || card.offsetHeight;
        return Math.max(value, (minH + CARD_INTERVAL_PADDING) / duration);
      }, BASE_MONTH_HEIGHT);

      Object.keys(lanes).forEach(function (laneKey) {
        var laneCards = sortLaneCardsByCenter(lanes[laneKey].slice(), ranks);

        for (var j = 1; j < laneCards.length; j++) {
          var prevCard = laneCards[j - 1];
          var nextCard = laneCards[j];
          var prevStartIdx = Number(prevCard.getAttribute("data-start-idx"));
          var prevEndIdx = Number(prevCard.getAttribute("data-end-idx"));
          var nextStartIdx = Number(nextCard.getAttribute("data-start-idx"));
          var nextEndIdx = Number(nextCard.getAttribute("data-end-idx"));
          var prevStartRank = ranks[prevStartIdx];
          var prevEndRank = ranks[prevEndIdx];
          var nextStartRank = ranks[nextStartIdx];
          var nextEndRank = ranks[nextEndIdx];
          var prevCenter = prevEndRank - (prevEndRank - prevStartRank + 1) / 2;
          var nextCenter = nextEndRank - (nextEndRank - nextStartRank + 1) / 2;
          var gap = prevCenter - nextCenter;

          if (gap > 0) {
            var prevMinH = minHeights.get(prevCard) || prevCard.offsetHeight;
            var nextMinH = minHeights.get(nextCard) || nextCard.offsetHeight;
            nextScale = Math.max(
              nextScale,
              (CARD_INTERVAL_PADDING + (prevMinH + nextMinH) / 2) / gap
            );
          }
        }
      });

      if (Math.abs(nextScale - scale) < 0.5) {
        return nextScale;
      }
      scale = nextScale;
    }

    return scale;
  }

  function renderNowLine(grid, ranks, activeCount, scale, gaps) {
    var now = currentMonth();
    if (!Object.prototype.hasOwnProperty.call(ranks, now)) return;

    var line = document.createElement("div");
    line.className = "timeline__now";
    var rawTop =
      CHART_PADDING + (activeCount - 1 - ranks[now]) * scale + scale / 2;
    line.style.top = compressedPosition(rawTop, gaps) + "px";

    var label = document.createElement("span");
    label.className = "timeline__now-label";
    label.textContent =
      document.documentElement.lang === "zh" ? "现在" : "Now";
    line.appendChild(label);
    grid.appendChild(line);
  }

  function layoutTimeline(axisEl, chartEl, activeMonths, ranks) {
    var grid = chartEl.querySelector(".timeline__grid");
    if (!grid) return;

    var cards = Array.prototype.slice.call(chartEl.querySelectorAll(".timeline__bar"));
    var activeCount = activeMonths.length;
    if (activeCount <= 0) return;

    var minHeights = new WeakMap();
    cards.forEach(function (card) {
      minHeights.set(card, measureMinBarHeight(card));
    });

    var scale = requiredScale(cards, ranks);
    var gridHeight = CHART_PADDING * 2 + activeCount * scale;
    grid.style.height = gridHeight + "px";
    grid.style.setProperty("--timeline-month-height", scale + "px");

    cards.forEach(function (card) {
      var startIdx = Number(card.getAttribute("data-start-idx"));
      var endIdx = Number(card.getAttribute("data-end-idx"));
      var startRank = ranks[startIdx];
      var endRank = ranks[endIdx];
      var intervalTop = CHART_PADDING + (activeCount - 1 - endRank) * scale;
      var intervalHeight = (endRank - startRank + 1) * scale;
      var barHeight = minHeights.get(card) || measureMinBarHeight(card);
      var barTop = intervalTop + Math.max(0, (intervalHeight - barHeight) / 2);

      card.style.top = barTop + "px";
      card.style.height = barHeight + "px";
    });

    var compression = emptyGaps(cards, gridHeight);
    grid.style.height = compression.height + "px";

    cards.forEach(function (card) {
      var top = Number(card.style.top.replace("px", ""));
      card.style.top = compressedPosition(top, compression.gaps) + "px";
    });

    var oldNow = grid.querySelector(".timeline__now");
    if (oldNow) oldNow.remove();
    renderNowLine(grid, ranks, activeCount, scale, compression.gaps);
    renderAxis(
      axisEl,
      activeMonths,
      ranks,
      scale,
      grid.offsetTop,
      compression.gaps
    );
  }

  function appendBarContent(el, p) {
    var text = document.createElement("span");
    text.className = "timeline__bar-label";
    text.textContent = p.name;

    var meta = document.createElement("span");
    meta.className = "timeline__bar-meta";

    if (p.venue && !(p.venue === "arXiv" && p.status === "preprint")) {
      var venue = document.createElement("span");
      venue.className = "timeline__badge timeline__badge--venue";
      venue.textContent = p.venue;
      meta.appendChild(venue);
    }

    if (p.statusLabel) {
      var status = document.createElement("span");
      status.className = "timeline__badge timeline__badge--" + p.status;
      status.textContent = p.statusLabel;
      meta.appendChild(status);
    }

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
      img.loading = "eager";
      img.width = 640;
      img.height = 400;

      var content = document.createElement("span");
      content.className = "timeline__bar-content";

      media.appendChild(img);
      content.appendChild(meta);
      content.appendChild(text);
      content.appendChild(period);
      el.appendChild(media);
      el.appendChild(content);
      return;
    }

    el.style.setProperty("--timeline-col-color", p.color);

    var fallbackContent = document.createElement("span");
    fallbackContent.className = "timeline__bar-content";
    fallbackContent.appendChild(meta);
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

  function renderMobileTimeline(container, projects) {
    if (!container) return;
    container.innerHTML = "";

    var grouped = {};
    projects.forEach(function (p) {
      var year = Math.floor(p.endIdx / 12);
      if (!grouped[year]) grouped[year] = [];
      grouped[year].push(p);
    });

    Object.keys(grouped)
      .sort(function (a, b) {
        return Number(b) - Number(a);
      })
      .forEach(function (year) {
        var section = document.createElement("section");
        section.className = "timeline-mobile__year";

        var heading = document.createElement("h2");
        heading.className = "timeline-mobile__year-title";
        heading.textContent = year;
        section.appendChild(heading);

        var list = document.createElement("div");
        list.className = "timeline-mobile__list";

        grouped[year]
          .sort(function (a, b) {
            return b.endIdx - a.endIdx;
          })
          .forEach(function (p) {
            var card = p.url
              ? document.createElement("a")
              : document.createElement("article");
            card.className = "timeline-mobile__card";
            if (p.url) card.href = p.url;
            card.style.setProperty("--timeline-col-color", p.color);

            var topic = document.createElement("span");
            topic.className = "timeline-mobile__topic";
            topic.textContent = p.topic || "";

            var name = document.createElement("strong");
            name.className = "timeline-mobile__name";
            name.textContent = p.name;

            var details = document.createElement("span");
            details.className = "timeline-mobile__details";
            var venueText =
              p.venue && !(p.venue === "arXiv" && p.status === "preprint")
                ? " · " + p.venue
                : "";
            details.textContent =
              formatMonth(p.startIdx) +
              " – " +
              formatMonth(p.endIdx) +
              venueText +
              (p.statusLabel ? " · " + p.statusLabel : "");

            card.appendChild(topic);
            card.appendChild(name);
            card.appendChild(details);
            list.appendChild(card);
          });

        section.appendChild(list);
        container.appendChild(section);
      });
  }

  function init() {
    var projects = parseJsonEl("timeline-data");
    var range = parseJsonEl("timeline-range");
    var columns = parseJsonEl("timeline-columns");
    if (!projects || !projects.length) return;

    var chartEl = document.getElementById("timeline-chart");
    var axisEl = document.getElementById("timeline-axis");
    var mobileEl = document.getElementById("timeline-mobile");
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
    renderMobileTimeline(mobileEl, projects);
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
