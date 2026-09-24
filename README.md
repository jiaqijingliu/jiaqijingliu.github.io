# StayInTop

个人站点，部署在 GitHub Pages。纯静态，无框架。

## 目录结构

```
index.html            SPA 外壳：导航 + <main id="view">，靠 hash 路由换内容
partials/             四个页面的片段，被 main.js 用 fetch 注入到 index.html
  ├─ home.html
  ├─ projects.html
  ├─ blog.html        ← 列表部分由 build.js 生成，别手改标记之间的内容
  └─ about.html
posts/                博客源文件（Markdown + front-matter），写笔记只碰这里
templates/post.html   文章页模板，build.js 用它套出 blog/<slug>.html
blog/                 构建产物，已提交（GitHub Pages 没有构建步骤）
build.js              Markdown → HTML 的构建脚本
src/
  ├─ css/             SCSS 源码 + 编译出的 style.css
  ├─ font/            Logo 可选字体（woff2，自托管）
  └─ js/
      ├─ site.js      主题切换 + 页脚年份（SPA 和文章页都加载）
      └─ main.js      只有 hash 路由（文章页不加载）
archive/              早期练习，已归档，不再上站
Vibe_project/         三个完整应用（iframe 外链，不在 SPA 内）
```

## 本地预览

`fetch()` 在 `file://` 下会被浏览器拦截，**必须走 HTTP 服务**：

```bash
npm install        # 首次
npm run serve      # http://localhost:8080
```

## 写一篇笔记

1. 在 `posts/` 下新建 `xxx.md`，照 `posts/_模板.md` 写 front-matter：

   ```markdown
   ---
   title: 标题（必填）
   date: 2026-01-01
   tags: [JavaScript, CSS]
   summary: 列表页显示的一句话摘要，不写则自动截取正文首段
   ---
   ```

   以 `_` 开头的文件会被跳过，可以当模板留着。

2. 构建：

   ```bash
   npm run build:blog
   ```

   这一步会做三件事：生成 `blog/<slug>.html`、重写博客列表、更新首页的「最新笔记」和笔记数量。
   删掉 `posts/` 里的某个 md 再构建，对应的页面也会跟着消失。

3. 提交并推送。`blog/` 是产物，要一起提交。

## 改样式

改 `src/css/*.scss` 后编译：

```bash
npm run build:css        # 或 npm run build（CSS + 博客一起）
```

改完记得把 `index.html` 和 `templates/post.html` 里的 `style.css?v=N` 升一位，避免浏览器缓存。

## 外观设置

齿轮按钮**平时吸附在屏幕左/右边缘、半藏起来**（只露出一小条把手），鼠标移上去或键盘聚焦时才完全滑出。按住拖动可以换边和换高度，松手自动吸附到更近的那一侧并记住纵向位置。

面板里能调：

| 选项 | 对应属性 | 说明 |
|---|---|---|
| 亮暗模式 | `data-theme` | 默认跟随系统偏好 |
| 主题色 | 内联 `--primary` | 6 个预设 + 任意取色。页脚底色、导航 hover 底色、标签底色都由它混出来 |
| Logo 字体 | `data-logo-font` | 见下 |
| 正文字体 | `data-font` | 无衬线 / 宋体 / 楷体 / 仿宋 / 圆体，见下 |
| 字号 | 内联 `font-size` | 13–20px。全站尺寸都用 rem，所以这一个值会把整站等比缩放 |
| 内容宽度 | `data-width` | 同时影响页面宽度和文章正文宽度 |
| 文本选中 | `data-select` | **默认 `off`，鼠标选不中任何文字**；改成「可选中」恢复 |

「恢复默认设置」会清掉 localStorage 里所有外观项并复位面板。字号那项是移除内联值而不是写死 16px，这样浏览器里设过默认字号的用户（无障碍需求）不会被打回 16。

### 加一个可选项要动哪几个文件

设置项分两类：

- **枚举值**（字体、宽度、可否选中）——「值 → 视觉」全部写在 CSS 的 `html[data-*]` 规则里，JS 只负责 `setAttribute` + 存 localStorage
- **连续值**（字号）——没法做成枚举，只能走内联样式

之所以这么分，是因为 `<head>` 里必须有一段内联脚本在首次绘制前套用设置，否则会闪一下默认样式。值放 CSS 里，这段脚本就只要一行 `setAttribute`，不用把整张对照表在 JS 里再抄一份。

所以加一个**枚举**选项：

1. `_var_global.scss` 加 `html[data-xxx="key"] { ... }`
2. `site.js` 的 `optionGroups` 里加一项，`dict` 只需 `{ key: { label } }`
3. 两处 HTML（`index.html` 和 `templates/post.html`）的面板里加一个空 `<div id="xxx-opts" class="theme-opts">`
4. `<head>` 内联脚本里加一行 `setAttribute`

### Logo 字体

四个字体全部自托管在 `src/font/`，只取了 latin 子集（logo 是纯 ASCII）。不自托管的话国内访问 Google Fonts 拿不到字，本地预览也会挂。字体只在被选中时才下载，每个约 25–43KB。

授权是 SIL OFL 1.1，来源和替换方法见 [src/font/LICENSES.md](src/font/LICENSES.md)。

### 正文字体

五个选项全部是**系统字体栈**，没有网字体 —— logo 能用 woff2 是因为它只有几个 ASCII 字母，而中文正文一个子集也覆盖不了几个字，整站塞个中文字库是几 MB 起步，为换个观感付这个代价不值。

每个栈都同时写了 macOS 和 Windows 的字体名，靠汉字字形本身的风格差异拉开：

| 选项 | Windows | macOS |
|---|---|---|
| 无衬线 | 微软雅黑 | 苹方 |
| 宋体 | SimSun | Songti SC |
| 楷体 | KaiTi | Kaiti SC |
| 仿宋 | FangSong（系统自带，优先于随 Office 的 STFangsong） | STFangsong |
| 圆体 | YouYuan 幼圆 | Yuanti SC 圆体-简 |

两个踩过的坑，别再犯：

- **`ui-rounded` / `Hiragino Maru Gothic ProN` 是 macOS 专有**。圆体这项原来只写了这两个，在 Windows 上一路落空落到微软雅黑，和「无衬线」渲染**逐像素相同**，等于一个不起作用的选项。加选项时一定要确认它在 Windows 上也能落到一个真的存在的字体。
- **等宽字体对中文无效**。Consolas / Cascadia Mono 都没有汉字，CJK 会回落到默认衬线字体，整段渲染与「宋体」逐像素相同，只有英文会变。所以没做「等宽」选项。

验证办法：同一个字符串在不同字体栈下各截图一张，比对 PNG 的 md5。**哈希相同就是同一个字体**，这个判据比肉眼看截图可靠 —— 我一度以为幼圆渲染错了，是哈希证明它确实生效且有别于其余七个。

宽度测量在这里没用（CJK 汉字在任何字体里都是全角 1em，宽度必然一样），`document.fonts.check()` 也没用（它对 `Songti SC`、`ui-rounded` 这些本机根本没装的字体照样返回 `true`）。

## 两个注意点

- **文章页在 SPA 之外。** `blog/<slug>.html` 是独立页面，导航链接写成 `../#/blog` 这样带 `../` 的形式才能回到主站。
- **文章页在手机窄屏上偏窄**（页面宽度是 `70vw`）。设置面板里的「内容宽度 → 宽」可以放宽，或者改 `_var_global.scss` 里 `--content-max` 的默认值。
