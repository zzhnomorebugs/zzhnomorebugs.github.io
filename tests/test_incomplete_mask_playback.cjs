// Run with: node --test tests/test_incomplete_mask_playback.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const scripts = [
  'lib/gsap-3.13.0.min.js',
  'incomplete-mask-sampler.js',
  'incomplete-mask-animation.js'
].map(name => ({ name, source: fs.readFileSync(path.join(__dirname, '../assets/js', name), 'utf8') }));

const locale = {
  en: { play: 'Resume', pause: 'Pause', replay: 'Replay' },
  'zh-CN': { play: '继续播放', pause: '暂停', replay: '重播' }
};

class Element {
  constructor() {
    this.dataset = {};
    this.attributes = new Map();
    this.children = new Map();
    this.listeners = new Map();
    this.style = {};
    this.parentElement = { style: {} };
  }

  querySelector(selector) {
    if (!this.children.has(selector)) this.children.set(selector, new Element());
    return this.children.get(selector);
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  dispatch(name) { this.listeners.get(name)?.(); }
  getBoundingClientRect() { return this.rect; }
}

function setup(language = 'en') {
  const labels = {
    noise: 'noise', predict: 'predict', base: 'base', gradient: 'gradient',
    guided: 'guided', binary: 'binary', ...locale[language]
  };
  const document = new Element();
  const viewportHeight = 650;
  document.documentElement = { clientHeight: viewportHeight, clientWidth: 390 };
  document.createElement = () => new Element();
  document.hidden = false;
  const root = document.querySelector('[data-mask-flow]');
  const stage = root.querySelector('[data-mask-interactive]');
  const panels = root.querySelector('.mask-flow__panels');
  const field = root.querySelector('[data-mask-field]');
  const overlay = root.querySelector('[data-mask-overlay]');
  const captions = Array.from({ length: 5 }, () => new Element());
  const buttons = Array.from({ length: 5 }, () => new Element());
  const groups = new Map([['[data-mask-scene]', buttons], ['.mask-flow__caption p', captions]]);
  root.querySelectorAll = selector => groups.get(selector) || [];
  root.querySelector('[data-mask-labels]').textContent = JSON.stringify(labels);

  const rectangle = (top, height) => ({ top, bottom: top + height, height, left: 0, right: 390, width: 390 });
  function place(graphicsTop) {
    root.rect = rectangle(graphicsTop - 210, 1300);
    stage.rect = rectangle(graphicsTop - 90, 650);
    panels.rect = rectangle(graphicsTop, 440);
    field.rect = rectangle(graphicsTop, 200);
    overlay.rect = rectangle(graphicsTop + 240, 200);
  }
  place(1110);

  // The browser suite checks actual SVG geometry and ScrollTrigger. This stand-in
  // reports intersections for the elements chosen by the production controller.
  let trigger;
  const ScrollTrigger = {
    name: 'scrollTrigger',
    register() {},
    create(options) {
      trigger = options;
      return { refresh: () => viewportChange('onRefresh') };
    }
  };
  function viewportChange(callback) {
    const start = trigger.trigger.getBoundingClientRect().top;
    const end = (trigger.endTrigger || trigger.trigger).getBoundingClientRect().bottom;
    trigger[callback]({ isActive: start < viewportHeight && end > 0 });
  }

  // Drawing is irrelevant to this controller test. The real GSAP timeline runs
  // its updates and completion callbacks on a deterministic animation clock.
  const selection = {};
  for (const method of ['append', 'attr', 'data', 'join', 'select', 'selectAll', 'text']) {
    selection[method] = () => selection;
  }
  let now = 0;
  let nextFrame = 0;
  const frames = new Map();
  const context = {
    document, ScrollTrigger, d3: { select: () => selection },
    Date: class extends Date { static now() { return now; } },
    requestAnimationFrame(callback) { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame(id) { frames.delete(id); }
  };
  context.window = context;
  vm.createContext(context);
  scripts.forEach(({ source, name }) => vm.runInContext(source, context, { filename: name }));
  const [timeline] = context.gsap.globalTimeline.getChildren(false, false, true);
  viewportChange('onRefresh');

  const play = root.querySelector('.mask-flow__play');
  return {
    labels, play, buttons, captions, timeline,
    get playing() { return play.dataset.playing === 'true'; },
    get scene() { return buttons.findIndex(button => button.attributes.get('aria-current') === 'step'); },
    get mode() { return root.querySelector('[data-mask-mode]').textContent; },
    view(graphicsTop, callback = 'onToggle') {
      place(graphicsTop);
      viewportChange(callback);
    },
    hide(value) {
      document.hidden = value;
      document.dispatch('visibilitychange');
    },
    advance(ms) {
      const end = now + ms;
      while (now < end) {
        now = Math.min(now + 20, end);
        const pending = [...frames.values()];
        frames.clear();
        pending.forEach(callback => callback(now));
      }
    }
  };
}

test('BFN waits for a graphic and keeps playing through the second stacked graphic', () => {
  const page = setup();
  assert.equal(page.playing, false);
  page.view(710);
  page.advance(600);
  assert.equal(page.playing, false, 'heading alone is visible');
  assert.equal(page.timeline.time(), 0);

  page.view(500, 'onRefresh');
  assert.equal(page.playing, true);
  page.advance(600);
  assert.ok(page.timeline.time() > 0);
  page.view(-220);
  assert.equal(page.playing, true, 'only the second graphic is visible');

  page.view(-470);
  assert.equal(page.playing, false, 'only content below the graphics is visible');
  const pausedAt = page.timeline.time();
  page.advance(2000);
  assert.equal(page.timeline.time(), pausedAt);
  page.view(-220);
  page.advance(600);
  assert.ok(page.timeline.time() > pausedAt);
});

test('BFN Play while the graphics are offscreen requests playback on entry', () => {
  const page = setup();
  page.view(710);
  assert.equal(page.play.textContent, page.labels.play);
  page.play.dispatch('click');
  assert.equal(page.playing, false);
  page.advance(600);
  assert.equal(page.timeline.time(), 0);
  page.view(500);
  assert.equal(page.playing, true);
});

test('BFN resumes after background and viewport pauses and preserves manual pause', () => {
  const page = setup();
  page.view(500);
  page.advance(600);
  page.hide(true);
  assert.equal(page.playing, false);
  const pausedAt = page.timeline.time();
  page.advance(2000);
  assert.equal(page.timeline.time(), pausedAt);
  page.hide(false);
  assert.equal(page.playing, true);
  page.hide(true);
  page.view(1110);
  page.hide(false);
  assert.equal(page.playing, false);
  page.view(500);
  assert.equal(page.playing, true);

  page.play.dispatch('click');
  assert.equal(page.playing, false);
  const manuallyPausedAt = page.timeline.time();
  page.hide(true);
  page.view(1110);
  page.view(500);
  page.hide(false);
  page.advance(2000);
  assert.equal(page.timeline.time(), manuallyPausedAt);
  assert.equal(page.play.textContent, page.labels.play);
  page.play.dispatch('click');
  page.advance(600);
  assert.equal(page.playing, true);
  assert.ok(page.timeline.time() > manuallyPausedAt);
});

test('BFN stage jumps select the right hold frame and pause in both languages', () => {
  for (const language of Object.keys(locale)) {
    const page = setup(language);
    page.view(500);
    assert.equal(page.play.textContent, locale[language].pause);
    for (const [scene, mode] of [[4, 'binary'], [0, 'predict'], [2, 'gradient'], [1, 'predict'], [3, 'guided']]) {
      page.buttons[scene].dispatch('click');
      assert.equal(page.scene, scene, language);
      assert.equal(page.mode, mode, language);
      assert.deepEqual(page.captions.map(caption => caption.attributes.get('aria-hidden')),
        page.captions.map((_, index) => String(index !== scene)));
      assert.equal(page.playing, false);
      assert.equal(page.play.textContent, locale[language].play);
      const pausedAt = page.timeline.time();
      page.advance(600);
      assert.equal(page.timeline.time(), pausedAt);
    }
    page.view(1110);
    page.view(500);
    assert.equal(page.playing, false);
  }
});

test('BFN replay resets the first frame immediately and waits for the graphics', () => {
  for (const language of Object.keys(locale)) {
    const page = setup(language);
    page.view(500);
    page.advance(Math.ceil(page.timeline.duration() * 1000) + 100);
    assert.equal(page.scene, 4, language);
    assert.equal(page.playing, false);
    assert.equal(page.play.textContent, locale[language].replay);
    page.view(710);
    page.play.dispatch('click');
    assert.equal(page.timeline.time(), 0);
    assert.equal(page.scene, 0, language);
    assert.equal(page.mode, 'noise', language);
    assert.equal(page.playing, false);
    page.view(500);
    page.advance(600);
    assert.equal(page.play.textContent, locale[language].pause);
    assert.ok(page.timeline.time() > 0);
  }
});
