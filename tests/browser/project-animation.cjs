const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { chromium } = require('playwright');

const baseUrl = process.env.PROJECT_ANIMATION_URL || 'http://127.0.0.1:4000/';
const channel = process.env.PROJECT_ANIMATION_BROWSER_CHANNEL;
const languages = ['en', 'zh'];
let browser;

before(async () => {
  browser = await chromium.launch({ channel });
});
after(async () => {
  await browser?.close();
});

async function visit(t, slug, lang, options) {
  const page = await browser.newPage(options);
  t.after(() => page.close());
  page.setDefaultTimeout(8_000);
  page.setDefaultNavigationTimeout(30_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, [], 'Uncaught page errors'));
  const prefix = lang === 'zh' ? 'zh/' : '';
  const url = new URL(`${prefix}research/${slug}/`, baseUrl.replace(/\/?$/, '/'));
  const response = await page.goto(url.href, { waitUntil: 'load' });
  assert.ok(response?.ok(), `${url.href} returned ${response?.status()}`);
  await page.evaluate(async () => {
    await window.MathJax?.startup?.promise;
    await document.fonts.ready;
  });
  assert.match(await page.locator('html').getAttribute('lang'), lang === 'zh' ? /^zh\b/ : /^en\b/);
  return page;
}

function center(locator) {
  return locator.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
}

function scrollToTop(page) {
  return page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
}

function renderFrames(page) {
  return page.evaluate(async () => {
    for (let i = 0; i < 4; i++) await new Promise(resolve => requestAnimationFrame(resolve));
  });
}

// Headless Chromium does not reliably background tabs on focus changes. Drive the
// same document visibility contract while leaving real GSAP and scrolling in use.
function setHidden(page, hidden) {
  return page.evaluate(value => {
    for (const [property, snapshot] of [['hidden', value], ['visibilityState', value ? 'hidden' : 'visible']]) {
      Object.defineProperty(document, property, { configurable: true, value: snapshot });
    }
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

const mask = {
  root: '[data-mask-flow]',
  play: '.mask-flow__play',
  field: '[data-mask-field]',
  overlay: '[data-mask-overlay]',
  mode: '[data-mask-mode]',
};

function maskLayout(root) {
  return root.evaluate(element => {
    const boxes = ['.mask-flow__header', '.mask-flow__play', '[data-mask-field]', '[data-mask-overlay]', '[aria-current=step]'];
    const [header, play, field, overlay, step] = boxes.map(selector => element.querySelector(selector).getBoundingClientRect().toJSON());
    return {
      header, play, field, overlay, step, root: element.getBoundingClientRect().toJSON(),
      height: window.innerHeight, width: document.documentElement.clientWidth,
      overflow: element.scrollWidth - element.clientWidth,
    };
  });
}

function assertMaskLayout(layout, stacked) {
  const { field, overlay, play, step } = layout;
  for (const [name, box] of Object.entries({ field, overlay, play, step })) {
    assert.ok(box.width > 0 && box.height > 0, `${name} is rendered`);
    assert.ok(box.left >= -1 && box.right <= layout.width + 1, `${name} fits horizontally`);
  }
  assert.ok(layout.overflow <= 1, 'BFN animation does not cause horizontal overflow');
  if (stacked) {
    assert.ok(field.bottom <= overlay.top, 'the two diagrams stack on mobile');
  } else {
    assert.ok(field.right <= overlay.left && field.top < overlay.bottom && overlay.top < field.bottom,
      'the two diagrams are side by side above the breakpoint');
  }
}

for (const lang of languages) {
  test(`BFN ${lang} mobile viewport, stage controls, visibility and replay`, { timeout: 90_000 }, async t => {
    const page = await visit(t, 'incomplete-learning', lang, {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: 'reduce',
    });
    const root = page.locator(mask.root);
    const play = root.locator(mask.play);
    const field = root.locator(mask.field);
    const overlay = root.locator(mask.overlay);
    const labels = await root.locator('[data-mask-labels]').evaluate(element => JSON.parse(element.textContent));
    await root.locator('[data-mask-interactive]').waitFor();
    const state = playing => page.waitForFunction(({ selector, playing }) =>
      document.querySelector(selector).dataset.playing === String(playing), { selector: mask.play, playing });
    const mode = () => root.locator(mask.mode).textContent();
    const waitForMode = label => page.waitForFunction(({ selector, label }) =>
      document.querySelector(selector).textContent === label, { selector: mask.mode, label });
    const displayGeometry = () => field.evaluate(element => {
      window.scrollBy({ top: element.getBoundingClientRect().top - innerHeight * 0.63, behavior: 'instant' });
    });
    const displayControls = () => overlay.evaluate(element => {
      window.scrollBy({ top: element.getBoundingClientRect().bottom - innerHeight * 0.5, behavior: 'instant' });
    });
    const firstPicture = () => field.locator('rect[fill]').evaluateAll(tiles => tiles.map(tile => tile.getAttribute('fill')));

    await state(false);
    assertMaskLayout(await maskLayout(root), true);
    const initial = await firstPicture();
    assert.ok(initial.length > 0, 'D3 populated the field SVG');
    assert.equal(await mode(), labels.noise);
    await root.locator('.mask-flow__header').evaluate(element => {
      window.scrollBy({ top: element.getBoundingClientRect().bottom - innerHeight + 8, behavior: 'instant' });
    });
    await renderFrames(page);
    let layout = await maskLayout(root);
    assert.ok(layout.header.bottom > 0 && layout.header.bottom < layout.height, 'the heading is in view');
    assert.ok(layout.play.top >= layout.height, 'the play control follows the diagrams');
    assert.ok(layout.field.top >= layout.height && layout.overlay.top >= layout.height, 'both diagrams remain below the fold');
    assert.equal(await play.getAttribute('data-playing'), 'false', 'the heading alone must not start autoplay');
    assert.deepEqual(await firstPicture(), initial);

    await displayGeometry();
    await state(true);
    assert.equal(await play.textContent(), labels.pause);
    await waitForMode(labels.predict);
    assert.notDeepEqual(await firstPicture(), initial, 'autoplay changes the displayed field');

    await center(overlay);
    await state(true);
    await overlay.evaluate(element => {
      window.scrollBy({ top: element.getBoundingClientRect().bottom + 12, behavior: 'instant' });
    });
    await state(false);
    layout = await maskLayout(root);
    assert.ok(layout.overlay.bottom <= 0 && layout.root.bottom > 0,
      'both diagrams are offscreen while the section is still in view');
    const offscreenFrame = await firstPicture();
    await renderFrames(page);
    assert.equal(await play.getAttribute('data-playing'), 'false', 'playback stays paused below both diagrams');
    assert.deepEqual(await firstPicture(), offscreenFrame, 'the displayed frame stays fixed offscreen');

    await displayGeometry();
    await state(true);
    await setHidden(page, true);
    await state(false);
    const backgroundFrame = await firstPicture();
    await renderFrames(page);
    assert.deepEqual(await firstPicture(), backgroundFrame);
    await setHidden(page, false);
    await state(true);

    await displayControls();
    await play.tap();
    await state(false);
    const pausedFrame = await firstPicture();
    await scrollToTop(page);
    await renderFrames(page);
    await displayGeometry();
    await setHidden(page, true);
    await setHidden(page, false);
    await renderFrames(page);
    assert.equal(await play.getAttribute('data-playing'), 'false', 'manual pause survives re-entry and foregrounding');
    assert.deepEqual(await firstPicture(), pausedFrame);

    const scenes = root.locator('[data-mask-scene]');
    const expectedModes = [labels.predict, labels.predict, labels.gradient, labels.guided, labels.binary];
    assert.equal(await scenes.count(), expectedModes.length);
    for (const [scene, expectedMode] of expectedModes.entries()) {
      await scenes.nth(scene).tap();
      await state(false);
      assert.equal(await root.locator('[aria-current=step]').getAttribute('data-mask-scene'), String(scene));
      assert.equal(await root.locator('.mask-flow__caption p[aria-hidden=false]').count(), 1);
      assert.equal(await mode(), expectedMode);
    }

    await displayControls();
    await play.tap();
    await state(true);
    await page.waitForFunction(({ selector, label }) => document.querySelector(selector).textContent === label,
      { selector: mask.play, label: labels.replay });
    await state(false);
    await play.tap();
    await state(true);
    assert.equal(await root.locator('[aria-current=step]').getAttribute('data-mask-scene'), '0');
    assert.equal(await mode(), labels.noise);
    assert.deepEqual(await firstPicture(), initial, 'replay renders the initial diagram immediately');
  });

  test(`BFN ${lang} switches layout at the 680px breakpoint`, { timeout: 60_000 }, async t => {
    const page = await visit(t, 'incomplete-learning', lang, { viewport: { width: 680, height: 844 } });
    const root = page.locator(mask.root);
    await root.locator('[data-mask-interactive]').waitFor();
    assertMaskLayout(await maskLayout(root), true);
    await page.setViewportSize({ width: 681, height: 844 });
    await renderFrames(page);
    assertMaskLayout(await maskLayout(root), false);
    await page.setViewportSize({ width: 1440, height: 900 });
    await renderFrames(page);
    assertMaskLayout(await maskLayout(root), false);
    await center(root.locator(mask.field));
    await page.waitForFunction(selector => document.querySelector(selector).dataset.playing === 'true', mask.play);
    await scrollToTop(page);
    await page.waitForFunction(selector => document.querySelector(selector).dataset.playing === 'false', mask.play);
  });
}

const walkthroughs = [
  {
    slug: 'protein-control', root: '[data-protein-training]', diagram: '.protein-training__views',
    play: '[data-training-play]', progress: '[data-training-progress]',
    step: 'data-training-jump', playingAttribute: 'data-training-playing', values: ['pretrain', 'adapt'],
  },
  {
    slug: 'incomplete-learning', root: '[data-idcd-animate]', diagram: '.idcd-stage-viewport',
    play: '[data-idcd-play]', progress: '[data-idcd-progress]',
    step: 'data-idcd-jump', values: ['0', '4'],
  },
  {
    slug: 'retro', root: '[data-retro-training]', diagram: '.rt-screen',
    play: '[data-rt-play]', progress: '#rt-progress',
    step: 'data-rt-step', values: ['0', '4'],
  },
];

for (const lang of languages) {
  for (const animation of walkthroughs) {
    test(`${animation.slug} ${lang} walkthrough playback`, { timeout: 75_000 }, async t => {
      const page = await visit(t, animation.slug, lang, {
        viewport: { width: 390, height: 844 },
        reducedMotion: 'reduce',
      });
      const root = page.locator(animation.root);
      const diagram = root.locator(animation.diagram);
      const play = root.locator(animation.play);
      const progress = root.locator(animation.progress);
      await play.waitFor();
      await scrollToTop(page);
      const state = playing => page.waitForFunction(({ config, playing }) => {
        const element = document.querySelector(config.root);
        const running = config.playingAttribute ? element.hasAttribute(config.playingAttribute) :
          element.querySelector(config.play).getAttribute('aria-pressed') === 'true';
        return running === playing;
      }, { config: animation, playing });
      const value = () => progress.evaluate(element => Number(element.value));
      async function activate() {
        // The sibling tests exercise real touch targets. Dispatch directly here so
        // Playwright does not scroll a below-diagram toolbar into view by itself.
        await play.evaluate(element => element.click());
      }

      await state(false);
      assert.equal(await value(), 0);
      await center(diagram);
      await state(true);
      await page.waitForFunction(selector => Number(document.querySelector(selector).value) > 0, animation.progress);

      await scrollToTop(page);
      await state(false);
      const offscreen = await value();
      await renderFrames(page);
      assert.equal(await value(), offscreen);
      await center(diagram);
      await state(true);

      await setHidden(page, true);
      await state(false);
      const background = await value();
      await renderFrames(page);
      assert.equal(await value(), background);
      await setHidden(page, false);
      await state(true);

      await activate();
      await state(false);
      const paused = await value();
      await scrollToTop(page);
      await renderFrames(page);
      await center(diagram);
      await setHidden(page, true);
      await setHidden(page, false);
      await renderFrames(page);
      assert.equal(await value(), paused);

      const jump = root.locator(`[${animation.step}="${animation.values[1]}"]`);
      await jump.evaluate(element => element.click());
      await page.waitForFunction(({ selector, step, last }) =>
        document.querySelector(selector).querySelector(`[aria-current=step][${step}="${last}"]`) !== null,
      { selector: animation.root, step: animation.step, last: animation.values[1] });
      await state(false);

      await progress.evaluate(element => {
        element.value = element.max;
        element.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await activate();
      await state(true);
      await page.waitForFunction(config => {
        const element = document.querySelector(config.root);
        const progress = element.querySelector(config.progress);
        return element.querySelector(`[aria-current=step][${config.step}="${config.values[0]}"]`) &&
          Number(progress.value) < Number(progress.max) * 0.05;
      }, animation);
    });
  }
}
