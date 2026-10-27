// Run with: node --test tests/test_retro_playback.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../assets/js/retro-pipeline.js'), 'utf8');
const dataSource = fs.readFileSync(path.join(__dirname, '../assets/js/retro-training-data.js'), 'utf8');

// Exercise the production playback controller with a deterministic frame clock.
// Molecular drawing and responsive layout are verified in the browser.
class Element {
  constructor() {
    this.dataset = {};
    this.attributes = {};
    this.children = new Map();
    this.groups = new Map();
    this.listeners = {};
    this.style = { setProperty() {} };
    this.classes = new Set();
    this.classList = {
      add: name => this.classes.add(name),
      remove: name => this.classes.delete(name),
      toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name)
    };
  }
  querySelector(selector) {
    if (!this.children.has(selector)) this.children.set(selector, new Element());
    return this.children.get(selector);
  }
  querySelectorAll(selector) { return this.groups.get(selector) || []; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  dispatchEvent(event) { this.listeners[event.type]?.(event); }
  click() { this.listeners.click(); }
}

function setup({ reduced = false, legacy = false, viewportHeight = 600, top = 900, stageHeight = 600 } = {}) {
  const figure = new Element();
  figure.dataset.language = 'en';
  figure.groups.set('[data-rt-scene]', Array.from({ length: 5 }, () => new Element()));
  figure.groups.set('[data-rt-step]', Array.from({ length: 5 }, () => new Element()));
  const probability = new Element(), sample = new Element();
  probability.dataset.rtField = 'probability'; sample.dataset.rtField = 'sample';
  figure.groups.set('[data-rt-field]', [probability, sample]);
  const screen = figure.querySelector('.rt-screen');
  let screenTop = top;
  screen.getBoundingClientRect = () => ({ top: screenTop, bottom: screenTop + stageHeight, height: stageHeight, width: 1000, left: 0, right: 1000 });
  const document = new Element();
  document.hidden = false;
  document.documentElement = { clientHeight: viewportHeight, clientWidth: 1200 };
  document.children.set('[data-retro-training]', figure);
  const motion = { matches: reduced };
  let motionListener;
  if (legacy) motion.addListener = listener => { motionListener = listener; };
  else motion.addEventListener = (_, listener) => { motionListener = listener; };
  const window = new Element();
  window.matchMedia = () => motion;
  let nextFrame = 0, clock = 1;
  const frames = new Map();
  const context = vm.createContext({
    document, window,
    requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: id => frames.delete(id),
    CustomEvent: class { constructor(type) { this.type = type; } }
  });
  vm.runInContext(dataSource, context);
  vm.runInContext(source, context);
  function advance(ms = 0) {
    clock += ms;
    const pending = [...frames.entries()];
    pending.forEach(([id]) => frames.delete(id));
    pending.forEach(([, callback]) => callback(clock));
  }
  return {
    figure, probability, sample, document,
    play: figure.querySelector('[data-rt-play]'),
    note: figure.querySelector('[data-rt-motion-note]'),
    slider: figure.querySelector('#rt-progress'),
    advance,
    scroll(nextTop) { screenTop = nextTop; window.listeners.scroll(); advance(); },
    motion(value) { motion.matches = value; motionListener(); },
    hidden(value) { document.hidden = value; document.listeners.visibilitychange(); }
  };
}

const playing = page => page.play.attributes['aria-pressed'] === 'true';

test('autoplay starts between old ratio thresholds, even in a short viewport', () => {
  const page = setup({ viewportHeight: 300 });
  assert.equal(playing(page), false);
  page.scroll(145); // 155px visible: ratio .258, below the former 240px trigger.
  assert.equal(playing(page), true);
  page.advance(); page.advance(1000);
  assert.ok(page.slider.value > 0);
});

test('reduced motion stays static until explicit play, then animates interpolation and arrows', () => {
  const page = setup({ reduced: true, top: 0 });
  assert.equal(playing(page), false);
  assert.equal(page.note.hidden, false);
  page.play.click(); page.advance(); page.advance(14900);
  assert.equal(page.note.hidden, true);
  assert.ok(page.figure.classes.has('has-user-motion'));
  assert.ok(Number(page.probability.dataset.time) > 0);
  assert.ok(Number(page.probability.dataset.time) < 0.45);
  page.advance(7000);
  const progress = Number(page.sample.querySelector('[data-rt-denoise-links]').dataset.progress);
  assert.ok(progress > 0 && progress < 1);
  page.advance(5000);
  assert.equal(playing(page), false); // One full pass, without an unsolicited loop.
  assert.equal(page.slider.value, 1000);
});

test('visibility pauses and resumes playback, but preserves a manual pause', () => {
  const page = setup({ top: 0 });
  page.advance(); page.advance(1000);
  page.scroll(900);
  assert.equal(playing(page), false);
  const pausedAt = page.slider.value;
  page.advance(5000);
  assert.equal(page.slider.value, pausedAt);
  page.scroll(0);
  assert.equal(playing(page), true);
  page.hidden(true); assert.equal(playing(page), false);
  page.hidden(false); assert.equal(playing(page), true);
  page.play.click(); page.scroll(900); page.scroll(0);
  assert.equal(playing(page), false);
});

test('normal playback loops and preference changes revoke the manual override', () => {
  const page = setup({ top: 0 });
  page.advance(); page.advance(30000); page.advance(1300);
  assert.equal(playing(page), true);
  assert.equal(page.slider.value, 0);
  page.motion(true);
  assert.equal(playing(page), false);
  page.play.click(); assert.equal(playing(page), true);
  page.motion(false); page.motion(true);
  assert.equal(playing(page), false);
  assert.equal(page.figure.classes.has('has-user-motion'), false);
});

test('legacy media-query listeners still initialize and handle preference changes', () => {
  const page = setup({ legacy: true, reduced: true, top: 0 });
  assert.ok(page.figure.classes.has('is-ready'));
  page.motion(false);
  assert.equal(playing(page), true);
});
