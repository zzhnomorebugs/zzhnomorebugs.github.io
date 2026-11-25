(function () {
  "use strict";

  function init(root) {
    const scenes = Array.from(root.querySelectorAll("[data-idcd-scene]"));
    const steps = Array.from(root.querySelectorAll("[data-idcd-jump]"));
    const controls = root.querySelector("[data-idcd-controls]");
    const play = root.querySelector("[data-idcd-play]");
    const prev = root.querySelector("[data-idcd-prev]");
    const next = root.querySelector("[data-idcd-next]");
    const progress = root.querySelector("[data-idcd-progress]");
    const status = root.querySelector("[data-idcd-status]");
    const starts = [0];
    scenes.forEach((scene) => starts.push(starts.at(-1) + Number(scene.dataset.duration)));
    const end = starts.at(-1);

    let current = -1;
    let position = 0;
    let frame = 0;
    let lastTick;

    function render(announce) {
      const nextStart = starts.findIndex((start) => position < start);
      const selected = nextStart === -1 ? scenes.length - 1 : nextStart - 1;
      progress.value = position;
      if (current === selected) return;

      scenes.forEach((scene, i) => {
        scene.hidden = i !== selected;
        scene.classList.toggle("is-entering", announce && i === selected);
        if (i === selected) {
          steps[i].setAttribute("aria-current", "step");
        } else {
          steps[i].removeAttribute("aria-current");
        }
      });
      const title = scenes[selected].querySelector("h4").textContent;
      progress.setAttribute("aria-valuetext", `${selected + 1} / ${scenes.length} · ${title}`);
      prev.disabled = selected === 0;
      next.disabled = selected === scenes.length - 1;
      if (announce) status.textContent = title;
      current = selected;
    }

    function stop() {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTick = undefined;
      play.textContent = position === end ? root.dataset.replayLabel : root.dataset.playLabel;
    }

    function tick(now) {
      if (lastTick !== undefined) position = Math.min(position + now - lastTick, end);
      lastTick = now;
      render(true);
      if (position === end) {
        stop();
      } else {
        frame = requestAnimationFrame(tick);
      }
    }

    function jump(index) {
      position = starts[index];
      stop();
      render(true);
    }

    play.addEventListener("click", () => {
      if (frame) {
        stop();
        return;
      }
      if (position === end) {
        position = 0;
        render(true);
      }
      scenes[current].classList.add("is-entering");
      play.textContent = root.dataset.pauseLabel;
      frame = requestAnimationFrame(tick);
    });
    prev.addEventListener("click", () => jump(current - 1));
    next.addEventListener("click", () => jump(current + 1));
    steps.forEach((step, index) => step.addEventListener("click", () => jump(index)));
    progress.addEventListener("input", () => {
      position = Number(progress.value);
      stop();
      render(true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop();
    });

    progress.max = end;
    render(false);
    controls.hidden = false;
  }

  document.querySelectorAll("[data-idcd-animate]").forEach(init);
})();
