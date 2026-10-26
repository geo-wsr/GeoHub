import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const edgePath =
  process.env.EDGE_PATH ??
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const requestedUrl = process.env.SMOKE_URL ?? "http://127.0.0.1:5173/";
const baseUrl = requestedUrl.includes("#")
  ? requestedUrl
  : `${requestedUrl.replace(/#$/, "")}#von-thunen`;
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

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.locator(".land-use-path").first().waitFor();

assert(
  (await page.locator("h1").innerText()).includes("杜能圈交互实验室"),
  "标题未正确显示",
);
assert(
  !(await page.locator("body").innerText()).includes(
    "素材来源：本地参考稿《杜能农业区位论》",
  ),
  "指定素材来源文字未删除",
);
assert(
  (await page.locator(".land-use-path").count()) >= 4,
  "地图圈层路径不足",
);
assert(
  (await page.locator(".chart-plot svg").count()) === 1,
  "地租曲线 SVG 缺失",
);
assert(
  (await page.locator(".katex").count()) >= 1,
  "KaTeX 公式未渲染",
);
assert(
  (await page.locator(".formula-legend .katex").count()) === 3,
  "a、b、R 的公式说明未使用 KaTeX",
);
const symbolBoxes = await page
  .locator(".symbol-grid > span")
  .evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().height),
  );
assert(
  symbolBoxes.length === 6 && symbolBoxes.every((height) => height < 56),
  "公式变量卡片排版异常",
);
assert(
  (await page.locator(".city-marker").count()) === 1 &&
    (await page.locator(".road-hit").count()) === 0,
  "页面没有以单中心基础场景启动",
);
assert(
  (await page.locator(".map-hover-note").count()) === 0,
  "地图注释不应在默认状态常驻",
);
assert(
  (await page.locator("#map-frame-clip rect").getAttribute("rx")) === null &&
    (await page.locator(".road-layer").getAttribute("clip-path")) ===
      "url(#map-frame-clip)" &&
    (await page.locator(".map-clipped-content").count()) === 1 &&
    (await page
      .locator(".map-svg")
      .evaluate((element) => window.getComputedStyle(element).overflow)) ===
      "hidden",
  "地图没有使用无圆角的硬边界裁剪",
);
assert(
  (await page.locator(".map-probe").count()) === 0 &&
    (await page.locator(".view-fit-badge").count()) === 0 &&
    (await page.locator(".map-card-header p").count()) === 0 &&
    (await page.locator(".chart-card-header p").count()) === 0,
  "已要求删除的说明或探针区域仍然存在",
);

assert(
  (await page.locator(".map-furniture").count()) === 0 &&
    !(await page.locator(".map-svg").textContent()).includes("非真实地形"),
  "地图仍包含指北针、比例尺或非真实地形标注",
);
const desktopOverflow = await page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
}));
assert(
  desktopOverflow.scrollWidth <= desktopOverflow.clientWidth + 1,
  `桌面端出现横向溢出：${desktopOverflow.scrollWidth} > ${desktopOverflow.clientWidth}`,
);
await page.screenshot({
  path: `${artifacts}/desktop-full.png`,
  fullPage: true,
});

const mapCardBox = await page.locator(".map-card").boundingBox();
const chartCardBox = await page.locator(".chart-card").boundingBox();
assert(
  Boolean(mapCardBox && chartCardBox) &&
    chartCardBox.x > mapCardBox.x + mapCardBox.width - 2 &&
    Math.abs(chartCardBox.y - mapCardBox.y) < 4,
  "桌面端地图与竞租曲线没有并排显示",
);

const mapHover = page.locator(".map-svg");
await mapHover.scrollIntoViewIfNeeded();
const mapHoverBox = await mapHover.boundingBox();
const ringBoxBeforeZoom = await page
  .locator(".land-use-path")
  .first()
  .boundingBox();
if (mapHoverBox) {
  await page.mouse.move(
    mapHoverBox.x + mapHoverBox.width / 2,
    mapHoverBox.y + mapHoverBox.height / 2,
  );
  const scrollBeforeZoom = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, -700);
  await page.waitForTimeout(180);
  const scrollAfterZoom = await page.evaluate(() => window.scrollY);
  assert(
    scrollBeforeZoom === scrollAfterZoom,
    "地图滚轮缩放同时滚动了页面",
  );
  await page.locator(".map-card").screenshot({
    path: `${artifacts}/desktop-hard-clip.png`,
  });
}
const ringBoxAfterZoom = await page
  .locator(".land-use-path")
  .first()
  .boundingBox();
assert(
  Boolean(ringBoxBeforeZoom && ringBoxAfterZoom) &&
    ringBoxAfterZoom.width > ringBoxBeforeZoom.width * 1.1,
  "滚轮没有放大地图",
);
await page.getByRole("button", { name: /重置视图/ }).click();
await page.waitForTimeout(180);
if (mapHoverBox) {
  await page.mouse.move(
    mapHoverBox.x + mapHoverBox.width * 0.68,
    mapHoverBox.y + mapHoverBox.height * 0.35,
  );
  await page.waitForTimeout(100);
  assert(
    (await page.locator(".map-hover-note").count()) === 1,
    "悬停圈层后未显示跟随鼠标的注释",
  );
}

const chartFrame = page.locator(".chart-plot svg");
await chartFrame.scrollIntoViewIfNeeded();
const chartBox = await chartFrame.boundingBox();
if (chartBox) {
  await page.mouse.move(
    chartBox.x + chartBox.width * 0.42,
    chartBox.y + chartBox.height * 0.45,
  );
  await page.waitForTimeout(100);
  assert(
    (await page.locator(".readout-series").count()) > 0,
    "悬停曲线后未显示 Rᵢ 读数",
  );
  await page.locator(".chart-card").screenshot({
    path: `${artifacts}/desktop-chart-hover.png`,
  });
}

const actualRentToggle = page.getByRole("button", { name: "实际地租" });
assert(
  (await actualRentToggle.getAttribute("aria-pressed")) === "false" &&
    (await page.locator("[data-actual-envelope]").count()) === 0,
  "实际地租默认不应显示",
);
await actualRentToggle.click();
assert(
  (await actualRentToggle.getAttribute("aria-pressed")) === "true" &&
    (await page.locator("[data-actual-envelope]").count()) === 1 &&
    (await page.locator("[data-boundary-formula]").count()) > 0,
  "点击实际地租控件后未显示地租包络",
);
await page.locator(".chart-card").screenshot({
  path: `${artifacts}/desktop-chart-actual-rent.png`,
});
await actualRentToggle.click();

const intensityCard = page.locator(".intensity-card");
await intensityCard.scrollIntoViewIfNeeded();
const intensityNear = Number(
  await page.locator(".intensity-k strong").innerText(),
);
const distanceSlider = page
  .locator(".intensity-range", { hasText: "距市场距离" })
  .locator("input[type='range']");
await distanceSlider.evaluate((element) => element.focus());
await page.keyboard.press("End");
await page.waitForTimeout(180);
const intensityFar = Number(
  await page.locator(".intensity-k strong").innerText(),
);
assert(
  Number.isFinite(intensityNear) &&
    Number.isFinite(intensityFar) &&
    intensityFar <= intensityNear,
  "集约程度没有随距离实时演算",
);
await intensityCard.screenshot({
  path: `${artifacts}/desktop-intensity.png`,
});
const intensityFormulaOverflow = await page
  .locator(".intensity-formulas > div")
  .evaluateAll((elements) =>
    elements.map(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
  );
assert(
  intensityFormulaOverflow.every(Boolean),
  "集约程度公式在框内被截断或需要滚动",
);
const featuredFormulaSizes = await page
  .locator(".intensity-formula-featured .katex")
  .evaluateAll((elements) =>
    [...new Set(elements.map((element) => getComputedStyle(element).fontSize))],
  );
assert(
  featuredFormulaSizes.length === 1,
  "投入强度三行公式字号不一致",
);

const initialCurvePath = await page
  .locator(".chart-plot svg path")
  .first()
  .getAttribute("d");

await page
  .locator(".map-tool-button")
  .filter({ hasText: "画道路" })
  .click();
assert(
  await page.locator(".add-mode-hint").isVisible(),
  "画道路工具没有显示操作提示",
);
const drawMapBox = await page.locator(".map-svg").boundingBox();
assert(Boolean(drawMapBox), "地图 SVG 无法用于绘制道路");
if (drawMapBox) {
  await page.mouse.move(
    drawMapBox.x + drawMapBox.width * 0.14,
    drawMapBox.y + drawMapBox.height * 0.76,
  );
  await page.mouse.down();
  await page.mouse.move(
    drawMapBox.x + drawMapBox.width * 0.84,
    drawMapBox.y + drawMapBox.height * 0.72,
    { steps: 24 },
  );
  await page.mouse.up();
  await page.waitForTimeout(420);
}
assert(
  (await page.locator(".road-hit").count()) === 1,
  "自由绘制道路未添加到地图",
);
await page.mouse.move(4, 4);
await page.waitForTimeout(80);
assert(
  (await page.locator(".map-hover-note").count()) === 0,
  "鼠标离开地图后注记仍然存在",
);
assert(
  Number(
    await page.locator(".road-stroke").first().getAttribute("stroke-width"),
  ) <= 3,
  "绘制道路交通线仍然过粗",
);
assert(
  (await page
    .locator(".road-stroke")
    .first()
    .evaluate((element) => window.getComputedStyle(element).stroke)) ===
    "rgb(34, 48, 42)",
  "道路交通线应使用黑色细实线",
);
assert(
  !(await page.locator(".road-stroke").first().getAttribute("stroke-dasharray")) &&
    (await page.locator(".road-item path").count()) === 2,
  "道路仍使用虚线或可见 buffer",
);

await page
  .locator(".map-tool-button")
  .filter({ hasText: "移动" })
  .click();
const roadHit = page.locator(".road-hit").first();
await roadHit.scrollIntoViewIfNeeded();
const roadPathBefore = await roadHit.getAttribute("d");
await roadHit.hover({ force: true });
await page.waitForTimeout(120);
assert(
  (await page.locator(".map-hover-note").textContent()).includes("交通线"),
  "悬停道路后未在鼠标附近显示道路注释",
);
await page.locator(".map-card").screenshot({
  path: `${artifacts}/desktop-drawn-road.png`,
});
const roadBox = await roadHit.boundingBox();
if (roadBox) {
  await page.mouse.move(
    roadBox.x + roadBox.width / 2,
    roadBox.y + roadBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    roadBox.x + roadBox.width / 2 + 24,
    roadBox.y + roadBox.height / 2 - 18,
    { steps: 8 },
  );
  await page.mouse.up();
  await page.waitForTimeout(140);
}
const roadPathAfter = await roadHit.getAttribute("d");
assert(roadPathBefore !== roadPathAfter, "拖动道路后位置没有变化");

await page
  .locator(".map-tool-button")
  .filter({ hasText: "删除" })
  .click();
await page.locator(".road-hit").first().click({ force: true });
await page.waitForTimeout(180);
assert(
  (await page.locator(".road-hit").count()) === 0,
  "删除工具未能删除道路",
);
assert(
  await page.locator(".undo-toast").isVisible(),
  "删除道路后未显示可见撤销提示",
);
await page
  .locator(".undo-toast")
  .getByRole("button", { name: "撤销", exact: true })
  .click();
await page.waitForTimeout(180);
assert(
  (await page.locator(".road-hit").count()) === 1,
  "撤销道路删除后道路没有恢复",
);
await page
  .locator(".map-tool-button")
  .filter({ hasText: "删除" })
  .click();
await page.locator(".road-hit").first().click({ force: true });
await page.waitForTimeout(180);
await page.getByRole("button", { name: /重置视图/ }).click();
assert(
  (await page.locator(".city-marker").count()) === 1 &&
    (await page.locator(".road-hit").count()) === 0,
  "重置视图未恢复当前预设的城市与道路",
);

const firstCurveLegend = page.locator(".curve-legend-button").first();
assert(
  (await firstCurveLegend.getAttribute("aria-pressed")) === "true",
  "作物曲线初始应为可见",
);
await firstCurveLegend.click();
assert(
  (await firstCurveLegend.getAttribute("aria-pressed")) === "false",
  "作物曲线无法隐藏",
);
await firstCurveLegend.click();

assert(
  (await page.getByRole("button", { name: /隐藏公式|显示公式/ }).count()) ===
    0 &&
    (await page.locator(".intro-formula .formula").isVisible()),
  "公式显隐功能未移除或主公式不可见",
);

const initialPath = await page
  .locator(".land-use-path")
  .first()
  .getAttribute("d");
const freightSlider = page
  .locator(".range-control", { hasText: "全市场运费率" })
  .locator('input[type="range"]');
await freightSlider.evaluate((element) => {
  element.focus();
});
await page.keyboard.press("End");
await page.keyboard.press("ArrowLeft");
await page.waitForTimeout(360);
const changedPath = await page
  .locator(".land-use-path")
  .first()
  .getAttribute("d");
assert(initialPath !== changedPath, "调整运费率后圈层路径没有变化");
const changedCurvePath = await page
  .locator(".chart-plot svg path")
  .first()
  .getAttribute("d");
assert(initialCurvePath !== changedCurvePath, "调整运费率后竞租曲线没有变化");

await page.locator(".map-card").screenshot({
  path: `${artifacts}/desktop-map-default.png`,
});
await page.locator(".chart-card").screenshot({
  path: `${artifacts}/desktop-chart-sync.png`,
});

const marker = page.locator(".city-marker").first();
const markerHitArea = marker.locator("circle").first();
await markerHitArea.scrollIntoViewIfNeeded();
const markerBox = await markerHitArea.boundingBox();
assert(Boolean(markerBox), "城市标记没有可交互区域");
if (markerBox) {
  const markerTransform = await marker.getAttribute("transform");
  await page.mouse.move(
    markerBox.x + markerBox.width / 2,
    markerBox.y + markerBox.height / 2,
  );
  await page.mouse.down();
  await page.waitForTimeout(60);
  await page.mouse.move(
    markerBox.x + markerBox.width / 2 + 56,
    markerBox.y + markerBox.height / 2 + 28,
    { steps: 8 },
  );
  await page.waitForTimeout(80);
  const draggedTransform = await marker.getAttribute("transform");
  assert(markerTransform !== draggedTransform, "拖动城市后位置没有变化");
  await page.mouse.up();
  const markerOutline = await marker.evaluate(
    (element) => window.getComputedStyle(element).outlineStyle,
  );
  assert(
    (await marker.getAttribute("tabindex")) === "0" &&
      markerOutline === "none",
    "城市键盘焦点不可达或点击后仍产生焦点黑框",
  );
  await page.getByRole("button", { name: /双城竞争/ }).click();
  await page.waitForTimeout(220);
  const keyboardMarker = page.locator(".city-marker").nth(1);
  const keyboardTransformBefore =
    await keyboardMarker.getAttribute("transform");
  await keyboardMarker.focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(180);
  const keyboardTransformAfter =
    await keyboardMarker.getAttribute("transform");
  assert(
    keyboardTransformBefore !== keyboardTransformAfter,
    "城市无法使用方向键移动",
  );
}

await page.getByRole("button", { name: /交通线影响/ }).click();
await page.waitForTimeout(360);
assert(
  (await page.locator(".road-hit").count()) === 1,
  "交通线场景中未显示可编辑道路",
);
await page.locator(".map-card").screenshot({
  path: `${artifacts}/desktop-map-corridor.png`,
});

await page.getByRole("button", { name: /双城竞争/ }).click();
await page.waitForTimeout(360);
assert(
  (await page.locator(".city-marker").count()) === 2,
  "双城预设没有两座市场",
);
assert(
  (await page.locator("[data-global-envelope]").count()) === 0,
  "实际地租关闭时仍显示全市场包络",
);
await actualRentToggle.click();
assert(
  (await page.locator("[data-global-envelope]").count()) === 1,
  "多城市时实际地租控件没有显示全市场最高包络",
);
const globalEnvelopeBefore = await page
  .locator("[data-global-envelope]")
  .getAttribute("d");
const competitorHitArea = page
  .locator(".city-marker")
  .nth(1)
  .locator("circle")
  .first();
const competitorBox = await competitorHitArea.boundingBox();
if (competitorBox) {
  await page.mouse.move(
    competitorBox.x + competitorBox.width / 2,
    competitorBox.y + competitorBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    competitorBox.x + competitorBox.width / 2 + 28,
    competitorBox.y + competitorBox.height / 2 + 18,
    { steps: 6 },
  );
  await page.mouse.up();
  await page.waitForTimeout(160);
  const globalEnvelopeAfter = await page
    .locator("[data-global-envelope]")
    .getAttribute("d");
  assert(
    globalEnvelopeBefore !== globalEnvelopeAfter,
    "拖动竞争城市后全市场竞租包络没有实时变化",
  );
}
await page.locator(".visual-pair").screenshot({
  path: `${artifacts}/desktop-multicity.png`,
});
await page.getByRole("button", { name: "交通与市场" }).click();
const initialCityDeleteButtons = page.locator(".city-delete");
assert(
  (await initialCityDeleteButtons.count()) === 2,
  "多城市时第一座城市也应允许删除",
);
await initialCityDeleteButtons.first().click();
await page.waitForTimeout(120);
assert(
  (await page.locator(".city-marker").count()) === 1,
  "删除城市一后城市数量未减少",
);
await page.getByRole("button", { name: /重置视图/ }).click();
await page.waitForTimeout(120);
assert(
  (await page.locator(".city-marker").count()) === 2,
  "重置视图未恢复双城场景",
);

await page
  .locator(".map-tool-button")
  .filter({ hasText: "添加城市" })
  .click();
const mapSvg = page.locator(".map-svg");
const mapBox = await mapSvg.boundingBox();
assert(Boolean(mapBox), "地图 SVG 无尺寸");
if (mapBox) {
  await page.mouse.click(
    mapBox.x + mapBox.width * 0.18,
    mapBox.y + mapBox.height * 0.74,
  );
  await page.waitForTimeout(360);
  assert(
    (await page.locator(".city-marker").count()) === 3,
    "点击地图未增加第三座市场",
  );
  await page.getByRole("button", { name: "交通与市场" }).click();
  const deleteButtons = page.locator(".city-delete");
  await deleteButtons.last().click();
  await page.waitForTimeout(120);
  assert(
    (await page.locator(".city-marker").count()) === 2,
    "删除城市按钮未生效",
  );
}

await page.getByRole("button", { name: /帮助/ }).click();
await page.locator('[role="dialog"]').waitFor();
assert(
  await page.locator('[role="dialog"]').isVisible(),
  "帮助弹窗未打开",
);
await page.getByRole("button", { name: "关闭原理说明" }).click();

await page.getByRole("button", { name: "收起参数侧栏" }).click();
assert(
  (await page.locator(".control-panel").count()) === 0,
  "桌面参数侧栏无法收起",
);
await page.getByRole("button", { name: "展开侧栏" }).click();
assert(
  await page.locator(".control-panel").isVisible(),
  "桌面参数侧栏无法重新展开",
);
await page
  .locator(".control-tabs button")
  .filter({ hasText: "作物参数" })
  .click();
await page.locator(".crop-chevron").first().click();
assert(
  (await page.locator(".crop-fields .inline-formula").first().isVisible()) &&
    (await page.locator(".crop-fields .inline-formula").count()) >= 5,
  "作物参数中的公式未正确渲染",
);
await page.locator(".control-panel").screenshot({
  path: `${artifacts}/desktop-control-panel.png`,
});
const addCropButton = page.locator(".add-crop-button");
await addCropButton.click();
await page.waitForTimeout(120);
assert(
  (await page.locator(".crop-control").count()) === 7 &&
    (await addCropButton.isDisabled()),
  "作物上限 7 类或添加按钮状态不正确",
);
await page.locator(".crop-name-input").last().fill("测试作物");
await page.waitForTimeout(120);
assert(
  (await page.locator(".crop-name-input").last().inputValue()) ===
    "测试作物" &&
    (await page.locator(".legend-name").last().innerText()).includes(
      "测试作物",
    ),
  "作物重命名没有同步到图例",
);
for (let remaining = 7; remaining > 0; remaining -= 1) {
  await page.locator(".crop-delete-button").first().click();
  await page.waitForTimeout(60);
}
assert(
  (await page.locator(".crop-control").count()) === 0 &&
    (await page.locator(".chart-empty-overlay").count()) === 1 &&
    (await page.locator(".intensity-card .empty-state").count()) === 1,
  "删除全部作物后未进入 0 作物状态",
);
await page.screenshot({
  path: `${artifacts}/desktop-no-crops.png`,
  fullPage: true,
});
await addCropButton.click();
await page.waitForTimeout(120);
assert(
  (await page.locator(".crop-control").count()) === 1,
  "0 作物状态下无法重新添加作物",
);
await page.locator(".legend-item").first().click();
assert(
  (await page.locator(".inline-crop-editor").isVisible()) &&
    (await page
      .locator(".inline-crop-editor")
      .getAttribute("data-crop-index")) === "1",
  "图例中的作物参数编辑器没有展开",
);
const inlineEquationBefore = await page
  .locator(".inline-equation")
  .innerText();
const inlineYieldSlider = page
  .locator(".inline-crop-editor input[type='range']")
  .first();
await inlineYieldSlider.evaluate((element) => element.focus());
await page.keyboard.press("End");
await page.waitForTimeout(180);
assert(
  (await page.locator(".inline-equation").innerText()) !==
    inlineEquationBefore,
  "图例内调整作物参数时 a、b 公式没有实时变化",
);
await page.locator(".map-card").screenshot({
  path: `${artifacts}/desktop-inline-crop-editor.png`,
});
await page.getByRole("button", { name: "关闭作物参数编辑器" }).click();
await page.getByRole("button", { name: /重置视图/ }).click();
await page.waitForTimeout(240);
assert(
  (await page.locator(".legend-item").count()) === 6 &&
    (await page.locator(".city-marker").count()) === 2 &&
    (await page.locator(".road-hit").count()) === 0 &&
    (await actualRentToggle.getAttribute("aria-pressed")) === "false",
  "重置视图没有恢复所有参数与图层状态",
);

await page.setViewportSize({ width: 1100, height: 900 });
await page.reload({ waitUntil: "networkidle" });
await page.locator(".land-use-path").first().waitFor();
await page.getByRole("button", { name: "展开侧栏" }).click();
await page.waitForTimeout(180);
const tabletLayout = await page.evaluate(() => {
  const box = (selector) =>
    document.querySelector(selector)?.getBoundingClientRect() ?? null;
  const panel = box(".control-panel");
  const map = box(".map-card");
  const chart = box(".chart-card");
  const commandBar = document.querySelector(".map-command-bar");
  return {
    overlapMap: Boolean(panel && map && panel.x < map.right - 1),
    overlapChart: Boolean(panel && chart && panel.x < chart.right - 1),
    commandOverflow: Boolean(
      commandBar && commandBar.scrollWidth > commandBar.clientWidth + 1,
    ),
  };
});
assert(
  !tabletLayout.overlapMap &&
    !tabletLayout.overlapChart &&
    !tabletLayout.commandOverflow,
  "平板宽度下侧栏遮挡图表或地图工具栏内部溢出",
);
await page.locator(".workspace").screenshot({
  path: `${artifacts}/tablet-1100.png`,
});

await page.setViewportSize({ width: 390, height: 844 });
await page.reload({ waitUntil: "networkidle" });
await page.locator(".land-use-path").first().waitFor();
const overflow = await page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
}));
assert(
  overflow.scrollWidth <= overflow.clientWidth + 1,
  `移动端出现横向溢出：${overflow.scrollWidth} > ${overflow.clientWidth}`,
);
await page.screenshot({
  path: `${artifacts}/mobile-full.png`,
  fullPage: true,
});
await page.screenshot({
  path: `${artifacts}/mobile-top.png`,
  fullPage: false,
});
await page.locator(".map-card").screenshot({
  path: `${artifacts}/mobile-map.png`,
});
await page.locator(".chart-card").scrollIntoViewIfNeeded();
await page.locator(".chart-card").screenshot({
  path: `${artifacts}/mobile-chart.png`,
});
await page.locator(".intensity-card").scrollIntoViewIfNeeded();
await page.locator(".intensity-card").screenshot({
  path: `${artifacts}/mobile-intensity.png`,
});
const mobileIntensityOverflow = await page
  .locator(".intensity-formulas > div")
  .evaluateAll((elements) =>
    elements.map(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
  );
assert(
  mobileIntensityOverflow.every(Boolean),
  "移动端集约程度公式未完整收纳",
);
assert(
  (await page.locator(".control-panel").count()) === 0,
  "移动端参数侧栏不应默认占用版面",
);
await page.getByRole("button", { name: "展开侧栏" }).click();
assert(
  await page.locator(".control-panel").isVisible(),
  "移动端参数侧栏无法展开",
);
await page.getByRole("button", { name: "收起参数侧栏" }).click();
assert(
  (await page.locator(".control-panel").count()) === 0,
  "移动端参数面板无法收起",
);

await page.setViewportSize({ width: 320, height: 800 });
await page.reload({ waitUntil: "networkidle" });
await page.locator(".land-use-path").first().waitFor();
const narrowOverflow = await page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
}));
assert(
  narrowOverflow.scrollWidth <= narrowOverflow.clientWidth + 1,
  `320px 宽度出现横向溢出：${narrowOverflow.scrollWidth} > ${narrowOverflow.clientWidth}`,
);

await page.emulateMedia({ reducedMotion: "reduce" });
await page.reload({ waitUntil: "networkidle" });
const reducedMotionTool = page.getByRole("button", {
  name: "画道路",
  exact: true,
});
await reducedMotionTool.scrollIntoViewIfNeeded();
const reducedToolBox = await reducedMotionTool.boundingBox();
assert(Boolean(reducedToolBox), "减少动态效果测试按钮不可见");
if (reducedToolBox) {
  await page.mouse.move(
    reducedToolBox.x + reducedToolBox.width / 2,
    reducedToolBox.y + reducedToolBox.height / 2,
  );
  await page.mouse.down();
  await page.waitForTimeout(80);
  const reducedTransform = await reducedMotionTool.evaluate(
    (element) => window.getComputedStyle(element).transform,
  );
  await page.mouse.move(4, 4);
  await page.mouse.up();
  assert(
    reducedTransform === "none",
    "减少动态效果模式下按钮仍发生缩放",
  );
}

assert(consoleErrors.length === 0, `控制台错误：${consoleErrors.join(" | ")}`);

await browser.close();

if (failures.length > 0) {
  console.error("SMOKE FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  const paths = await Promise.resolve("6");
  console.log(
    `SMOKE OK · 圈层/联动/道路编辑/悬停注记/实际地租/公式/城市删除/侧栏/移动端通过 · 作物基础 ${paths} 类`,
  );
}
