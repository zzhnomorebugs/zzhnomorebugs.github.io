(function () {
  "use strict";

  var project = document.querySelector("[data-retro-project]");
  if (!project) return;

  var chapters = Array.prototype.slice.call(project.querySelectorAll(".retro-chapter"));
  var start = project.querySelector("[data-retro-start]");
  var presenter = project.querySelector("[data-retro-presenter]");
  var previous = project.querySelector("[data-retro-prev]");
  var next = project.querySelector("[data-retro-next]");
  var exit = project.querySelector("[data-retro-exit]");
  var position = project.querySelector("[data-retro-position]");
  var outline = Array.prototype.slice.call(project.querySelectorAll(".retro-outline a"));
  if (!chapters.length || !start || !presenter || !previous || !next || !exit || !position) return;

  var presenting = false;
  var current = 0;
  var savedScroll = 0;
  var savedFocus = null;
  var scheduled = false;
  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setOutline(index) {
    outline.forEach(function (link) {
      if (link.getAttribute("href") === "#" + chapters[index].id) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function readingChapter() {
    var index = 0;
    chapters.forEach(function (chapter, i) {
      if (chapter.getBoundingClientRect().top <= 170) index = i;
    });
    return index;
  }

  function showChapter(index, focusHeading) {
    current = Math.max(0, Math.min(chapters.length - 1, index));
    chapters.forEach(function (chapter, i) {
      chapter.hidden = i !== current;
      chapter.classList.toggle("is-active", i === current);
    });
    position.textContent = (current + 1) + " / " + chapters.length + " · " + (chapters[current].getAttribute("data-chapter-label") || "章节");
    previous.disabled = current === 0;
    next.disabled = current === chapters.length - 1;
    setOutline(current);
    window.scrollTo({ top: 0, behavior: "instant" });
    if (focusHeading) {
      var heading = chapters[current].querySelector("h2");
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      }
    }
  }

  function beginPresentation() {
    if (presenting) return;
    current = readingChapter();
    savedScroll = window.scrollY;
    savedFocus = document.activeElement;
    presenting = true;
    document.body.classList.add("retro-presentation");
    presenter.hidden = false;
    start.setAttribute("aria-pressed", "true");
    showChapter(current, true);
  }

  function endPresentation() {
    if (!presenting) return;
    presenting = false;
    chapters.forEach(function (chapter) {
      chapter.hidden = false;
      chapter.classList.remove("is-active");
    });
    presenter.hidden = true;
    document.body.classList.remove("retro-presentation");
    start.setAttribute("aria-pressed", "false");
    if (savedFocus && savedFocus.isConnected) savedFocus.focus({ preventScroll: true });
    window.scrollTo({ top: savedScroll, behavior: "instant" });
    window.requestAnimationFrame(function () {
      window.scrollTo({ top: savedScroll, behavior: "instant" });
      setOutline(readingChapter());
    });
  }

  start.addEventListener("click", beginPresentation);
  exit.addEventListener("click", endPresentation);
  previous.addEventListener("click", function () { showChapter(current - 1, true); });
  next.addEventListener("click", function () { showChapter(current + 1, true); });

  document.addEventListener("keydown", function (event) {
    if (!presenting || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    // Image dialogs and text fields retain their own keyboard interactions.
    var target = event.target;
    if (document.querySelector(".mfp-wrap")) return;
    if (target && target.closest && target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox'], [role='dialog']")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      endPresentation();
      return;
    }
    // Arrow keys on ordinary controls retain their native behavior; Escape still exits.
    if (target && target.closest && target.closest("button, a")) return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "PageDown") {
      event.preventDefault();
      showChapter(current + 1, true);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "PageUp") {
      event.preventDefault();
      showChapter(current - 1, true);
    }
  });

  window.addEventListener("scroll", function () {
    if (presenting || scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(function () {
      scheduled = false;
      if (!presenting) setOutline(readingChapter());
    });
  }, { passive: true });

  outline.forEach(function (link) {
    link.addEventListener("click", function (event) {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      var chapter = document.getElementById(link.getAttribute("href").slice(1));
      if (!chapter) return;
      event.preventDefault();
      // This page owns its outline; avoid the theme's separate smooth-scroll handler.
      event.stopImmediatePropagation();
      chapter.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "start" });
      // Preserve shareable chapter links without adding an entry for every click.
      if (window.history && window.history.replaceState) window.history.replaceState(null, "", "#" + chapter.id);
      setOutline(chapters.indexOf(chapter));
    });
  });

  start.hidden = false;
  start.setAttribute("aria-pressed", "false");
  setOutline(readingChapter());
})();
