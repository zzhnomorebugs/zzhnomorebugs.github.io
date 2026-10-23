(function () {
  "use strict";

  var data = window.RETRO_TRAINING_DATA;
  if (!data || !Array.isArray(data.nodes)) return;

  function pointText(point) {
    return point.x.toFixed(2) + " " + point.y.toFixed(2);
  }

  function connect(figure) {
    var svg = figure.querySelector('[data-rt-field="sample"]');
    var model = figure.querySelector("[data-rt-model]");
    var canvas = figure.querySelector(".rt-sample-canvas");
    var layer = svg && svg.querySelector("[data-rt-denoise-links]");
    if (!svg || !model || !canvas || !layer) return;

    // Keep destinations fixed to the same atom identities as the molecular field.
    var routes = data.nodes.map(function (node) {
      return { node: node, path: layer.querySelector('[data-rt-denoise-link="' + node.id + '"]') };
    }).filter(function (route) { return !!route.path; });
    var ranked = routes.slice().sort(function (a, b) {
      return a.node.x - b.node.x || a.node.y - b.node.y;
    });
    var pending = 0;

    function render() {
      pending = 0;
      var rect = model.getBoundingClientRect();
      var fieldRect = svg.getBoundingClientRect();
      var matrix = svg.getScreenCTM();
      if (!matrix || rect.width < 1 || rect.height < 1 || fieldRect.width < 1 || fieldRect.height < 1) return;

      var inverse;
      try { inverse = matrix.inverse(); } catch (_) { return; }
      function localPoint(x, y) {
        var point = svg.createSVGPoint();
        point.x = x;
        point.y = y;
        return point.matrixTransform(inverse);
      }

      var left = localPoint(rect.left + rect.width * 0.1, rect.top);
      var right = localPoint(rect.right - rect.width * 0.1, rect.top);
      if (![left.x, left.y, right.x, right.y].every(Number.isFinite)) return;

      ranked.forEach(function (route, index) {
        var fraction = ranked.length > 1 ? index / (ranked.length - 1) : 0.5;
        var start = {
          x: left.x + (right.x - left.x) * fraction,
          y: left.y + (right.y - left.y) * fraction - 1
        };
        var target = route.node;
        var dx = target.x - start.x;
        var dy = target.y - start.y;
        var span = Math.hypot(dx, dy);
        if (!span) return;

        // A shared upward departure makes the model's per-node output a calm fan.
        // The final tangent points directly at the atom but stops outside its label.
        var lift = Math.min(76, Math.max(28, span * 0.16));
        var first = { x: start.x + dx * 0.12, y: start.y - lift };
        var second = {
          x: start.x + dx * 0.72,
          y: start.y + dy * 0.72 - lift * 0.42
        };
        var tx = target.x - second.x, ty = target.y - second.y;
        var length = Math.hypot(tx, ty);
        if (!length) return;
        var end = { x: target.x - tx * 17 / length, y: target.y - ty * 17 / length };
        route.path.setAttribute("d", "M " + pointText(start) + " C " + pointText(first) + " " + pointText(second) + " " + pointText(end));
      });
    }

    function schedule() {
      if (!pending) pending = window.requestAnimationFrame(render);
    }

    if (window.ResizeObserver) {
      var observer = new ResizeObserver(schedule);
      observer.observe(canvas);
      observer.observe(svg);
      observer.observe(model);
    }
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("load", schedule, { once: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
    schedule();
  }

  document.querySelectorAll("[data-retro-training]").forEach(connect);
})();
