// Run with: node --test tests/test_project_animation_playback.cjs
const { after, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const d3 = require('../assets/js/lib/d3-selection-3.0.0.min.js');
const { gsap } = require('../assets/js/lib/gsap-3.13.0.min.js');

// Run the real timelines, but move their playheads explicitly instead of
// relying on wall-clock delays. Diagrams and page layout belong in browser tests.
gsap.ticker.remove(gsap.updateRoot);
after(() => gsap.ticker.sleep());

const scripts = new Map();
function runScript(name, context) {
  if (!scripts.has(name)) {
    const filename = path.join(__dirname, '../assets/js', name);
    scripts.set(name, new vm.Script(fs.readFileSync(filename, 'utf8'), { filename }));
  }
  scripts.get(name).runInContext(context);
}

class Element extends EventTarget {
  constructor() {
    super();
    this.attributes = new Map();
    this.elements = new Map();
    this.groups = new Map();
    this.dataset = {};
    this.classList = new Set();
    this.textContent = '';
    this.hidden = false;
  }

  querySelector(selector) { return this.elements.get(selector) ?? null; }
  querySelectorAll(selector) { return this.groups.get(selector) ?? []; }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  toggleAttribute(name, enabled) {
    if (enabled) this.setAttribute(name, '');
    else this.removeAttribute(name);
  }

  emit(type) { this.dispatchEvent(new Event(type)); }
}

function browser({ inView = false, observer = true, hidden = false } = {}) {
  const window = new Element();
  const document = new Element();
  document.hidden = hidden;
  document.documentElement = { clientWidth: 390, clientHeight: 700 };
  const stage = new Element();
  let rect = { top: inView ? 300 : 900, left: 10, width: 370, height: 500 };
  stage.getBoundingClientRect = () => ({
    ...rect, bottom: rect.top + rect.height, right: rect.left + rect.width
  });

  let notify;
  let observedStage;
  if (observer) {
    window.IntersectionObserver = class {
      constructor(callback) { notify = callback; }
      observe(element) { observedStage = element; }
    };
  }
  const context = vm.createContext({ window, document, IntersectionObserver: window.IntersectionObserver });
  runScript('project-animation-playback.js', context);

  return {
    window,
    document,
    stage,
    context,
    setRect(next, event = 'scroll') { rect = { ...rect, ...next }; window.emit(event); },
    intersect(...visibility) {
      assert.equal(observedStage, stage, 'Playback must observe the diagram viewport');
      notify(visibility.map(isIntersecting => ({ target: stage, isIntersecting })));
    },
    setHidden(value) { document.hidden = value; document.emit('visibilitychange'); }
  };
}

test('shared controller starts in view, uses the latest observer entry, and suppresses duplicate updates', () => {
  const page = browser({ inView: true });
  const changes = [];
  const playback = page.window.projectAnimationPlayback(page.stage, value => changes.push(value));
  assert.equal(playback.playing, true);

  page.intersect(false, true);
  page.intersect(false);
  assert.equal(playback.playing, false);
  page.intersect(true);
  assert.equal(playback.playing, true);
  assert.deepEqual(changes, [true, false, true]);
});

test('shared controller preserves manual pause and requires both viewport and foreground for play', () => {
  const page = browser({ hidden: true });
  const changes = [];
  const playback = page.window.projectAnimationPlayback(page.stage, value => changes.push(value));
  page.intersect(true);
  assert.equal(playback.playing, false);
  page.setHidden(false);
  assert.equal(playback.playing, true);
  page.setHidden(true);
  assert.equal(playback.playing, false);
  page.intersect(false);
  page.setHidden(false);
  assert.equal(playback.playing, false);
  page.intersect(true);
  assert.equal(playback.playing, true);

  playback.pause();
  page.intersect(false);
  page.setHidden(true);
  page.intersect(true);
  page.setHidden(false);
  assert.equal(playback.playing, false);
  page.intersect(false);
  playback.play();
  assert.equal(playback.playing, false);
  page.intersect(true);
  assert.equal(playback.playing, true);
  assert.deepEqual(changes, [false, true, false, true, false, true]);
});

test('shared controller falls back to scroll and resize with two-dimensional bounds', () => {
  const page = browser({ observer: false });
  const changes = [];
  page.window.projectAnimationPlayback(page.stage, value => changes.push(value));
  page.setRect({ top: 700 });
  page.setRect({ top: 699 });
  page.setRect({ left: 390 });
  page.setRect({ left: 389 }, 'resize');
  page.setRect({ width: 0 }, 'resize');
  page.setRect({ width: 370, top: -500 });
  page.setRect({ top: -499 });
  assert.deepEqual(changes, [false, true, false, true, false, true]);
});

const labels = {
  en: { playLabel: 'Play', pauseLabel: 'Pause', replayLabel: 'Replay' },
  'zh-CN': { playLabel: '播放', pauseLabel: '暂停', replayLabel: '重播' }
};

function gsapDiagram(language, { rootSelector, viewportSelector, selectors }, setup, name) {
  const page = browser({ inView: true });
  const root = new Element();
  Object.assign(root.dataset, labels[language]);
  page.document.groups.set(rootSelector, [root]);
  root.elements.set(viewportSelector, page.stage);
  for (const selector of selectors) root.elements.set(selector, new Element());

  let timeline;
  let transition;
  page.window.d3 = d3;
  page.window.gsap = {
    timeline(options) { timeline = gsap.timeline(options); return timeline; },
    to(target, options) { transition = gsap.to(target, options); return transition; }
  };
  const controls = setup(root, page.window);
  runScript(name, page.context);
  assert.ok(timeline, 'Production controller initialized the timeline');
  return { ...page, ...controls, root, timeline, get transition() { return transition; } };
}

function incomplete(language) {
  return gsapDiagram(language, {
    rootSelector: '[data-idcd-animate]',
    viewportSelector: '.idcd-stage-viewport',
    selectors: [
      '[data-idcd-scenes]', '[data-idcd-framework]', '[data-idcd-training]', '[data-idcd-imputation]',
      '[data-idcd-play]', '[data-idcd-prev]', '[data-idcd-next]', '[data-idcd-progress]',
      '.idcd-animation__time', '[data-idcd-status]', '.idcd-scene__phase', '.idcd-scene__heading h4',
      '#idcd-frame-description', '.idcd-animation__interactive'
    ]
  }, (root, window) => {
    window.createIncompleteTrainingFields = () => () => {};
    window.createIncompleteImputation = () => () => {};
    window.createIncompleteStrategyFramework = () => () => {};
    const steps = Array.from({ length: 5 }, () => new Element());
    root.groups.set('[data-idcd-jump]', steps);
    root.querySelector('[data-idcd-scenes]').textContent = JSON.stringify(steps.map((_, index) => {
      const id = language + ' ' + index;
      return { phase: id, title: id, step: id, cue: 'Input ' + id, outcome: 'Output ' + id };
    }));
    return {
      steps,
      play: root.querySelector('[data-idcd-play]'),
      next: root.querySelector('[data-idcd-next]'),
      prev: root.querySelector('[data-idcd-prev]'),
      progress: root.querySelector('[data-idcd-progress]')
    };
  }, 'incomplete-training-animation.js');
}

function protein(language) {
  return gsapDiagram(language, {
    rootSelector: '[data-protein-training]',
    viewportSelector: '.protein-training__views',
    selectors: ['[data-training-play]', '[data-training-progress]']
  }, (root, window) => {
    window.proteinTrainingEffects = () => ({ render() {} });
    window.proteinTrainingTransition = () => () => {};
    const steps = [];
    const views = ['pretrain', 'adapt'].map(id => {
      const view = new Element();
      view.dataset.trainingView = id;
      view.setAttribute('aria-label', language + ' ' + id);
      const button = new Element();
      steps.push(button);
      root.elements.set('[data-training-jump="' + id + '"]', button);
      return view;
    });
    root.groups.set('[data-training-view]', views);
    return {
      steps,
      views,
      play: root.querySelector('[data-training-play]'),
      progress: root.querySelector('[data-training-progress]')
    };
  }, 'protein-control-training.js');
}

// Only the drawing methods used while advancing the SE(3) controller. SVG
// geometry itself needs a rendered browser and is outside this unit fixture.
class SvgElement extends Element {
  style = {};
  appendChild() {}
  getTotalLength() { return 1; }
  getPointAtLength() { return { x: 0, y: 0 }; }
}

function se3(language) {
  const page = browser();
  const root = new Element();
  root.dataset.language = language === 'en' ? 'en' : 'zh';
  const scene = page.stage;
  scene.clientWidth = 370;
  scene.replaceChildren = () => {};
  scene.appendChild = () => {};
  scene.scrollIntoView = options => { scene.scrolledTo = options.block; };
  page.document.createElementNS = () => new SvgElement();
  page.document.groups.set('[data-se3-mapping]', [root]);
  root.elements.set('[data-mapping-scene]', scene);
  for (const name of ['controls', 'play', 'step-play', 'restart', 'progress', 'counter', 'status']) {
    root.elements.set('[data-mapping-' + name + ']', new Element());
  }
  const steps = Array.from({ length: 4 }, (_, index) => {
    const button = new Element();
    button.dataset.mappingJump = String(index);
    return button;
  });
  root.groups.set('[data-mapping-jump]', steps);
  page.window.matchMedia = () => ({ matches: false });

  let time = 1;
  let id = 0;
  const pendingFrames = new Map();
  page.context.requestAnimationFrame = callback => {
    pendingFrames.set(++id, callback);
    return id;
  };
  page.context.cancelAnimationFrame = frame => pendingFrames.delete(frame);
  runScript('se3-mapping.js', page.context);
  return {
    ...page, root, steps,
    play: root.querySelector('[data-mapping-play]'),
    progress: root.querySelector('[data-mapping-progress]'),
    restart: root.querySelector('[data-mapping-restart]'),
    advance(ms = 0) {
      time += ms;
      const frames = [...pendingFrames.values()];
      pendingFrames.clear();
      frames.forEach(callback => callback(time));
    }
  };
}

for (const language of Object.keys(labels)) {
  test('incomplete training keeps stage controls, pause and replay consistent in ' + language, t => {
    const page = incomplete(language);
    const { timeline, root, play, steps, prev, next } = page;
    t.after(() => timeline.kill());
    assert.equal(timeline.paused(), false);
    assert.equal(play.textContent, labels[language].pauseLabel);
    assert.equal(play.getAttribute('aria-pressed'), 'true');
    assert.equal(prev.disabled, true);

    next.emit('click');
    assert.equal(timeline.time(), timeline.labels.pixels);
    assert.equal(root.dataset.scene, 1);
    assert.equal(steps[1].getAttribute('aria-current'), 'step');
    assert.equal(timeline.paused(), false);
    prev.emit('click');
    assert.equal(timeline.time(), 0);

    timeline.time(2);
    page.intersect(false);
    assert.equal(timeline.paused(), true);
    assert.equal(timeline.time(), 2);
    page.setHidden(true);
    page.intersect(true);
    assert.equal(timeline.paused(), true);
    page.setHidden(false);
    assert.equal(timeline.paused(), false);

    play.emit('click');
    page.intersect(false);
    page.intersect(true);
    assert.equal(timeline.paused(), true);
    assert.equal(play.getAttribute('aria-pressed'), 'false');
    steps[3].emit('click');
    assert.equal(root.dataset.scene, 3);
    assert.ok(timeline.time() > timeline.labels.train);
    assert.ok(timeline.time() < timeline.labels.impute);
    play.emit('click');
    assert.equal(timeline.time(), timeline.labels.train);
    assert.equal(timeline.paused(), false);

    timeline.totalProgress(1);
    assert.equal(timeline.paused(), true);
    assert.equal(next.disabled, true);
    assert.equal(play.textContent, labels[language].replayLabel);
    play.emit('click');
    assert.equal(timeline.time(), 0);
    assert.equal(root.dataset.scene, 0);
    assert.equal(timeline.paused(), false);
  });

  test('protein training plays stage handoffs, pauses, and replays in ' + language, t => {
    const page = protein(language);
    const { timeline, root, play, steps, views, progress } = page;
    t.after(() => {
      page.transition?.kill();
      timeline.kill();
    });
    assert.equal(timeline.paused(), false);
    assert.equal(play.textContent, labels[language].pauseLabel);
    assert.equal(root.dataset.trainingStage, 'pretrain');

    timeline.time(2);
    page.intersect(false);
    assert.equal(timeline.paused(), true);
    assert.equal(timeline.time(), 2);
    page.intersect(true);
    assert.equal(timeline.paused(), false);

    steps[1].emit('click');
    const handoff = page.transition;
    assert.equal(handoff.paused(), false);
    handoff.totalProgress(0.5);
    assert.equal(root.dataset.trainingPart, 'transition');
    assert.ok(Number(root.dataset.stageMix) > 0 && Number(root.dataset.stageMix) < 1);
    page.setHidden(true);
    assert.equal(handoff.paused(), true);
    page.setHidden(false);
    assert.equal(handoff.paused(), false);
    play.emit('click');
    page.intersect(false);
    page.intersect(true);
    assert.equal(handoff.paused(), true);
    play.emit('click');
    handoff.totalProgress(1);
    assert.equal(timeline.time(), timeline.labels.adapt);
    assert.equal(root.dataset.trainingStage, 'adapt');
    assert.equal(steps[1].getAttribute('aria-current'), 'step');
    assert.equal(views[0].inert, true);
    assert.equal(views[1].inert, false);
    assert.equal(timeline.paused(), true);

    progress.value = 2;
    progress.emit('input');
    assert.equal(timeline.time(), 2);
    assert.equal(root.dataset.trainingStage, 'pretrain');
    assert.equal(timeline.paused(), true);

    play.emit('click');
    timeline.totalProgress(1);
    assert.equal(timeline.paused(), true);
    assert.equal(play.textContent, labels[language].replayLabel);
    play.emit('click');
    page.transition.totalProgress(1);
    assert.equal(timeline.time(), 0);
    assert.equal(root.dataset.trainingStage, 'pretrain');
    assert.equal(timeline.paused(), false);
  });

  test('SE(3) mapping pauses, jumps to a local update, and replays in ' + language, () => {
    const page = se3(language);
    const { root, play, steps, progress, restart } = page;
    const isPlaying = () => play.getAttribute('aria-pressed') === 'true';
    assert.equal(root.dataset.mappingReady, 'true');
    assert.equal(isPlaying(), false);
    page.intersect(true);
    assert.equal(isPlaying(), true);
    assert.equal(play.textContent, labels[language].pauseLabel);
    page.advance();
    page.advance(600);
    assert.equal(root.dataset.mappingView, 'overview');
    assert.equal(root.dataset.mappingSample, '2');

    const pausedAt = progress.value;
    page.intersect(false);
    assert.equal(isPlaying(), false);
    page.setHidden(true);
    page.intersect(true);
    page.advance(1000);
    assert.equal(isPlaying(), false);
    assert.equal(progress.value, pausedAt);
    page.setHidden(false);
    assert.equal(isPlaying(), true);

    steps[2].emit('click');
    assert.equal(isPlaying(), false);
    assert.equal(root.dataset.mappingView, 'detail');
    assert.equal(root.dataset.mappingStage, '2');
    assert.equal(page.stage.scrolledTo, 'start');
    page.intersect(false);
    page.intersect(true);
    assert.equal(isPlaying(), false);

    progress.value = progress.max;
    progress.emit('input');
    assert.equal(root.dataset.mappingView, 'done');
    assert.equal(isPlaying(), false);
    play.emit('click');
    assert.equal(root.dataset.mappingView, 'overview');
    assert.equal(progress.value, '0');
    assert.equal(isPlaying(), true);

    page.advance();
    page.advance(1000);
    assert.ok(Number(progress.value) > 0);
    restart.emit('click');
    assert.equal(progress.value, '0');
    page.advance(Number(progress.max) * 1000 / 60 + 16);
    assert.equal(root.dataset.mappingView, 'done');
    page.advance(1200);
    assert.equal(root.dataset.mappingView, 'overview');
    assert.equal(progress.value, '0');
    assert.equal(isPlaying(), true);
  });
}
