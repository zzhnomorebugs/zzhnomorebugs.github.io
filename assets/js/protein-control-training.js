(function () {
  "use strict";

  const timeline = [
    { stage: "pretrain", duration: 29 },
    { stage: "adapt", duration: 37 },
    { stage: "combined", duration: 41 }
  ];
  const millisecondsPerFrame = 200;

  function init(root) {
    const play = root.querySelector("[data-training-play]");
    const slider = root.querySelector("[data-training-progress]");
    const jumps = root.querySelectorAll("[data-training-jump]");
    const views = Array.from(root.querySelectorAll("[data-training-show]"), (node) => ({
      node,
      stages: node.dataset.trainingShow.split(" ")
    }));
    const beats = root.querySelectorAll("[data-training-beat]");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const starts = new Map();
    let end = 0;
    timeline.forEach(({ stage, duration }) => {
      starts.set(stage, end);
      end += duration;
    });
    slider.max = end;

    let position = 0;
    let lastTimestamp = null;
    let request = 0;
    let visible = !("IntersectionObserver" in window);
    let wantsPlayback = !reduced.matches;

    function render() {
      const frame = Math.floor(position);
      const active = timeline.findLast(({ stage }) => starts.get(stage) <= frame);
      const offset = frame - starts.get(active.stage);
      const beat = Math.min(4, Math.floor(5 * offset / (active.duration * 0.85)));

      if (root.dataset.trainingStage !== active.stage) {
        root.dataset.trainingStage = active.stage;
        views.forEach(({ node, stages }) => {
          node.toggleAttribute("hidden", !stages.includes(active.stage));
        });
        jumps.forEach((button) => {
          if (button.dataset.trainingJump === active.stage) {
            button.setAttribute("aria-current", "step");
          } else {
            button.removeAttribute("aria-current");
          }
        });
      }

      if (root.dataset.trainingBeat !== String(beat)) {
        root.dataset.trainingBeat = beat;
        beats.forEach((node) => {
          node.toggleAttribute("data-training-beat-active", Number(node.dataset.trainingBeat) === beat);
        });
      }

      if (Number(slider.value) !== frame) slider.value = frame;
    }

    function syncPlayback() {
      const playing = wantsPlayback && visible && !document.hidden && position < end;
      if (playing && !request) {
        request = window.requestAnimationFrame(tick);
      } else if (!playing) {
        window.cancelAnimationFrame(request);
        request = 0;
        lastTimestamp = null;
      }
      root.toggleAttribute("data-training-playing", playing);
      const label = playing ? root.dataset.pauseLabel :
        position === end ? root.dataset.replayLabel : root.dataset.playLabel;
      if (play.textContent !== label) play.textContent = label;
    }

    function tick(timestamp) {
      request = 0;
      if (lastTimestamp !== null) {
        const elapsed = timestamp - lastTimestamp;
        position = Math.min(end, position + elapsed / millisecondsPerFrame);
      }
      lastTimestamp = timestamp;
      render();
      if (position === end) wantsPlayback = false;
      syncPlayback();
    }

    function seek(frame) {
      wantsPlayback = false;
      position = frame;
      render();
      syncPlayback();
    }

    play.addEventListener("click", () => {
      wantsPlayback = !root.hasAttribute("data-training-playing");
      if (position === end) {
        position = 0;
        render();
      }
      syncPlayback();
    });
    slider.addEventListener("input", () => seek(Number(slider.value)));
    jumps.forEach((button) => {
      button.addEventListener("click", () => seek(starts.get(button.dataset.trainingJump)));
    });
    document.addEventListener("visibilitychange", syncPlayback);
    reduced.addEventListener("change", () => {
      if (reduced.matches) {
        wantsPlayback = false;
        syncPlayback();
      }
    });

    root.querySelectorAll("[data-training-controls]").forEach((controls) => { controls.hidden = false; });
    render();
    syncPlayback();
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        syncPlayback();
      }, { threshold: 0.08 }).observe(root);
    }
  }

  document.querySelectorAll("[data-protein-training]").forEach(init);
}());
