(function () {
  "use strict";

  const model = "<var>f</var><sub>θ</sub>";
  const probability = "<var>p</var><sub>i</sub>";
  const chapters = [
    { id: "observation", duration: 7, symbols: ["⌖", "<var>i</var>"] },
    { id: "pixels", duration: 11, symbols: ["<var>C</var>", probability + " = 0"] },
    { id: "blocks", duration: 12, symbols: ["<var>C</var>", probability + " &gt; 0"] },
    { id: "holdout", duration: 9, symbols: ["<var>C, Q</var>", "+ <var>ε</var>"] },
    { id: "predict", duration: 8, symbols: [model, model] },
    { id: "score", duration: 11, symbols: ["<var>Q</var>", "ℒ<sub>qry</sub>"] },
    { id: "impute", duration: 9, symbols: ["<var>K</var>", "⟨<var>f</var><sub>θ</sub>⟩"] }
  ];

  function timecode(seconds) {
    return Math.floor(seconds / 60) + ":" + String(Math.floor(seconds % 60)).padStart(2, "0");
  }

  function init(root) {
    const copy = JSON.parse(root.querySelector("[data-idcd-scenes]").textContent);
    const buttons = [...root.querySelectorAll("[data-idcd-jump]")];
    if (copy.length !== chapters.length || buttons.length !== chapters.length) return;

    const drawFields = window.createIncompleteTrainingFields(root);
    const play = root.querySelector("[data-idcd-play]");
    const prev = root.querySelector("[data-idcd-prev]");
    const next = root.querySelector("[data-idcd-next]");
    const progress = root.querySelector("[data-idcd-progress]");
    const elapsed = root.querySelector(".idcd-animation__time");
    const status = root.querySelector("[data-idcd-status]");
    const phase = root.querySelector(".idcd-scene__phase");
    const heading = root.querySelector(".idcd-scene__heading h4");
    const [leftRole, rightRole] = root.querySelectorAll(".idcd-board__role");
    const [leftTitle, rightTitle] = root.querySelectorAll(".idcd-board__title");
    const symbol = root.querySelector(".idcd-link__symbol");
    const action = root.querySelector(".idcd-link__label");
    const update = root.querySelector(".idcd-link__update");
    const focus = root.querySelector(".idcd-focus__copy");

    const cursor = { chapter: 0 };
    const timeline = window.gsap.timeline({ paused: true, defaults: { ease: "none" } });
    chapters.forEach(({ id, duration }, index) => {
      timeline.addLabel(id).to(cursor, { chapter: index + 1, duration }, id);
    });
    // Follow the loss back to the same model that produced the prediction.
    timeline.fromTo(root.querySelector("[data-gradient-signal]"),
      { attr: { cy: 1 } }, { attr: { cy: 18 }, duration: 0.9, repeat: 1 }, "score+=5.8");
    timeline.fromTo(root.querySelector("[data-model-weights]"),
      { attr: { "fill-opacity": 0.06 } },
      { attr: { "fill-opacity": 0.32 }, duration: 0.45, repeat: 1, yoyo: true }, "score+=6.6");

    const duration = timeline.duration();
    progress.max = duration;
    let current = -1;
    let lastBeat = -1;
    let lastSecond = -1;

    function render() {
      const index = Math.min(Math.floor(cursor.chapter), chapters.length - 1);
      const fraction = cursor.chapter - index;
      const beat = fraction < 0.46 ? 0 : 1;
      const scene = copy[index];
      if (current !== index) {
        root.dataset.scene = index;
        buttons[current]?.removeAttribute("aria-current");
        buttons[index].setAttribute("aria-current", "step");
        phase.textContent = scene.phase;
        heading.textContent = scene.title;
        leftRole.textContent = scene.left_role;
        rightRole.textContent = scene.right_role;
        leftTitle.textContent = scene.left;
        prev.disabled = index === 0;
        next.disabled = index === chapters.length - 1;
      }
      if (current !== index || lastBeat !== beat) {
        rightTitle.textContent = (beat && scene.right_after) || scene.right;
        symbol.innerHTML = chapters[index].symbols[beat];
        action.textContent = beat ? scene.result : scene.action;
        focus.textContent = beat ? scene.outcome : scene.cue;
        update.hidden = !(chapters[index].id === "score" && beat);
      }
      drawFields(index, fraction);
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
    const playback = window.projectAnimationPlayback(root.querySelector(".idcd-stage"), playing => {
      updateButton(playing);
      timeline.paused(!playing);
    });
    timeline.eventCallback("onComplete", () => playback.pause());

    function scrub(time) {
      playback.pause();
      timeline.time(time, true);
      render();
      updateButton(false);
    }

    function jump(index) {
      const chapter = chapters[index];
      // In paused and reduced-motion reading, a jump should show the result
      // immediately. During playback, let the selected transformation unfold.
      const start = timeline.labels[chapter.id];
      if (playback.playing) {
        timeline.time(start, true);
        render();
      } else {
        scrub(start + chapter.duration * 0.85);
      }
      status.textContent = heading.textContent + " " + focus.textContent;
    }

    play.addEventListener("click", () => {
      if (playback.playing) {
        playback.pause();
      } else {
        if (timeline.time() >= duration) {
          timeline.time(0, true);
          render();
        }
        playback.play();
      }
    });
    prev.addEventListener("click", () => jump(current - 1));
    next.addEventListener("click", () => jump(current + 1));
    buttons.forEach((button, index) => button.addEventListener("click", () => jump(index)));
    progress.addEventListener("input", () => scrub(Number(progress.value)));
    progress.addEventListener("change", () => { status.textContent = focus.textContent; });
  }

  if (window.gsap && window.d3 && window.createIncompleteTrainingFields && window.projectAnimationPlayback) {
    document.querySelectorAll("[data-idcd-animate]").forEach(init);
  }
}());
