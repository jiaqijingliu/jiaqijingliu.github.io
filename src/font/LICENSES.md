# src/font 下的字体来源

全部来自 [Google Fonts](https://fonts.google.com/)，授权均为 **SIL Open Font License 1.1**
（可自由用于商业与非商业项目、可再分发、可嵌入网页）。

为了不依赖境外 CDN（国内访问 fonts.googleapis.com 基本不通），字体已下载到本仓库自托管。
每个文件都只包含 **latin 子集**——站点 logo 是纯 ASCII 的 `StayInTop`，用不到别的字符集。

| 文件 | 字体 | 来源 |
|---|---|---|
| `dancing-script-700.woff2` | Dancing Script 700 | https://fonts.google.com/specimen/Dancing+Script |
| `kaushan-script-400.woff2` | Kaushan Script 400 | https://fonts.google.com/specimen/Kaushan+Script |
| `great-vibes-400.woff2` | Great Vibes 400 | https://fonts.google.com/specimen/Great+Vibes |
| `pacifico-400.woff2` | Pacifico 400 | https://fonts.google.com/specimen/Pacifico |

## 想换字体 / 加字体

1. 从 Google Fonts 下 latin 子集的 woff2（或在 [google-webfonts-helper](https://gwfh.mranftl.com/fonts) 按子集下载）
2. 放进本目录
3. 在 `src/css/_font.scss` 里加一条 `@font-face`
4. 在 `src/css/_var_global.scss` 里给 `html[data-logo-font="<key>"]` 加上 `--logo-font` / `--logo-weight`
5. 在 `src/js/site.js` 的 `LOGO_FONTS` 里加上同名 key 和面板里显示的标签

OFL 要求再分发时保留授权声明，所以本文件请不要删。
