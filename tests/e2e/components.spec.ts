import { expect, test } from '@playwright/test';

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
  expect(await preload.getAttribute('type')).toBe('image/avif');
  await expect(hero).toHaveAttribute('width', '960');
  await expect(hero).toHaveAttribute('height', '640');
  expect(await hero.evaluate((img) => getComputedStyle(img).aspectRatio)).toBe('960 / 640');
  await expect(page.getByTestId('events')).toHaveText('Loads: 1');
  await expect(page.getByRole('status')).toHaveText('Image unavailable');
  await expect(page.getByTestId('lazy')).toHaveAttribute('loading', 'lazy');
  await expect(page.getByTestId('lazy')).toHaveAttribute('sizes', 'auto, 100vw');
  await expect(page.getByTestId('picture').locator('..').locator('source')).toHaveAttribute(
    'media',
    '(min-width: 640px)',
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await hero.evaluate((img) => getComputedStyle(img).transitionDuration)).toBe('0s');
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
test('SSR renders useful images and preloads without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto('http://127.0.0.1:4173');
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
