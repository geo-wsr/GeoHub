import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const edgePath =
  process.env.EDGE_PATH ??
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const requestedUrl = process.env.SMOKE_URL ?? "http://127.0.0.1:5173/";
const baseUrl = requestedUrl.includes("#")
  ? requestedUrl
  : `${requestedUrl.replace(/#$/, "")}#dijkstra`;
const artifacts = fileURLToPath(new URL("../artifacts/", import.meta.url));
const reviewDir = fileURLToPath(new URL("../.impeccable/review/", import.meta.url));

await mkdir(artifacts, { recursive: true });
await mkdir(reviewDir, { recursive: true });

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
await page.locator(".dk-node").first().waitFor();

assert(
  (await page.locator("h1").innerText()).includes(
    "Dijkstra 最短路径算法可视化实验室",
  ),
  "页面标题不正确",
);
assert(
  (await page.locator(".dk-node").count()) === 9 &&
    (await page.locator(".dk-edge").count()) === 14,
  "默认多分支示例图未正确载入",
);
const desktopPanels = await page.evaluate(() => {
  const box = (selector) => {
    const element = document.querySelector(selector);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, height: rect.height };
  };
  return {
    viewportHeight: window.innerHeight,
    editor: box(".dk-editor-panel"),
    graph: box(".dk-graph-panel"),
    runner: box(".dk-runner-panel"),
  };
});
assert(
  Boolean(
    desktopPanels.editor &&
      desktopPanels.graph &&
      desktopPanels.runner
  ) &&
    Math.abs(desktopPanels.editor.height - desktopPanels.graph.height) < 2 &&
    Math.abs(desktopPanels.runner.height - desktopPanels.graph.height) < 2 &&
    Math.max(
      desktopPanels.editor.bottom,
      desktopPanels.graph.bottom,
      desktopPanels.runner.bottom,
    ) <= desktopPanels.viewportHeight,
  "1440×900 下三栏未等高或未完整进入首屏",
);
assert(
  (await page.locator(".dk-node-label").first().textContent()) === "A₁" &&
    (await page
      .locator(".dk-node-label")
      .first()
      .getAttribute("dominant-baseline")) === "central" &&
    (await page
      .locator(".dk-node-label")
      .first()
      .getAttribute("text-anchor")) === "middle",
  "节点标号未使用 A₁…Aₙ 记法或未设置居中锚点",
);
assert(
  (await page
    .locator(".dk-edge-weight-text")
    .first()
    .getAttribute("dominant-baseline")) === "central" &&
    (await page
      .locator(".dk-edge-weight-text")
      .first()
      .getAttribute("text-anchor")) === "middle",
  "边权数字未设置水平、垂直居中锚点",
);
assert(
  (await page.locator(".dk-table-wrap tbody tr").count()) === 9,
  "距离表没有覆盖全部节点",
);
assert(
  (await page.locator(".dk-pseudocode li").count()) === 11,
  "伪代码行数不完整",
);
const editorOverflow = await page
  .locator(".dk-editor-panel .dk-panel-body")
  .evaluate((element) => ({
    overflow: window.getComputedStyle(element).overflowY,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
assert(
  editorOverflow.overflow === "visible" &&
    editorOverflow.scrollHeight <= editorOverflow.clientHeight + 1,
  "图编辑面板仍存在内部裁切或纵向溢出",
);
assert(
  (await page.locator(".dk-progress strong").innerText()).startsWith("1 /"),
  "页面没有以初始化事件启动",
);

const initialDescription = await page.locator(".dk-step-card p").innerText();
await page.getByRole("button", { name: "下一步", exact: true }).click();
assert(
  (await page.locator(".dk-step-card p").innerText()) !== initialDescription &&
    (await page.locator(".dk-event-kind").innerText()).includes("EXTRACT"),
  "单步执行没有推进到真实 Dijkstra 事件",
);
const syncedCodeLines = await page.locator(".dk-pseudocode li.is-active").count();
assert(syncedCodeLines >= 1, "伪代码没有跟随当前事件高亮");

assert(
  (await page.locator(".dk-speed-options button").count()) === 4 &&
    (await page
      .locator(".dk-speed-options button")
      .evaluateAll((buttons) => buttons.map((button) => button.textContent))) 
      .join(",") === "0.5×,1×,1.5×,2×",
  "播放速度档位不是 0.5×、1×、1.5×、2×",
);
await page.getByRole("button", { name: "2×", exact: true }).click();
await page.getByRole("button", { name: "播放", exact: true }).click();
await page.waitForTimeout(700);
assert(
  (await page.locator(".dk-workspace").getAttribute("class")).includes(
    "is-playing",
  ) &&
    !(await page.locator(".dk-editor-panel").isVisible()) &&
    (await page.locator(".dk-live-code-line").count()) >= 1 &&
    (await page.locator(".dk-live-table tbody tr").count()) === 9,
  "播放专注模式未隐藏图编辑并显示算法行与距离表",
);
await page.getByRole("button", { name: "暂停", exact: true }).click();
const playedProgress = Number(
  (await page.locator(".dk-progress strong").innerText()).split("/")[0],
);
assert(playedProgress > 2, "播放没有持续推进事件");

await page.getByRole("button", { name: /简单链/ }).click();
await page.waitForTimeout(120);
assert(
  (await page.locator(".dk-node").count()) === 6 &&
    (await page.locator(".dk-edge").count()) === 5,
  "简单链示例未正确载入",
);

await page.locator(".dk-node").first().click();
assert(
  (await page.locator(".dk-inspector").count()) === 1 &&
    (await page.locator(".dk-node").first().getAttribute("class")).includes(
      "is-selected",
    ),
  "选择模式下点击节点没有打开对象检查器",
);
await page.locator(".dk-graph-paper").click({ position: { x: 12, y: 12 } });

await page.locator(".dk-edge-hit").first().dispatchEvent("click");
await page.getByLabel("边权重").fill("-1");
await page.waitForTimeout(120);
assert(
  await page.locator(".dk-negative-banner").isVisible(),
  "负权边没有触发明确警告",
);
assert(
  await page.getByRole("button", { name: "下一步", exact: true }).isDisabled(),
  "负权边存在时仍可执行算法",
);

await page.getByLabel("边权重").fill("4");
await page.waitForTimeout(120);
assert(
  (await page.locator(".dk-negative-banner").count()) === 0,
  "移除负权边后警告未消失",
);

await page.getByRole("button", { name: "有向图", exact: true }).click();
assert(
  (await page.locator(".dk-graph-meta").innerText()).includes("有向") &&
    (await page.locator(".dk-edge-stroke[marker-end]").count()) === 5,
  "有向图切换或箭头渲染失败",
);

await page.locator(".dk-endpoint-grid select").first().selectOption("f");
await page.locator(".dk-endpoint-grid select").nth(1).selectOption("a");
await page.getByRole("button", { name: "跳到结束", exact: true }).click();
assert(
  (await page.locator(".dk-outcome h2").innerText()) === "不可达",
  "有向图中不可达终点没有正确提示",
);

await page.locator(".dk-endpoint-grid select").first().selectOption("a");
await page.locator(".dk-endpoint-grid select").nth(1).selectOption("f");
await page.getByRole("button", { name: "跳到结束", exact: true }).click();
await page.locator(".dk-path-line").waitFor();
assert(
  (await page.locator(".dk-edge.is-path").count()) === 5,
  "结束后没有高亮完整最短路径",
);
assert(
  (await page.locator(".dk-outcome-main").innerText()).includes("17"),
  "最短路径总距离计算不正确",
);
await page.getByRole("button", { name: "路径回溯动画", exact: true }).click();
await page.waitForTimeout(320);
assert(
  (await page.locator(".dk-outcome-actions").innerText()).includes("已显现"),
  "路径回溯动画没有逐段推进",
);
await page.screenshot({
  path: `${reviewDir}desktop.png`,
  fullPage: true,
});

await page.locator(".dk-add-node-button").click();
await page.waitForTimeout(100);
assert(
  (await page.locator(".dk-notice").innerText()).includes(
    "图已修改，请重置执行",
  ) && (await page.locator(".dk-node").count()) === 7,
  "执行中修改图没有提示重置，或节点未添加",
);
await page.locator(".dk-notice").getByRole("button", {
  name: "重置执行",
}).click();

const firstNode = page.locator(".dk-node").first();
await firstNode.scrollIntoViewIfNeeded();
const transformBefore = await firstNode.getAttribute("transform");
const nodeBox = await firstNode.boundingBox();
if (nodeBox) {
  await page.mouse.move(
    nodeBox.x + nodeBox.width / 2,
    nodeBox.y + nodeBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    nodeBox.x + nodeBox.width / 2 + 24,
    nodeBox.y + nodeBox.height / 2 + 18,
    { steps: 6 },
  );
  await page.mouse.up();
}
assert(
  (await firstNode.getAttribute("transform")) !== transformBefore,
  "拖动节点没有更新布局",
);

await page.getByRole("button", { name: "帮助 / 原理", exact: true }).click();
await page.locator(".dk-dialog").waitFor();
assert(
  await page.locator(".dk-dialog").isVisible(),
  "帮助与原理说明没有打开",
);
await page.getByRole("button", { name: "关闭原理说明" }).click();

await page.locator(".dk-pseudocode-toggle").click();
assert(
  (await page.locator(".dk-pseudocode").count()) === 0,
  "伪代码显隐按钮无效",
);
await page.locator(".dk-pseudocode-toggle").click();

const desktopOverflow = await page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
}));
assert(
  desktopOverflow.scrollWidth <= desktopOverflow.clientWidth + 1,
  "桌面端出现横向溢出",
);

await page.setViewportSize({ width: 390, height: 844 });
await page.reload({ waitUntil: "networkidle" });
await page.locator(".dk-node").first().waitFor();
const mobileOverflow = await page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
}));
assert(
  mobileOverflow.scrollWidth <= mobileOverflow.clientWidth + 1,
  "移动端出现横向溢出",
);
assert(
  (await page.locator(".dk-editor-panel").getAttribute("class")).includes(
    "is-collapsed",
  ),
  "移动端图编辑面板没有默认折叠",
);
await page.locator(".dk-editor-panel .dk-panel-toggle").click();
assert(
  await page.locator(".dk-editor-panel .dk-panel-body").isVisible(),
  "移动端图编辑面板无法展开",
);
await page.locator(".dk-editor-panel .dk-panel-toggle").click();
await page.screenshot({
  path: `${reviewDir}mobile.png`,
  fullPage: true,
});

assert(
  consoleErrors.length === 0,
  `浏览器控制台错误：${consoleErrors.join(" | ")}`,
);

await browser.close();

if (failures.length > 0) {
  console.error("DIJKSTRA SMOKE FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    "DIJKSTRA SMOKE OK · 事件推进/队列同步/负权阻止/方向切换/路径回溯/图编辑/移动端通过",
  );
}
