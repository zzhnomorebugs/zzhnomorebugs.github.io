(function () {
  "use strict";

  var figures = Array.prototype.slice.call(document.querySelectorAll("[data-physical-rollout]"));
  if (!figures.length) return;

  var motionPreference = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var reducedMotion = !!(motionPreference && motionPreference.matches);
  var players = [];

  figures.forEach(function (figure) {
    var video = figure.querySelector(".physical-rollout__video");
    var counter = figure.querySelector(".physical-rollout__counter");
    var frameCount = Number(figure.getAttribute("data-frame-count"));
    var frameMs = Number(figure.getAttribute("data-frame-ms"));
    if (!video || !counter || !(frameCount > 0) || !(frameMs > 0)) return;

    var player = {
      figure: figure,
      group: figure.closest ? figure.closest(".physical-evidence") : null,
      video: video,
      visible: false,
      failed: false,
      loaded: false,
      starting: false,
      callbackId: null,
      callbackType: null
    };
    players.push(player);

    function showFrame(mediaTime) {
      var frame = Math.min(frameCount, Math.floor(Math.max(0, mediaTime) * 1000 / frameMs) + 1);
      counter.textContent = String(frame).padStart(2, "0") + " / " + frameCount;
      counter.hidden = false;
    }

    function canPlay() {
      return player.visible && !document.hidden && !reducedMotion && !player.failed;
    }

    function cancelFrame() {
      if (player.callbackId === null) return;
      if (player.callbackType === "video" && video.cancelVideoFrameCallback) {
        video.cancelVideoFrameCallback(player.callbackId);
      } else if (player.callbackType === "animation") {
        window.cancelAnimationFrame(player.callbackId);
      }
      player.callbackId = null;
      player.callbackType = null;
    }

    function showFallback() {
      figure.classList.remove("is-video");
      if (reducedMotion) showFrame(frameCount * frameMs / 1000);
      else counter.hidden = true;
    }

    function stop() {
      cancelFrame();
      video.pause();
      showFallback();
    }

    function fail() {
      player.failed = true;
      player.starting = false;
      stop();
    }

    function nextFrame() {
      if (!canPlay() || video.paused || player.callbackId !== null) return;
      if (video.requestVideoFrameCallback) {
        player.callbackType = "video";
        player.callbackId = video.requestVideoFrameCallback(function (_, metadata) {
          player.callbackId = null;
          player.callbackType = null;
          if (!canPlay() || video.paused) return;
          showFrame(metadata.mediaTime);
          nextFrame();
        });
      } else {
        player.callbackType = "animation";
        player.callbackId = window.requestAnimationFrame(function () {
          player.callbackId = null;
          player.callbackType = null;
          if (!canPlay() || video.paused) return;
          showFrame(video.currentTime);
          nextFrame();
        });
      }
    }

    player.update = function () {
      if (!canPlay()) {
        stop();
        return;
      }
      if (!player.loaded) {
        var source = video.getAttribute("data-src");
        if (!source) {
          fail();
          return;
        }
        // Assign the source only when the figure first enters the viewport.
        video.muted = true;
        video.defaultMuted = true;
        video.src = source;
        player.loaded = true;
        video.load();
      }
      if (player.starting || !video.paused) return;
      player.starting = true;
      var playRequest;
      try {
        playRequest = video.play();
      } catch (_) {
        fail();
        return;
      }
      if (playRequest && typeof playRequest.then === "function") {
        playRequest.then(function () {
          player.starting = false;
          if (!canPlay()) stop();
        }, function (error) {
          player.starting = false;
          // Pausing a pending load is expected when scrolling or hiding the tab.
          if (error && error.name === "AbortError") {
            player.update();
            return;
          }
          fail();
        });
      } else {
        player.starting = false;
      }
    };

    video.addEventListener("playing", function () {
      if (!canPlay()) {
        stop();
        return;
      }
      player.starting = false;
      // Let concurrently visible examples share a playback position, including
      // when one source finishes loading later or resumes after scrolling.
      var peer = player.group && players.find(function (item) {
        return item !== player && item.group === player.group && item.visible &&
          !item.video.paused && item.figure.classList.contains("is-video");
      });
      if (peer && Math.abs(video.currentTime - peer.video.currentTime) > 0.06) {
        video.currentTime = peer.video.currentTime;
      }
      figure.classList.add("is-video");
      showFrame(video.currentTime);
      nextFrame();
    });
    video.addEventListener("pause", function () {
      cancelFrame();
      showFallback();
    });
    video.addEventListener("error", fail);
    showFallback();
  });

  if (!players.length) return;

  if (window.IntersectionObserver) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var player = players.find(function (item) { return item.figure === entry.target; });
        if (!player) return;
        player.visible = entry.isIntersecting;
        player.update();
      });
    }, { threshold: 0.01 });
    players.forEach(function (player) { observer.observe(player.figure); });
  } else {
    players.forEach(function (player) {
      player.visible = true;
      player.update();
    });
  }

  document.addEventListener("visibilitychange", function () {
    players.forEach(function (player) { player.update(); });
  });

  function updateMotionPreference(event) {
    reducedMotion = event.matches;
    players.forEach(function (player) { player.update(); });
  }

  if (motionPreference) {
    if (motionPreference.addEventListener) motionPreference.addEventListener("change", updateMotionPreference);
    else if (motionPreference.addListener) motionPreference.addListener(updateMotionPreference);
  }
})();
