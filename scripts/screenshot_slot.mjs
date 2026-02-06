import { chromium } from 'playwright';

const url = 'file://' + process.cwd() + '/dist/index.html';
const out = process.cwd() + '/dist/pokeslot-preview.png';

const browser = await chromium.launch({
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
await page.goto(url, { waitUntil: 'load' });

// Scroll to slot section
await page.evaluate(() => {
  const el = document.querySelector('[data-pokeslot]');
  el?.scrollIntoView({ block: 'center' });
});
await page.waitForTimeout(200);

// Click lever to start spin
await page.click('[data-lever]');
await page.waitForTimeout(850);

// Screenshot the slot area
const slot = await page.$('[data-pokeslot]');
await slot.screenshot({ path: out });

await browser.close();
console.log(out);
