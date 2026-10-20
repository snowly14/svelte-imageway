import { test, expect } from '@playwright/test';
const enabled = process.env.IMAGEWAY_SERVICE_E2E === 'true';
for (const [service, port, key] of [
  ['worker', 8787, 'images/landscape.png'],
  ['docker', 8788, 'source.png'],
] as const) {
  test(`${service}: real image format/cache/security through HTTP`, async ({ request }) => {
    test.skip(!enabled, 'Start local Wrangler and Docker, then set IMAGEWAY_SERVICE_E2E=true.');
    const url = `http://127.0.0.1:${port}/_img/v1?key=${key}&preset=card&w=640&format=webp`;
    const image = await request.get(url);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toBe('image/webp');
    const bytes = await image.body();
    expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
    await expect
      .poll(async () => (await request.get(url)).headers()['x-imageway-cache'])
      .toBe('HIT');
    expect(
      (await request.get(url, { headers: { 'If-None-Match': image.headers()['etag']! } })).status(),
    ).toBe(304);
    await expect((await request.head(url)).body()).resolves.toHaveLength(0);
    expect(
      (await request.get(`http://127.0.0.1:${port}/_img/v1?key=..%2Fsecret&preset=card`)).status(),
    ).toBeGreaterThanOrEqual(400);
    expect(
      (
        await request.get(
          `http://127.0.0.1:${port}/_img/v1?url=https%3A%2F%2F169.254.169.254%2Flatest&preset=card`,
        )
      ).status(),
    ).toBe(403);
    expect((await request.get(`http://127.0.0.1:${port}/metrics`)).status()).toBe(403);
  });
}
