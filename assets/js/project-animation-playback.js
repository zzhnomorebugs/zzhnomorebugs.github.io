(function () {
  "use strict";

  // Keep the reader's intent separate from temporary pauses while the diagram
  // is off screen or its tab is hidden.
  window.projectAnimationPlayback = function (stage, onChange) {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let intent = "auto";
    let playing;

    function inViewport() {
      const rect = stage.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 &&
        rect.top < document.documentElement.clientHeight && rect.left < document.documentElement.clientWidth;
    }

    let visible = inViewport();

    function sync() {
      const enabled = intent === "play" || (intent === "auto" && !motion.matches);
      const next = enabled && visible && !document.hidden;
      if (next === playing) return;
      playing = next;
      onChange(playing);
    }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        visible = entries[entries.length - 1].isIntersecting;
        sync();
      }).observe(stage);
    } else {
      const checkViewport = () => { visible = inViewport(); sync(); };
      window.addEventListener("scroll", checkViewport, { capture: true, passive: true });
      window.addEventListener("resize", checkViewport);
    }

    document.addEventListener("visibilitychange", sync);
    function onMotionChange() {
      if (motion.matches && intent === "play") intent = "auto";
      sync();
    }
    if (motion.addEventListener) motion.addEventListener("change", onMotionChange);
    else motion.addListener(onMotionChange);

    sync();
    return {
      get playing() { return playing; },
      play() { intent = "play"; sync(); },
      pause() { intent = "pause"; sync(); }
    };
  };
}());
