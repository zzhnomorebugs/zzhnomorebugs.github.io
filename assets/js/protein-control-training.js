(function () {
  "use strict";

  // The five beats share a clock, including when the reader scrubs backwards.
  const beats = [
    { id: "noise", duration: 3.2 },
    { id: "model", duration: 3.2 },
    { id: "predict", duration: 3.4 },
    { id: "loss", duration: 2.8 },
    { id: "update", duration: 3.6 }
  ];
  const segment = 0.11;
  const transitionDuration = 1.4;

  function collectStage(view, button) {
    const diagrams = window.d3.select(view).selectAll("[data-training-diagram]");
    const marks = diagrams.selectAll("[data-flow-node], path[data-flow-edge]");
    const edges = diagrams.selectAll("path[data-flow-edge]");

    // A short moving stroke shares the original route and its coordinate system.
    // Normalized path lengths also work for the currently hidden responsive SVG.
    const pulses = edges.clone(false).datum(function () {
      return { beat: this.dataset.beat, order: Number(this.dataset.order || 0) };
    })
      .attr("data-flow-pulse", "")
      .attr("data-flow-edge", null)
      .attr("id", null)
      .attr("aria-hidden", "true")
      .attr("pathLength", 1)
      .style("pointer-events", "none")
      .style("marker-start", "none")
      .style("marker-mid", "none")
      .style("marker-end", "none")
      .style("stroke-dasharray", segment + " 2")
      .style("stroke-linecap", "round")
      .style("stroke-width", "6px")
      .style("opacity", 0);

    return {
      id: view.dataset.trainingView,
      view,
      button,
      label: view.getAttribute("aria-label") || button.textContent.trim(),
      effects: window.proteinTrainingEffects(view),
      beats: beats.map(beat => {
        const packets = pulses.filter(d => d.beat === beat.id);
        const orders = [...new Set(packets.data().map(d => d.order))].sort((a, b) => a - b);
        packets.each(d => { d.lane = orders.indexOf(d.order); });
        return {
          id: beat.id,
          duration: beat.duration,
          marks: marks.filter(function () { return this.dataset.beat === beat.id; }),
          packets,
          lanes: orders.length
        };
      })
    };
  }

  function drawPackets(beat, progress) {
    // Allow time to read the destination once a packet reaches its arrowhead.
    const sweep = (progress - 0.07) / 0.76 * beat.lanes;
    beat.packets.each(function (d) {
      const position = sweep - d.lane;
      const travelling = position > 0 && position < 1;
      this.style.opacity = travelling ? 1 : 0;
      if (travelling) this.style.strokeDashoffset = segment - (1 + segment) * position;
    });
  }

  function init(root) {
    const play = root.querySelector("[data-training-play]");
    const slider = root.querySelector("[data-training-progress]");
    const stages = Array.from(root.querySelectorAll("[data-training-view]"), view =>
      collectStage(view, root.querySelector('[data-training-jump="' + view.dataset.trainingView + '"]'))
    );
    const clock = { beat: 0, mix: 0 };
    const timeline = window.gsap.timeline({ paused: true, defaults: { ease: "none" } });
    const frames = [];
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduceMotion = motion.matches;
    const morph = window.proteinTrainingTransition(stages[0].view, stages[1].view);

    stages.forEach((stage, index) => {
      if (index === 1) {
        timeline.addLabel("handoff").to(clock, { mix: 1, duration: transitionDuration, ease: "sine.inOut" });
      }
      timeline.addLabel(stage.id);
      stage.beats.forEach(beat => {
        const label = stage.id + "-" + beat.id;
        frames.push({ stage, beat });
        timeline.addLabel(label).to(clock, { beat: frames.length, duration: beat.duration }, label);
      });
    });

    const end = timeline.duration();
    const handoff = timeline.labels.handoff;
    const adapted = timeline.labels[stages[1].id];
    slider.max = end;
    let activeFrame;
    let activeStage;
    let inTransition = false;
    let lastTenth = -1;
    let playback;
    let jumpTween;
    let jumpDestination;

    function render() {
      const time = timeline.time();
      const between = time > handoff && time < adapted;
      const amount = reduceMotion ? Math.round(clock.mix) : clock.mix;
      const index = time <= handoff ? Math.min(Math.floor(clock.beat), beats.length - 1) :
        Math.min(Math.floor(clock.beat), frames.length - 1);
      const frame = frames[index];
      const stage = between ? stages[amount < .5 ? 0 : 1] : frame.stage;
      const progress = clock.beat - index;

      if (activeStage !== stage) {
        activeStage = stage;
        root.dataset.trainingStage = stage.id;
        stages.forEach(item => {
          const active = item === stage;
          item.view.setAttribute("aria-hidden", String(!active));
          item.view.inert = !active;
          if (active) item.button.setAttribute("aria-current", "step");
          else item.button.removeAttribute("aria-current");
        });
        lastTenth = -1;
      }
      const next = between ? null : frame;
      if (activeFrame !== next) {
        if (activeFrame) {
          activeFrame.beat.marks.attr("data-flow-active", null);
          activeFrame.beat.packets.style("opacity", 0);
        }
        root.dataset.trainingPart = next ? next.beat.id : "transition";
        if (next) next.beat.marks.attr("data-flow-active", "");
        activeFrame = next;
      }
      morph(amount);
      root.dataset.stageMix = String(amount);
      if (between) {
        if (!inTransition) {
          stages[0].effects.render("update", 1, handoff);
          stages[1].effects.render("noise", 0, 0);
        }
      } else {
        stage.effects.render(frame.beat.id, progress, time - timeline.labels[stage.id]);
        drawPackets(frame.beat, progress);
      }
      inTransition = between;
      const tenth = Math.round(time * 10);
      if (lastTenth !== tenth) {
        lastTenth = tenth;
        slider.value = tenth / 10;
        slider.setAttribute("aria-valuetext", stage.label + " · " + Math.floor(time) + " s");
      }
    }

    function setPlaying(playing) {
      if (jumpTween) jumpTween.paused(!playing);
      else timeline.paused(!playing);
      root.toggleAttribute("data-training-playing", playing);
      play.textContent = playing ? root.dataset.pauseLabel :
        timeline.time() >= end ? root.dataset.replayLabel : root.dataset.playLabel;
    }

    function seek(time) {
      playback.pause();
      if (jumpTween) jumpTween.kill();
      jumpTween = null;
      timeline.time(time, false);
      render();
      setPlaying(false);
    }

    // A tab jump plays just the handoff section, forwards or backwards, then
    // rests on the selected stage. Further input starts from the current pose.
    function selectStage(stage, resume = false) {
      const destination = timeline.labels[stage.id];
      const target = stage === stages[0] ? handoff : adapted;
      const from = Math.min(adapted, Math.max(handoff, timeline.time()));
      if (reduceMotion || Math.abs(from - target) < .001) {
        seek(destination);
        if (resume) playback.play();
        return;
      }
      seek(from);
      jumpDestination = destination;
      jumpTween = window.gsap.to(timeline, {
        time: target, duration: Math.abs(target - from), ease: "none", paused: true,
        onComplete: () => {
          jumpTween = null;
          seek(destination);
          if (resume) playback.play();
        }
      });
      playback.play();
    }

    root.setAttribute("data-training-ready", "");
    root.querySelectorAll("[data-training-controls]").forEach(node => { node.hidden = false; });
    render();
    timeline.eventCallback("onUpdate", render);
    timeline.eventCallback("onComplete", () => playback.pause());
    playback = window.projectAnimationPlayback(root.querySelector(".protein-training__views"), setPlaying);
    function refreshMotion(event) {
      reduceMotion = event.matches;
      if (reduceMotion && jumpTween) seek(jumpDestination);
      else render();
    }
    if (motion.addEventListener) motion.addEventListener("change", refreshMotion);
    else motion.addListener(refreshMotion);
    play.addEventListener("click", () => {
      if (playback.playing) playback.pause();
      else if (timeline.time() >= end) selectStage(stages[0], true);
      else playback.play();
    });
    slider.addEventListener("input", () => seek(Number(slider.value)));
    stages.forEach(stage => stage.button.addEventListener("click", () => selectStage(stage)));
  }

  if (window.d3 && window.gsap && window.proteinTrainingEffects &&
      window.proteinTrainingTransition && window.projectAnimationPlayback) {
    document.querySelectorAll("[data-protein-training]").forEach(init);
  }
}());
