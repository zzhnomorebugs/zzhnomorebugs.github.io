(function () {
  "use strict";

  const cols = 30;
  const rows = 18;
  const size = cols * rows;
  const stepsCount = 7;
  const retention = 0.46;
  const guidanceScale = 90;
  const spatialGain = 3.9;

  function sigmoid(value) {
    return 1 / (1 + Math.exp(-value));
  }

  function seededUniform(seed) {
    return function () {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return (seed + 0.5) / 4294967296;
    };
  }

  // Center crop of images/research/incomplete-learning/demo-chl.webp (Figure 1):
  // x in [1,1201), y in [241,961), measured in pixels from the top left.
  // A 40 x 40 cell is observed when at least half of its pixels are colored
  // (max(R,G,B) - min(R,G,B) >= 32). Gray land and white gaps remain excluded.
  const observedRows = [
    "000000001110000011111000000000",
    "000000001110110011111000000000",
    "000000111111100001111000000000",
    "000000011111000001110000000000",
    "000000011111110000000000000000",
    "000000111110010001100000000000",
    "000001111011000011000000000000",
    "000001101111111110000000000000",
    "000000111111111110000000000000",
    "000000011110011000100000000000",
    "000000001111111000100000000000",
    "000000001111111000100000000000",
    "000111011111111000000000000000",
    "000111111111111000010001100000",
    "001110111111111000100000000000",
    "000111110111000000000000000000",
    "000111111110000000000010000000",
    "000111111110000000000000000000"
  ];

  // A fixed local filter stands in for the learned mask predictor. Its weights
  // depend only on distances within the grid, including at its boundaries.
  function neighborhood(index) {
    const x = index % cols;
    const y = Math.floor(index / cols);
    const neighbors = [];
    let total = 0;
    for (let yy = Math.max(0, y - 3); yy <= Math.min(rows - 1, y + 3); yy += 1) {
      for (let xx = Math.max(0, x - 4); xx <= Math.min(cols - 1, x + 4); xx += 1) {
        const distance = ((yy - y) / 1.1) ** 2 + ((xx - x) / 1.75) ** 2;
        const weight = Math.exp(-0.5 * distance);
        neighbors.push({ index: yy * cols + xx, weight });
        total += weight;
      }
    }
    for (const neighbor of neighbors) neighbor.weight /= total;
    return neighbors;
  }

  function predict(latent, filters, time) {
    // One continuous logit difference per pixel suffices for two classes.
    // p(z,t) = sigmoid(gain * Wz + bias(t)) is the clean-class prediction.
    const bias = -0.4 * time + 3.4 * (1 - time);
    return filters.map(function (neighbors) {
      const local = neighbors.reduce((sum, n) => sum + n.weight * latent[n.index], 0);
      return sigmoid(spatialGain * local + bias);
    });
  }

  function guidanceCorrection(probability, anchors, filters) {
    // Scaled negative gradient of mean binary cross-entropy with respect to z.
    // Back-propagation uses W transpose (W is row-normalized at the border).
    const correction = Array(size).fill(0);
    probability.forEach(function (p, index) {
      const delta = guidanceScale * spatialGain * (anchors[index] - p) / size;
      for (const n of filters[index]) correction[n.index] += n.weight * delta;
    });
    return correction;
  }

  window.incompleteMaskExample = function () {
    const uniform = seededUniform(103);
    const gaussian = () => Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform());
    let latent = Array.from({ length: size }, gaussian);
    const initial = latent.map(sigmoid);
    const observed = Array.from(observedRows.join(""), Number);
    const anchors = observed.map(valid => Number(valid && uniform() < retention));
    const filters = Array.from({ length: size }, (_, i) => neighborhood(i));
    const steps = [];

    for (let j = 0; j < stepsCount; j += 1) {
      const time = 1 - j / stepsCount;
      const nextTime = 1 - (j + 1) / stepsCount;
      const alpha = Math.cos(time * Math.PI / 2);
      const sigma = Math.sin(time * Math.PI / 2);
      const nextAlpha = Math.cos(nextTime * Math.PI / 2);
      const nextSigma = Math.sin(nextTime * Math.PI / 2);
      const prediction = predict(latent, filters, time);
      const base = latent.map(function (z, i) {
        // Use the predicted clean binary code and the implied noise for
        // a deterministic reverse diffusion step in the logit difference.
        const clean = 2.5 * (2 * prediction[i] - 1);
        const noise = (z - alpha * clean) / sigma;
        return nextAlpha * clean + nextSigma * noise;
      });
      const gradient = guidanceCorrection(prediction, anchors, filters);
      latent = base.map((z, i) => z + gradient[i]);
      steps.push({ prediction, base: base.map(sigmoid), guided: latent.map(sigmoid), gradient });
    }

    const generated = latent.map(z => Number(z > 0));
    return { cols, rows, observed, anchors, initial, steps, generated };
  };
})();
