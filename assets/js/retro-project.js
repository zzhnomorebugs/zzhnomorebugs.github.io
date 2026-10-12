(function () {
  "use strict";

  var project = document.querySelector("[data-retro-project]");
  if (!project) return;

  var chapters = Array.prototype.slice.call(project.querySelectorAll(".retro-chapter"));
  var outline = Array.prototype.slice.call(project.querySelectorAll(".retro-outline a"));
  if (!chapters.length) return;

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

  window.addEventListener("scroll", function () {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(function () {
      scheduled = false;
      setOutline(readingChapter());
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
      var index = chapters.indexOf(chapter);
      if (index < 0) return;
      chapter.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "start" });
      // Preserve shareable chapter links without adding an entry for every click.
      if (window.history && window.history.replaceState) window.history.replaceState(null, "", "#" + chapter.id);
      setOutline(index);
    }, { capture: true });
  });

  setOutline(readingChapter());
})();
