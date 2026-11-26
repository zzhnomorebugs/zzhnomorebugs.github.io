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
      before: diagrams.selectAll("[data-token-before]"),
      after: diagrams.selectAll("[data-token-after]"),
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
    const clock = { beat: 0 };
    const timeline = window.gsap.timeline({ paused: true, defaults: { ease: "none" } });
    const frames = [];

    stages.forEach(stage => {
      timeline.addLabel(stage.id);
      stage.beats.forEach(beat => {
        const label = stage.id + "-" + beat.id;
        frames.push({ stage, beat });
        timeline.addLabel(label).to(clock, { beat: frames.length, duration: beat.duration }, label);
      });
    });

    const end = timeline.duration();
    slider.max = end;
    let activeFrame;
    let lastTenth = -1;
    let playback;

    function render() {
      const index = Math.min(Math.floor(clock.beat), frames.length - 1);
      const frame = frames[index];
      const { stage, beat } = frame;
      const progress = clock.beat - index;

      if (!activeFrame || activeFrame.stage !== stage) {
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
      if (activeFrame !== frame) {
        if (activeFrame) {
          activeFrame.beat.marks.attr("data-flow-active", null);
          activeFrame.beat.packets.style("opacity", 0);
        }
        root.dataset.trainingPart = beat.id;
        beat.marks.attr("data-flow-active", "");
        activeFrame = frame;
      }

      // At rest the diagram shows the completed corruption. During playback a
      // copy of the residue arrives, then the mask replaces it in the noisy row.
      let mask = 1;
      if (beat.id === "noise" && progress > 0 && progress < 0.82) {
        const expose = Math.min(progress / 0.18, 1, (0.82 - progress) / 0.34);
        mask = 1 - expose;
      }
      stage.before.style("opacity", 1 - mask);
      stage.after.style("opacity", mask);
      drawPackets(beat, progress);

      const time = timeline.time();
      const tenth = Math.round(time * 10);
      if (lastTenth !== tenth) {
        lastTenth = tenth;
        slider.value = tenth / 10;
        slider.setAttribute("aria-valuetext", stage.label + " · " + Math.floor(time) + " s");
      }
    }

    function setPlaying(playing) {
      timeline.paused(!playing);
      root.toggleAttribute("data-training-playing", playing);
      play.textContent = playing ? root.dataset.pauseLabel :
        timeline.time() >= end ? root.dataset.replayLabel : root.dataset.playLabel;
    }

    function seek(time) {
      playback.pause();
      timeline.time(time, false);
      render();
      setPlaying(false);
    }

    root.setAttribute("data-training-ready", "");
    root.querySelectorAll("[data-training-controls]").forEach(node => { node.hidden = false; });
    render();
    timeline.eventCallback("onUpdate", render);
    timeline.eventCallback("onComplete", () => playback.pause());
    playback = window.projectAnimationPlayback(root.querySelector(".protein-training__views"), setPlaying);
    play.addEventListener("click", () => {
      if (playback.playing) playback.pause();
      else {
        if (timeline.time() >= end) timeline.time(0, false);
        playback.play();
      }
    });
    slider.addEventListener("input", () => seek(Number(slider.value)));
    stages.forEach(stage => stage.button.addEventListener("click", () => seek(timeline.labels[stage.id])));
  }

  if (window.d3 && window.gsap && window.projectAnimationPlayback) {
    document.querySelectorAll("[data-protein-training]").forEach(init);
  }
}());
