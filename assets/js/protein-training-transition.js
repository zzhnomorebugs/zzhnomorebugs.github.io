(function () {
  "use strict";

  const mix = (a, b, p) => a + (b - a) * p;
  const movePoint = (a, b, p) => ({ x: mix(a.x, b.x, p), y: mix(a.y, b.y, p) });

  function nodesOf(svg) {
    return new Map(Array.from(svg.querySelectorAll("[data-flow-node]"), el => {
      const shape = el.querySelector(".pt-box");
      const matrix = el.transform.baseVal.getItem(0).matrix;
      const circle = shape.localName === "circle";
      const w = circle ? 2 * shape.r.baseVal.value : shape.width.baseVal.value;
      const h = circle ? w : shape.height.baseVal.value;
      return [el.dataset.flowNode, { el, x: matrix.e, y: matrix.f, w, h }];
    }));
  }

  // Layouts specify absolute SVG line segments. Keep their exact corners
  // by matching travel distances along each route before interpolating them.
  function routeOf(path) {
    const points = [];
    let x = 0, y = 0, length = 0;
    for (const [, command, values] of path.getAttribute("d").matchAll(/([MLHV])([^MLHV]*)/g)) {
      const pair = values.trim().split(/[\s,]+/).map(Number);
      const lastX = x, lastY = y;
      if (command !== "V") x = pair[0];
      if (command !== "H") y = command === "V" ? pair[0] : pair[1];
      if (points.length) length += Math.hypot(x - lastX, y - lastY);
      points.push({ x, y, at: length });
    }
    points.forEach(point => { point.at /= length; });
    return points;
  }

  function pointAt(route, at) {
    const index = route.findIndex(point => point.at >= at);
    if (index <= 0) return route[index === 0 ? 0 : route.length - 1];
    const a = route[index - 1], b = route[index];
    return movePoint(a, b, (at - a.at) / (b.at - a.at));
  }

  function attachedNode(nodes, p) {
    for (const [id, n] of nodes) {
      if (p.x >= n.x - 1 && p.x <= n.x + n.w + 1 &&
          p.y >= n.y - 1 && p.y <= n.y + n.h + 1) return id;
    }
  }

  function edgeOf(el, nodes) {
    const route = routeOf(el);
    return { el, route, d: el.getAttribute("d"),
      from: attachedNode(nodes, route[0]), to: attachedNode(nodes, route[route.length - 1]) };
  }

  function sharedPriorTitle(diagrams, nodes, overlay) {
    const titles = diagrams.map(svg => svg.querySelector("[data-prior-title]"));
    if (!titles.every(Boolean)) return;

    // Only the network state changes. Move the original label at full opacity
    // and natural type size while both network drawings crossfade beneath it.
    const anchors = titles.map((title, i) => {
      const node = nodes[i].get("prior");
      const local = title.transform.baseVal.getItem(0).matrix;
      return { x: node.x + local.e, y: node.y + local.f };
    });
    const svg = document.createElementNS(diagrams[0].namespaceURI, "svg");
    for (const name of ["class", "viewBox"]) svg.setAttribute(name, diagrams[0].getAttribute(name));
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.appendChild(titles[0]);
    titles[1].remove();
    overlay.appendChild(svg);
    return p => {
      const point = movePoint(anchors[0], anchors[1], p);
      titles[0].setAttribute("transform", `translate(${point.x} ${point.y})`);
    };
  }

  function layoutPair(first, second, overlay) {
    const diagrams = [first, second];
    const nodes = diagrams.map(nodesOf);
    const moveTitle = sharedPriorTitle(diagrams, nodes, overlay);
    const updates = [];
    const resets = [];
    for (const [key, a] of nodes[0]) {
      const b = nodes[1].get(key);
      if (!b) continue;
      const originals = [a.el.getAttribute("transform"), b.el.getAttribute("transform")];
      updates.push(p => {
        const x = mix(a.x, b.x, p), y = mix(a.y, b.y, p);
        const w = mix(a.w, b.w, p), h = mix(a.h, b.h, p);
        for (const n of [a, b]) n.el.setAttribute("transform", `translate(${x} ${y}) scale(${w / n.w} ${h / n.h})`);
      });
      resets.push(() => {
        a.el.setAttribute("transform", originals[0]);
        b.el.setAttribute("transform", originals[1]);
      });
    }

    const paths = diagrams.map((svg, i) => new Map(Array.from(svg.querySelectorAll("[data-flow-edge]"),
      el => [el.dataset.flowEdge, edgeOf(el, nodes[i])])));
    // Let the moving prior clear the space for the new guidance branch. The
    // desktop and mobile layouts open that space at different points.
    const prior = nodes[0].get("prior"), frozenPrior = nodes[1].get("prior");
    const residual = nodes[1].get("residual");
    const firstGap = residual.y - (prior.y + prior.h);
    const finalGap = residual.y - (frozenPrior.y + frozenPrior.h);
    if (firstGap < 0 && finalGap > 0) {
      const branch = [residual.el, ...second.querySelectorAll(".pt-label--correction, .pt-label--update")];
      for (const edge of paths[1].values()) {
        if (edge.from === "residual" || edge.to === "residual") branch.push(edge.el);
      }
      updates.push(p => {
        const opacity = String(Math.max(0, mix(firstGap, finalGap, p) / finalGap));
        for (const el of branch) el.style.opacity = opacity;
      });
      resets.push(() => { for (const el of branch) el.style.opacity = ""; });
    }
    for (const key of new Set([...paths[0].keys(), ...paths[1].keys()])) {
      const a = paths[0].get(key), b = paths[1].get(key);
      if (a && b && a.from === b.from && a.to === b.to) {
        const distances = [...new Set([...a.route, ...b.route].map(point => point.at))].sort((x, y) => x - y);
        const pairs = distances.map(t => [pointAt(a.route, t), pointAt(b.route, t)]);
        updates.push(p => {
          const d = pairs.map(([start, end], i) => {
            const point = movePoint(start, end, p);
            return (i ? "L" : "M") + point.x + " " + point.y;
          }).join(" ");
          a.el.setAttribute("d", d);
          b.el.setAttribute("d", d);
        });
      } else {
        // New and rewired branches fade with their scene. Keep both ends on
        // their moving modules, including the gradient's changing destination.
        [a, b].forEach((edge, side) => {
          if (!edge) return;
          function offset(name, point) {
            const here = nodes[side].get(name), there = nodes[1 - side].get(name);
            if (!here || !there) return { x: 0, y: 0 };
            return {
              x: there.x - here.x + (point.x - here.x) * (there.w / here.w - 1),
              y: there.y - here.y + (point.y - here.y) * (there.h / here.h - 1)
            };
          }
          const start = offset(edge.from, edge.route[0]);
          const end = offset(edge.to, edge.route[edge.route.length - 1]);
          const offsets = edge.route.map(point => movePoint(start, end, point.at));
          updates.push(p => {
            const distance = side === 0 ? p : 1 - p;
            const d = edge.route.map((point, i) => (i ? "L" : "M") +
              (point.x + distance * offsets[i].x) + " " + (point.y + distance * offsets[i].y)).join(" ");
            edge.el.setAttribute("d", d);
          });
        });
      }
      for (const edge of [a, b]) if (edge) resets.push(() => edge.el.setAttribute("d", edge.d));
    }

    const labels = svg => new Map(Array.from(svg.querySelectorAll(".pt-edge-label"), el =>
      [el.getAttribute("class"), { el, x: Number(el.getAttribute("x")), y: Number(el.getAttribute("y")) }]));
    const toLabels = labels(second);
    for (const [key, a] of labels(first)) {
      const b = toLabels.get(key);
      if (!b) continue;
      updates.push(p => {
        const point = movePoint(a, b, p);
        for (const label of [a, b]) {
          label.el.setAttribute("x", point.x);
          label.el.setAttribute("y", point.y);
        }
      });
      resets.push(() => {
        for (const label of [a, b]) {
          label.el.setAttribute("x", label.x);
          label.el.setAttribute("y", label.y);
        }
      });
    }
    return { draw: p => updates.forEach(update => update(p)), reset: () => resets.forEach(reset => reset()), moveTitle };
  }

  window.proteinTrainingTransition = function (first, second) {
    const views = [first, second];
    const changingDetails = views.map(view => view.querySelectorAll("[data-dataset-content], [data-flow-node='prior'] .pt-status"));
    const overlay = document.createElement("div");
    overlay.className = "protein-training__view protein-training__shared-labels";
    overlay.inert = true;
    const layouts = Array.from(first.querySelectorAll("[data-training-diagram]"), svg =>
      layoutPair(svg, second.querySelector(`[data-training-diagram="${svg.dataset.trainingDiagram}"]`), overlay));
    if (overlay.childElementCount) second.after(overlay);
    let previous = -1;
    return p => {
      if (p === previous) return;
      const between = p > 0 && p < 1;
      if (between) layouts.forEach(layout => layout.draw(p));
      else if (previous > 0 && previous < 1) layouts.forEach(layout => layout.reset());
      for (const layout of layouts) if (layout.moveTitle) layout.moveTitle(p);
      views.forEach((view, index) => {
        const weight = index ? p : 1 - p;
        view.style.visibility = between ? "visible" : "";
        view.style.opacity = between ? String(weight) : "";
        // Different record schemas and training statuses share these positions.
        // Fade out the old content before revealing the new labels.
        for (const content of changingDetails[index]) {
          content.style.opacity = between ? String(Math.max(0, 2 * weight - 1)) : "";
        }
      });
      previous = p;
    };
  };
}());
