(function () {
  "use strict";

  var roots = ["A", "B", "C"];
  var compact = window.matchMedia("(max-width: 740px)");

  function distance(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  function pointString(point) {
    return point.x.toFixed(2) + " " + point.y.toFixed(2);
  }

  // Small rounded corners retain the clear, separate routing corridors.
  function roundedPath(points) {
    points = points.filter(function (point, index) {
      return index === 0 || distance(point, points[index - 1]) > 0.1;
    });
    if (points.length < 2) return "";
    var path = "M " + pointString(points[0]);
    for (var i = 1; i < points.length - 1; i++) {
      var previous = points[i - 1], corner = points[i], next = points[i + 1];
      var before = distance(previous, corner), after = distance(corner, next);
      var radius = Math.min(9, before / 2, after / 2);
      var entry = {
        x: corner.x + (previous.x - corner.x) * radius / before,
        y: corner.y + (previous.y - corner.y) * radius / before
      };
      var exit = {
        x: corner.x + (next.x - corner.x) * radius / after,
        y: corner.y + (next.y - corner.y) * radius / after
      };
      path += " L " + pointString(entry) + " Q " + pointString(corner) + " " + pointString(exit);
    }
    return path + " L " + pointString(points[points.length - 1]);
  }

  function connect(map) {
    var overlay = map.querySelector("[data-rt-route-links]");
    var product = map.querySelector(".rt-dataset-product > svg");
    var list = map.querySelector(".rt-sample-list");
    if (!overlay || !product || !list) return;

    var routes = roots.map(function (root, index) {
      var row = map.querySelector('[data-rt-route-target="' + root + '"]');
      return {
        path: overlay.querySelector('[data-rt-route-link="' + index + '"]'),
        circle: product.querySelector('[data-rt-center="' + root + '"] circle'),
        row: row,
        anchor: row && row.querySelector(".rt-route-anchor")
      };
    });
    var pending = 0;

    function render() {
      pending = 0;
      var surface = overlay.getBoundingClientRect();
      var matrix = product.getScreenCTM();
      // Hidden scenes have no usable geometry; ResizeObserver redraws on reveal.
      if (surface.width < 1 || surface.height < 1 || !matrix) return;
      overlay.setAttribute("viewBox", "0 0 " + surface.width + " " + surface.height);

      function svgPoint(x, y) {
        var point = product.createSVGPoint();
        point.x = x;
        point.y = y;
        var screen = point.matrixTransform(matrix);
        return { x: screen.x - surface.left, y: screen.y - surface.top };
      }

      var listRect = list.getBoundingClientRect();
      var productRect = product.getBoundingClientRect();
      var listLeft = listRect.left - surface.left;
      var productRight = productRect.right - surface.left;
      var gutter = Math.max(0, listLeft - productRight);

      routes.forEach(function (route, index) {
        if (!route.path || !route.circle || !route.anchor) return;
        var circle = route.circle.getBoundingClientRect();
        var anchor = route.anchor.getBoundingClientRect();
        if (circle.width < 1 || anchor.width < 1) return;
        var center = {
          x: circle.left + circle.width / 2 - surface.left,
          y: circle.top + circle.height / 2 - surface.top
        };
        var end = {
          x: anchor.left - surface.left - 3,
          y: anchor.top + anchor.height / 2 - surface.top
        };
        var points;

        if (compact.matches) {
          // The early outer exits let the later inner exits pass without crossing.
          // All three vertical lanes remain outside the reactant rows.
          var lane = Math.max(4, listLeft - 6 - index * 10);
          if (index === 0) {
            var lowerA = svgPoint(185, 275);
            points = [lowerA, { x: lane, y: lowerA.y }, { x: lane, y: end.y }, end];
          } else if (index === 1) {
            var lowerB = svgPoint(90, 230);
            points = [lowerB, { x: lane, y: lowerB.y }, { x: lane, y: end.y }, end];
          } else {
            points = [{ x: lane, y: center.y }, { x: lane, y: end.y }, end];
          }
        } else {
          var rightLane = productRight + gutter * (0.32 + index * 0.23);
          // Keep the final arrow horizontal, including when the gap is very small.
          rightLane = Math.min(rightLane, end.x - 9);
          if (index === 0) {
            var upperA = svgPoint(145, 20);
            points = [svgPoint(145, 125), upperA,
              { x: rightLane, y: upperA.y }, { x: rightLane, y: end.y }, end];
          } else if (index === 1) {
            var bottomB = svgPoint(122.46, 285);
            points = [bottomB, { x: rightLane, y: bottomB.y }, { x: rightLane, y: end.y }, end];
          } else {
            var leftC = svgPoint(18, 155.1), bottomC = svgPoint(18, 310);
            points = [leftC, bottomC, { x: rightLane, y: bottomC.y },
              { x: rightLane, y: end.y }, end];
          }
        }

        // Attach to the visible ring boundary, never its atom label or centre.
        var dx = points[0].x - center.x, dy = points[0].y - center.y;
        var rx = circle.width / 2 + 1.5, ry = circle.height / 2 + 1.5;
        var length = Math.hypot(dx / rx, dy / ry);
        if (!length) return;
        points.unshift({ x: center.x + dx / length, y: center.y + dy / length });
        route.path.setAttribute("d", roundedPath(points));
      });
    }

    function schedule() {
      if (!pending) pending = window.requestAnimationFrame(render);
    }

    if (window.ResizeObserver) {
      var observer = new ResizeObserver(schedule);
      observer.observe(map);
      observer.observe(product);
      observer.observe(list);
      routes.forEach(function (route) {
        if (route.row) observer.observe(route.row);
        if (route.anchor) observer.observe(route.anchor);
      });
    }
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("load", schedule, { once: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
    schedule();
  }

  document.querySelectorAll(".rt-dataset-map").forEach(connect);
})();
