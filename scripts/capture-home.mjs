import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const edgePath =
  process.env.EDGE_PATH ??
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const targetUrl = process.env.CAPTURE_URL ?? "http://127.0.0.1:5173/";
const outputDir = fileURLToPath(new URL("../artifacts/homepage/", import.meta.url));

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: edgePath,
  headless: true,
});

async function capture(
  name,
  viewport,
  theme = "light",
  menuOpen = false,
  fullPage = true,
) {
  const page = await browser.newPage({
    viewport,
    deviceScaleFactor: 1,
    colorScheme: theme,
  });
  await page.addInitScript((selectedTheme) => {
    localStorage.setItem("quanhezi-theme", selectedTheme);
  }, theme);
  await page.goto(targetUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  if (menuOpen) {
    await page.getByRole("button", { name: "打开导航菜单" }).click();
  }
  await page.waitForTimeout(250);
  await page.screenshot({
    path: `${outputDir}${name}.png`,
    fullPage,
  });
  await page.close();
}

await capture("desktop-light", { width: 1440, height: 1000 });
await capture("desktop-dark", { width: 1440, height: 1000 }, "dark");
await capture("desktop-light-top", { width: 1440, height: 900 }, "light", false, false);
await capture("desktop-dark-top", { width: 1440, height: 900 }, "dark", false, false);
await capture("mobile-light", { width: 390, height: 844 });
await capture("mobile-menu", { width: 390, height: 844 }, "light", true);

await browser.close();
console.log(`Homepage screenshots written to ${outputDir}`);
