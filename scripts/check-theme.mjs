import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const edgePath =
  process.env.EDGE_PATH ??
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const baseUrl = process.env.CAPTURE_URL ?? "http://127.0.0.1:5173/";
const outputDir = fileURLToPath(
  new URL("../artifacts/theme-check/", import.meta.url),
);

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: edgePath,
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
await page.addInitScript(() => {
  localStorage.setItem("quanhezi-theme", "dark");
});

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(250);

const removedCopyVisible = await page
  .getByText("先选一个问题，再改变条件。")
  .isVisible()
  .catch(() => false);
if (removedCopyVisible) {
  throw new Error("Removed homepage section is still visible.");
}

await page.screenshot({
  path: `${outputDir}home-dark.png`,
  fullPage: true,
});

await page.getByRole("button", { name: "进入实验室" }).click();
await page.waitForTimeout(500);
const labTheme = await page.evaluate(
  () => document.documentElement.dataset.theme,
);
if (labTheme !== "dark") {
  throw new Error(`Expected lab theme dark, received ${labTheme}.`);
}

await page.screenshot({
  path: `${outputDir}lab-dark.png`,
  fullPage: true,
});

await page.getByRole("button", { name: "切换到浅色主题" }).click();
await page.waitForTimeout(300);
const toggledTheme = await page.evaluate(
  () => document.documentElement.dataset.theme,
);
if (toggledTheme !== "light") {
  throw new Error(`Theme toggle failed: ${toggledTheme}.`);
}

await page.screenshot({
  path: `${outputDir}lab-light.png`,
  fullPage: true,
});

await browser.close();
console.log(
  "Theme continuity verified: homepage dark -> lab dark -> lab light.",
);
