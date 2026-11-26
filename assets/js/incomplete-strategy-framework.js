(function () {
  "use strict";

  const size = 120;
  const tile = size / 3;
  const observed = { A: [1, 2, 3, 4, 6, 7, 8], B: [0, 1, 4, 5, 6, 7, 8] };
  const retained = [1, 4, 6, 8];
  const xy = i => [i % 3 * tile, Math.floor(i / 3) * tile];
  let instance = 0;

  const phase = (p, a, b) => Math.min(1, Math.max(0, (p - a) / (b - a)));
  const ease = x => x * x * (3 - 2 * x);

  function tourScale(p, start, end) {
    const time = phase(p, start, end);
    const lift = Math.min(phase(time, 0, 0.32), 1 - phase(time, 0.68, 1));
    return 1 + 0.14 * ease(lift);
  }

  function rect(parent, x, y, width, height, fill) {
    return parent.append("rect").attr("x", x).attr("y", y).attr("width", width)
      .attr("height", height).attr("fill", fill);
  }

  function setup(root) {
    const frame = window.d3.select(root.querySelector("[data-idcd-framework]"));
    const defs = frame.select(".idcd-framework__defs defs");
    const prefix = "idcd-framework-" + (++instance) + "-";
    const id = name => prefix + name;
    const local = name => "#" + id(name);
    const paint = name => "url(" + local(name) + ")";
    const use = (parent, name) => parent.append("use").attr("href", local(name));
    defs.append("image").attr("id", id("sheet")).attr("width", 2400).attr("height", 1548)
      .attr("href", root.dataset.fieldArt);
    const stackClip = defs.append("clipPath").attr("id", id("stack"));
    // Clip to the five sample sheets, keeping white field values inside the diamonds.
    stackClip.selectAll("polygon").data([
      "320,202 533,324 320,447 107,324",
      "320,309 533,432 320,554 107,432",
      "329,596 551,723 326,852 106,725",
      "320,895 533,1017 320,1140 107,1017",
      "320,1022 533,1144 320,1267 107,1144"
    ]).join("polygon").attr("points", d => d);
    const stacks = frame.selectAll("[data-fw-stack]");
    use(stacks, "sheet").attr("clip-path", paint("stack"));
    stacks.selectAll("circle").data([563, 577, 590, 856, 870, 883]).join("circle")
      .attr("cx", 319).attr("cy", y => y).attr("r", 3.5).attr("fill", "currentColor");

    // Keep the measured and predicted textures registered to the same coordinates.
    function crop(name, box) {
      const surface = defs.append("svg").attr("id", id(name)).attr("width", size)
        .attr("height", size).attr("viewBox", box).attr("overflow", "hidden");
      use(surface, "sheet");
    }
    crop("fieldA", "1856 851 397 397");
    crop("unconstrained", "1856 203 397 397");
    use(defs.append("g").attr("id", id("fieldB")), "fieldA")
      .attr("transform", "translate(120 120) rotate(180)");

    const hatch = defs.append("pattern").attr("id", id("blank"))
      .attr("width", 6).attr("height", 6).attr("patternUnits", "userSpaceOnUse");
    rect(hatch, 0, 0, 6, 6, "var(--idcd-empty)");
    hatch.append("path").attr("d", "M-1 1L1 -1M0 6L6 0M5 7L7 5")
      .attr("stroke", "var(--idcd-hatch)").attr("stroke-width", 0.7);

    // A fixed sparse draw makes the input pixels exactly match the split pixels.
    let seed = 36;
    function random() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    const pixels = observed.A.flatMap(i => {
      const [x, y] = xy(i);
      return Array.from({ length: 36 }, (_, k) => ({ k, draw: random() }))
        .sort((a, b) => a.draw - b.draw).slice(0, 6)
        .map(({ k }) => ({ x: x + (k % 6 + 0.2) * tile / 6, y: y + (Math.floor(k / 6) + 0.2) * tile / 6 }));
    });
    const pixelClip = defs.append("clipPath").attr("id", id("pixels"));
    pixelClip.selectAll("rect").data(pixels).join("rect")
      .attr("x", d => d.x).attr("y", d => d.y).attr("width", 4.2).attr("height", 4.2);
    const marks = defs.append("g").attr("id", id("pixel-marks"));
    marks.selectAll("rect").data(pixels).join("rect")
      .attr("x", d => d.x).attr("y", d => d.y).attr("width", 4.2).attr("height", 4.2)
      .attr("fill", "var(--idcd-context-fill)").attr("fill-opacity", 0.52)
      .attr("stroke", "var(--idcd-context)").attr("stroke-width", 0.9);
    function mask(name, indices) {
      const clip = defs.append("clipPath").attr("id", id(name));
      indices.forEach(i => { const [x, y] = xy(i); rect(clip, x, y, tile, tile, "#fff"); });
    }
    mask("maskA", observed.A);
    mask("maskB", observed.B);
    mask("blocks", retained);

    const grain = defs.append("pattern").attr("id", id("grain"))
      .attr("width", 16).attr("height", 16).attr("patternUnits", "userSpaceOnUse");
    for (let i = 0; i < 64; i += 1) {
      rect(grain, i % 8 * 2, Math.floor(i / 8) * 2, 2, 2, random() < 0.5 ? "#d56950" : "#4884bf")
        .attr("opacity", random() * 0.2);
    }
    for (const sample of ["A", "B"]) {
      const measured = defs.append("g").attr("id", id("observed" + sample));
      use(measured, "field" + sample);
      rect(measured, 0, 0, size, size, paint("grain"));
    }
    const swap = [];
    const focus = [];
    const evidence = [];
    let arbitrary, predictionB;

    // These annotations belong to the reader. The context boards trace only
    // visible evidence; original-mask gaps and held-out labels stay on the split.
    function addEvidence(board, role, indices, path, color) {
      const marks = board.append("g").attr("data-fw-evidence", role)
        .attr("fill", "none").attr("stroke", color).attr("stroke-width", 2.4)
        .attr("stroke-linecap", "round").attr("stroke-linejoin", "round")
        .selectAll("path").data(indices).join("path")
        .attr("data-fw-tile", i => i)
        .attr("transform", i => "translate(" + xy(i).join(" ") + ")")
        .attr("d", path).attr("pathLength", 1).attr("stroke-dasharray", 1);
      let previous;
      evidence.push({ role, draw: amount => {
        if (amount === previous) return;
        previous = amount;
        marks.each(function (_, order) {
          const offset = indices.length === 1 ? 0 : 0.70 * order / (indices.length - 1);
          const revealed = phase(amount, offset, offset + (indices.length === 1 ? 1 : 0.30));
          this.setAttribute("stroke-dashoffset", 1 - revealed);
          this.setAttribute("opacity", revealed === 0 ? 0 : 1);
        });
      } });
    }
    function paintSample(group, route, kind, sample) {
      const isPixel = route === "pixel";
      const clip = kind === "split" ? "mask" + sample : isPixel ? "pixels" : "blocks";
      const face = group.append("g").attr("clip-path", paint(clip));
      use(face, "observed" + sample);
      if (kind === "split") {
        rect(face, 0, 0, size, size, "var(--idcd-query-fill)").attr("opacity", 0.27);
        // Restore the measured texture on context sites so amber only marks held-out data.
        use(face, "observed" + sample).attr("clip-path", paint(isPixel ? "pixels" : "blocks"));
      }
      if (isPixel) {
        use(group, "pixel-marks");
      } else {
        retained.forEach(i => {
          const [x, y] = xy(i);
          rect(group, x + 0.6, y + 0.6, tile - 1.2, tile - 1.2, "var(--idcd-context-fill)")
            .attr("fill-opacity", 0.24).attr("stroke", "var(--idcd-context)").attr("stroke-width", 1.3);
        });
      }
    }

    function target(board, color) {
      const g = board.append("g").attr("data-fw-site", "i");
      const corners = "M3 11V3h8M29 3h8v8M37 29v8h-8M11 37H3v-8";
      g.append("path").attr("d", corners).attr("fill", "none").attr("stroke", "white").attr("stroke-width", 3.8);
      g.append("path").attr("d", corners).attr("fill", "none").attr("stroke", color).attr("stroke-width", 2.1);
      g.append("circle").attr("cx", 20).attr("cy", 20).attr("r", 7.6)
        .attr("stroke", color).attr("stroke-width", 0.9).attr("fill", "#fff").attr("fill-opacity", 0.94);
      g.append("text").attr("x", 20).attr("y", 23.6).attr("fill", color).attr("text-anchor", "middle")
        .attr("font-family", "Georgia, serif").attr("font-style", "italic").attr("font-size", 11).text("i");
      focus.push(g);
    }

    frame.selectAll("[data-strategy]").each(function () {
      const lane = window.d3.select(this);
      const route = this.dataset.strategy;
      lane.selectAll("[data-fw-field]").each(function () {
        const board = window.d3.select(this);
        const kind = this.dataset.fwField;
        rect(board, 0, 0, size, size, paint("blank"));
        if (kind === "output") {
          use(board, route === "pixel" ? "unconstrained" : "fieldA");
          if (route === "pixel") {
            // Two arbitrary predictions can agree everywhere the loss is evaluated.
            arbitrary = board.append("g").attr("opacity", 0);
            [0, 5].forEach(i => {
              const [x, y] = xy(i);
              const patch = arbitrary.append("svg").attr("x", x).attr("y", y)
                .attr("width", tile).attr("height", tile).attr("viewBox", [x, y, tile, tile].join(" "));
              use(patch, "unconstrained").attr("transform", "rotate(90 " + (x + tile / 2) + " " + (y + tile / 2) + ")");
            });
          } else {
            predictionB = use(board, "fieldB").attr("opacity", 0);
          }
        } else {
          paintSample(board, route, kind, "A");
          if (route === "block") {
            const alternate = board.append("g").attr("opacity", 0);
            rect(alternate, 0, 0, size, size, paint("blank"));
            paintSample(alternate, route, kind, "B");
            swap.push(alternate);
          }
        }
        board.append("path").attr("d", "M40 0v120M80 0v120M0 40h120M0 80h120")
          .attr("fill", "none").attr("stroke", "var(--idcd-grid)").attr("stroke-opacity", 0.49).attr("stroke-width", 0.65);
        rect(board, 0.5, 0.5, 119, 119, "none").attr("stroke", "var(--idcd-grid)").attr("stroke-width", 1);
        if (kind === "context") {
          const footprint = route === "pixel" ? observed.A : retained;
          addEvidence(board, "footprint", footprint, "M4 13V4h9M36 27v9h-9", "var(--idcd-footprint)");
        } else if (kind === "split" && route === "pixel") {
          addEvidence(board, "excluded", [0, 5], "M14 14l12 12m-12 0 12-12", "var(--idcd-excluded)");
        } else if (kind === "split" && route === "block") {
          addEvidence(board, "query", [0], "M3 13V3h10M37 27v10H27", "var(--idcd-query)");
        }
        if (kind === "output") target(board, route === "pixel" ? "#284c88" : "#9a4d19");
      });
    });
    const flow = {
      fork: frame.selectAll('[data-fw-trace="fork"]'),
      select: frame.selectAll('[data-fw-trace="select"]'),
      predict: frame.selectAll('[data-fw-trace="predict"]')
    };
    const tour = [
      { column: "source", nodes: frame.selectAll("[data-fw-stack]"), start: 0, end: 0.18 },
      ...[["split", 0.19, 0.38], ["context", 0.39, 0.58], ["output", 0.59, 0.84]].map(([column, start, end]) => ({
        column, start, end,
        nodes: frame.selectAll('[data-fw-field="' + column + '"]').select(function () { return this.parentNode; })
      }))
    ];
    const sample = frame.select('[data-strategy="block"] [data-fw-sample]');
    let previousChapter, previousSample, previousFocus;
    return function draw(chapter, p) {
      const overview = chapter === 0;
      const pixels = chapter === 1;
      if (chapter !== previousChapter) {
        frame.attr("data-strategy-focus", ["both", "pixel", "block"][chapter]);
        previousChapter = chapter;
      }
      for (const stop of tour) {
        const scale = overview ? tourScale(p, stop.start, stop.end) : 1;
        if (scale !== stop.scale) {
          stop.nodes.style("--fw-zoom", scale);
          stop.scale = scale;
        }
      }

      // Begin each strategy close-up with the previous frame's evidence.
      // In the block close-up, remove and restore sample B while the four
      // highlighted context locations remain fixed through both transitions.
      let b, predicted, arbitraryMix, footprint, excluded, query;
      if (overview) {
        b = phase(p, 0.33, 0.47);
        predicted = phase(p, 0.53, 0.65);
        arbitraryMix = phase(p, 0.65, 0.74);
        footprint = excluded = query = 0;
      } else if (pixels) {
        b = predicted = 1;
        footprint = phase(p, 0.06, 0.46);
        excluded = phase(p, 0.45, 0.65);
        query = phase(p, 0.47, 0.65);
        arbitraryMix = 1 - phase(p, 0.60, 0.77);
      } else {
        b = 1 - ease(phase(p, 0.04, 0.18)) + ease(phase(p, 0.39, 0.54));
        predicted = 1 - ease(phase(p, 0.12, 0.25)) + ease(phase(p, 0.55, 0.69));
        footprint = 1;
        excluded = 1 - ease(phase(p, 0.04, 0.18)) + ease(phase(p, 0.40, 0.59));
        query = b;
        arbitraryMix = phase(p, 0.57, 0.73);
      }
      const amounts = { footprint, excluded, query };
      evidence.forEach(mark => mark.draw(amounts[mark.role]));
      swap.forEach(layer => layer.attr("opacity", b));
      const label = b < 0.5 ? "A" : "B";
      if (label !== previousSample) {
        sample.text(label);
        previousSample = label;
      }
      flow.fork.attr("stroke-dashoffset", overview ? 1 - phase(p, 0.04, 0.18) : 0);
      flow.select.attr("stroke-dashoffset", overview ? 1 - phase(p, 0.20, 0.36) : 0);
      flow.predict.attr("stroke-dashoffset", overview ? 1 - phase(p, 0.48, 0.65) : 0);
      predictionB.attr("opacity", predicted);
      arbitrary.attr("opacity", arbitraryMix);
      focus.forEach(site => site.attr("opacity", overview ? 0.55 + 0.45 * phase(p, 0.60, 0.78) : 1));
      let column;
      if (overview) column = (tour.find(stop => p < stop.end) || tour[tour.length - 1]).column;
      else if (pixels) column = p < 0.45 ? "context" : p < 0.63 ? "split" : "output";
      else column = p < 0.22 ? "split" : p < 0.55 ? "context" : "output";
      if (column !== previousFocus) {
        frame.attr("data-focus", column);
        previousFocus = column;
      }
    };
  }
  window.createIncompleteStrategyFramework = setup;
}());
