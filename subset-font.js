/* 把霞鹜文楷（LXGW WenKai Mono Lite Medium）裁成本站真正用到的那批字。
 *
 *   npm run font:subset
 *
 * 全量字体 13.1 MB —— 一个中文字库就是这么重，直接挂上去等于每个访客都要拖
 * 十几兆（参考站 daily.yybb.us 就是直接从 jsDelivr 拉的 TTF）。这里只保留
 * 站上实际出现过的字，压成 woff2 之后约 340 KB，既用上了同款字体，又不用把
 * 十几兆塞进仓库、也不用依赖第三方 CDN。
 *
 * **加了新文章、改了文案之后要重跑一次**，否则新出现的字会回落到系统字体。
 * 判断标准很简单：新写的字如果不在旧子集里，页面上那一个字就是另一个字体。
 *
 * 源文件不放进仓库（13 MB，而且它是从 CDN 拿的，没必要存两份）—— 脚本自己下。
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const subsetFont = require("subset-font");

const ROOT = __dirname;
const FONT_DIR = path.join(ROOT, "src", "font");
const FONT_BASE = "lxgw-wenkai-mono-lite-medium-subset";
const FONT_CSS = path.join(ROOT, "src", "css", "_font.scss");

// 上游：AIOVTUE/llqcss 是参考站 daily.yybb.us 用的那一份，family 被它改名成
// XiaMingXinSong，这里用回本名。SIL OFL 1.1（见 src/font/LICENSES.md）。
const SRC_URL =
  "https://cdn.jsdelivr.net/gh/AIOVTUE/llqcss@main/LXGWWenKaiMonoLite-Medium.ttf";

// 只扫会变成页面文字的东西。src/font 和 src/pic 是二进制，node_modules/.git 不用看。
const EXTS = new Set([".html", ".js", ".scss", ".css", ".md", ".json"]);
const SKIP_DIRS = new Set(["node_modules", ".git", "font", "pic"]);

function collectChars(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
        collectChars(p, out);
      }
      continue;
    }
    if (!EXTS.has(path.extname(entry.name))) continue;
    for (const ch of fs.readFileSync(p, "utf8")) out.add(ch);
  }
  return out;
}

async function main() {
  const chars = new Set();
  collectChars(ROOT, chars);
  // ASCII 可打印区：JS 拼出来的文本（计数、日期、文件名）和搜索框里输入的
  // 英文数字都靠它。汉字凑不齐可以回落到系统字体，数字缺字形会很难看。
  for (let i = 0x20; i < 0x7f; i++) chars.add(String.fromCharCode(i));
  const text = [...chars].join("");

  process.stdout.write("下载上游字体 … ");
  const res = await fetch(SRC_URL);
  if (!res.ok) throw new Error(`上游返回 ${res.status}`);
  const src = Buffer.from(await res.arrayBuffer());
  console.log(`${(src.length / 1048576).toFixed(1)} MB`);

  console.log(`子集字符 ${chars.size} 个，正在裁 …`);
  // 只出 woff2 —— 网站只认这一种，truetype 中间产物没必要落盘。
  const out = await subsetFont(src, text, { targetFormat: "woff2" });

  /* **文件名带内容哈希，并且这个哈希要写回 _font.scss。**
     字体不走 ?v=N 那一套（?v= 只加在 HTML 引的 CSS / JS 上），CSS 里那条 url()
     是写死的路径 —— 文件名不变的话，加完新文章重新裁一次，Cloudflare 那 4 小时
     的缓存还会继续发旧文件，新字照样是豆腐块。带哈希之后内容一变 URL 就变，
     缓存自然绕开；自动回写是免得手抄那串哈希抄错。 */
  const hash = crypto.createHash("sha256").update(out).digest("hex").slice(0, 8);
  const name = `${FONT_BASE}.${hash}.woff2`;

  // 先清掉上一版，别在 src/font/ 里越堆越多
  for (const f of fs.readdirSync(FONT_DIR)) {
    if (f.startsWith(FONT_BASE + ".") && f.endsWith(".woff2")) {
      fs.unlinkSync(path.join(FONT_DIR, f));
    }
  }
  fs.writeFileSync(path.join(FONT_DIR, name), out);

  const css = fs.readFileSync(FONT_CSS, "utf8");
  const next = css.replace(
    new RegExp(`${FONT_BASE}\\.[0-9a-f]{8}\\.woff2`),
    name
  );
  if (next === css) {
    console.error(`× ${path.relative(ROOT, FONT_CSS)} 里没找到 ${FONT_BASE}.<hash>.woff2`);
    process.exit(1);
  }
  fs.writeFileSync(FONT_CSS, next);

  console.log(
    `→ src/font/${name}  ${(out.length / 1024).toFixed(0)} KB` +
      `（比原字体小 ${(100 - (out.length / src.length) * 100).toFixed(1)}%）`
  );
  console.log(`  已把新文件名写回 src/css/_font.scss`);
  console.log("接着跑 npm run build:css && npm run bump。");
}

main().catch((e) => {
  console.error("失败：", e.message);
  process.exit(1);
});
