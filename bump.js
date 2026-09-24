/* 把所有 ?v=N 统一加一，然后重编 blog/。
 *
 * 为什么必要：线上站点走 Cloudflare，静态资源的响应头是
 *   Cache-Control: max-age=14400   （4 小时）
 * URL 不变的话，浏览器在这 4 小时里根本不会回来问服务器，改了也看不到。
 * 加 ?v=N 等于换了个 URL，缓存自然绕过。
 *
 * 这个坑的代价（真实发生过）：某次重构把 main.js 里的主题逻辑搬到了 site.js，
 * 但 index.html 里 <script src=".../main.js"> 没有版本号，浏览器拿的还是缓存的旧文件，
 * 于是新旧两份代码同时给设置按钮绑了 click —— 一个开一个关，点击互相抵消，
 * 表现得像「按钮坏了」。改 JS 一定要升版本号，别再漏。
 */
const fs = require("fs");
const { execSync } = require("child_process");

// 所有带版本号的 HTML。blog/ 下的文章页由 build.js 从模板重新生成，不用手列。
const FILES = ["index.html", "templates/post.html"];

const sources = FILES.map((f) => ({ file: f, text: fs.readFileSync(f, "utf8") }));

// 先取全局最大值，保证所有文件写同一个版本号（CSS 和 JS 一起换 URL）
let next = 0;
for (const { text } of sources) {
  for (const m of text.matchAll(/\?v=(\d+)/g)) {
    next = Math.max(next, Number(m[1]));
  }
}
if (!next) {
  console.error("× 没找到任何 ?v=N ，确认一下文件是不是被改过");
  process.exit(1);
}
next += 1;

for (const { file, text } of sources) {
  const count = (text.match(/\?v=\d+/g) || []).length;
  if (!count) {
    console.error(`× ${file} 里没有 ?v= ，跳过（脚本标签是不是漏加版本号了？）`);
    continue;
  }
  fs.writeFileSync(file, text.replace(/\?v=\d+/g, `?v=${next}`));
  console.log(`  ✓ ${file}  ${count} 处 → ?v=${next}`);
}

// blog/<slug>.html 由 templates/post.html 套出来，重新生成才能跟上新版本号
console.log("  重新生成 blog/ …");
execSync("node build.js", { stdio: "inherit" });
console.log(`\n版本号已升到 ?v=${next}，记得连同 blog/ 一起提交。`);
