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
  viewport: { width: 1440, height: 900 },
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
await page.locator(".atfu-page").waitFor();

assert(
  (await page.title()).includes("暂未开放"),
  "阻拦页标题没有标明暂未开放",
);
assert(
  (await page.locator(".atf-app").count()) === 0 &&
    (await page.locator(".atf-canvas").count()) === 0,
  "大气受力实验室仍被渲染",
);
assert(
  (await page.locator(".atfu-copy").innerText()).includes("不会加载交互画布"),
  "阻拦页没有说明交互计算已暂停",
);

await page.screenshot({
  path: `${artifacts}/atmosphere-unavailable-light.png`,
  fullPage: true,
});

await page.locator(".atfu-home-button").click();
await page.locator(".qh-home").waitFor();
assert(page.url().endsWith("#home"), "阻拦页无法返回平台首页");

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.locator(".atfu-page").waitFor();
await page.locator('a[href="#von-thunen"]').click();
await page.locator(".app-shell").waitFor();
assert(page.url().endsWith("#von-thunen"), "阻拦页无法进入杜能环");

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.locator(".atfu-page").waitFor();
await page.locator('a[href="#dijkstra"]').click();
await page.locator(".dk-page").waitFor();
assert(page.url().endsWith("#dijkstra"), "阻拦页无法进入 Dijkstra");

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.locator(".atfu-page").waitFor();
const mobileOverflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
assert(mobileOverflow <= 1, "阻拦页在移动端出现横向溢出");

assert(
  consoleErrors.length === 0,
  `阻拦页控制台错误：${consoleErrors.join(" | ")}`,
);

await browser.close();

if (failures.length > 0) {
  console.error("ATMOSPHERE GATE SMOKE FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    "ATMOSPHERE GATE SMOKE OK · 路由拦截/无实验渲染/返回首页/双入口/移动端通过",
  );
}
