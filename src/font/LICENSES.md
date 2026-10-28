# src/font 下的字体来源

授权均为 **SIL Open Font License 1.1**（可自由用于商业与非商业项目、可再分发、可嵌入网页）。

为了不依赖境外 CDN（国内访问 fonts.googleapis.com 基本不通），字体已下载到本仓库自托管。

OFL 要求再分发时保留授权声明，所以本文件请不要删。

## 一、站名 / 落款用的花体（latin 子集）

来自 [Google Fonts](https://fonts.google.com/)。每个文件都只包含 **latin 子集** ——
站名是纯 ASCII 的 `StayInTop`，用不到别的字符集。

从前这四个是设置面板里「Logo 字体」的四个可选项，2026-10-06 那个选项删掉了，
现在只有 Dancing Script 在用（`--logo-font`）。另外三个留着是因为 Great Vibes 还被
关于页头像卡的名字用着（`.me-name` 写死了它）—— 换句话说四个文件里真正会被下载的
是两个。将来确认不再需要时可以删文件 + 删 `_font.scss` 里对应的 `@font-face`。

| 文件 | 字体 | 来源 |
|---|---|---|
| `dancing-script-700.woff2` | Dancing Script 700 | https://fonts.google.com/specimen/Dancing+Script |
| `kaushan-script-400.woff2` | Kaushan Script 400 | https://fonts.google.com/specimen/Kaushan+Script |
| `great-vibes-400.woff2` | Great Vibes 400 | https://fonts.google.com/specimen/Great+Vibes |
| `pacifico-400.woff2` | Pacifico 400 | https://fonts.google.com/specimen/Pacifico |

## 二、正文的中文字体：霞鹜文楷

| 文件 | 字体 | 来源 |
|---|---|---|
| `lxgw-wenkai-mono-lite-medium-subset.<hash>.woff2` | LXGW WenKai Mono Lite Medium（裁过的子集） | https://github.com/lxgw/LxgwWenKai |

- 作者：落霞孤鹜（LXGW），授权 **SIL OFL 1.1**
- 上游文件：`https://cdn.jsdelivr.net/gh/AIOVTUE/llqcss@main/LXGWWenKaiMonoLite-Medium.ttf`
  （参考站 daily.yybb.us 用的就是这一份，它在那边被改名成 `XiaMingXinSong`）
- 全量 13.1 MB。本仓库里这份是**裁过的子集**，只保留站点出现过的字，约 390 KB

**重新生成**（加了新文章、改了文案之后要跑，否则新出现的字会回落到系统字体）：

```bash
npm run font:subset     # 生成带内容哈希的新文件，并自动把文件名写回 _font.scss
npm run build:css && npm run bump
```

文件名里的哈希是脚本自动加的：字体不走 `?v=N` 那一套，路径不变的话 Cloudflare
那 4 小时的缓存会继续发旧文件。**别手改 `_font.scss` 里那一行。**

## 想换 / 加 logo 字体

1. 从 Google Fonts 下 latin 子集的 woff2（或在 [google-webfonts-helper](https://gwfh.mranftl.com/fonts) 按子集下载）
2. 放进本目录
3. 在 `src/css/_font.scss` 里加一条 `@font-face`
4. 在 `src/css/_var_global.scss` 的 `:root` 里改 `--logo-font` / `--logo-weight`

（从前还要在 `site.js` 的 `LOGO_FONTS` 和设置面板里各加一处，那个选项 2026-10-06 删掉了，
现在只有 `:root` 一处。）
