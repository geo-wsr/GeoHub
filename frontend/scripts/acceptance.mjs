import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

import { chromium } from 'playwright-core'

const edgePath =
  process.env.EDGE_PATH ??
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const baseUrl = process.env.ACCEPTANCE_URL ?? 'http://127.0.0.1:5173'
const outputDir = resolve(process.env.ACCEPTANCE_OUT ?? 'artifacts/acceptance')
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1280, height: 720 },
  { name: 'desktop', width: 1440, height: 900 },
]

await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({ executablePath: edgePath, headless: true })
const failures = []
const consoleErrors = []

function check(condition, message) {
  if (!condition) failures.push(message)
}

async function preparePage(viewport) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  })
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(`${viewport.name}: ${message.text()}`)
  })
  page.on('pageerror', (error) => {
    consoleErrors.push(`${viewport.name}: ${error.message}`)
  })
  await page.addInitScript(() => {
    try {
      window.sessionStorage.setItem('mywebsite-login-prompted', '1')
    } catch {
      /* 验收时跳过登录引导，不影响匿名浏览路径 */
    }
  })
  return page
}

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  check(overflow <= 1, `${label} 出现横向溢出：${overflow}px`)
}

async function gotoAndSettle(page, path, readySelector) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' })
  await page.locator(readySelector).first().waitFor()
}

for (const viewport of viewports) {
  const page = await preparePage(viewport)
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await gotoAndSettle(page, '/', '.home')

  check((await page.locator('.main-nav__link').count()) === 3, `${viewport.name} 主导航不是三个板块`)
  check(
    (await page.locator('.hero__dot').count()) === 3,
    `${viewport.name} 首页介绍卡片不是三个主要板块`,
  )
  check(
    (await page.locator('.hero__eyebrow').allInnerTexts()).join(',') ===
      '资料分享,论坛,可视化实验室',
    `${viewport.name} 首页介绍卡片顺序或名称不正确`,
  )
  check(
    (await page.locator('.main-section-card').count()) === 3,
    `${viewport.name} 首页没有显示三个主板块`,
  )
  check(
    (await page.locator('.brand__text').innerText()) === '泉盒子的GeoHub',
    `${viewport.name} 站名没有更新`,
  )
  const faviconUrl = await page.locator('link[rel="icon"]').getAttribute('href')
  const faviconStatus = await page.evaluate(async (href) => {
    const response = await fetch(href)
    return response.status
  }, faviconUrl)
  check(faviconStatus === 200, `${viewport.name} 选项卡图标加载失败`)
  check(
    (await page.locator('.intro').count()) === 1 &&
      (await page.getByRole('heading', { name: /热门下载/ }).count()) === 1 &&
      (await page.getByRole('heading', { name: /热门讨论/ }).count()) === 1,
    `${viewport.name} 首页原有资料与讨论区块缺失`,
  )

  if (viewport.width <= 840) {
    await page.getByRole('button', { name: '打开主导航' }).click()
    check(
      (await page.locator('.mobile-nav-links a').count()) === 4,
      `${viewport.name} 移动导航入口不完整`,
    )
    await page.screenshot({
      path: resolve(outputDir, `home-${viewport.name}-menu.png`),
      fullPage: false,
    })
    await page.getByRole('button', { name: '关闭主导航' }).click()
  }

  await assertNoHorizontalOverflow(page, `${viewport.name} 首页`)
  await page.screenshot({
    path: resolve(outputDir, `home-${viewport.name}.png`),
    fullPage: true,
  })

  await gotoAndSettle(page, '/visualization', '.visualization-page')
  check(
    (await page.locator('.lab-group').count()) === 3,
    `${viewport.name} 实验室没有分为自然、人文、GIS与遥感三组`,
  )
  check(
    (await page.locator('.lab-group h2').allInnerTexts()).includes('GIS与遥感'),
    `${viewport.name} 实验室分类没有改为 GIS与遥感`,
  )
  check((await page.locator('.lab-card').count()) === 3, `${viewport.name} 实验室卡片数量错误`)
  check(
    (await page.locator('.lab-card img').evaluateAll((images) => images.every((image) => image.complete))),
    `${viewport.name} 实验室截图未加载`,
  )
  await assertNoHorizontalOverflow(page, `${viewport.name} 实验室目录`)
  await page.screenshot({
    path: resolve(outputDir, `visualization-${viewport.name}.png`),
    fullPage: true,
  })

  await gotoAndSettle(page, '/login', '.login')
  const backendNotice = await page.locator('.backend-notice').innerText()
  check(
    backendNotice.includes('Render') && backendNotice.includes('120 秒'),
    `${viewport.name} 登录页缺少冷启动原因或 120 秒说明`,
  )
  await assertNoHorizontalOverflow(page, `${viewport.name} 登录页`)
  await page.screenshot({
    path: resolve(outputDir, `login-${viewport.name}.png`),
    fullPage: true,
  })

  await page.close()
}

const page = await preparePage(viewports[3])
await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
await gotoAndSettle(page, '/visualization', '.lab-card')

for (const [label, selector] of [
  ['进入大气水平运动受力实验室', '.atf-app'],
  ['进入杜能环实验室', '.app-shell'],
  ['进入Dijkstra 最短路径实验室', '.dk-page'],
]) {
  await gotoAndSettle(page, '/visualization', '.lab-card')
  await page.getByRole('link', { name: label, exact: true }).click()
  const frame = page.frameLocator('.lab-runtime__frame')
  await frame.locator(selector).first().waitFor({ timeout: 20_000 })
  check(page.url().includes('/visualization/'), `${label} 没有进入对应沉浸路由`)
  await page.screenshot({
    path: resolve(outputDir, `lab-${label.slice(0, 6)}.png`),
    fullPage: false,
  })
}

await gotoAndSettle(page, '/visualization', '.lab-card')
await page.getByRole('link', { name: '杜能环实验室' }).click()
let frame = page.frameLocator('.lab-runtime__frame')
await frame.locator('.app-shell').waitFor({ timeout: 20_000 })
await frame.locator('.app-theme-toggle').click()
check(
  (await page.locator('html').getAttribute('data-theme')) === 'dark',
  '实验室内切换主题没有同步回主站',
)
await frame.getByRole('button', { name: '可视化实验室' }).click()
await page.waitForURL('**/visualization', { timeout: 10_000 })
await page.locator('.visualization-page').waitFor()
check((await page.locator('.visualization-page').count()) === 1, '实验室返回按钮没有回到实验室目录')
check(
  (await page.locator('.lab-card img').first().getAttribute('src'))?.includes('dark-preview'),
  '深色主题没有切换到对应的实验室预览图',
)
await page.screenshot({
  path: resolve(outputDir, 'visualization-desktop-dark.png'),
  fullPage: true,
})

await browser.close()

if (consoleErrors.length) {
  failures.push(...consoleErrors.map((error) => `浏览器控制台错误：${error}`))
}

if (failures.length) {
  console.error('ACCEPTANCE FAILED')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(`ACCEPTANCE OK · ${viewports.length} 个视口 · 三板块/三分类/三个实验/主题同步/返回路径`)
  console.log(`截图目录：${outputDir}`)
}
