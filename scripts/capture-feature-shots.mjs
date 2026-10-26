import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const edgePath =
  process.env.EDGE_PATH ??
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const targetUrl = process.env.CAPTURE_URL ?? "https://geo-wsr.github.io/";
const outputDir = fileURLToPath(
  new URL("../artifacts/feature-shots/", import.meta.url),
);

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: edgePath,
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 1600, height: 1100 },
  deviceScaleFactor: 1,
});

await page.goto(targetUrl, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(350);

async function capture(locator, filename) {
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(220);
  await locator.screenshot({ path: `${outputDir}${filename}` });
}

await capture(page.locator(".workspace"), "01-single-center.png");

await page.getByRole("button", { name: /交通线影响/ }).click();
await page.waitForTimeout(350);
const actualRent = page.getByRole("button", { name: "实际地租" });
if ((await actualRent.getAttribute("aria-pressed")) === "false") {
  await actualRent.click();
}
await page.locator(".road-hit").first().hover({ force: true });
await capture(page.locator(".visual-pair"), "02-transport-corridor.png");

await page.getByRole("button", { name: /双城竞争/ }).click();
await page.waitForTimeout(350);
await page.locator(".chart-card .select-control select").selectOption({
  label: "河西市场",
});
await page.waitForTimeout(180);
await capture(page.locator(".visual-pair"), "03-two-city-competition.png");

await page.getByRole("button", { name: /单中心基础/ }).click();
await page.waitForTimeout(300);
await page.locator(".legend-item").first().click();
await page.waitForTimeout(180);
await capture(page.locator(".map-card"), "04-inline-crop-editor.png");

await capture(page.locator(".intensity-card"), "05-intensity-lab.png");

await browser.close();
console.log(`Feature screenshots written to ${outputDir}`);
