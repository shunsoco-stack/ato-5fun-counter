import { expect, test } from "@playwright/test";

async function startCounter(page: import("@playwright/test").Page) {
  await page.getByLabel("予定の名前").fill("ポートフォリオを更新する");
  await page.getByRole("button", { name: "カウンターを準備する" }).click();
  await expect(page.getByRole("button", { name: "予定を5分延期する" })).toBeFocused();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: /その「あと5分」/ })).toBeVisible();
});

test("5分・30分・60分・180分のメッセージと集計が変化する", async ({ page }) => {
  await startCounter(page);
  const postpone = page.getByRole("button", { name: "予定を5分延期する" });

  await postpone.click();
  await expect(page.getByRole("heading", { name: "まだ誤差です" })).toBeVisible();
  await expect(page.getByText("5分", { exact: true }).first()).toBeVisible();

  for (let count = 0; count < 5; count += 1) await postpone.click();
  await expect(page.getByRole("heading", { name: "そろそろ始めませんか？" })).toBeVisible();
  await expect(page.getByText("30分", { exact: true }).first()).toBeVisible();

  for (let count = 0; count < 6; count += 1) await postpone.click();
  await expect(page.getByRole("heading", { name: "もう別日にしません？" })).toBeVisible();

  for (let count = 0; count < 24; count += 1) await postpone.click();
  await expect(page.getByRole("heading", { name: "予定は完全に崩壊しました" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "予定の崩壊度" })).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
});

test("キーボード延期、1回戻す、再読込後の復元ができる", async ({ page }) => {
  await startCounter(page);
  const postpone = page.getByRole("button", { name: "予定を5分延期する" });

  await postpone.press("Space");
  await expect(page.getByText("1回", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "1回戻す" }).click();
  await expect(page.getByText("0回", { exact: true })).toBeVisible();
  await postpone.click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "まだ誤差です" })).toBeVisible();
  await expect(page.getByText("ポートフォリオを更新する", { exact: true })).toBeVisible();
});

test("リセットで履歴を残し、テーマを切り替えられる", async ({ page }) => {
  await startCounter(page);
  await page.getByRole("button", { name: "予定を5分延期する" }).click();
  await page.getByRole("button", { name: "リセット" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "終了して記録する" }).click();

  await expect(page.getByRole("heading", { name: /その「あと5分」/ })).toBeVisible();
  await expect(page.getByText("ポートフォリオを更新する", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "ライトモードとダークモードを切り替える" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("PWAメタデータと主要SEOメタデータを配信する", async ({ page, request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  expect((await manifest.json()).name).toBe("あと5分カウンター");

  const serviceWorker = await request.get("/sw.js");
  expect(serviceWorker.ok()).toBeTruthy();
  await expect(page).toHaveTitle("あと5分カウンター");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /先延ばしカウンター/,
  );
});
