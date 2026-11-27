// Run with: node --test tests/test_physical_rollout_playback.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../assets/js/physical-rollouts.js'), 'utf8');

function setup({ videoFrames = true, hidden = false } = {}) {
  const video = new EventTarget();
  const counter = {};
  const classes = new Set();
  const frames = new Map();
  let nextFrame = 0;
  const requestFrame = callback => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  };
  const cancelFrame = id => frames.delete(id);

  Object.assign(video, {
    paused: true,
    currentTime: 0,
    playCalls: 0,
    loadCalls: 0,
    getAttribute: name => name === 'data-src' ? 'rollout.mp4' : null,
    load() { this.loadCalls++; },
    play() {
      this.paused = false;
      this.playCalls++;
      return this.playResult ?? Promise.resolve();
    },
    pause() {
      if (this.paused) return;
      this.paused = true;
      this.dispatchEvent(new Event('pause'));
    }
  });
  if (videoFrames) {
    video.requestVideoFrameCallback = requestFrame;
    video.cancelVideoFrameCallback = cancelFrame;
  }

  const children = { '.physical-rollout__video': video, '.physical-rollout__counter': counter };
  const attributes = { 'data-frame-count': '8', 'data-frame-ms': '250' };
  const figure = {
    querySelector: selector => children[selector],
    getAttribute: name => attributes[name],
    classList: { add: name => classes.add(name), remove: name => classes.delete(name) }
  };
  const document = new EventTarget();
  document.hidden = hidden;
  document.querySelectorAll = selector => selector === '[data-physical-rollout]' ? [figure] : [];
  let onIntersect;
  const observed = new Set();
  class IntersectionObserver {
    constructor(callback) { onIntersect = callback; }
    observe(element) { observed.add(element); }
  }
  const window = {
    IntersectionObserver,
    requestAnimationFrame: requestFrame,
    cancelAnimationFrame: cancelFrame
  };
  vm.runInNewContext(source, { document, window, IntersectionObserver });

  return {
    video, counter, classes, frames,
    inView(isIntersecting) {
      onIntersect([...observed].map(target => ({ target, isIntersecting })));
    },
    hidden(value) {
      document.hidden = value;
      document.dispatchEvent(new Event('visibilitychange'));
    },
    started() { video.dispatchEvent(new Event('playing')); },
    advance(mediaTime) {
      video.currentTime = mediaTime;
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach(callback => callback(0, { mediaTime }));
    }
  };
}

test('physical rollout loads once on entry and resumes after temporary pauses', async () => {
  const page = setup();
  const { video, counter, classes, frames } = page;
  page.inView(false);
  assert.equal(video.src, undefined);
  assert.equal(video.playCalls, 0);
  assert.equal(counter.hidden, true);

  page.inView(true);
  assert.equal(video.src, 'rollout.mp4');
  assert.equal(video.muted, true);
  assert.equal(video.loadCalls, 1);
  assert.equal(video.playCalls, 1);
  page.started();
  assert.ok(classes.has('is-video'));
  assert.equal(counter.textContent, '01 / 8');
  page.advance(0.75);
  assert.equal(counter.textContent, '04 / 8');
  assert.equal(frames.size, 1);
  await Promise.resolve();

  page.inView(false);
  assert.equal(video.paused, true);
  assert.equal(frames.size, 0);
  assert.equal(counter.hidden, true);
  assert.equal(classes.has('is-video'), false);

  page.hidden(true);
  page.inView(true);
  assert.equal(video.playCalls, 1);
  page.hidden(false);
  assert.equal(video.playCalls, 2);
  assert.equal(video.loadCalls, 1);
  page.started();
  assert.equal(counter.textContent, '04 / 8');
  await Promise.resolve();

  page.hidden(true);
  assert.equal(video.paused, true);
  assert.equal(frames.size, 0);
  page.inView(false);
  page.hidden(false);
  assert.equal(video.playCalls, 2);
});

test('physical rollout retries a play request interrupted by scrolling', async () => {
  const page = setup();
  const { video } = page;
  let rejectPlay;
  video.playResult = new Promise((_, reject) => { rejectPlay = reject; });
  page.inView(true);
  page.inView(false);
  page.inView(true);
  assert.equal(video.playCalls, 1);

  video.playResult = undefined;
  rejectPlay(Object.assign(new Error('Play was interrupted'), { name: 'AbortError' }));
  await Promise.resolve();
  assert.equal(video.playCalls, 2);
  assert.equal(video.loadCalls, 1);
  page.started();
  assert.equal(page.counter.hidden, false);
});

test('physical rollout updates and cancels the animation-frame fallback', () => {
  const page = setup({ videoFrames: false, hidden: true });
  page.inView(true);
  assert.equal(page.video.playCalls, 0);
  page.hidden(false);
  page.started();
  page.advance(2);
  assert.equal(page.counter.textContent, '08 / 8');
  assert.equal(page.frames.size, 1);
  page.hidden(true);
  assert.equal(page.frames.size, 0);
  assert.equal(page.counter.hidden, true);
});
