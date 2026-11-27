# 研究项目动画回归测试

## Node.js 单元测试

在仓库根目录用 Node.js 22 或更高版本运行，无需安装 npm 依赖。

```sh
node --test "tests/*.cjs"
```

用例覆盖 RETRO、共享播放控制器及其调用方、不完整物理场训练与 BFN 掩码采样，以及物理动力学结果视频。模拟时钟和视口事件使阶段跳转、重播和暂停行为可重复验证。

## Playwright 浏览器测试

先在一个终端构建并启动网站。

```sh
bundle install
bundle exec jekyll serve --host 127.0.0.1
```

在另一个终端安装浏览器依赖并运行测试。

```sh
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
node --test tests/browser/project-animation.cjs
```

默认加载 `http://127.0.0.1:4000/`。可通过 `PROJECT_ANIMATION_URL` 指向其他预览或已部署的网站。已有 Chrome 时，可设置 `PROJECT_ANIMATION_BROWSER_CHANNEL=chrome` 并跳过下载 Chromium。

浏览器测试使用中英文页面，检查 BFN 双图在 390、680、681 和 1440 像素宽度下的布局与手机视口播放时机，也检查 BFN、RETRO、不完整物理场训练和蛋白质训练的播放控件。后台测试在 Chromium 中模拟 `document.hidden` 和 `visibilitychange`，视口检测与布局由浏览器实际执行。
