import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(scriptDirectory, "..");
const outputDirectory = join(projectRoot, "public", "screenshots");
const baseUrl =
  process.argv[2] ??
  process.env.PLAYWRIGHT_BASE_URL ??
  "http://127.0.0.1:3000";

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  locale: "ja-JP",
  timezoneId: "Asia/Tokyo",
  colorScheme: "light",
  reducedMotion: "reduce",
});
const page = await context.newPage();

async function openClean() {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /その「あと5分」/ }).waitFor();
}

async function startCounter() {
  await page.getByLabel("予定の名前").fill("ポートフォリオを更新する");
  await page.getByRole("button", { name: "カウンターを準備する" }).click();
  await page.getByRole("button", { name: "予定を5分延期する" }).waitFor();
}

async function postpone(times) {
  const button = page.getByRole("button", { name: "予定を5分延期する" });
  for (let count = 0; count < times; count += 1) await button.click();
}

async function capture(fileName) {
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: join(outputDirectory, fileName),
    fullPage: true,
    animations: "disabled",
  });
  console.log(`Captured ${fileName} from ${baseUrl}`);
}

try {
  await openClean();
  await capture("01-initial.png");

  await startCounter();
  await postpone(1);
  await capture("02-five-minutes.png");

  await postpone(5);
  await capture("03-thirty-minutes.png");

  await postpone(30);
  await capture("04-collapsed.png");

  await openClean();
  await startCounter();
  await postpone(12);
  await page
    .getByRole("button", { name: "ライトモードとダークモードを切り替える" })
    .click();
  await capture("05-dark-mode.png");
} finally {
  await browser.close();
}
