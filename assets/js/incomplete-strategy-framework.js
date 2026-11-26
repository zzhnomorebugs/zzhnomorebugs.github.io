(function () {
  "use strict";

  const size = 120;
  const tile = size / 3;
  const observed = { A: [1, 2, 3, 4, 6, 7, 8], B: [0, 1, 4, 5, 6, 7, 8] };
  const retained = [1, 4, 6, 8];
  const xy = i => [i % 3 * tile, Math.floor(i / 3) * tile];
  let instance = 0;

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
    rect(stackClip, 105, 199, 447, 1069, "#fff");
    use(frame.selectAll("[data-fw-stack]"), "sheet").attr("clip-path", paint("stack"));

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
    rect(hatch, 0, 0, 6, 6, "#f9fafb");
    hatch.append("path").attr("d", "M-1 1L1 -1M0 6L6 0M5 7L7 5")
      .attr("stroke", "#dce3e6").attr("stroke-width", 0.7);

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
      .attr("fill", "#635bba").attr("fill-opacity", 0.48).attr("stroke", "#484292").attr("stroke-width", 0.8);
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
      rect(grain, i % 8 * 2, Math.floor(i / 8) * 2, 2, 2, random() < 0.5 ? "#754c58" : "#59769b")
        .attr("opacity", random() * 0.32);
    }
    const swap = [];
    const focus = [];
    let arbitrary, predictionB;
    function paintSample(group, route, kind, sample) {
      const isPixel = route === "pixel";
      const clip = kind === "split" ? "mask" + sample : isPixel ? "pixels" : "blocks";
      const face = group.append("g").attr("clip-path", paint(clip));
      use(face, "field" + sample);
      rect(face, 0, 0, size, size, paint("grain"));
      if (kind === "split") {
        rect(face, 0, 0, size, size, "#f4c16f").attr("opacity", 0.38);
      }
      if (isPixel) {
        use(group, "pixel-marks");
      } else {
        retained.forEach(i => {
          const [x, y] = xy(i);
          rect(group, x + 0.6, y + 0.6, tile - 1.2, tile - 1.2, "#7870c9")
            .attr("fill-opacity", 0.38).attr("stroke", "#5955b7").attr("stroke-width", 1.2);
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
          .attr("fill", "none").attr("stroke", "#5c6870").attr("stroke-opacity", 0.48).attr("stroke-width", 0.65);
        rect(board, 0.5, 0.5, 119, 119, "none").attr("stroke", "#829098").attr("stroke-width", 1);
        if (kind === "output") target(board, route === "pixel" ? "#284c88" : "#9a4d19");
      });
    });
    const flow = {
      fork: frame.selectAll('[data-fw-trace="fork"]'),
      select: frame.selectAll('[data-fw-trace="select"]'),
      predict: frame.selectAll('[data-fw-trace="predict"]')
    };
    const phase = (p, a, b) => Math.min(1, Math.max(0, (p - a) / (b - a)));
    const sample = frame.select('[data-strategy="block"] [data-fw-sample]');
    let previousSample, previousFocus;
    return function draw(p) {
      const b = phase(p, 0.33, 0.47);
      swap.forEach(layer => layer.attr("opacity", b));
      const label = b < 0.5 ? "A" : "B";
      if (label !== previousSample) {
        sample.text(label);
        previousSample = label;
      }
      flow.fork.attr("stroke-dashoffset", 1 - phase(p, 0.04, 0.18));
      flow.select.attr("stroke-dashoffset", 1 - phase(p, 0.20, 0.36));
      flow.predict.attr("stroke-dashoffset", 1 - phase(p, 0.48, 0.65));
      predictionB.attr("opacity", phase(p, 0.53, 0.65));
      arbitrary.attr("opacity", phase(p, 0.65, 0.74));
      focus.forEach(site => site.attr("opacity", 0.55 + 0.45 * phase(p, 0.60, 0.78)));
      const column = p < 0.19 ? "source" : p < 0.36 ? "split" : p < 0.55 ? "context" : "output";
      if (column !== previousFocus) {
        frame.attr("data-focus", column);
        previousFocus = column;
      }
    };
  }
  window.createIncompleteStrategyFramework = setup;
}());
