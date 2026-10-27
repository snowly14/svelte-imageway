import { expect, test } from '@playwright/test';

test('Image and Picture preserve loading/error snippets, callback context and recovery on src changes', async ({
  page,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/lifecycle-missing.png', async (route) => {
    await pending;
    await route.abort();
  });
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('lifecycle').locator('summary').click();
    for (const index of [0, 1])
      await expect(page.getByTestId(`life-loading-${index}`)).toBeVisible();
    release();
    for (const index of [0, 1]) {
      const error = page.getByTestId(`life-error-${index}`);
      await expect(error).toBeVisible();
      expect(await error.evaluate((element) => element.parentElement?.tagName)).not.toBe('PICTURE');
    }
    await page.getByRole('button', { name: 'Use valid lifecycle image' }).click();
    for (const index of [0, 1]) {
      const image = page.getByTestId(`life-image-${index}`);
      await expect
        .poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
        .toBe(true);
      await expect(page.getByTestId(`life-error-${index}`)).toHaveCount(0);
      await expect(page.getByTestId(`life-loading-${index}`)).toHaveCount(0);
      await expect
        .poll(() => image.evaluate((img) => getComputedStyle(img).backgroundImage))
        .toBe('none');
    }
    await expect(page.getByTestId('life-loads')).toHaveText('2');
    await expect(page.getByTestId('life-context')).toHaveText('true');
  } finally {
    release();
  }
});

test('local Image component loads responsive bytes, clears its preview and works without JavaScript', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  expect(await page.getByTestId('hero').evaluate((img) => img.parentElement?.tagName)).not.toBe(
    'PICTURE',
  );
  expect(
    await page.getByTestId('local-image').evaluate((img) => img.parentElement?.tagName),
  ).not.toBe('PICTURE');
  expect(await page.getByTestId('picture').evaluate((img) => img.parentElement?.tagName)).toBe(
    'PICTURE',
  );
  expect(
    await page.getByTestId('local-picture').evaluate((img) => img.parentElement?.tagName),
  ).toBe('PICTURE');
  const image = page.getByTestId('local-image');
  await expect(image).toHaveAttribute('width', '1200');
  await expect(image).toHaveAttribute('loading', 'lazy');
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
    .toBe(true);
  await expect
    .poll(() => image.evaluate((img) => getComputedStyle(img).backgroundImage))
    .toBe('none');
  expect(await image.evaluate((img: HTMLImageElement) => img.currentSrc)).toMatch(/imageway/);
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const plain = await context.newPage();
    await plain.goto('/');
    await expect(plain.getByTestId('local-image')).toBeVisible();
    expect(
      await plain.getByTestId('local-image').evaluate((img: HTMLImageElement) => img.naturalWidth),
    ).toBeGreaterThan(0);
  } finally {
    await context.close();
  }
});

test('native loading, matching preload, dimensions, art direction, events, error and reduced motion', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  const hero = page.getByTestId('hero');
  await expect(hero).toHaveAttribute('loading', 'eager');
  await expect(hero).toHaveAttribute('fetchpriority', 'high');
  await expect(hero).toHaveAttribute('decoding', 'sync');
  await expect
    .poll(() => hero.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
    .toBe(true);
  await expect(page.locator('link[rel="preload"][as="image"]')).toHaveCount(1);
  const preload = page.locator('link[rel="preload"][as="image"]');
  expect(await preload.getAttribute('imagesrcset')).toContain('320w');
  expect(await preload.getAttribute('imagesrcset')).toBe(await hero.getAttribute('srcset'));
  expect(await hero.evaluate((img: HTMLImageElement) => img.currentSrc)).toMatch(/\.webp$/);
  await expect(hero).toHaveAttribute('width', '1200');
  await expect(hero).toHaveAttribute('height', '800');
  expect(await hero.evaluate((img) => getComputedStyle(img).aspectRatio)).toBe('1200 / 800');
  await expect(page.getByTestId('events')).toHaveText('Loads: 1');
  await expect(page.getByRole('status')).toHaveText('Image unavailable');
  expect(
    await page.getByTestId('broken').evaluate((element) => element.parentElement?.tagName),
  ).not.toBe('PICTURE');
  await expect(page.getByTestId('lazy')).toHaveAttribute('loading', 'lazy');
  await expect(page.getByTestId('lazy')).toHaveAttribute('sizes', 'auto, 100vw');
  await expect(page.getByTestId('picture').locator('..').locator('source')).toHaveAttribute(
    'media',
    '(min-width: 640px)',
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await hero.evaluate((img) => getComputedStyle(img).transitionDuration)).toBe('0s');
  for (const id of ['hero', 'local-picture']) {
    expect(
      await page.getByTestId(id).evaluate((img) => {
        img.classList.add('fade');
        return getComputedStyle(img).animationName;
      }),
    ).toBe('none');
  }
  expect(errors).toEqual([]);
});
test('served images have no layout shift and cached navigation remains visible', async ({
  page,
  browserName,
}) => {
  await page.addInitScript(() => {
    Object.assign(window, { imagewayCLS: 0 });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        if (!(entry as PerformanceEntry & { hadRecentInput: boolean }).hadRecentInput)
          (window as unknown as { imagewayCLS: number }).imagewayCLS += (
            entry as PerformanceEntry & { value: number }
          ).value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('/');
  await expect(page.getByTestId('hero')).toBeVisible();
  await page.waitForLoadState('networkidle');
  if (browserName === 'chromium')
    expect(
      await page.evaluate(() => (window as unknown as { imagewayCLS: number }).imagewayCLS),
    ).toBe(0);
  await page.reload();
  await expect(page.getByTestId('hero')).toBeVisible();
  expect(await page.getByTestId('hero').evaluate((img) => getComputedStyle(img).opacity)).toBe('1');
});
test('SSR renders useful images and preloads without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto(baseURL!);
    await expect(page.getByTestId('hero')).toBeVisible();
    expect(
      await page.getByTestId('hero').evaluate((img: HTMLImageElement) => img.naturalWidth),
    ).toBeGreaterThan(0);
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
    await expect(page.locator('link[rel="preload"][as="image"]')).toHaveCount(1);
  } finally {
    await context.close();
  }
});

test('responsive backgrounds follow media queries instead of an inline base image', async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await page.goto('/');
  const background = page.getByTestId('responsive-background');
  await expect(background).toHaveCSS('background-image', /variant\.png/);
  await page.setViewportSize({ width: 400, height: 700 });
  await expect(background).toHaveCSS('background-image', /base\.png/);
});

test('shared image styles remain isolated from ordinary images', async ({ page }) => {
  await page.goto('/');
  const library = page.getByTestId('hero');
  await expect(library).toHaveClass(/imageway-image/);
  const outside = await page.evaluate(() => {
    const image = document.createElement('img');
    image.className = 'ready fade';
    image.style.backgroundColor = 'rgb(255, 0, 0)';
    image.style.backgroundImage = 'linear-gradient(red, red)';
    document.body.append(image);
    const style = getComputedStyle(image);
    const result = {
      color: style.backgroundColor,
      background: style.backgroundImage,
      animation: style.animationName,
    };
    image.remove();
    return result;
  });
  expect(outside.color).toBe('rgb(255, 0, 0)');
  expect(outside.background).toContain('gradient');
  expect(outside.animation).toBe('none');
});
