(function () {
  "use strict";

  const chapters = [
    { id: "framework", duration: 8, keys: ["context", "query"] },
    { id: "pixels", duration: 7, keys: ["context", "query"] },
    { id: "blocks", duration: 8, keys: ["context", "query"] },
    { id: "train", duration: 11, keys: ["context", "query", "prediction", "missing"] },
    { id: "impute", duration: 14, keys: ["measured", "context", "prediction", "missing"] }
  ];

  function timecode(seconds) {
    return Math.floor(seconds / 60) + ":" + String(Math.floor(seconds % 60)).padStart(2, "0");
  }

  function init(root) {
    const copy = JSON.parse(root.querySelector("[data-idcd-scenes]").textContent);
    const buttons = [...root.querySelectorAll("[data-idcd-jump]")];
    if (copy.length !== chapters.length || buttons.length !== chapters.length) return;

    const drawTraining = window.createIncompleteTrainingFields(root);
    const drawImputation = window.createIncompleteImputation(root);
    const drawFramework = window.createIncompleteStrategyFramework(root);
    const framework = root.querySelector("[data-idcd-framework]");
    const training = root.querySelector("[data-idcd-training]");
    const imputation = root.querySelector("[data-idcd-imputation]");
    const legend = root.querySelectorAll("[data-idcd-key]");
    const play = root.querySelector("[data-idcd-play]");
    const prev = root.querySelector("[data-idcd-prev]");
    const next = root.querySelector("[data-idcd-next]");
    const progress = root.querySelector("[data-idcd-progress]");
    const elapsed = root.querySelector(".idcd-animation__time");
    const status = root.querySelector("[data-idcd-status]");
    const phase = root.querySelector(".idcd-scene__phase");
    const heading = root.querySelector(".idcd-scene__heading h4");
    const description = root.querySelector("#idcd-frame-description");

    const cursor = { chapter: 0 };
    const timeline = window.gsap.timeline({ paused: true, defaults: { ease: "none" } });
    chapters.forEach(({ id, duration }, index) => {
      timeline.addLabel(id).to(cursor, { chapter: index + 1, duration }, id);
    });
    const duration = timeline.duration();
    progress.max = duration;
    let current = -1;
    let lastBeat = -1;
    let lastSecond = -1;
    let chapterToReplay = null;

    function render() {
      const index = Math.min(Math.floor(cursor.chapter), chapters.length - 1);
      const fraction = cursor.chapter - index;
      const scene = copy[index];
      const chapter = chapters[index];
      const showFramework = index < 3;
      const beat = fraction < (showFramework ? 0.46 : 0.80) ? 0 : 1;
      if (current !== index) {
        root.dataset.scene = index;
        framework.toggleAttribute("hidden", !showFramework);
        training.toggleAttribute("hidden", chapter.id !== "train");
        imputation.toggleAttribute("hidden", chapter.id !== "impute");
        legend.forEach(key => { key.hidden = !chapter.keys.includes(key.dataset.idcdKey); });
        buttons[current]?.removeAttribute("aria-current");
        buttons[index].setAttribute("aria-current", "step");
        phase.textContent = scene.phase;
        heading.textContent = scene.title;
        prev.disabled = index === 0;
        next.disabled = index === chapters.length - 1;
      }
      if (current !== index || lastBeat !== beat) {
        description.textContent = beat ? scene.outcome : scene.cue;
      }
      if (showFramework) drawFramework(index, fraction);
      else if (chapter.id === "train") drawTraining(fraction);
      else drawImputation(fraction);
      const time = timeline.time();
      const second = Math.floor(time);
      if (second !== lastSecond || current !== index) {
        elapsed.textContent = timecode(time) + " / " + timecode(duration);
        elapsed.dateTime = "PT" + second + "S";
        progress.setAttribute("aria-valuetext", scene.step + " · " + timecode(time));
        lastSecond = second;
      }
      progress.value = time;
      current = index;
      lastBeat = beat;
    }

    function updateButton(playing) {
      play.textContent = playing ? root.dataset.pauseLabel :
        timeline.time() >= duration ? root.dataset.replayLabel : root.dataset.playLabel;
      play.setAttribute("aria-pressed", String(playing));
    }

    render();
    root.querySelector(".idcd-animation__interactive").hidden = false;
    root.classList.add("is-ready");
    timeline.eventCallback("onUpdate", render);
    const playback = window.projectAnimationPlayback(root.querySelector(".idcd-stage-viewport"), playing => {
      updateButton(playing);
      timeline.paused(!playing);
    });
    timeline.eventCallback("onComplete", () => playback.pause());

    function scrub(time) {
      chapterToReplay = null;
      playback.pause();
      timeline.time(time, true);
      render();
      updateButton(false);
    }

    function jump(index) {
      const chapter = chapters[index];
      // Show the outcome when paused. During playback, start at the chapter boundary.
      const start = timeline.labels[chapter.id];
      if (playback.playing) {
        timeline.time(start, true);
        render();
      } else if (index < 3) {
        scrub(start + chapter.duration * 0.85);
      } else {
        // A paused jump shows the completed diagram. Play traces its construction.
        scrub(start + chapter.duration * 0.98);
        chapterToReplay = start;
      }
      status.textContent = heading.textContent + " " + description.textContent;
    }

    play.addEventListener("click", () => {
      if (playback.playing) {
        playback.pause();
      } else {
        if (chapterToReplay !== null || timeline.time() >= duration) {
          timeline.time(chapterToReplay ?? 0, true);
          chapterToReplay = null;
          render();
        }
        playback.play();
      }
    });
    prev.addEventListener("click", () => jump(current - 1));
    next.addEventListener("click", () => jump(current + 1));
    buttons.forEach((button, index) => button.addEventListener("click", () => jump(index)));
    progress.addEventListener("input", () => scrub(Number(progress.value)));
    progress.addEventListener("change", () => { status.textContent = description.textContent; });
  }

  if (window.gsap && window.d3 && window.createIncompleteTrainingFields && window.createIncompleteImputation && window.createIncompleteStrategyFramework && window.projectAnimationPlayback) {
    document.querySelectorAll("[data-idcd-animate]").forEach(init);
  }
}());
