(function () {
  "use strict";

  const size = 240;
  const block = size / 3;
  const tiles = Array.from({ length: 9 }, (_, i) => ({
    id: i, x: (i % 3) * block, y: Math.floor(i / 3) * block
  }));
  const observedA = [1, 2, 3, 4, 6, 7, 8];
  const observedB = [0, 1, 4, 5, 6, 7, 8];
  const context = [1, 4, 6, 8];
  const queryB = observedB.filter(i => !context.includes(i));
  const colors = { context: "#5955b7", query: "#b86b19", prediction: "#157d79" };
  let instance = 0;

  // Each arrangement maps the same nine spatial locations to visible evidence.
  // All hidden values share one drawing, regardless of why they are absent.
  function arrange(...layers) {
    const roles = tiles.map(() => "blank");
    layers.forEach(([indices, role]) => indices.forEach(i => { roles[i] = role; }));
    return roles;
  }

  const all = tiles.map(tile => tile.id);
  const views = {
    blank: arrange(),
    observed: arrange([observedA, "measuredA"]),
    locate: arrange([observedA, "quietA"], [[0], "tracked"]),
    pixels: arrange([observedA, "pixels"]),
    footprint: arrange([observedA, "present"]),
    excluded: arrange([observedA, "present"], [[0, 5], "excluded"]),
    contextA: arrange([context, "contextA"]),
    secondContextA: arrange([[2, 3, 4, 7], "contextA"]),
    splitA: arrange([observedA, "measuredA"], [context, "contextA"]),
    splitB: arrange([context, "contextB"], [queryB, "queryB"]),
    contextB: arrange([context, "contextB"]),
    noisyB: arrange([context, "noisyB"]),
    prediction: arrange([all, "predictionB"]),
    predictedQueries: arrange([queryB, "scoredB"]),
    answers: arrange([queryB, "queryB"]),
    imputation: arrange([observedA, "measuredA"], [[0, 5], "predictionA"])
  };

  // A track starts from an arrangement. Later entries give the start/end of
  // an on-object change, its new arrangement, and whether tiles resolve in turn.
  const scenes = [
    [["observed"], ["observed", [.19, .52, "locate"]]],
    [["observed", [.08, .40, "pixels", true]],
      ["pixels", [.18, .43, "footprint", true], [.44, .66, "excluded"]]],
    [["observed", [.07, .37, "contextA", true]],
      ["splitA", [.39, .57, "splitB"]]],
    [["splitB"], ["contextB", [.40, .66, "noisyB", true]]],
    [["noisyB"], ["blank", [.16, .65, "prediction", true]]],
    [["prediction", [.08, .35, "predictedQueries"]],
      ["blank", [.29, .48, "answers", true]]],
    [["observed", [.02, .09, "contextA"], [.18, .25, "secondContextA"], [.34, .40, "observed"]],
      ["observed", [.40, .73, "imputation", true]]]
  ];

  function rectangle(parent, width = size, height = size) {
    return parent.append("rect").attr("width", width).attr("height", height);
  }

  function makePalette(svg, prefix, art) {
    const defs = svg.append("defs");
    const local = name => "#" + prefix + name;
    const group = name => defs.append("g").attr("id", prefix + name);
    const use = (parent, name) => parent.append("use").attr("href", local(name));

    const hatch = defs.append("pattern").attr("id", prefix + "hatch")
      .attr("patternUnits", "userSpaceOnUse").attr("width", 9).attr("height", 9);
    rectangle(hatch, 9, 9).attr("fill", "#f6f8f8");
    hatch.append("path").attr("d", "M-2 2L2 -2 M0 9L9 0 M7 11L11 7")
      .attr("fill", "none").attr("stroke", "#d8e1e2").attr("stroke-width", .85);
    rectangle(group("blank")).attr("fill", "url(" + local("hatch") + ")");
    const tracked = group("tracked");
    use(tracked, "blank");
    tracked.append("path").attr("d", "M5 22V5h17M58 5h17v17M75 58v17H58M22 75H5V58")
      .attr("fill", "none").attr("stroke", "#536b72").attr("stroke-width", 2.8);

    // A crop of the illustrated field in the project's context–query figure.
    const texture = group("texture").append("svg").attr("viewBox", "1856 851 397 397")
      .attr("width", size).attr("height", size).attr("overflow", "hidden");
    texture.append("image").attr("href", art).attr("width", 2400).attr("height", 1548);
    use(group("measuredA"), "texture");
    use(group("measuredB"), "texture").attr("transform", "translate(240 240) rotate(180)");
    const quiet = group("quietA");
    use(quiet, "measuredA");
    rectangle(quiet).attr("fill", "#fff").attr("opacity", .43);

    function outlines(parent, color, dashed) {
      parent.selectAll("rect.block-outline").data(tiles).join("rect").attr("class", "block-outline")
        .attr("x", t => t.x + 2.5).attr("y", t => t.y + 2.5)
        .attr("width", block - 5).attr("height", block - 5).attr("fill", "none")
        .attr("stroke", color).attr("stroke-width", 2.2)
        .attr("stroke-dasharray", dashed ? "6 3" : null);
    }

    function tint(parent, color, opacity) {
      rectangle(parent).attr("fill", color).attr("opacity", opacity);
    }

    ["A", "B"].forEach(sample => {
      const retained = group("context" + sample);
      use(retained, "measured" + sample);
      tint(retained, colors.context, .36);
      outlines(retained, colors.context, false);
      const predicted = group("prediction" + sample);
      // Shift and scale the structures relative to the clean target. This is
      // a schematic estimate, so the score views show a genuine visual residual.
      use(predicted, "measured" + sample).attr("transform", "translate(-10 -2) scale(1.13)");
      tint(predicted, colors.prediction, .20);
      outlines(predicted, colors.prediction, false);
    });
    const target = group("queryB");
    use(target, "measuredB");
    tint(target, "#f4ae4c", .27);
    outlines(target, colors.query, true);
    const scored = group("scoredB");
    use(scored, "predictionB");
    outlines(scored, colors.query, true);

    // Fixed draws keep the evidence identical after scrubbing or replay.
    let seed = 14321;
    function random() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return (seed + .5) / 4294967296;
    }
    const grains = ["#4c68a3", "#7699c3", "#afc6df", "#edf1f4", "#edc8b8", "#d69a86", "#ad6b5f"];
    const noise = defs.append("pattern").attr("id", prefix + "grain")
      .attr("patternUnits", "userSpaceOnUse").attr("width", 52).attr("height", 52);
    noise.selectAll("rect").data(Array.from({length: 169}, (_, i) => i)).join("rect")
      .attr("x", i => i % 13 * 4).attr("y", i => Math.floor(i / 13) * 4)
      .attr("width", 4).attr("height", 4).attr("fill", () => {
        const z = Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random());
        return grains[Math.max(0, Math.min(6, Math.round(3 + z * 1.5)))];
      });
    const noisy = group("noisyB");
    use(noisy, "measuredB");
    rectangle(noisy).attr("fill", "url(" + local("grain") + ")").attr("opacity", .74);
    tint(noisy, colors.context, .22);
    outlines(noisy, colors.context, false);

    const points = tiles.flatMap(tile => {
      // Select a few actual pixel locations in each retained block.
      const candidates = Array.from({ length: 64 }, (_, i) => ({ i, key: random() }));
      return candidates.sort((a, b) => a.key - b.key).slice(0, 11)
        .map(({ i }) => ({ x: tile.x + (i % 8) * 10 + 2, y: tile.y + Math.floor(i / 8) * 10 + 2 }));
    });
    function drawPoints(parent) {
      return parent.selectAll("rect.pixel").data(points).join("rect").attr("class", "pixel")
        .attr("x", p => p.x).attr("y", p => p.y).attr("width", 6).attr("height", 6);
    }
    const pixelClip = defs.append("clipPath").attr("id", prefix + "pixelsOnly");
    drawPoints(pixelClip);
    const pixels = group("pixels");
    use(pixels, "blank");
    use(pixels, "measuredA").attr("clip-path", "url(" + local("pixelsOnly") + ")");
    drawPoints(pixels).attr("fill", colors.context).attr("fill-opacity", .49)
      .attr("stroke", colors.context).attr("stroke-width", 1.15);

    const present = group("present");
    rectangle(present).attr("fill", "#e3e5f0");
    present.selectAll("path").data(tiles).join("path")
      .attr("d", t => "M" + (t.x + 31) + " " + (t.y + 40) + "l6 6 13 -14")
      .attr("fill", "none").attr("stroke", "#63678c").attr("stroke-width", 2.3)
      .attr("stroke-linejoin", "round").attr("stroke-linecap", "round");
    const excluded = group("excluded");
    use(excluded, "blank");
    excluded.selectAll("path").data(tiles).join("path")
      .attr("d", t => "M" + (t.x + 31) + " " + (t.y + 31) + "l18 18m0 -18l-18 18")
      .attr("fill", "none").attr("stroke", "#8a5348").attr("stroke-width", 2.8);
    return local;
  }

  function makeBoard(element, art) {
    const svg = window.d3.select(element);
    const local = makePalette(svg, "idcd-field-" + (++instance) + "-", art);
    const cells = svg.selectAll("svg.field-tile").data(tiles, t => t.id).join("svg")
      .attr("class", "field-tile").attr("x", t => t.x).attr("y", t => t.y)
      .attr("width", block).attr("height", block).attr("overflow", "hidden")
      .attr("viewBox", t => [t.x, t.y, block, block].join(" "));
    const previous = cells.append("use").nodes();
    const incoming = cells.append("use").nodes();
    svg.append("path").attr("d", "M80 0v240M160 0v240M0 80h240M0 160h240")
      .attr("fill", "none").attr("stroke", "#637577").attr("stroke-opacity", .62)
      .attr("stroke-width", 1);
    rectangle(svg, size - 1, size - 1).attr("x", .5).attr("y", .5)
      .attr("fill", "none").attr("stroke", "#687879").attr("stroke-width", 1);

    // A reader's reticle stays registered to the same physical coordinate.
    // Its open centre leaves the prediction and the clean value visible there.
    const marker = svg.append("g").attr("transform", "translate(40,40)").attr("aria-hidden", "true");
    const reticle = "M-8 -3v-5h5M3 -8h5v5M8 3v5H3M-3 8h-5V3";
    [ ["white", 4.4], ["#263d45", 2] ].forEach(([stroke, width]) => {
      marker.append("path").attr("d", reticle).attr("fill", "none").attr("stroke", stroke)
        .attr("stroke-width", width).attr("stroke-linejoin", "round");
    });
    marker.append("circle").attr("cx", 15).attr("cy", -13).attr("r", 7.8)
      .attr("fill", "#fff").attr("stroke", "#4e6165").attr("stroke-width", .8);
    marker.append("text").attr("x", 15).attr("y", -9)
      .attr("font-family", "Georgia, serif").attr("font-size", 13).attr("font-style", "italic")
      .attr("font-weight", "bold").attr("text-anchor", "middle").attr("fill", "#263d45").text("i");

    const cache = tiles.map(() => ({}));
    return function draw(track, p) {
      let from = track[0], to = from, amount = 1, stagger = false;
      for (const [start, end, target, ordered] of track.slice(1)) {
        if (p < start) break;
        if (p < end) {
          to = target;
          amount = (p - start) / (end - start);
          stagger = ordered;
          break;
        }
        from = to = target;
      }
      tiles.forEach(({ id }) => {
        const a = views[from][id], b = views[to][id];
        const phase = stagger ? (amount - .32 * id / 8) / .68 : amount;
        const t = Math.max(0, Math.min(1, phase));
        const mix = a === b ? 0 : Math.round(100 * t * t * (3 - 2 * t)) / 100;
        const before = mix === 1 ? b : a;
        const after = mix > 0 && mix < 1 ? b : null;
        const opacity = after ? mix : 0;
        const last = cache[id];
        if (before !== last.before) previous[id].setAttribute("href", local(before));
        if (after && after !== last.after) incoming[id].setAttribute("href", local(after));
        if (opacity !== last.opacity) incoming[id].setAttribute("opacity", opacity);
        last.before = before;
        last.after = after;
        last.opacity = opacity;
      });
    };
  }

  window.createIncompleteTrainingFields = function (root) {
    const boards = ["left", "right"].map(side =>
      makeBoard(root.querySelector('[data-idcd-field="' + side + '"]'), root.dataset.fieldArt));
    return function render(sceneIndex, progress) {
      boards.forEach((draw, side) => draw(scenes[sceneIndex][side], progress));
    };
  };
}());
