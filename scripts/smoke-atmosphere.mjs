import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const edgePath =
  process.env.EDGE_PATH ??
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const requestedUrl = process.env.SMOKE_URL ?? "http://127.0.0.1:5173/";
const baseUrl = requestedUrl.includes("#")
  ? requestedUrl
  : `${requestedUrl.replace(/#$/, "")}#atmosphere`;
const artifacts = fileURLToPath(new URL("../artifacts/", import.meta.url));

await mkdir(artifacts, { recursive: true });

const browser = await chromium.launch({
  executablePath: edgePath,
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 980 },
  deviceScaleFactor: 1,
});
const failures = [];
const consoleErrors = [];

page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

function assert(condition, message) {
  if (!condition) failures.push(message);
}

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.locator(".atf-canvas").waitFor();

assert(
  (await page.locator("h1").innerText()).includes(
    "大气水平运动受力实验室",
  ),
  "页面标题不正确",
);
assert(
  (await page.locator(".atf-force").count()) >= 4,
  "主图没有渲染四个力矢量",
);
assert(
  (await page.locator(".atf-formula-block").count()) >= 4 &&
    (await page.locator(".atf-formula-katex .katex").count()) >= 4,
  "KaTeX 公式没有完整渲染",
);
assert(
  (await page.locator(".atf-card-status").innerText()).includes("梯度风平衡"),
  "默认梯度风低压预设未进入平衡状态",
);

const presetGrid = page.locator(".atf-preset-grid");
await presetGrid.getByRole("button", { name: /地转风/ }).click();
await page.waitForTimeout(120);
assert(
  (await page.locator(".atf-card-status").innerText()).includes("地转平衡"),
  "地转风预设没有切到地转平衡",
);
const geostrophicAngle = Number(
  (await page.locator(".atf-readout-grid > div").nth(2).locator("strong").innerText())
    .replace("°", ""),
);
assert(geostrophicAngle < 1, "地转风的风向没有近似平行等压线");

await presetGrid.getByRole("button", { name: /梯度风高压/ }).click();
await page.waitForTimeout(120);
assert(
  (await page.locator(".atf-canvas").getAttribute("aria-label")).includes("高压"),
  "梯度风高压预设没有切换高压几何",
);
assert(
  (await page.locator(".atf-card-status").innerText()).includes("梯度风平衡"),
  "梯度风高压没有进入三力平衡",
);

const northDirection = await page
  .locator(".atf-computed-wind > div")
  .nth(1)
  .locator("strong")
  .innerText();
await page.locator(".atf-segmented--compact").last().getByRole("button", {
  name: "南半球",
}).click();
await page.waitForTimeout(120);
const southDirection = await page
  .locator(".atf-computed-wind > div")
  .nth(1)
  .locator("strong")
  .innerText();
assert(
  northDirection !== southDirection,
  "切换南半球后平衡风向没有反转",
);

await presetGrid.getByRole("button", { name: /边界层/ }).click();
await page.waitForTimeout(120);
assert(
  (await page.locator(".atf-card-status").innerText()).includes("边界层平衡"),
  "边界层预设没有进入摩擦平衡",
);
const boundaryAngle = Number(
  (await page.locator(".atf-readout-grid > div").nth(2).locator("strong").innerText())
    .replace("°", ""),
);
assert(boundaryAngle > 3, "摩擦作用没有形成可读的入流角");

const frictionRange = page.getByLabel(/摩擦系数/);
await frictionRange.evaluate((element) => {
  const input = element;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, "0.0003");
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
});
await page.waitForTimeout(120);
assert(
  (await page.locator(".atf-range-heading").filter({ hasText: "摩擦系数" }).innerText())
    .includes("3.0"),
  "摩擦滑块没有实时更新数值",
);

await page.getByRole("button", { name: "隐藏公式", exact: true }).click();
assert(
  (await page.locator(".atf-formulas").count()) === 0,
  "公式显隐按钮无效",
);
await page.getByRole("button", { name: "显示公式", exact: true }).click();

await page.getByRole("button", { name: "帮助 / 原理说明", exact: true }).click();
await page.locator(".atf-dialog").waitFor();
assert(
  (await page.locator(".atf-dialog p").count()) >= 6 &&
    (await page.locator(".atf-dialog .atf-formula-block").count()) >= 4,
  "帮助弹窗缺少公式、操作或局限性说明",
);
await page.getByRole("button", { name: "关闭原理说明" }).click();

await page.getByRole("button", { name: "切换到暗色主题" }).click();
await page.waitForTimeout(180);
assert(
  (await page.locator(".atf-app").getAttribute("data-theme")) === "dark",
  "暗色主题开关没有生效",
);
await page.screenshot({
  path: `${artifacts}/atmosphere-desktop-dark.png`,
  fullPage: true,
});
await page.getByRole("button", { name: "切换到亮色主题" }).click();
await page.waitForTimeout(180);
assert(
  (await page.locator(".atf-app").getAttribute("data-theme")) === "light",
  "亮色主题开关没有恢复",
);
await page.screenshot({
  path: `${artifacts}/atmosphere-desktop-light.png`,
  fullPage: true,
});

const desktopOverflow = await page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
}));
assert(
  desktopOverflow.scrollWidth <= desktopOverflow.clientWidth + 1,
  "桌面端出现横向溢出",
);

const homeUrl = baseUrl.split("#")[0];
await page.goto(homeUrl, { waitUntil: "networkidle" });
const atmosphereCard = page.locator("#experiment-atmosphere");
await atmosphereCard.waitFor();
assert(
  (await atmosphereCard.innerText()).includes("大气受力") &&
    (await page.locator(".qh-section-meta").innerText()).includes("03 个实验"),
  "平台首页没有正确展示大气受力实验入口",
);
await atmosphereCard.click();
await page.locator(".atf-canvas").waitFor();
assert(
  page.url().includes("#atmosphere"),
  "首页入口没有进入大气受力实验室",
);

await page.setViewportSize({ width: 390, height: 844 });
await page.reload({ waitUntil: "networkidle" });
await page.locator(".atf-canvas").waitFor();
const mobileOverflow = await page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
}));
assert(
  mobileOverflow.scrollWidth <= mobileOverflow.clientWidth + 1,
  "移动端出现横向溢出",
);
assert(
  (await page.locator(".atf-control-panel").count()) === 0,
  "移动端参数面板没有默认收起",
);
await page.getByRole("button", { name: /展开参数与控制/ }).click();
await page.locator(".atf-control-panel").waitFor();
assert(
  await page.locator(".atf-control-panel").isVisible(),
  "移动端参数面板无法展开",
);
await page.screenshot({
  path: `${artifacts}/atmosphere-mobile-controls.png`,
  fullPage: false,
});
await page.getByRole("button", { name: "收起参数与控制" }).click();
await page.screenshot({
  path: `${artifacts}/atmosphere-mobile.png`,
  fullPage: true,
});

assert(
  consoleErrors.length === 0,
  `浏览器控制台错误：${consoleErrors.join(" | ")}`,
);

await browser.close();

if (failures.length > 0) {
  console.error("ATMOSPHERE SMOKE FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    "ATMOSPHERE SMOKE OK · 四力/平衡预设/半球/摩擦/公式/弹窗/双主题/移动端通过",
  );
}
