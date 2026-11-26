(function () {
  "use strict";

  const size = 120, tile = size / 3;
  const tiles = Array.from({ length: 9 }, (_, i) => i);
  const context = [1, 4, 6, 8];
  const queries = [0, 5, 7];
  const x = i => (i % 3) * tile, y = i => Math.floor(i / 3) * tile;
  const names = ["source", "context", "prediction", "targets"];
  const routeColors = {
    select: "context", forward: "context", estimate: "prediction",
    hold: "query", compare: "query", target: "query", gradient: "prediction"
  };
  const fraction = (p, a, b) => Math.max(0, Math.min(1, (p - a) / (b - a)));
  const ease = t => t * t * (3 - 2 * t);
  let instance = 0;

  // The two layouts preserve the same branches. The held-out data has exactly
  // one destination, the loss. The gradient path returns to the model node.
  const wide = {
    viewBox: "0 0 816 336",
    boards: [[20, 115, 112], [188, 43, 99], [489, 43, 99], [489, 210, 99]],
    model: [371, 92], loss: [725, 172], feedback: [439, 164],
    paths: {
      select: [[132,171], [151,171], [151,92], [182,92]],
      forward: [[287,92], [334,92]], estimate: [[402,92], [483,92]],
      hold: [[132,171], [151,171], [151,260], [483,260]],
      compare: [[588,92], [642,92], [642,158], [667,158]],
      target: [[588,260], [642,260], [642,186], [667,186]],
      gradient: [[673,172], [371,172], [371,117]]
    }
  };
  const compact = {
    viewBox: "0 0 340 361",
    boards: [[13, 45, 70], [119, 45, 70], [236, 176, 72], [12, 176, 72]],
    model: [272, 80], loss: [159, 294], feedback: [234, 332],
    paths: {
      select: [[83,80], [114,80]], forward: [[189,80], [235,80]], estimate: [[272,99], [272,149]],
      hold: [[48,134], [48,149]], compare: [[272,269], [272,294], [217,294]],
      target: [[48,269], [48,294], [101,294]], gradient: [[159,313], [159,341], [327,341], [327,80], [308,80]]
    }
  };

  function makePalette(svg, art, prefix) {
    const defs = svg.append("defs");
    const id = name => prefix + name;
    const ref = name => "#" + id(name);
    const group = name => defs.append("g").attr("id", id(name));
    const use = (parent, name) => parent.append("use").attr("href", ref(name));
    function rect(parent, w, h, fill) {
      return parent.append("rect").attr("width", w).attr("height", h).attr("fill", fill);
    }
    const hatch = defs.append("pattern").attr("id", id("hatch"))
      .attr("patternUnits", "userSpaceOnUse").attr("width", 5).attr("height", 5);
    rect(hatch, 5, 5, "var(--idcd-empty)");
    hatch.append("path").attr("d", "M-1 1L1 -1 M0 5L5 0 M4 6L6 4").attr("stroke", "var(--idcd-hatch)")
      .attr("stroke-width", .55);
    rect(group("blank"), size, size, "url(" + ref("hatch") + ")");

    // Sample B uses the same spatial registration as the preceding framework.
    const surface = group("measuredB").append("g").attr("transform", "translate(120 120) rotate(180)")
      .append("svg").attr("width", size).attr("height", size).attr("viewBox", "1856 851 397 397")
      .attr("overflow", "hidden");
    surface.append("image").attr("href", art).attr("width", 2400).attr("height", 1548);

    const grain = defs.append("pattern").attr("id", id("grain")).attr("patternUnits", "userSpaceOnUse")
      .attr("width", 22).attr("height", 22);
    let seed = 14321;
    function random() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return (seed + 0.5) / 4294967296;
    }
    const colors = ["#4487bd", "#9bbbd9", "#f8f4ed", "#efbaa4", "#d2775c"];
    for (let i = 0; i < 121; i++) {
      const z = Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random());
      rect(grain, 2, 2, colors[Math.max(0, Math.min(4, Math.round(2 + z)))])
        .attr("x", (i % 11) * 2).attr("y", Math.floor(i / 11) * 2);
    }
    for (const [name, tint, strength] of [
      ["contextB", "context", .21], ["noisyB", "context", .16],
      ["predictionB", "prediction", .13], ["queryB", "query", .23]
    ]) {
      const layer = group(name);
      const field = use(layer, "measuredB");
      // Shift the schematic prediction relative to the held-out clean field so
      // the matched patches exhibit a residual.
      if (name === "predictionB") field.attr("transform", "translate(-5 -1) scale(1.13)");
      if (name === "noisyB") rect(layer, size, size, "url(" + ref("grain") + ")").attr("opacity", .71);
      rect(layer, size, size, "var(--idcd-" + tint + "-fill)").attr("opacity", strength);
      layer.selectAll("rect.tile-edge").data(tiles).join("rect").attr("class", "tile-edge")
        .attr("x", i => x(i) + 1).attr("y", i => y(i) + 1)
        .attr("width", tile - 2).attr("height", tile - 2).attr("fill", "none")
        .attr("stroke", "var(--idcd-" + tint + ")").attr("stroke-width", 1.2)
        .attr("stroke-dasharray", name === "queryB" ? "3 2" : null);
    }
    return ref;
  }

  function makeBoard(board, ref, name) {
    const grid = board.select("[data-train-grid]");
    const cells = grid.selectAll("svg").data(tiles).join("svg")
      .attr("data-tile", i => i).attr("x", x).attr("y", y).attr("width", tile).attr("height", tile)
      .attr("overflow", "hidden").attr("viewBox", i => [x(i), y(i), tile, tile].join(" "));
    const before = cells.append("use").nodes(), after = cells.append("use").nodes();
    const cellNodes = cells.nodes();
    grid.append("path").attr("d", "M40 0v120 M80 0v120 M0 40h120 M0 80h120 M.5 .5h119v119H.5z")
      .attr("fill", "none").attr("stroke", "var(--idcd-grid)").attr("stroke-width", .7);
    const brackets = grid.append("g").attr("color", "var(--idcd-query)")
      .selectAll("g").data(queries).join("g").attr("data-train-bracket", i => i)
      .attr("transform", i => "translate(" + x(i) + " " + y(i) + ")");
    for (const [stroke, width] of [["white", 3.6], ["currentColor", 1.9]]) {
      brackets.append("path").attr("d", "M3 11V3h8 M37 29v8h-8")
        .attr("stroke", stroke).attr("stroke-width", width).attr("fill", "none")
        .attr("stroke-linecap", "round").attr("stroke-linejoin", "round");
    }
    const marker = grid.append("g").attr("aria-hidden", "true");
    if (name !== "context") {
      marker.append("circle").attr("cx", 20).attr("cy", 20).attr("r", 6.3)
        .attr("fill", "white").attr("stroke", "#475967").attr("stroke-width", .7);
      marker.append("text").attr("x", 20).attr("y", 24.1)
        .attr("fill", "#293c4a").attr("font-family", "Georgia, serif").attr("font-size", 12)
        .attr("font-style", "italic").attr("font-weight", 700).text("i");
    }

    return function draw(p) {
      tiles.forEach(i => {
        let a = "blank", b = "blank", amount = 0;
        if (name === "source") {
          if (context.includes(i) || queries.includes(i)) a = "measuredB";
          if (context.includes(i)) b = "contextB";
          if (queries.includes(i)) b = "queryB";
          amount = fraction(p, .035, .14);
        } else if (name === "context" && context.includes(i)) {
          if (p < .185) {
            b = "contextB";
            amount = fraction(p, .085, .18);
          } else {
            a = "contextB"; b = "noisyB";
            amount = fraction(p, .185, .29);
          }
        } else if (name === "prediction") {
          b = "predictionB";
          amount = fraction(p, .365 + i * .01, .468 + i * .01);
        } else if (name === "targets" && queries.includes(i)) {
          b = "queryB";
          const offset = queries.indexOf(i) * .025;
          amount = fraction(p, .585 + offset, .675 + offset);
        }
        const role = amount >= 1 ? b : a;
        const mix = a === b || amount >= 1 ? 0 : Math.round(100 * ease(amount)) / 100;
        if (cellNodes[i].dataset.role !== role) {
          cellNodes[i].dataset.role = role;
          before[i].setAttribute("href", ref(role));
        }
        if (mix && after[i].getAttribute("href") !== ref(b)) after[i].setAttribute("href", ref(b));
        if (Number(after[i].getAttribute("opacity") ?? -1) !== mix) after[i].setAttribute("opacity", mix);
      });
      const compare = name === "prediction" || name === "targets";
      brackets.attr("opacity", (_, rank) => compare ? fraction(p, .62 + rank * .045, .71 + rank * .045) : 0);
      marker.attr("opacity", name === "source" ? fraction(p, .02, .15) :
        name === "prediction" ? fraction(p, .54, .60) : fraction(p, .64, .71));
    };
  }

  window.createIncompleteTrainingFields = function (root) {
    const svg = window.d3.select(root.querySelector("[data-idcd-training]"));
    const prefix = "idcd-train-" + (++instance) + "-";
    const ref = makePalette(svg, root.dataset.fieldArt, prefix);
    const boards = names.map(name => svg.select('[data-train-board="' + name + '"]'));
    const draws = boards.map((board, i) => makeBoard(board, ref, names[i]));
    const model = svg.select('[data-train-node="model"]'), loss = svg.select('[data-train-node="loss"]');
    const feedback = svg.select("[data-train-feedback]");
    const wires = {};
    Object.entries(routeColors).forEach(([name, color]) => {
      const group = svg.select("[data-train-wires]").append("g").attr("color", "var(--idcd-" + color + "-ink)")
        .attr("fill", "none").attr("stroke", "currentColor").attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round");
      const base = group.append("path").attr("stroke-width", 1.5).attr("opacity", .2);
      const trace = group.append("path").attr("data-train-wire", name).attr("stroke-width", 2.2)
        .attr("pathLength", 1).attr("stroke-dasharray", "1 1");
      const tip = group.append("path").attr("d", "M-6 -4L0 0l-6 4").attr("stroke-width", 2);
      wires[name] = { base, trace, tip };
    });

    let lastLayout;
    function resize(width) {
      const layout = width && width < 615 ? compact : wide;
      if (layout === lastLayout) return;
      lastLayout = layout;
      svg.attr("viewBox", layout.viewBox).attr("data-compact", layout === compact ? "" : null);
      boards.forEach((board, i) => {
        const [left, top, side] = layout.boards[i];
        board.attr("transform", "translate(" + left + " " + top + ")");
        board.select("[data-train-grid]").attr("transform", "scale(" + side / size + ")");
        board.select(".idcd-training__title").attr("x", side / 2).attr("y", -10);
        board.select(".idcd-training__detail").attr("x", side / 2).attr("y", side + 15);
      });
      model.attr("transform", "translate(" + layout.model.join(" ") + ")");
      loss.attr("transform", "translate(" + layout.loss.join(" ") + ")");
      feedback.attr("x", layout.feedback[0]).attr("y", layout.feedback[1]);
      Object.entries(layout.paths).forEach(([name, points]) => {
        const {base, trace, tip} = wires[name];
        const path = "M" + points.map(point => point.join(" ")).join("L");
        base.attr("d", path);
        trace.attr("d", path);
        const [prior, end] = points.slice(-2);
        const angle = Math.atan2(end[1] - prior[1], end[0] - prior[0]) * 180 / Math.PI;
        tip.attr("transform", "translate(" + end.join(" ") + ") rotate(" + angle + ")");
      });
    }
    const viewport = root.querySelector(".idcd-stage-viewport");
    const fitViewport = () => resize(viewport.clientWidth || root.clientWidth || window.innerWidth);
    fitViewport();
    if (window.ResizeObserver) {
      new ResizeObserver(entries => resize(entries[0].contentRect.width)).observe(viewport);
    } else {
      window.addEventListener("resize", fitViewport);
    }
    const intervals = {
      select: [.04, .15], forward: [.245, .33], estimate: [.32, .40], hold: [.50, .635],
      compare: [.685, .79], target: [.695, .80], gradient: [.81, .94]
    };
    return function render(p) {
      draws.forEach(draw => draw(p));
      for (const [name, [start, end]] of Object.entries(intervals)) {
        const f = fraction(p, start, end);
        wires[name].trace.attr("stroke-dashoffset", 1 - f).attr("opacity", f > 0 ? 1 : 0);
        wires[name].tip.attr("opacity", .2 + .8 * f);
      }
      const forward = fraction(p, .22, .34);
      const scored = fraction(p, .69, .80);
      model.attr("opacity", .4 + .6 * forward);
      loss.attr("opacity", .36 + .64 * scored);
      feedback.attr("opacity", fraction(p, .805, .88));
      const pulse = Math.sin(Math.PI * fraction(p, .915, .985));
      model.select("rect").style("stroke-width", (2 + 2 * pulse) + "px")
        .style("fill", "var(--idcd-prediction-fill)").style("fill-opacity", .24 * pulse);
    };
  };
}());
