(function () {
  "use strict";

  const root = document.querySelector("[data-mask-flow]");
  if (!root || !window.d3 || !window.gsap || !window.ScrollTrigger || !window.incompleteMaskExample) return;

  const example = window.incompleteMaskExample();
  const {cols, rows, observed, anchors, initial, steps, generated} = example;
  const find = (selector) => root.querySelector(selector);
  const labels = JSON.parse(find("[data-mask-labels]").textContent);
  const buttons = Array.from(root.querySelectorAll("[data-mask-scene]"));
  const captions = Array.from(root.querySelectorAll(".mask-flow__caption p"));
  const play = find(".mask-flow__play");
  const stage = find("[data-mask-interactive]");
  const cells = Array.from(observed.keys());
  const observedCount = observed.reduce((total, value) => total + value, 0);
  const frames = [];
  const jumps = [];

  // A frame pairs the continuous estimate on the left with its provisional
  // observed-class support on the right. Only the final frame decodes a mask.
  function addFrame(scene, mode, round, values, transition, hold, options = {}) {
    frames.push({
      scene, mode, round, values, transition, hold,
      overlay: 1, anchors: 1, correction: 0, split: 0, ...options
    });
  }

  const first = steps[0];
  addFrame(0, "noise", 1, initial, 0, 1.2, {overlay: 0, anchors: 0});
  addFrame(0, "predict", 1, first.prediction, 1.4, 2.5, {anchors: 0, jump: true});
  addFrame(1, "predict", 1, first.prediction, 1.6, 3.2, {jump: true});
  addFrame(2, "base", 1, first.base, 1.2, 1.3);
  addFrame(2, "gradient", 1, first.base, 0.85, 3.7, {correction: 1, jump: true});
  addFrame(2, "guided", 1, first.guided, 1.2, 1.9);
  steps.slice(1).forEach((step, index) => {
    const round = index + 2;
    addFrame(3, "predict", round, step.prediction, 0.55, 0.35);
    addFrame(3, "base", round, step.base, 0.45, 0.2);
    addFrame(3, "guided", round, step.guided, 0.6, 0.55, {jump: index === 0});
  });
  addFrame(4, "binary", steps.length, generated, 0.95, 1.8, {anchors: 0});
  addFrame(4, "binary", steps.length, generated, 1.5, 3, {anchors: 0, split: 1, jump: true});

  // Keep each measurement at the same coordinates throughout the explanation.
  function boundaryPath() {
    const edges = [];
    observed.forEach((value, index) => {
      if (!value) return;
      const x = index % cols, y = Math.floor(index / cols);
      if (y === 0 || !observed[index - cols]) edges.push("M" + x + " " + y + "h1");
      if (y === rows - 1 || !observed[index + cols]) edges.push("M" + x + " " + (y + 1) + "h1");
      if (x === 0 || !observed[index - 1]) edges.push("M" + x + " " + y + "v1");
      if (x === cols - 1 || !observed[index + 1]) edges.push("M" + (x + 1) + " " + y + "v1");
    });
    return edges.join("");
  }

  const field = d3.select(find("[data-mask-field]"));
  const overlay = d3.select(find("[data-mask-overlay]"));
  [field, overlay].forEach((svg) => svg.attr("viewBox", [-0.25, -0.25, cols + 0.5, rows + 0.5].join(" ")));

  function tileLayer(svg) {
    return svg.append("g").selectAll("rect").data(cells).join("rect")
      .attr("x", (i) => i % cols + 0.025).attr("y", (i) => Math.floor(i / cols) + 0.025)
      .attr("width", 0.95).attr("height", 0.95);
  }

  const probabilities = tileLayer(field);
  const gradient = field.append("g").attr("opacity", 0);
  const footprint = tileLayer(overlay);
  const hatch = overlay.append("defs").append("pattern").attr("id", "mask-flow-hatch")
    .attr("patternUnits", "userSpaceOnUse").attr("width", 0.5).attr("height", 0.5);
  hatch.append("path").attr("d", "M-0.25 0.25l0.5 -0.5M0 0.5l0.5 -0.5M0.25 0.75l0.5 -0.5")
    .attr("stroke", "#a99cbc").attr("stroke-width", 0.095);
  // Keep the discarded part visible at the handoff to field-model training.
  const discarded = overlay.append("path").attr("fill", "url(#mask-flow-hatch)").attr("opacity", 0)
    .attr("d", cells.filter((i) => generated[i] && !observed[i])
      .map((i) => "M" + (i % cols) + " " + Math.floor(i / cols) + "h1v1h-1z").join(""));
  overlay.append("path").attr("d", boundaryPath()).attr("stroke", "#435462")
    .attr("stroke-width", 0.11).attr("fill", "none").attr("stroke-linecap", "square");
  const anchorGroup = overlay.append("g").attr("opacity", 0);
  const dots = anchorGroup.selectAll("circle")
    .data(cells.filter((i) => anchors[i])).join("circle")
    .attr("cx", (i) => i % cols + 0.5).attr("cy", (i) => Math.floor(i / cols) + 0.5)
    .attr("r", 0.24).attr("fill", "#ffcb57").attr("stroke", "#344048").attr("stroke-width", 0.075);

  const mix = (from, to, amount) => from + (to - from) * amount;
  function color(from, to, amount) {
    return "rgb(" + from.map((channel, i) => Math.round(mix(channel, to[i], amount))).join(",") + ")";
  }

  const paper = [243, 245, 242], teal = [23, 109, 117], deep = [16, 62, 83];
  const lookup = Array.from({length: 256}, (_, i) => {
    const p = i / 255;
    return p < 0.5 ? color(paper, teal, 2 * p) : color(teal, deep, 2 * p - 1);
  });
  const amplitude = Math.max(...first.gradient.map(Math.abs)) || 1;
  tileLayer(gradient).attr("fill", (i) => {
    const delta = first.gradient[i] / amplitude;
    return color(paper, delta < 0 ? [172, 98, 55] : [18, 106, 120], Math.abs(delta));
  });

  const state = {position: 0};
  let lastPosition = -1, lastScene = -1, lastMode = "", lastSplit = null, lastAnchorKey = null;
  let lastReveal = -1;
  const rate = find("[data-mask-rate]");
  const counts = find("[data-mask-counts]");
  const iteration = find("[data-mask-iteration]");
  const modeLabel = find("[data-mask-mode]");
  const show = (selector, visible) => { find(selector).hidden = !visible; };

  function draw() {
    if (state.position === lastPosition) return;
    lastPosition = state.position;
    const index = Math.floor(state.position);
    const from = frames[index], to = frames[Math.min(index + 1, frames.length - 1)];
    const fraction = state.position - index;
    const current = fraction > 0.001 ? to : from;
    const fractionSplit = mix(from.split, to.split, fraction);
    const fractionOverlay = mix(from.overlay, to.overlay, fraction);
    const fractionAnchors = mix(from.anchors, to.anchors, fraction);
    const isSplit = fractionSplit > 0.5;
    const observedOnly = color([221, 231, 229], [216, 137, 71], fractionSplit);
    const candidateOnly = color(paper, [169, 156, 188], fractionOverlay * (1 - fractionSplit));
    const intersection = color([221, 231, 229], [33, 123, 130], fractionOverlay);
    let selected = 0, inside = 0;
    probabilities.attr("fill", (i) => lookup[Math.round(255 * mix(from.values[i], to.values[i], fraction))]);
    gradient.attr("opacity", mix(from.correction, to.correction, fraction));
    discarded.attr("opacity", fractionSplit);
    anchorGroup.attr("opacity", fractionAnchors);
    // Stagger the reveal spatially; membership in this sample never changes.
    const reveal = current.scene === 1 ? fractionAnchors : 1;
    if (reveal !== lastReveal) {
      lastReveal = reveal;
      dots.attr("opacity", (i) => {
        const delay = ((137 * i) % cells.length) / cells.length * 0.75;
        return Math.max(0, Math.min(1, (reveal - delay) * 4));
      });
    }
    footprint.attr("fill", (i) => {
      const candidate = mix(from.values[i], to.values[i], fraction) > 0.5;
      if (candidate) {
        selected++;
        if (observed[i]) inside++;
        return observed[i] ? intersection : candidateOnly;
      }
      return observed[i] ? observedOnly : "#f3f5f2";
    });

    if (current.scene !== lastScene) {
      lastScene = current.scene;
      buttons.forEach((button, i) => {
        if (i === lastScene) button.setAttribute("aria-current", "step");
        else button.removeAttribute("aria-current");
        captions[i].setAttribute("aria-hidden", String(i !== lastScene));
      });
    }
    if (current.mode !== lastMode) {
      lastMode = current.mode;
      modeLabel.textContent = labels[lastMode];
      field.select("title").text(labels[lastMode]);
      show("[data-mask-signed]", lastMode === "gradient");
      show("[data-mask-probability]", lastMode !== "gradient" && lastMode !== "binary");
      show("[data-mask-binary]", lastMode === "binary");
    }
    if (isSplit !== lastSplit) {
      lastSplit = isSplit;
      show("[data-mask-overlay-title]", !isSplit);
      show("[data-mask-inside-key]", !isSplit);
      show("[data-mask-outside-key]", !isSplit);
      show("[data-mask-split-title]", isSplit);
      show("[data-mask-split-symbol]", isSplit);
      show("[data-mask-context-key]", isSplit);
      show("[data-mask-query-key]", isSplit);
      show("[data-mask-excluded-key]", isSplit);
      overlay.select("title").text(find(isSplit ? "[data-mask-split-title]" : "[data-mask-overlay-title]").textContent);
    }
    const anchorsVisible = fractionAnchors > 0.02;
    if (anchorsVisible !== lastAnchorKey) {
      lastAnchorKey = anchorsVisible;
      show("[data-mask-anchor-key]", anchorsVisible);
    }
    const roundLabel = current.round + " / " + steps.length;
    if (iteration.textContent !== roundLabel) iteration.textContent = roundLabel;
    rate.parentElement.style.visibility = fractionOverlay > 0.05 ? "visible" : "hidden";
    const percent = selected ? Math.round(100 * inside / selected) + "%" : "—";
    if (rate.textContent !== percent) rate.textContent = percent;
    const detail = (current.mode === "binary" ? labels.final_compare : labels.compare) +
      " (" + inside + " / " + selected + ")" +
      (isSplit ? " · " + (observedCount - inside) + " " + labels.final_query : "");
    if (counts.textContent !== detail) counts.textContent = detail;
  }

  let ended = false, userPaused = false, inView = false;
  const timeline = gsap.timeline({
    paused: true,
    onUpdate: draw,
    onComplete: () => { ended = true; syncPlayback(); }
  });
  frames.forEach((frame, i) => {
    if (!i || frames[i - 1].scene !== frame.scene) timeline.addLabel("scene-" + frame.scene);
    if (frame.transition) timeline.to(state, {position: i, duration: frame.transition, ease: "sine.inOut"});
    if (frame.jump) jumps[frame.scene] = timeline.duration();
    timeline.to(state, {position: i, duration: frame.hold, ease: "none"});
  });

  function syncPlayback() {
    const playing = Boolean(inView) && !document.hidden && !userPaused && !ended;
    timeline.paused(!playing);
    play.dataset.playing = String(playing);
    play.textContent = ended ? labels.replay : playing ? labels.pause : labels.play;
  }
  play.addEventListener("click", () => {
    if (ended) {
      ended = false;
      userPaused = false;
      timeline.seek(0);
    } else {
      userPaused = !userPaused;
    }
    syncPlayback();
  });
  buttons.forEach((button, i) => button.addEventListener("click", () => {
    userPaused = true;
    ended = false;
    timeline.pause(jumps[i], false);
    syncPlayback();
  }));
  draw();
  stage.hidden = false;
  play.hidden = false;
  find(".mask-flow__fallback").hidden = true;

  gsap.registerPlugin(ScrollTrigger);
  const viewport = ScrollTrigger.create({
    trigger: root, start: "top bottom", end: "bottom top",
    onToggle: (self) => { inView = self.isActive; syncPlayback(); },
    onRefresh: (self) => { inView = self.isActive; syncPlayback(); }
  });
  document.addEventListener("visibilitychange", syncPlayback);
  // MathJax and the earlier field demonstrations can reflow this long chapter.
  if (window.ResizeObserver) {
    let refreshFrame;
    new ResizeObserver(() => {
      cancelAnimationFrame(refreshFrame);
      refreshFrame = requestAnimationFrame(() => viewport.refresh());
    }).observe(root.closest("article") || root.parentElement);
  }
}());
