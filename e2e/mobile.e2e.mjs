// בדיקת e2e במובייל (375px, מגע): יצירת שולחן, דיאלוגים שלא מוציאים מהשולחן, אישור יציאת מארח, 3 בוטים והתחלת משחק.
// הרצה: npm run e2e   (בונה את הלקוח, מרים שרת במצב פיתוח על פורט אקראי, ומריץ Chromium)
import { chromium, devices } from 'playwright-core';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('..', import.meta.url));
const PORT = 5900 + Math.floor(Math.random() * 90);
const base = `http://localhost:${PORT}`;
const chromePath = process.env.CHROME_PATH
  || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find(existsSync);

const srv = spawn('npx', ['tsx', 'server/src/main.ts'], {
  cwd: root, stdio: 'ignore', detached: true,
  env: { ...process.env, PORT: String(PORT), BOT_DELAY_MS: '200,300', TURN_MS: '30000', WAIT_GRACE_MS: '1500' },
});
const browser = await chromium.launch({ executablePath: chromePath, args: ['--no-sandbox'] });
const step = (m) => console.log('•', m);
let failed = false;
try {
  for (let i = 0; i < 40; i++) { try { if ((await fetch(`${base}/health`)).ok) break; } catch { /* */ } await new Promise((r) => setTimeout(r, 500)); }
  const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  const path = () => new URL(p.url()).pathname;
  const onTable = () => path().startsWith('/table/');

  await p.goto(`${base}/?name=Mobile1`);
  await p.waitForSelector('text=שולחנות פתוחים', { timeout: 30000 });

  step('פתיחה וסגירה של דיאלוג "שולחן חדש" בלובי');
  await p.locator('text=+ שולחן חדש').tap();
  await p.locator('button:has-text("ביטול")').tap();
  assert.equal(path(), '/lobby');

  step('יצירת שולחן');
  await p.locator('text=+ שולחן חדש').tap();
  await p.locator('button:has-text("צור שולחן")').tap();
  await p.waitForSelector('button:has-text("הוסף מחשב")', { timeout: 15000 });
  assert.ok(onTable(), 'אחרי יצירה צריך להיות בדף השולחן');

  step('פתיחה וסגירה של תפריט בחדר ההמתנה לא מוציאה מהשולחן');
  await p.locator('button[aria-label="תפריט"]').tap();
  await p.waitForSelector('[role="menu"]');
  await p.locator('button[aria-label="תפריט"]').tap();
  await p.waitForTimeout(1500);
  assert.ok(onTable(), 'סגירת תפריט הוציאה מהשולחן');

  step('חזרה כמארח יחיד: מבקשים אישור "לצאת ולסגור את השולחן?" ובביטול נשארים');
  await p.locator('button[aria-label="חזרה"]').tap();
  await p.waitForSelector('text=לצאת ולסגור את השולחן?', { timeout: 5000 });
  await p.locator('button:has-text("להישאר")').tap();
  await p.waitForTimeout(1500);
  assert.ok(onTable(), 'ביטול האישור הוציא מהשולחן');
  assert.equal(await p.locator('text=לצאת ולסגור את השולחן?').count(), 0);

  step('הוספת 3 בוטים');
  for (let i = 0; i < 3; i++) {
    await p.locator('button:has-text("הוסף מחשב")').first().tap();
    await p.waitForTimeout(250);
  }
  await p.waitForFunction(() => document.querySelectorAll('button').length > 0 && ![...document.querySelectorAll('button')].some((b) => b.textContent.includes('הוסף מחשב')), null, { timeout: 10000 });

  step('התחלת משחק');
  await p.locator('button:has-text("התחל")').first().tap();
  await p.waitForFunction(() => ![...document.querySelectorAll('button')].some((b) => b.textContent.includes('התחל משחק') || b.textContent.trim() === 'התחל'), null, { timeout: 15000 });
  await p.waitForTimeout(2500);
  assert.ok(onTable(), 'המשחק התחיל אבל הדף עזב את השולחן');

  assert.deepEqual(errors, [], 'שגיאות JS בדף');
  console.log('PASS');
} catch (e) {
  failed = true;
  console.error('FAIL:', e?.message ?? e);
} finally {
  await browser.close();
  try { process.kill(-srv.pid); } catch { /* */ }
}
process.exit(failed ? 1 : 0);
