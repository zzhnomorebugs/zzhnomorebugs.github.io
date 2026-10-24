(function () {
  "use strict";
  var figure = document.querySelector("[data-retro-training]");
  var data = window.RETRO_TRAINING_DATA;
  if (!figure || !data) return;
  var zh = figure.dataset.language === "zh";
  var motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var scenes = Array.from(figure.querySelectorAll("[data-rt-scene]"));
  var steps = Array.from(figure.querySelectorAll("[data-rt-step]"));
  var sampleButtons = Array.from(figure.querySelectorAll("[data-rt-sample]"));
  var rootButtons = Array.from(figure.querySelectorAll("[data-rt-root-option]"));
  var play = figure.querySelector("[data-rt-play]");
  var prev = figure.querySelector("[data-rt-prev]");
  var next = figure.querySelector("[data-rt-next]");
  var slider = figure.querySelector("#rt-progress");
  // Preserve each scene's pacing; only the t=0 → .45 interpolation is accelerated.
  var sceneDurations = [5120, 4480, 4800, 2200, 10240];
  var duration = sceneDurations.reduce(function (sum, ms) { return sum + ms; }, 0);
  var starts = [0], elapsed = 0;
  sceneDurations.forEach(function (ms) { elapsed += ms; starts.push(elapsed * 1000 / duration); });
  var sceneCount = scenes.length;
  var selectedCase = 1, root = "B", time = 0.45;
  var siteLabels = { A: "α", B: "β", C: "γ" };
  var nodeDraws = data.nodes.map(function (_, i) { return (0.137 + i * 0.239) % 1; });
  var edgeDraws = data.edges.map(function (_, i) { return (0.613 + i * 0.317) % 1; });
  var value = 0, stage = -1, running = false, previousTime = 0, frame = 0;
  var visible = false, autoplayStarted = false, userPaused = false, resumeOnVisible = false;
  var loopElapsed = 0, loopDelay = 1200;
  var circumference = 2 * Math.PI * data.ringRadius;
  var fields = {};
  figure.querySelectorAll("[data-rt-field]").forEach(function (svg) {
    fields[svg.dataset.rtField] = {
      svg: svg,
      nodes: Array.from(svg.querySelectorAll("[data-rt-field-node]")).map(function (el) {
        return { el: el, source: el.querySelector("[data-rt-ring-source]"), target: el.querySelector("[data-rt-ring-target]"),
          symbol: el.querySelector("[data-rt-field-symbol]"), cleanSymbol: el.querySelector("[data-rt-denoise-symbol]"),
          label: el.querySelector("[data-rt-field-label]"), title: el.querySelector("title") };
      }),
      edges: Array.from(svg.querySelectorAll("[data-rt-field-edge]"))
    };
  });
  function clamp(x) { return Math.max(0, Math.min(1, x)); }
  function ease(x) { return x * x * (3 - 2 * x); }
  function mix(a, b, p) { return a + (b - a) * p; }
  function draw(source, target, u) { return source === target || u < 1 - time ? source : target; }
  function caseName() { return data.cases[selectedCase][zh ? "nameZh" : "nameEn"]; }
  function mapNumber(id) { return id.charCodeAt(0) - 64; }

  function markSample(index) {
    sampleButtons.forEach(function (button, i) {
      button.classList.toggle("is-selected", i === index);
      button.setAttribute("aria-pressed", String(i === index));
    });
    scenes[0].querySelectorAll("[data-rt-center]").forEach(function (circle) {
      circle.setAttribute("opacity", circle.dataset.rtCenter === data.cases[index].root ? "1" : "0.65");
    });
    scenes[0].querySelectorAll("[data-rt-route-link]").forEach(function (path) {
      path.classList.toggle("is-selected", Number(path.dataset.rtRouteLink) === index);
    });
  }
  function syncCase() {
    figure.querySelector("[data-rt-case-name]").textContent = caseName();
    rootButtons.forEach(function (button, i) {
      var candidate = data.cases[selectedCase].roots[i];
      button.dataset.root = candidate;
      button.querySelector("[data-rt-root-label]").textContent = siteLabels[candidate];
      button.querySelectorAll(".rt-token").forEach(function (token, j) { token.textContent = mapNumber(data.orders[candidate][j]); });
    });
    figure.querySelectorAll("[data-rt-aligned]").forEach(function (row) {
      row.querySelectorAll("[data-rt-token]").forEach(function (token) {
        var id = token.dataset.rtToken;
        var extra = !data.elements[id];
        var element = extra ? (row.dataset.rtAligned === "source" ? "∅" : data.cases[selectedCase].extra[id.charCodeAt(0) - 77]) : data.elements[id];
        token.querySelector("[data-rt-element]").textContent = element;
        token.classList.toggle("is-extra", extra);
        token.classList.toggle("is-dummy", element === "∅");
      });
    });
  }
  function markRoot(candidate) {
    rootButtons.forEach(function (button) {
      var active = button.dataset.root === candidate;
      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
    figure.querySelector("[data-rt-selected-root]").textContent = siteLabels[candidate];
    scenes[1].querySelectorAll("[data-rt-center]").forEach(function (circle) {
      circle.setAttribute("opacity", circle.dataset.rtCenter === candidate ? "1" : "0.45");
    });
  }
  function alignRows(amount) {
    var order = data.orders[root].concat(["M", "N", "O", "P", "Q", "R"]);
    figure.querySelectorAll("[data-rt-token]").forEach(function (token) {
      var id = token.dataset.rtToken;
      var before = id.charCodeAt(0) - 65;
      token.style.setProperty("--rt-slot", mix(before, order.indexOf(id), amount));
      token.classList.toggle("is-root", id === root);
    });
    figure.querySelector("[data-rt-order-state]").textContent = amount >= 0.999 ? (zh ? "重排后" : "After reordering") : amount <= 0.001 ? (zh ? "原始顺序" : "Original order") : (zh ? "正在重排" : "Reordering");
    figure.querySelector("[data-rt-order-readout]").textContent = (amount < 0.999 ? Object.keys(data.elements) : data.orders[root]).map(mapNumber).join(" → ");
    scenes[2].classList.toggle("is-reordered", amount >= 0.999);
  }

  // All nodes and edges share one interpolation/collapse clock.
  // Their random draws are independent, with no per-token time offsets.
  function renderField(name, t, collapse) {
    var field = fields[name];
    var discrete = collapse >= 0.999;
    field.svg.classList.toggle("is-discrete", discrete);
    field.svg.dataset.time = t.toFixed(6);
    field.svg.dataset.collapse = collapse.toFixed(6);
    field.nodes.forEach(function (view, i) {
      var node = data.nodes[i], changed = node.source !== node.target;
      var sampled = draw(node.source, node.target, nodeDraws[i]);
      var originalSource = changed ? 1 - t : 1;
      var finalSource = changed && sampled === node.target ? 0 : 1;
      var sourceWeight = mix(originalSource, finalSource, collapse);
      var targetWeight = changed ? 1 - sourceWeight : 0;
      view.source.setAttribute("stroke-dasharray", (sourceWeight * circumference) + " " + circumference);
      view.target.setAttribute("stroke-dasharray", (targetWeight * circumference) + " " + circumference);
      view.target.setAttribute("stroke-dashoffset", -sourceWeight * circumference);
      view.source.style.opacity = String(1 - collapse);
      view.target.style.opacity = String(1 - collapse);
      view.symbol.textContent = changed && collapse < 0.5 ? (t === 0 ? node.source : t === 1 ? node.target : "?") : sampled;
      var distribution = changed ? "∅" + Math.round((1-t)*100) + "% " + node.target + Math.round(t*100) + "%" : node.target + " 100%";
      view.label.textContent = discrete ? "" : distribution;
      view.label.style.opacity = String(1 - collapse);
      view.el.dataset.sampledToken = sampled;
      view.el.dataset.sourceProbability = originalSource.toFixed(6);
      view.el.dataset.targetProbability = (changed ? t : 0).toFixed(6);
      view.title.textContent = (zh ? "节点 " : "Node ") + node.id + ": " + (discrete ? sampled : distribution);
    });
    field.edges.forEach(function (view, i) {
      var edge = data.edges[i];
      var sampled = draw(edge.source, edge.target, edgeDraws[i]);
      var probability = edge.source === edge.target ? (edge.source === "none" ? 0 : 1) : (edge.source === "none" ? t : 1-t);
      view.setAttribute("opacity", mix(probability, sampled === "none" ? 0 : 1, collapse));
      view.dataset.sampledToken = sampled;
      view.querySelectorAll("path").forEach(function (path) {
        if (edge.source !== edge.target && !discrete) path.setAttribute("stroke-dasharray", "5 4");
        else path.removeAttribute("stroke-dasharray");
      });
    });
  }

  // A teaching reconstruction of the known reactant endpoint, after the model's
  // probability prediction. It is not an extra training step or a model rollout.
  // Keep the sampled input and random draws intact so seeking is reversible.
  function renderDenoising(denoise, clean, signal) {
    var field = fields.sample;
    field.svg.dataset.denoise = denoise.toFixed(6);
    field.svg.dataset.clean = clean.toFixed(6);
    var links = field.svg.querySelector("[data-rt-denoise-links]");
    links.dataset.progress = signal.toFixed(6);
    links.setAttribute("opacity", signal > 0 ? 1-clean : 0);
    links.dispatchEvent(new CustomEvent("retro:denoise-progress"));
    var endpoint = field.svg.querySelector("[data-rt-clean-endpoint]");
    endpoint.setAttribute("opacity", clean);
    endpoint.setAttribute("aria-hidden", String(clean === 0));
    field.nodes.forEach(function (view, i) {
      var node = data.nodes[i], sampled = view.el.dataset.sampledToken;
      var changed = sampled !== node.target;
      view.el.setAttribute("opacity", 1-clean);
      view.symbol.style.opacity = String(changed ? 1-denoise : 1);
      view.cleanSymbol.style.opacity = String(changed ? denoise : 0);
      view.el.dataset.denoisedToken = denoise >= 0.5 ? node.target : sampled;
      if (denoise > 0) view.title.textContent = (zh ? "节点 " : "Node ") + node.id + ": " + view.el.dataset.denoisedToken;
    });
    field.edges.forEach(function (view, i) {
      var edge = data.edges[i], sampled = view.dataset.sampledToken;
      var present = edge.target === "none" ? 0 : 1;
      view.setAttribute("opacity", mix(Number(view.getAttribute("opacity")), present, denoise) * (1-clean));
      view.dataset.denoisedToken = denoise >= 0.5 ? edge.target : sampled;
      view.querySelectorAll("path").forEach(function (path) {
        if (sampled === "none" && present && denoise > 0 && denoise < 1) {
          path.setAttribute("pathLength", "1");
          path.setAttribute("stroke-dasharray", "1 1");
          path.setAttribute("stroke-dashoffset", 1-denoise);
        } else {
          path.removeAttribute("pathLength");
          path.removeAttribute("stroke-dashoffset");
        }
      });
    });
  }
  function updateControls() {
    play.textContent = running ? (zh ? "暂停" : "Pause") : value >= 1000 ? (zh ? "重新播放" : "Replay") : (zh ? "播放讲解" : "Play walkthrough");
    play.setAttribute("aria-pressed", String(running));
    prev.disabled = stage === 0;
    next.disabled = stage === sceneCount - 1;
    slider.value = Math.round(value);
    slider.setAttribute("aria-valuetext", (stage+1) + "/" + sceneCount + " " + scenes[stage].querySelector("h4").textContent);
  }
  function render(nextValue) {
    value = Math.max(0, Math.min(1000, nextValue));
    var newStage = 0;
    for (var i=1; i<sceneCount; i++) if (value >= starts[i]) newStage = i;
    if (newStage !== stage) {
      stage = newStage;
      scenes.forEach(function (scene, index) {
        // Keep each scene in the same grid cell so crossfades never resize the stage.
        scene.hidden = false;
        scene.inert = index !== stage;
        scene.setAttribute("aria-hidden", String(index !== stage));
        scene.classList.toggle("is-active", index === stage);
      });
      steps.forEach(function (button, index) {
        if (index === stage) button.setAttribute("aria-current", "step");
        else button.removeAttribute("aria-current");
      });
      figure.querySelector("[data-rt-announcement]").textContent = (stage+1) + "/" + sceneCount + " " + scenes[stage].querySelector("h4").textContent;
    }
    var p = clamp((value-starts[stage])/(starts[stage+1]-starts[stage]));
    figure.dataset.stage = stage;
    if (stage === 0) markSample(running && !motion.matches && p < 0.5 ? Math.floor(p*18)%3 : selectedCase);
    if (stage === 1) markRoot(running && !motion.matches && p < 0.5 ? data.cases[selectedCase].roots[Math.floor(p*10)%2] : root);
    if (stage === 2) alignRows(motion.matches ? 1 : ease(clamp((p-0.08)/0.6)));
    if (stage === 3) {
      var interpolation = motion.matches ? time : time*ease(clamp(p/0.96));
      renderField("probability", interpolation, 0);
      figure.querySelector("[data-rt-live-time]").textContent = interpolation.toFixed(2);
    }
    if (stage === 4) {
      var collapse = motion.matches ? 1 : ease(clamp(p/0.22));
      var prediction = motion.matches ? 1 : ease(clamp((p-0.28)/0.18));
      var denoise = motion.matches ? 1 : ease(clamp((p-0.58)/0.24));
      var clean = motion.matches ? 1 : ease(clamp((p-0.82)/0.10));
      var signal = motion.matches ? 0 : ease(clamp((p-0.47)/0.09));
      renderField("sample", time, collapse);
      renderDenoising(denoise, clean, signal);
      figure.querySelector("[data-rt-time-value]").textContent = mix(time, 1, denoise).toFixed(2);
      figure.querySelector("[data-rt-draw-phase]").textContent = clean >= 0.999 ? (zh ? "真实反应物图 · 去噪终点示意" : "True reactant graph · illustrative endpoint") : denoise > 0 ? (zh ? "更新节点与边 → 逐渐恢复反应物" : "Update nodes and bonds → recover reactants") : signal > 0 ? (zh ? "DiT 的预测分布作用到所有节点" : "DiT predictions reach every node") : prediction > 0 ? (zh ? "中间图 → 模型 → 干净类别分布" : "Intermediate graph → model → clean distributions") : collapse >= 0.999 ? (zh ? "所有 token 已抽出，作为模型输入" : "All tokens sampled: the model input") : (zh ? "全部节点与边独立、同时抽样" : "Independent, simultaneous draws for every node and edge");
      var predictions = figure.querySelector("[data-rt-predictions]");
      predictions.style.opacity = String(prediction);
      predictions.style.visibility = prediction === 0 ? "hidden" : "visible";
      predictions.setAttribute("aria-hidden", String(prediction === 0));
      fields.sample.svg.dataset.prediction = prediction.toFixed(6);
      fields.sample.nodes.forEach(function (view, i) {
        view.el.classList.toggle("is-prediction-node", prediction > 0.5 && clean < 1 && [20, 21, 28].indexOf(data.nodes[i].id) !== -1);
      });
      figure.querySelector("[data-rt-model]").classList.toggle("is-active", (prediction > 0 && prediction < 1) || (signal > 0 && clean < 1));
      figure.querySelector("[data-rt-sample-key]").textContent = denoise > 0 ? (zh ? "恢复 token · 补键与断键" : "Recover tokens · restore and remove bonds") : prediction > 0 ? (zh ? "预测分布 · 仅示意三个节点" : "Predicted distributions · three example nodes") : (zh ? "采样后只保留离散 token" : "Only discrete tokens remain after sampling");
    }
    updateControls();
  }
  function pause(manual) {
    running = false; previousTime = 0; cancelAnimationFrame(frame);
    if (manual) { userPaused = true; resumeOnVisible = false; }
    updateControls();
  }
  function tick(timestamp) {
    if (!running) return;
    var delta = previousTime ? Math.max(0, timestamp-previousTime) : 0;
    previousTime = timestamp;
    if (value >= 1000) {
      // Hold the completed reactants briefly before the next walkthrough.
      // This clock only advances while the animation is visible and playing.
      loopElapsed += delta;
      if (loopElapsed >= loopDelay) { loopElapsed = 0; render(0); }
    } else {
      render(value+delta*1000/duration);
      if (value >= 1000) loopElapsed = 0;
    }
    if (value >= 1000 && motion.matches) { pause(false); return; }
    frame = requestAnimationFrame(tick);
  }
  function start(resume) {
    if (running) return;
    userPaused = false; autoplayStarted = true;
    if (!visible || document.hidden) { resumeOnVisible = true; updateControls(); return; }
    resumeOnVisible = false;
    running = true; previousTime = 0;
    if (value >= 1000 && !resume) { loopElapsed = 0; render(0); }
    updateControls(); frame = requestAnimationFrame(tick);
  }
  function jump(index) {
    pause(true); loopElapsed = 0; index = Math.max(0, Math.min(sceneCount-1,index));
    render(index === sceneCount-1 ? 1000 : starts[index]+(starts[index+1]-starts[index])*0.99);
  }
  play.addEventListener("click", function () { if (running) pause(true); else start(); });
  prev.addEventListener("click", function () { jump(stage-1); });
  next.addEventListener("click", function () { jump(stage+1); });
  slider.addEventListener("input", function () { var requested = Number(slider.value); pause(true); loopElapsed = 0; render(requested); });
  sampleButtons.forEach(function (button, index) {
    button.addEventListener("click", function () { pause(true); selectedCase = index; root = data.cases[index].root; syncCase(); markRoot(root); alignRows(1); jump(0); });
  });
  rootButtons.forEach(function (button) {
    button.addEventListener("click", function () { pause(true); root = button.dataset.root; alignRows(1); jump(1); });
  });
  figure.querySelector("[data-rt-redraw]").addEventListener("click", function () {
    pause(false); loopElapsed = 0; selectedCase = Math.floor(Math.random()*data.cases.length);
    root = data.cases[selectedCase].roots[Math.floor(Math.random()*2)];
    // Hold the demonstration at t=.45; the training formula still samples t in general.
    time = 0.45;
    nodeDraws = data.nodes.map(function () { return Math.random(); });
    edgeDraws = data.edges.map(function () { return Math.random(); });
    syncCase(); markRoot(root); alignRows(1); render(0); start();
  });
  steps.forEach(function (button, index) { button.disabled = false; button.addEventListener("click", function () { jump(index); }); });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { resumeOnVisible = resumeOnVisible || running; pause(false); }
    else if (visible && !userPaused && (resumeOnVisible || (!autoplayStarted && !motion.matches))) start(true);
  });
  motion.addEventListener("change", function () {
    if (motion.matches) { resumeOnVisible = false; pause(false); }
    else if (!userPaused) { resumeOnVisible = true; start(true); }
    render(value);
  });
  syncCase(); markRoot(root); alignRows(1);
  renderField("probability", time, 0); renderField("sample", time, 1);
  figure.classList.add("is-ready"); figure.querySelector(".rt-controls").hidden = false; render(0);
  var screen = figure.querySelector(".rt-screen");
  if ("IntersectionObserver" in window) new IntersectionObserver(function (entries) {
    var entry = entries[0]; visible = entry.isIntersecting;
    if (!visible) { if (running) { resumeOnVisible = true; pause(false); } return; }
    if (resumeOnVisible && !userPaused) start(true);
    else if (!autoplayStarted && !userPaused && !motion.matches && entry.intersectionRect.height >= Math.min(240, screen.clientHeight*0.35)) start(true);
  }, {threshold:[0,0.15,0.3,0.5,0.7,1]}).observe(screen);
  else { visible = true; if (!motion.matches) start(); }
})();
