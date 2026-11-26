(function () {
  "use strict";

  window.proteinTrainingEffects = function (view) {
    const filters = view.querySelectorAll("[data-noise-blur]");
    const initialHue = view.dataset.trainingView === "pretrain" ? 180 : 12;
    let lastBlur, lastHue;

    return {
      render(beat, progress, time) {
        // Only the residue glyphs in the noisy input lose definition.
        const fraction = beat === "noise" ? Math.max(0, Math.min(1, progress)) : 1;
        const blur = (3 * fraction * fraction * (3 - 2 * fraction)).toFixed(2);
        if (blur !== lastBlur) {
          for (const filter of filters) filter.setAttribute("stdDeviation", blur);
          lastBlur = blur;
        }

        // Tie the colors to the playhead so pausing or seeking preserves the frame.
        const hue = Math.round(initialHue + time * 24) % 360;
        if (hue !== lastHue) {
          view.style.setProperty("--pt-training-hue", hue);
          lastHue = hue;
        }
      }
    };
  };
}());
