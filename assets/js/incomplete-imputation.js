(function () {
  "use strict";

  const size = 60;
  const observed = [1, 2, 3, 4, 6, 7, 8];
  const gaps = [0, 5];
  const draws = [[1, 4, 6, 8], [2, 3, 4, 7], [1, 2, 6, 7]];
  const ink = "var(--retro-ink, currentColor)";
  const grid = "var(--idcd-grid)";
  const violet = "var(--idcd-context-ink, var(--idcd-context))";
  const teal = "var(--idcd-prediction-ink, var(--idcd-prediction))";
  const muted = "var(--retro-muted, var(--idcd-grid))";
  let instance = 0;

  const copy = {
    zh: { source: "样本 A", measured: "7 / 9 块实测", once: "仅加噪一次 ·",
      contexts: "抽取 context", example: "（示意）", model: "同一模型", shortModel: "同一模型",
      estimates: "三份预测", mean: "逐点取均值", result: "补全样本 A", gaps: "只填两个缺口" },
    en: { source: "Sample A", measured: "7 / 9 measured", once: "Noise once ·",
      contexts: "Draw contexts", example: "(example)", model: "Shared model", shortModel: "One model",
      estimates: "Estimates", mean: "Pointwise mean", result: "Complete A", gaps: "Fill only the two gaps" }
  };

  function phase(p, start, end) {
    const t = Math.max(0, Math.min(1, (p - start) / (end - start)));
    return t * t * (3 - 2 * t);
  }
  function rect(parent, x, y, width, height, fill) {
    return parent.append("rect").attr("x", x).attr("y", y).attr("width", width)
      .attr("height", height).attr("fill", fill);
  }
  function label(parent, x, y, text, options = {}) {
    return parent.append("text").attr("x", x).attr("y", y)
      .attr("text-anchor", options.anchor || "middle").attr("fill", options.color || ink)
      .attr("font-size", options.size || 14).attr("font-weight", options.weight || 600).text(text);
  }

  // Native MathML keeps the plotted numbers, accents and fraction typeset offline.
  // x and y are the centre of the box unless it is left-aligned.
  function formula(parent, x, y, width, height, size, color, tex, expression, options = {}) {
    const box = parent.append("foreignObject").attr("x", options.left ? x : x - width / 2)
      .attr("y", y - height / 2).attr("width", width).attr("height", height);
    const row = box.append("xhtml:div").style("display", "flex").style("align-items", "center")
      .style("justify-content", options.left ? "flex-start" : "center").style("gap", ".2em")
      .style("height", "100%").style("white-space", "nowrap").style("line-height", "1")
      .style("font-size", size + "px").style("color", color);
    if (options.before) row.append("xhtml:span").text(options.before);
    row.append("xhtml:span").html('<math xmlns="http://www.w3.org/1998/Math/MathML" displaystyle="true" ' +
      'style="font-family:math,\'Cambria Math\',\'STIX Two Math\',serif;font-size:inherit;color:inherit">' +
      '<semantics><mrow>' + expression + '</mrow><annotation encoding="application/x-tex">' +
      tex + '</annotation></semantics></math>');
    if (options.after) row.append("xhtml:span").text(options.after);
    return box;
  }

  // A set of schematic scalar model outputs, independent of both missing targets.
  // The same array values drive the textures, the readout at i and every output mean.
  const resolution = 45;
  const site = 7 * resolution + 7; // Centre of the top-left block, (1/6, 1/6).
  function illustrativeOutputs() {
    function structure(x, y, j) {
      const a = 13 * x + 2.2 * Math.sin(8 * y + .55 * j) + j * .54;
      const b = 9 * y - 2.5 * Math.cos(7 * x - .36 * j);
      return .42 * Math.sin(a + b * .48) + .27 * Math.cos(b - a * .35);
    }
    const fields = [.60, -.30, .30].map((atSite, j) => {
      const offset = atSite - structure(1 / 6, 1 / 6, j);
      return Float64Array.from({ length: resolution * resolution }, (_, i) => {
        const x = (i % resolution + .5) / resolution;
        const y = (Math.floor(i / resolution) + .5) / resolution;
        const local = Math.exp(-19 * ((x - 1 / 6) ** 2 + (y - 1 / 6) ** 2));
        return Math.max(-1, Math.min(1, structure(x, y, j) + offset * local));
      });
    });
    const mean = fields[0].map((_, i) => fields.reduce((sum, f) => sum + f[i], 0) / fields.length);
    return { fields, mean };
  }

  function fieldImage(values) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = resolution;
    const pixels = canvas.getContext("2d");
    const image = pixels.createImageData(resolution, resolution);
    const neutral = [248, 247, 243];
    const cool = [58, 131, 191], warm = [205, 74, 44];
    values.forEach((value, i) => {
      const end = value < 0 ? cool : warm;
      for (let channel = 0; channel < 3; channel++) {
        image.data[4 * i + channel] = neutral[channel] + (end[channel] - neutral[channel]) * Math.abs(value);
      }
      image.data[4 * i + 3] = 255;
    });
    pixels.putImageData(image, 0, 0);
    return canvas.toDataURL();
  }

  function defineFields(defs, art, prefix, outputs) {
    const url = key => "url(#" + prefix + key + ")";
    const use = (parent, key) => parent.append("use").attr("href", "#" + prefix + key);
    const define = key => defs.append("g").attr("id", prefix + key);
    const hatch = defs.append("pattern").attr("id", prefix + "hatch")
      .attr("patternUnits", "userSpaceOnUse").attr("width", 3.5).attr("height", 3.5);
    rect(hatch, 0, 0, 3.5, 3.5, "var(--idcd-empty)");
    hatch.append("path").attr("d", "M-1 1L1 -1M0 3.5L3.5 0M2.5 4.5L4.5 2.5")
      .attr("stroke", "var(--idcd-hatch)").attr("stroke-width", .48);
    const texture = define("texture").append("svg").attr("width", size).attr("height", size)
      .attr("viewBox", "1856 851 397 397").attr("overflow", "hidden");
    texture.append("image").attr("href", art).attr("width", 2400).attr("height", 1548);
    const grain = defs.append("pattern").attr("id", prefix + "grain")
      .attr("patternUnits", "userSpaceOnUse").attr("width", 7).attr("height", 7);
    // One near-zero perturbation shared by every overlapping context.
    [[1, 1, "#4c87bb"], [3.5, 4.5, "#c87158"], [6, 2.5, "#4c87bb"]].forEach(([x, y, fill]) => {
      rect(grain, x, y, .9, .9, fill).attr("opacity", .16);
    });
    const shared = define("shared");
    use(shared, "texture");
    rect(shared, 0, 0, size, size, url("grain"));
    const mesh = define("grid");
    mesh.append("path").attr("d", "M20 0v60M40 0v60M0 20h60M0 40h60").attr("fill", "none")
      .attr("stroke", grid).attr("stroke-width", .52).attr("opacity", .60);
    rect(mesh, 0, 0, size, size, "none").attr("stroke", grid).attr("stroke-width", .9);

    function tile(i) { return [i % 3 * 20, Math.floor(i / 3) * 20]; }
    function mask(key, cells) {
      const clip = defs.append("clipPath").attr("id", prefix + key);
      cells.forEach(i => rect(clip, ...tile(i), 20, 20, "#fff"));
    }
    function board(name, visible, field) {
      mask(name + "-visible", visible);
      const face = define(name);
      rect(face, 0, 0, size, size, url("hatch"));
      use(face, field).attr("clip-path", url(name + "-visible"));
      use(face, "grid");
      return face;
    }
    board("observed", observed, "texture");
    draws.forEach((cells, j) => {
      const face = board("context-" + j, cells, "shared");
      cells.forEach(i => {
        const [x, y] = tile(i);
        rect(face, x + .7, y + .7, 18.6, 18.6, "var(--idcd-context-fill)")
          .attr("fill-opacity", .19).attr("stroke", "var(--idcd-context)").attr("stroke-width", 1.1);
      });
    });
    [...outputs.fields, outputs.mean].forEach((values, j) => {
      const field = define("estimate-" + j);
      field.append("image").attr("width", size).attr("height", size).attr("href", fieldImage(values));
    });
    gaps.forEach(i => mask("gap-" + i, [i]));
    return { use, url, tile };
  }

  const mathNumber = value => (value < 0 ? "<mo>−</mo>" : "") + "<mn>" + Math.abs(value).toFixed(2) + "</mn>";
  function drawScene(layer, compact, c, palette, outputs) {
    const { use, url, tile } = palette;
    // On phones the input and reconstruction move above and below the three model passes.
    const layout = compact ? {
      width: 342, height: 451, source: [32, 39, 48], cx: 62, px: 214, rows: [133, 201, 269],
      card: 48, mean: [94, 385, 63], result: [250, 385, 63], join: 323
    } : {
      width: 900, height: 304, source: [88, 150, 102], cx: 254, px: 457, rows: [74, 150, 226],
      card: 58, mean: [654, 150, 94], result: [827, 150, 98], join: 571
    };
    const { source, cx, px, rows, card, mean, result, join } = layout;
    const back = layer.append("g");
    const cards = layer.append("g");
    const text = layer.append("g");
    function group(parent, x, y, width) {
      return parent.append("g").attr("transform", "translate(" + (x - width / 2) + " " +
        (y - width / 2) + ") scale(" + width / size + ")");
    }
    function wire(path, color, arrow = true) {
      // Arrowheads are part of the trace, so rewinding cannot leave a detached arrow.
      return back.append("path").attr("d", path).attr("fill", "none")
        .attr("stroke", color).attr("stroke-width", arrow ? 1.9 : 1.35)
        .attr("stroke-linecap", "round").attr("stroke-linejoin", "round")
        .attr("pathLength", 1).attr("stroke-dasharray", 1);
    }
    function arrow(from, to, y, color) {
      return wire("M" + from + " " + y + "H" + to + "m-5-4 5 4-5 4", color);
    }
    function seen(node, amount) { node.attr("opacity", amount); }
    function trace(node, amount) {
      node.attr("stroke-dashoffset", 1 - amount).attr("opacity", amount === 0 ? 0 : .9);
    }

    const origin = group(cards, ...source).attr("data-imp-source", "A");
    use(origin, "observed");
    if (compact) {
      label(text, 69, 29, c.source + " · " + c.measured, { anchor: "start", size: 14 });
    } else {
      label(text, source[0], 29, c.source);
      label(text, source[0], 222, c.measured, { size: 13 });
    }
    formula(text, compact ? 69 : source[0], compact ? 46 : 239, 146, 22, 12, muted,
      "\\delta \\approx 0", "<mi>δ</mi><mo>≈</mo><mn>0</mn>", { left: compact, before: c.once });
    const headings = compact ? 87 : 29;
    label(text, cx, headings, c.contexts, { size: compact ? 13 : 15, color: violet });
    label(text, compact ? 141 : 351, headings, compact ? c.shortModel : c.model,
      { size: compact ? 10.5 : 13, color: muted });
    label(text, px, headings, c.estimates, { size: compact ? 13 : 15, color: teal });
    formula(text, cx, compact ? 305 : 277, compact ? 111 : 130, 20, compact ? 12 : 13, violet,
      "K=" + draws.length, "<mi>K</mi><mo>=</mo><mn>" + draws.length + "</mn>", { after: c.example });
    const drawCards = [], predictCards = [], forward = [], modelLabels = [], merge = [];
    const split = compact ? wire("M10 62H5V99Q5 106 23 108m-4-4 4 4-5 3", violet) :
      arrow(source[0] + source[2] / 2 + 9, cx - card / 2 - 24, rows[1], violet);
    function markSite(face) {
      const marker = face.append("g").attr("transform", "translate(10 10)");
      marker.append("circle").attr("r", 3.9).attr("fill", "none").attr("stroke", "#fff").attr("stroke-width", 2.8);
      marker.append("circle").attr("r", 3.9).attr("fill", "none").attr("stroke", "#174b55").attr("stroke-width", 1.35);
      marker.append("circle").attr("r", .85).attr("fill", "#174b55");
    }

    draws.forEach((cells, j) => {
      const context = cards.append("g").attr("data-imp-context", j + 1).attr("data-cells", cells.join(","));
      const face = group(context, 0, 0, card);
      use(face, "context-" + j);
      const badge = context.append("g").attr("transform", "translate(" + (-card / 2) + " " + (-card / 2) + ")");
      rect(badge, -9, -5, 23, 15, violet).attr("rx", 2.2);
      const k = j + 1;
      formula(badge, 2.5, 2.5, 23, 15, 12, "var(--idcd-on-accent)",
        "C_{" + k + "}", "<msub><mi>C</mi><mn>" + k + "</mn></msub>");
      drawCards.push(context);

      const y = rows[j];
      const start = cx + card / 2 + 8, end = px - card / 2 - 8;
      forward.push(arrow(start, end, y + 2, teal));
      const model = formula(text, (start + end) / 2, y - 11, 42, 22, 17, teal,
        "f_{\\theta}", "<msub><mi>f</mi><mi>θ</mi></msub>");
      modelLabels.push(model);
      const prediction = cards.append("g").attr("data-imp-prediction", j + 1)
        .attr("data-site-value", outputs.fields[j][site].toFixed(2));
      const predictionFace = group(prediction, px, y, card);
      use(predictionFace, "estimate-" + j);
      use(predictionFace, "grid");
      markSite(predictionFace);
      const nx = px + card / 2 + 7;
      formula(prediction, nx, y - 9, 43, 20, 12.5, teal, "\\hat{y}_{" + k + "}(i)",
        '<msub><mover accent="true"><mi>y</mi><mo>^</mo></mover><mn>' + k +
        '</mn></msub><mo stretchy="false">(</mo><mi>i</mi><mo stretchy="false">)</mo>', { left: true });
      const estimate = outputs.fields[j][site];
      formula(prediction, nx, y + 9, 43, 17, 13, ink,
        estimate.toFixed(2), mathNumber(estimate), { left: true });
      predictCards.push(prediction);
      const mx = nx + (compact ? 44 : 47);
      merge.push(wire("M" + mx + " " + y + "H" + join + "V" + (compact ? 326 : rows[1]), teal, false));
    });

    const fold = compact ?
      wire("M323 326H94V345m-4-5 4 5 4-5", teal) :
      arrow(join, mean[0] - mean[2] / 2 - 8, mean[1], teal);
    const copyMean = arrow(mean[0] + mean[2] / 2 + 10, result[0] - result[2] / 2 - 10, mean[1], teal);
    const meanGroup = cards.append("g").attr("data-imp-mean", "").attr("data-site-value", outputs.mean[site].toFixed(2));
    const meanFace = group(meanGroup, ...mean);
    use(meanFace, "estimate-3");
    use(meanFace, "grid");
    markSite(meanFace);
    const resultGroup = cards.append("g").attr("data-imp-result", "");
    const resultFace = group(resultGroup, ...result);
    use(resultFace, "observed");
    const patches = gaps.map(i => {
      const patch = resultFace.append("g").attr("data-imp-gap", i);
      use(patch, "estimate-3").attr("clip-path", url("gap-" + i));
      const [x, y] = tile(i);
      rect(patch, x + .65, y + .65, 18.7, 18.7, "none").attr("stroke", "var(--idcd-prediction)").attr("stroke-width", 1.4);
      return patch;
    });
    if (compact) {
      label(text, 7, 340, c.mean, { size: 12, color: teal, anchor: "start" });
      label(text, result[0], 340, c.result, { size: 13 });
    } else {
      label(text, mean[0], headings, c.mean, { size: 15, color: teal });
      label(text, result[0], headings, c.result, { size: 15 });
    }
    label(resultGroup, result[0], compact ? 438 : 223, c.gaps, { size: compact ? 11 : 13, color: teal });
    const average = outputs.mean[site];
    formula(meanGroup, mean[0], compact ? 435 : 219, 132, 25, compact ? 13 : 15, teal,
      "\\overline{\\hat{y}}(i)=" + average.toFixed(2),
      '<mover accent="true"><mover accent="true"><mi>y</mi><mo>^</mo></mover><mo>¯</mo></mover>' +
      '<mo stretchy="false">(</mo><mi>i</mi><mo stretchy="false">)</mo><mo>=</mo>' + mathNumber(average));
    const readouts = outputs.fields.map(f => f[site]);
    const sum = readouts.map((value, j) => (j && value >= 0 ? "<mo>+</mo>" : "") + mathNumber(value)).join("");
    const texSum = readouts.map((value, j) => (j && value >= 0 ? "+" : "") + value.toFixed(2)).join("");
    const equation = formula(text, compact ? 220 : 650, compact ? 309 : 277,
      compact ? 188 : 265, compact ? 29 : 39, compact ? 11.5 : 15, teal,
      "\\frac{" + texSum + "}{" + readouts.length + "}=" + average.toFixed(2),
      "<mfrac><mrow>" + sum + "</mrow><mn>" + readouts.length + "</mn></mfrac><mo>=</mo>" + mathNumber(average));

    function render(p) {
      trace(split, phase(p, .01, .13));
      const fan = phase(p, .25, .39);
      const pass = phase(p, .32, .43);
      // Reveal the three estimates and their pointwise mean as one comparison.
      const comparison = phase(p, .40, .54);
      draws.forEach((_, j) => {
        const draw = phase(p, .01 + j * .04, .08 + j * .04);
        const sx = cx + (j - 1) * (compact ? 10 : 13);
        const sy = rows[1] + (j - 1) * (compact ? 11 : 14);
        const x = source[0] + draw * (sx - source[0]) + fan * (cx - sx);
        const y = source[1] + draw * (sy - source[1]) + fan * (rows[j] - sy);
        drawCards[j].attr("transform", "translate(" + x + " " + y + ")").attr("opacity", draw);
        trace(forward[j], pass);
        seen(modelLabels[j], pass);
        seen(predictCards[j], comparison);
        trace(merge[j], comparison);
      });
      trace(fold, phase(p, .44, .54));
      seen(meanGroup, comparison);
      seen(equation, comparison);
      seen(resultGroup, phase(p, .62, .71));
      trace(copyMean, phase(p, .65, .74));
      patches.forEach(patch => seen(patch, phase(p, .72, .83)));
    }
    return { width: layout.width, height: layout.height, render };
  }

  window.createIncompleteImputation = function (root) {
    const host = root.querySelector("[data-idcd-imputation]");
    const svg = window.d3.select(host.querySelector("svg"));
    const c = copy[host.dataset.lang.startsWith("zh") ? "zh" : "en"];
    const outputs = illustrativeOutputs();
    const palette = defineFields(svg.append("defs"), root.dataset.fieldArt, "idcd-imp-" + (++instance) + "-", outputs);
    const layer = svg.append("g");
    let current, lastWidth, progress = 0;
    function fit(width) {
      if (!width) return;
      const compact = width < 680;
      if (current && lastWidth === compact) return;
      lastWidth = compact;
      layer.selectAll("*").remove();
      current = drawScene(layer, compact, c, palette, outputs);
      svg.attr("viewBox", [0, 0, current.width, current.height].join(" "))
        .style("max-width", compact ? "440px" : null).style("margin-inline", "auto");
      current.render(progress);
    }
    if (window.ResizeObserver) {
      new ResizeObserver(entries => fit(entries[0].contentRect.width)).observe(host);
    } else {
      window.addEventListener("resize", () => fit(host.clientWidth));
    }
    return function render(p) {
      progress = p;
      if (!current) fit(host.clientWidth || root.clientWidth);
      if (current) current.render(p);
    };
  };
}());
