import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const edgePath =
  process.env.EDGE_PATH ??
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const baseUrl = process.env.SMOKE_URL ?? "http://127.0.0.1:5173/";
const artifacts = fileURLToPath(new URL("../artifacts/", import.meta.url));

await mkdir(artifacts, { recursive: true });

const browser = await chromium.launch({
  executablePath: edgePath,
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
await page.emulateMedia({ colorScheme: "light" });

const failures = [];
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function waitForHome() {
  await page.locator(".qh-home").waitFor();
  await page.waitForFunction(() => location.hash === "#home");
}

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.locator(".qh-home").waitFor();

const cards = page.locator(".qh-featured-experiment");
assert((await cards.count()) === 3, "首页没有三个平级实验室入口");
const cardData = await cards.evaluateAll((elements) =>
  elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return {
      href: element.getAttribute("href"),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      copyOverflow:
        element.querySelector(".qh-featured-copy").scrollHeight >
        element.querySelector(".qh-featured-copy").clientHeight + 1,
    };
  }),
);
assert(
  cardData.map((card) => card.href).join(",") ===
    "#von-thunen,#dijkstra,#atmosphere",
  "实验室卡片的入口顺序或地址不正确",
);
assert(
  new Set(cardData.map((card) => card.width)).size === 1 &&
    new Set(cardData.map((card) => card.height)).size === 1 &&
    cardData.every((card) => !card.copyOverflow),
  "桌面端三个实验室卡片没有保持同宽同高，或卡片内容溢出",
);

const heroSlides = page.locator(".qh-carousel-progress button");
assert(
  (await heroSlides.count()) === 3,
  "主视觉轮播没有覆盖三个实验室",
);
for (const [index, expected] of [
  [0, "实验室 / 杜能环"],
  [1, "实验室 / Dijkstra"],
  [2, "实验室 / 大气受力"],
]) {
  await heroSlides.nth(index).click();
  await page.waitForTimeout(180);
  assert(
    (await page.locator(".qh-browser-bar").innerText()).includes(expected),
    `第 ${index + 1} 个主视觉不是 ${expected}`,
  );
}
assert(
  (await page.locator(".qh-browser-live").innerText()).includes("PAUSED") &&
    (await page.locator(".qh-slide-paused").innerText()).includes("暂未开放"),
  "大气受力主视觉没有显示暂停开放状态",
);

const scrollBefore = await page.evaluate(() => window.scrollY);
await page
  .getByRole("button", { name: /查看三个实验室/ })
  .first()
  .click();
await page.waitForTimeout(500);
assert(
  (await page.evaluate(() => window.scrollY)) > scrollBefore,
  "顶部“查看三个实验室”没有定位到实验库",
);

const searchInput = page.locator(".qh-search input");
await searchInput.fill("Dijkstra");
await page.locator(".qh-search-results button").first().click();
await page.locator(".dk-page").waitFor();
assert(locationHashIs(page, "#dijkstra"), "搜索点击没有直达 Dijkstra");
await page
  .locator(".dk-topnav")
  .getByRole("button", { name: "平台首页", exact: true })
  .click();
await waitForHome();

await page.locator('a[href="#von-thunen"]').click();
await page.locator(".app-shell").waitFor();
await page.locator(".app-home-button").click();
await waitForHome();

await page.locator('a[href="#dijkstra"]').click();
await page.locator(".dk-page").waitFor();
await page
  .locator(".dk-topnav")
  .getByRole("button", { name: "平台首页", exact: true })
  .click();
await waitForHome();

await page.locator('a[href="#atmosphere"]').click();
await page.locator(".atfu-page").waitFor();
assert(
  (await page.locator(".atf-app").count()) === 0 &&
    (await page.locator(".atfu-copy").innerText()).includes("暂未开放"),
  "大气受力路由没有由前端阻拦页截获",
);
await page.locator(".atfu-home-button").click();
await waitForHome();

const homePrimary = await page
  .locator(".qh-home")
  .evaluate((element) =>
    window.getComputedStyle(element).getPropertyValue("--qh-primary").trim(),
  );
assert(
  homePrimary === "#9b2f3b",
  `首页主色不是独立的陶土红体系：${homePrimary}`,
);

await page.setViewportSize({ width: 390, height: 844 });
await page.reload({ waitUntil: "networkidle" });
const mobileData = await page.locator(".qh-featured-experiment").evaluateAll(
  (elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { width: Math.round(rect.width), height: Math.round(rect.height) };
    }),
);
const mobileOverflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
assert(
  mobileData.length === 3 &&
    new Set(mobileData.map((card) => card.width)).size === 1 &&
    new Set(mobileData.map((card) => card.height)).size === 1 &&
    mobileOverflow <= 1,
  "移动端三个实验室卡片未保持同宽同高或出现横向溢出",
);

assert(
  consoleErrors.length === 0,
  `首页浏览器控制台错误：${consoleErrors.join(" | ")}`,
);

await browser.close();

if (failures.length > 0) {
  console.error("HOME SMOKE FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    "HOME SMOKE OK · 三馆平级/三屏主视觉/卡片直达/搜索直达/逐馆返回/移动端通过",
  );
}

function locationHashIs(target, expected) {
  return target.url().endsWith(expected);
}
