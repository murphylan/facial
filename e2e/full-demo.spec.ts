import { test, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// 设置超时时间
test.setTimeout(600000);

// 每个场景停留时间（毫秒）
const SCENE_DURATION = 3000;

// 截图计数器
let screenshotCounter = 0;
const SCREENSHOT_DIR = "e2e/screenshots";

// ==========================================
// 工具函数
// ==========================================

/** 等待指定时间 */
async function wait(ms = 800) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 保存截图 */
async function takeScreenshot(page: Page, name: string) {
  // 确保截图目录存在
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  
  screenshotCounter++;
  const filename = `${String(screenshotCounter).padStart(2, '0')}_${name}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);
  
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`📸 Screenshot saved: ${filename}`);
}

/** 平滑滚动 */
async function smoothScroll(page: Page, deltaY: number, steps = 8) {
  const step = deltaY / steps;
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, step);
    await wait(60);
  }
}

/** 模拟打字效果 */
async function typeSlowly(locator: ReturnType<Page["locator"]>, text: string, delay = 60) {
  await locator.click();
  await wait(200);
  for (const char of text) {
    await locator.pressSequentially(char, { delay });
  }
}

/** 展示区域 - 鼠标移动 */
async function showcaseArea(page: Page, areas: Array<{x: number, y: number}>) {
  for (const area of areas) {
    await page.mouse.move(area.x, area.y, { steps: 20 });
    await wait(400);
  }
}

/**
 * 显示演示文字说明（带动画效果）
 */
async function showCaption(page: Page, title: string, subtitle?: string, duration = SCENE_DURATION) {
  await page.evaluate(({ title, subtitle }) => {
    const existing = document.getElementById('demo-caption');
    if (existing) existing.remove();
    
    const container = document.createElement('div');
    container.id = 'demo-caption';
    container.style.cssText = `
      position: fixed;
      bottom: 50px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 99999;
      background: linear-gradient(135deg, rgba(0, 0, 0, 0.88) 0%, rgba(20, 20, 40, 0.92) 100%);
      backdrop-filter: blur(20px);
      padding: 24px 40px;
      border-radius: 20px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
      animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
      text-align: center;
      min-width: 350px;
      max-width: 700px;
    `;
    
    if (!document.getElementById('demo-caption-styles')) {
      const style = document.createElement('style');
      style.id = 'demo-caption-styles';
      style.textContent = `
        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(30px) scale(0.95); }
          to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; transform: translateX(-50%) translateY(-15px); }
        }
      `;
      document.head.appendChild(style);
    }
    
    const titleEl = document.createElement('div');
    titleEl.textContent = title;
    titleEl.style.cssText = `
      color: #ffffff;
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 10px;
    `;
    container.appendChild(titleEl);
    
    if (subtitle) {
      const subtitleEl = document.createElement('div');
      subtitleEl.textContent = subtitle;
      subtitleEl.style.cssText = `
        color: rgba(255, 255, 255, 0.85);
        font-size: 16px;
      `;
      container.appendChild(subtitleEl);
    }
    
    document.body.appendChild(container);
  }, { title, subtitle });
  
  await wait(500 + duration);
  
  await page.evaluate(() => {
    const caption = document.getElementById('demo-caption');
    if (caption) {
      caption.style.animation = 'fadeOut 0.5s ease-out forwards';
      setTimeout(() => caption.remove(), 500);
    }
  });
  await wait(500);
}

/** 显示功能介绍 */
async function showFeature(page: Page, title: string, subtitle?: string) {
  await showCaption(page, `【${title}】`, subtitle);
}

/** 显示流程步骤 */
async function showStep(page: Page, step: number, title: string, subtitle?: string) {
  await showCaption(page, `Step ${step}: ${title}`, subtitle);
}

/** 页面转场 - 先显示页面，再弹出文字 */
async function transitionTo(page: Page, url: string, title: string, subtitle?: string) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await wait(1500);
  await showFeature(page, title, subtitle);
  await wait(500);
}

// ==========================================
// 主测试 - 完整产品流程演示
// 流程：摄像头/图片输入 → 人脸检测 → 特征提取 → 聚类分组 → 人工标注 → 识别应用
// ==========================================

test("🎬 无感人脸识别系统 - 完整流程演示", async ({ page, context }) => {
  
  // 授予摄像头权限
  await context.grantPermissions(['camera']);
  
  // ==========================================
  // 开场
  // ==========================================
  await page.goto("/");
  await wait(2500);
  
  // 开场标题
  await showCaption(page, "🔐 无感人脸识别系统", "智能识别 · 自动聚类 · 高效管理", 4000);
  await takeScreenshot(page, "开场_系统标题");
  
  // 展示流程预览
  await showCaption(page, "📋 产品流程", "摄像头输入 → 人脸检测 → 特征提取 → 聚类分组 → 人工标注 → 识别应用", 4000);
  await takeScreenshot(page, "开场_流程预览");
  
  // ==========================================
  // Step 1: 摄像头输入 + 人脸检测 + 特征提取
  // ==========================================
  await page.goto("/camera", { waitUntil: 'networkidle' });
  await wait(2000);
  
  await showStep(page, 1, "摄像头输入", "接入浏览器摄像头，实时采集人脸数据");
  await takeScreenshot(page, "Step1_摄像头输入");
  
  // 点击"开始"按钮启动摄像头
  try {
    const startButton = page.getByRole('button', { name: '开始' });
    await startButton.waitFor({ state: 'visible', timeout: 5000 });
    await startButton.click();
    await wait(5000); // 等待摄像头启动和模型加载
  } catch {
    console.log('Start button not available, camera may already be running');
  }
  
  await showStep(page, 2, "人脸检测", "AI 实时检测画面中的人脸，显示检测框");
  await takeScreenshot(page, "Step2_人脸检测");
  
  // 点击"开始检测"按钮
  try {
    const detectButton = page.getByRole('button', { name: '开始检测' });
    await detectButton.waitFor({ state: 'visible', timeout: 5000 });
    await detectButton.click();
    await wait(5000); // 等待检测人脸
  } catch {
    console.log('Detect button not available, detection may already be running');
  }
  
  // 展示检测效果
  await showcaseArea(page, [
    { x: 400, y: 350 },
    { x: 500, y: 350 },
  ]);
  await wait(2000);
  await takeScreenshot(page, "Step2_检测效果展示");
  
  await showStep(page, 3, "特征提取", "自动提取 512 维人脸特征向量，用于后续识别");
  await takeScreenshot(page, "Step3_特征提取");
  
  // 开启自动识别选项展示（需要等待元素可用）
  try {
    const autoRecognizeSwitch = page.locator('#toolbar-auto-recognize');
    await autoRecognizeSwitch.waitFor({ state: 'visible', timeout: 5000 });
    // 等待开关变为可用状态
    await page.waitForFunction(() => {
      const el = document.querySelector('#toolbar-auto-recognize');
      return el && !el.hasAttribute('disabled');
    }, { timeout: 8000 });
    await autoRecognizeSwitch.click();
    await wait(3000);
  } catch {
    // 如果开关不可用，继续演示
    console.log('Auto recognize switch not available, skipping...');
  }
  
  await showFeature(page, "实时识别", "自动匹配身份库，区分已知身份与陌生人");
  await takeScreenshot(page, "Step3_实时识别功能");
  await wait(3000);
  
  // 截图保存
  try {
    const screenshotButton = page.getByRole('button', { name: '截图' });
    if (await screenshotButton.isVisible({ timeout: 2000 })) {
      await screenshotButton.click();
      await wait(1500);
    }
  } catch {
    console.log('Screenshot button not available, skipping...');
  }
  
  // ==========================================
  // Step 4: 聚类分组
  // ==========================================
  await page.goto("/clusters", { waitUntil: 'networkidle' });
  await wait(2000);
  
  await showStep(page, 4, "智能聚类", "基于特征向量相似度，自动将同一人的人脸分组");
  await takeScreenshot(page, "Step4_智能聚类");
  
  // 展示聚类统计
  await showcaseArea(page, [
    { x: 250, y: 200 },
    { x: 450, y: 200 },
    { x: 650, y: 200 },
    { x: 850, y: 200 },
  ]);
  await wait(1500);
  
  // 点击自动聚类按钮
  try {
    const clusterButton = page.getByRole('button', { name: '自动聚类' });
    const isVisible = await clusterButton.isVisible({ timeout: 2000 });
    const isEnabled = isVisible && await clusterButton.isEnabled();
    if (isVisible && isEnabled) {
      await clusterButton.click();
      await wait(3000);
    }
  } catch {
    console.log('Cluster button not available, skipping...');
  }
  
  // 展示合并相似聚类按钮
  try {
    const mergeButton = page.getByRole('button', { name: '合并相似聚类' });
    if (await mergeButton.isVisible({ timeout: 2000 })) {
      await showcaseArea(page, [{ x: 600, y: 280 }]);
      await wait(1000);
    }
  } catch {
    console.log('Merge button not visible, skipping...');
  }
  
  await showFeature(page, "一键聚类", "算法自动分组，减少人工标注工作量");
  await takeScreenshot(page, "Step4_一键聚类功能");
  
  // 滚动展示聚类卡片
  await smoothScroll(page, 300);
  await wait(2000);
  await smoothScroll(page, -300);
  await wait(1000);
  
  // ==========================================
  // Step 5: 人工标注
  // ==========================================
  await page.goto("/annotate", { waitUntil: 'networkidle' });
  await wait(2000);
  
  await showStep(page, 5, "人工标注", "为聚类分配身份，建立人脸-身份关联");
  await takeScreenshot(page, "Step5_人工标注");
  
  // 展示三栏布局
  await showcaseArea(page, [
    { x: 200, y: 400 }, // 待标注聚类
    { x: 540, y: 400 }, // 聚类预览
    { x: 880, y: 400 }, // 分配身份
  ]);
  await wait(2000);
  
  // 尝试选择第一个聚类
  try {
    const firstCluster = page.locator('.rounded-lg.border.cursor-pointer').first();
    if (await firstCluster.isVisible({ timeout: 2000 })) {
      await firstCluster.click();
      await wait(2000);
    }
  } catch {
    console.log('No cluster available to select');
  }
  
  await showFeature(page, "高效标注", "选择聚类 → 预览人脸 → 分配身份，三步完成");
  await takeScreenshot(page, "Step5_高效标注流程");
  await wait(2000);
  
  // ==========================================
  // Step 5.5: 身份库管理
  // ==========================================
  await page.goto("/identities", { waitUntil: 'networkidle' });
  await wait(2000);
  
  await showFeature(page, "身份库", "统一管理所有已识别的人员信息");
  await takeScreenshot(page, "Step5.5_身份库管理");
  
  // 展示身份统计
  await showcaseArea(page, [
    { x: 300, y: 200 },
    { x: 540, y: 200 },
    { x: 780, y: 200 },
  ]);
  await wait(1500);
  
  // 滚动展示身份卡片
  await smoothScroll(page, 200);
  await wait(1500);
  await smoothScroll(page, -200);
  await wait(1000);
  
  // ==========================================
  // Step 6: 识别应用
  // ==========================================
  await page.goto("/recognition", { waitUntil: 'networkidle' });
  await wait(2000);
  
  await showStep(page, 6, "识别应用", "实时追踪识别记录，智能区分已知身份与陌生人");
  await takeScreenshot(page, "Step6_识别应用");
  
  // 展示统计卡片
  await showcaseArea(page, [
    { x: 300, y: 200 },
    { x: 540, y: 200 },
    { x: 780, y: 200 },
  ]);
  await wait(1500);
  await takeScreenshot(page, "Step6_识别统计卡片");
  
  // 展示筛选选项
  await showcaseArea(page, [
    { x: 300, y: 320 },
    { x: 500, y: 320 },
  ]);
  await wait(1000);
  
  // 滚动展示识别记录
  await smoothScroll(page, 300);
  await wait(2000);
  
  await showFeature(page, "智能监控", "支持时间筛选、类型过滤，快速定位目标记录");
  await takeScreenshot(page, "Step6_智能监控功能");
  await wait(2000);
  
  // ==========================================
  // 回到仪表盘展示总览
  // ==========================================
  await page.goto("/", { waitUntil: 'networkidle' });
  await wait(2000);
  
  await showFeature(page, "数据仪表盘", "全局视角，实时监控系统运行状态");
  await takeScreenshot(page, "仪表盘_总览");
  
  // 展示统计卡片
  await showcaseArea(page, [
    { x: 300, y: 200 },
    { x: 500, y: 200 },
    { x: 700, y: 200 },
    { x: 900, y: 200 },
  ]);
  await wait(1500);
  await takeScreenshot(page, "仪表盘_统计卡片");
  
  // 滚动展示更多内容
  await smoothScroll(page, 400);
  await wait(2000);
  await smoothScroll(page, -400);
  await wait(1500);
  
  // ==========================================
  // 谢幕
  // ==========================================
  
  // 最终谢幕画面
  await page.evaluate(() => {
    // 创建全屏遮罩
    const overlay = document.createElement('div');
    overlay.id = 'demo-ending';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 99999;
      background: linear-gradient(135deg, rgba(0, 0, 0, 0.95) 0%, rgba(20, 20, 50, 0.98) 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      animation: fadeIn 1s ease-out;
    `;
    
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
    `;
    document.head.appendChild(style);
    
    // Logo/图标
    const logo = document.createElement('div');
    logo.textContent = '🔐';
    logo.style.cssText = `
      font-size: 80px;
      margin-bottom: 30px;
      animation: pulse 2s ease-in-out infinite;
    `;
    overlay.appendChild(logo);
    
    // 标题
    const title = document.createElement('div');
    title.textContent = '无感人脸识别系统';
    title.style.cssText = `
      color: #ffffff;
      font-size: 48px;
      font-weight: 800;
      margin-bottom: 20px;
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
      letter-spacing: 4px;
    `;
    overlay.appendChild(title);
    
    // 副标题
    const subtitle = document.createElement('div');
    subtitle.textContent = '智能识别 · 自动聚类 · 高效管理';
    subtitle.style.cssText = `
      color: rgba(255, 255, 255, 0.8);
      font-size: 24px;
      margin-bottom: 40px;
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
    `;
    overlay.appendChild(subtitle);
    
    // 流程图
    const flowContainer = document.createElement('div');
    flowContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 50px;
      padding: 20px 30px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 16px;
    `;
    
    const flowSteps = [
      { icon: '📷', text: '摄像头' },
      { icon: '👁️', text: '检测' },
      { icon: '🧬', text: '特征' },
      { icon: '📊', text: '聚类' },
      { icon: '🏷️', text: '标注' },
      { icon: '✅', text: '识别' },
    ];
    
    flowSteps.forEach((step, index) => {
      const stepEl = document.createElement('div');
      stepEl.style.cssText = `
        text-align: center;
        color: rgba(255, 255, 255, 0.9);
        font-size: 14px;
        font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
      `;
      stepEl.innerHTML = `
        <div style="font-size: 28px; margin-bottom: 6px;">${step.icon}</div>
        <div>${step.text}</div>
      `;
      flowContainer.appendChild(stepEl);
      
      if (index < flowSteps.length - 1) {
        const arrow = document.createElement('div');
        arrow.textContent = '→';
        arrow.style.cssText = `
          color: rgba(255, 255, 255, 0.5);
          font-size: 20px;
        `;
        flowContainer.appendChild(arrow);
      }
    });
    overlay.appendChild(flowContainer);
    
    // 特性列表
    const features = document.createElement('div');
    features.style.cssText = `
      display: flex;
      gap: 40px;
      margin-bottom: 50px;
    `;
    
    const featureItems = [
      { icon: '🤖', text: 'AI 驱动' },
      { icon: '⚡', text: '实时检测' },
      { icon: '🎯', text: '高精度' },
      { icon: '🔒', text: '安全可靠' },
    ];
    
    featureItems.forEach(item => {
      const feature = document.createElement('div');
      feature.style.cssText = `
        text-align: center;
        color: rgba(255, 255, 255, 0.9);
        font-size: 16px;
        font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
      `;
      feature.innerHTML = `
        <div style="font-size: 32px; margin-bottom: 8px;">${item.icon}</div>
        <div>${item.text}</div>
      `;
      features.appendChild(feature);
    });
    overlay.appendChild(features);
    
    // 感谢语
    const thanks = document.createElement('div');
    thanks.textContent = '感谢观看';
    thanks.style.cssText = `
      color: rgba(255, 255, 255, 0.6);
      font-size: 18px;
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
    `;
    overlay.appendChild(thanks);
    
    // 版权信息
    const copyright = document.createElement('div');
    copyright.textContent = 'Powered by Murphy · © 2026';
    copyright.style.cssText = `
      position: absolute;
      bottom: 30px;
      color: rgba(255, 255, 255, 0.4);
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
    `;
    overlay.appendChild(copyright);
    
    document.body.appendChild(overlay);
  });
  
  await wait(2000);
  await takeScreenshot(page, "结尾_谢幕画面");
  await wait(5000);
  
  console.log("✅ 视频录制完成！");
  console.log(`📁 截图已保存至: ${SCREENSHOT_DIR}/`);
});
