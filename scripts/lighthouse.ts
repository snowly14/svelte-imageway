import lighthouse from 'lighthouse';
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({
  args: ['--remote-debugging-port=9422', '--remote-debugging-address=127.0.0.1'],
});
try {
  const report = await lighthouse('http://127.0.0.1:4173', {
    port: 9422,
    output: ['html', 'json'],
    logLevel: 'error',
    onlyCategories: ['performance'],
    formFactor: 'mobile',
    screenEmulation: {
      mobile: true,
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      disabled: false,
    },
  });
  if (!report) throw new Error('Lighthouse did not return a report.');
  await writeFile('.local/lighthouse.html', report.report[0]!);
  await writeFile('.local/lighthouse.json', report.report[1]!);
  await writeFile(
    'bench/results/lighthouse.json',
    JSON.stringify(
      {
        lighthouseVersion: report.lhr.lighthouseVersion,
        fetchTime: report.lhr.fetchTime,
        requestedUrl: report.lhr.requestedUrl,
        performance: report.lhr.categories.performance?.score,
        metrics: Object.fromEntries(
          [
            'first-contentful-paint',
            'largest-contentful-paint',
            'cumulative-layout-shift',
            'total-blocking-time',
            'speed-index',
            'lcp-discovery-insight',
            'unsized-images',
            'modern-image-formats',
            'uses-optimized-images',
            'uses-responsive-images',
          ].flatMap((id) => {
            const a = report.lhr.audits[id];
            return a
              ? [
                  [
                    id,
                    {
                      score: a.score,
                      numericValue: a.numericValue,
                      displayValue: a.displayValue,
                      details: a.details,
                    },
                  ],
                ]
              : [];
          }),
        ),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(report.lhr.categories.performance?.score);
} finally {
  await browser.close();
}
