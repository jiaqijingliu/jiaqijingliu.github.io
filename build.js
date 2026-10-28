/**
 * StayInTop 博客构建脚本
 *
 *   posts/*.md  ──►  blog/<slug>.html           （带主题的独立文章页）
 *                ├─►  partials/posts/<slug>.html （同一篇的片段，给 SPA 路由注入 #view）
 *                ├─►  partials/blog.html         （重写标记之间的列表）
 *                └─►  partials/home.html         （重写「最新笔记」）
 *
 *   copyright.html ──►  partials/copyright.html  （版权页的片段，同样给 SPA 路由）
 *
 * 同一篇内容出两份产物，是为了让音乐播放器在站内跳转时不被销毁：独立页留给
 * 直接访问、分享链接和禁用 JS 的情况，片段给 SPA 的 #/post/<slug> 路由 ——
 * 整页跳转必然重建 <audio>，只有走路由才能连续播放。
 *
 * 用法：npm run build:blog
 * 以 _ 或 . 开头的 md 文件会被跳过（可用作模板）。
 */

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { marked } = require("marked");

const ROOT = path.dirname(__filename);
const POSTS_DIR = path.join(ROOT, "posts");
const OUT_DIR = path.join(ROOT, "blog");
const TEMPLATE_PATH = path.join(ROOT, "templates", "post.html");
const BLOG_PARTIAL = path.join(ROOT, "partials", "blog.html");
const HOME_PARTIAL = path.join(ROOT, "partials", "home.html");
// SPA 片段：文章一篇一个，版权页只有一个
const FRAG_DIR = path.join(ROOT, "partials", "posts");
const COPYRIGHT_PATH = path.join(ROOT, "copyright.html");
const COPYRIGHT_FRAG = path.join(ROOT, "partials", "copyright.html");

const HOME_LATEST = 5; // 首页放几篇笔记（第一条是大卡，其余进网格）
const CHARS_PER_MIN = 300; // 中文技术文阅读速度（字/分钟），仅用于估算

// 标记对。key 是 inject() 的第二个参数 —— 注意 file 和 key 是分开的，
// 同一个 key 可以喂给不同文件（count 就同时喂过首页和博客页），
// 但一个 key 只对应一对标记文本。
const MARKERS = {
  blog: ["<!-- posts:start -->", "<!-- posts:end -->"],
  count: ["<!-- post-count:start -->", "<!-- post-count:end -->"],
  // 博客页的分类 chips（「全部 / 踩坑记录 / 工程实践」）
  blogCats: ["<!-- blog-cats:start -->", "<!-- blog-cats:end -->"],
  // 首页三块，都是门户式两栏里要跟着 posts/ 变的东西
  homeStats: ["<!-- home-stats:start -->", "<!-- home-stats:end -->"],
  homeTags: ["<!-- home-tags:start -->", "<!-- home-tags:end -->"],
  homeNotes: ["<!-- home-notes:start -->", "<!-- home-notes:end -->"],
};

// 片段标记，写在 templates/post.html 和 copyright.html 里
const FRAG = ["<!-- fragment:start -->", "<!-- fragment:end -->"];

// 片段里要改写的链接前缀。片段会被注入站点根目录下的 index.html，
// 而模板里的链接是按「当前文件在 blog/ 下」写的，所以必须剥掉这一层。
//
// 不能指望「../ 在根路径下会被吃掉」这个巧合：本站是用户主页（jiaqijingliu.github.io），
// 正好就在根目录，../#/blog 会解析成 /#/blog 而碰巧正确；一旦挪到项目页子路径
// （/repo/），../ 会在吃掉 repo 段之后指到别人的页面上，而且是静默失效。
const POST_STRIPS = [
  ["../#/", "#/"],
  ["../copyright.html", "copyright.html"],
];
const COPYRIGHT_STRIPS = [["./#/", "#/"]];

/* ---------- 小工具 ---------- */

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// js-yaml 会把 `date: 2026-09-06` 解析成 Date 对象，这里统一成 YYYY-MM-DD
function toDateStr(d) {
  if (typeof d === "string") {
    const m = d.match(/^\d{4}-\d{2}-\d{2}/);
    return m ? m[0] : d;
  }
  if (d instanceof Date && !isNaN(d)) return d.toISOString().slice(0, 10);
  return "";
}

function toTags(v) {
  if (!v) return [];
  const arr = Array.isArray(v) ? v : String(v).split(/[,，]/);
  return arr.map((t) => String(t).trim()).filter(Boolean);
}

// 粗略估算：中文按 400 字/分钟，代码块也算进去（读代码同样花时间）
function readTime(body) {
  const chars = body.replace(/\s+/g, "").length;
  return Math.max(1, Math.round(chars / CHARS_PER_MIN));
}

// 没写 summary 时，从正文第一段截一段
function deriveSummary(body) {
  const line = body
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("#") && !l.startsWith("```"));
  if (!line) return "";
  const plain = line
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>]/g, "")
    .trim();
  return plain.length > 90 ? plain.slice(0, 90) + "…" : plain;
}

/* ---------- 读取与排序 ---------- */

function readPosts() {
  if (!fs.existsSync(POSTS_DIR)) {
    console.error(`✗ 找不到 ${path.relative(ROOT, POSTS_DIR)}/ 目录`);
    process.exit(1);
  }

  const posts = fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".md") && !/^[_.]/.test(f))
    .map((f) => {
      const { data, content } = matter(
        fs.readFileSync(path.join(POSTS_DIR, f), "utf8")
      );
      const slug = String(data.slug || f.replace(/\.md$/, "")).trim();
      return {
        file: f,
        slug,
        title: String(data.title || slug),
        date: toDateStr(data.date),
        // 一篇一个，是自由文本。空字符串表示没写 —— 这种篇目只进「全部」，
        // 不会生成空 chip（见 blogCatsHtml）。
        category: String(data.category || "").trim(),
        tags: toTags(data.tags),
        summary: String(data.summary || deriveSummary(content) || ""),
        draft: data.draft === true,
        body: content,
      };
    })
    .filter((p) => {
      if (p.draft) {
        console.log(`  跳过草稿 ${p.file}`);
        return false;
      }
      if (!p.slug || /[\\/]/.test(p.slug)) {
        console.warn(`  跳过非法 slug「${p.slug}」（${p.file}）`);
        return false;
      }
      return true;
    });

  // 日期倒序；同日期时按标题稳定排序，保证多次构建结果一致
  posts.sort((a, b) => (b.date || "").localeCompare(a.date || "") || a.title.localeCompare(b.title));
  return posts;
}

/* ---------- 生成文章页 ---------- */

function renderPost(post, tpl) {
  const tags = post.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("");
  const mins = readTime(post.body);
  return tpl
    .replace(/\{\{title\}\}/g, esc(post.title))
    .replace(/\{\{summary\}\}/g, esc(post.summary))
    .replace(/\{\{date\}\}/g, esc(post.date))
    .replace(/\{\{readTime\}\}/g, `约 ${mins} 分钟`)
    // 没写分类时给一个字面上的「—」而不是空串：模板里那两处是并排的
    // <span>，空串会在日期和「约 N 分钟」之间留下一段没有内容的间距。
    // （替换表是闭合的 —— 模板里加了 {{category}} 就必须有这一行，否则
    // 页面上会原样印出这串字符。）
    .replace(/\{\{category\}\}/g, post.category ? esc(post.category) : "—")
    .replace(/\{\{tags\}\}/g, tags)
    .replace(/\{\{content\}\}/g, marked.parse(post.body));
}

/* ---------- 列表片段 ---------- */

function blogListHtml(posts) {
  if (!posts.length) {
    return `    <p class="blog-empty">还没有文章。在 posts/ 下新建 Markdown 文件，跑一次 npm run build:blog 就会出现在这里。</p>`;
  }

  // 年份只在跨年那一行露出来，其余行带 is-repeat 由 CSS 藏掉（visibility，
  // 保留高度，日期轴顶端对齐所以不会错位）。每行都写一遍是四份冗余，做成
  // 「2026」分组标题在只有一年时又会变成孤零零一行 —— 两种都不如「只在变化
  // 时说一次」。
  //
  // 关键：span 是每行都输出的，只是重复的那些被藏起来。页面上的筛选会藏行，
  // 藏掉带年份的那行之后得有人把年份补到新的第一行上去 —— 这件事由 main.js
  // 的 applyBlogFilter() 重扫一遍 is-repeat 完成。要是这里图省事不输出重复行
  // 的 span，JS 那边就没东西可恢复了。无 JS 时走的就是下面这套初始类名，
  // 所以默认视图必须是对的。
  let lastYear = "";

  return posts
    .map((p) => {
      const tags = p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("");
      const href = `blog/${encodeURIComponent(p.slug)}.html`;
      // toDateStr() 已经把日期规范成 YYYY-MM-DD，直接切即可
      const year = p.date.slice(0, 4);
      const md = p.date.slice(5);
      const repeat = !year || year === lastYear ? " is-repeat" : "";
      lastYear = year || lastYear;

      // data-category 是 main.js 分类筛选的判据，必须和 .blog-cat 里显示的那个
      // 是同一个字符串。没写分类的行留空串 —— 筛选时的比较是「全等」，
      // 空串不会命中任何 chip，正是「只在全部里出现」要的效果。
      const cat = p.category
        ? `<span class="blog-cat">${esc(p.category)}</span>`
        : "";

      return `    <article class="blog-row" data-date="${esc(p.date)}" data-tags="${esc(p.tags.join(","))}" data-category="${esc(p.category)}">
      <time class="blog-row__date" datetime="${esc(p.date)}"><span class="blog-row__year${repeat}">${esc(year)}</span><span class="blog-row__md">${esc(md)}</span></time>
      <div class="blog-row__body">
        <h3 class="blog-row__title"><a href="${href}">${esc(p.title)}</a><span class="blog-row__arrow" aria-hidden="true">&rarr;</span></h3>
        <p class="blog-row__summary">${esc(p.summary)}</p>
        <div class="blog-meta">${cat}<span class="blog-read">约 ${readTime(p.body)} 分钟</span>
          <div class="blog-tags">${tags}</div>
        </div>
      </div>
    </article>`;
    })
    .join("\n\n");
}

/* 篇数是可变文案：筛选时 main.js 会把它改写成「找到 N 篇」，清空后再按
   data-total 还原。所以整段由这里生成，而不是手写在 partial 里 ——
   手写的话那个总数会随着文章增减慢慢和实际对不上。 */
function blogCountHtml(n) {
  return `<span class="blog-count" data-total="${n}" aria-live="polite">共 ${n} 篇</span>`;
}

/* 分类 chips。和首页标签云同一条理由：分类名、每个分类有几篇，都得跟着
   posts/ 现算，写死在 partial 里会随文章增减慢慢对不上。

   这一排 chips 跟「标签」是两回事：分类一篇一个、总数有天然上限（现在两个），
   所以 chips 这套 UI 压得住；标签一篇多个、只增不减，做筛选就是「限度 + 更多
   标签」那套比功能本身还重的机制 —— _main.scss 里记着这段历史。标签仍然参与
   搜索 haystack（applyBlogFilter 的匹配范围含 data-tags）。

   一篇分类都没写的仓库只输出「全部」一颗，整排由 main.js 藏掉（一颗芯片的
   筛选器没有意义）。 */
function blogCatsHtml(posts) {
  const freq = new Map();
  for (const p of posts) {
    if (!p.category) continue;
    freq.set(p.category, (freq.get(p.category) || 0) + 1);
  }
  if (!freq.size) return "";

  const chip = (value, label, n, active) =>
    `    <button type="button" class="blog-cat-chip${active ? " is-active" : ""}" ` +
    `data-category="${esc(value)}" aria-pressed="${active}">` +
    `${esc(label)}<span class="blog-cat-chip__count">${n}</span></button>`;

  const rest = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, n]) => chip(name, name, n, false));

  return [chip("", "全部", posts.length, true), ...rest].join("\n");
}

/* ---------- 首页（门户式两栏） ----------
   左栏是站点统计卡 + 标签云，右栏是 hero + 笔记卡片。三块全在这里生成 ——
   数字和标签必须跟着 posts/ 走，写死在 partial 里会随文章增减慢慢对不上，
   跟 blogCountHtml 是同一条理由。

   参考站（lcrworld / daily.yybb）都是「处处有封面图」的门户首页，而本站一张图
   都没有。这里用「一条通栏大卡 + 两列小卡」代替封面图制造的节奏差 ——
   首条大卡就是它们那个 spotlight 的位置。 */

// 一张笔记卡。lead 那条通栏、字号更大。
function noteCardHtml(p, lead) {
  // href 必须是 blog/<slug>.html 这个形状：main.js 拿正则 ^blog\/([a-z0-9-]+)\.html$
  // 拦下来走站内路由，换个形状就变成整页跳转，音乐当场断掉。
  const href = `blog/${encodeURIComponent(p.slug)}.html`;
  const tags = p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("");
  return `  <article class="note-card${lead ? " note-card--lead" : ""}" data-date="${esc(p.date)}">
    <div class="note-card__top">
      <time class="note-card__date" datetime="${esc(p.date)}">${esc(p.date)}</time>
      <div class="blog-tags">${tags}</div>
    </div>
    <h3 class="note-card__title"><a href="${href}">${esc(p.title)}</a></h3>
    <p class="note-card__summary">${esc(p.summary)}</p>
  </article>`;
}

/* 站点统计。三个数都现算：篇数、字数、最后更新日期。
   不放「运行 N 天/时/分」那种参考站上的东西 —— src/js 是刻意零定时器的
   （见 README），而这个数停在页面上不动反而更怪。 */
function homeStatsHtml(posts) {
  const chars = posts.reduce((n, p) => n + p.body.length, 0);
  // 正文是 Markdown 原文，字数是估算，所以取到百位、前面带「约」
  const approx = Math.max(1, Math.round(chars / 100)) * 100;
  const last = posts.reduce((d, p) => (p.date > d ? p.date : d), "");
  return [
    ["笔记", `${posts.length} 篇`],
    ["字数", `约 ${approx} 字`],
    ["最后更新", last || "—"],
  ]
    .map(
      ([k, v]) =>
        `    <div class="stat-list__row"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`
    )
    .join("\n");
}

/* 标签云。按出现次数分三档字号（类名，不写内联 style）。

   每个标签是真链接，指向 #/blog/<tag>。落点复用博客页**已有的**搜索机制：
   applyBlogFilter() 的匹配范围本来就是「标题 + 摘要 + 标签」，标签天然在
   haystack 里。main.js 只要把这一节填进搜索框，就得到「按标签筛过」的列表，
   一行新的筛选逻辑都不用写。 */
function homeTagsHtml(posts) {
  const freq = new Map();
  for (const p of posts) {
    for (const t of p.tags) freq.set(t, (freq.get(t) || 0) + 1);
  }
  if (!freq.size) return `    <p class="home-empty">还没有标签。</p>`;
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([t, n]) => {
      const tier = n >= 3 ? "lg" : n === 2 ? "md" : "sm";
      return `    <a class="tag-cloud__item tag-cloud__item--${tier}" href="#/blog/${encodeURIComponent(t)}">${esc(t)}</a>`;
    })
    .join("\n");
}

// 第一张通栏当地标，其余的进两列网格
function homeNotesHtml(posts) {
  if (!posts.length) {
    return `  <p class="home-empty">还没有文章。在 posts/ 下新建 Markdown 文件，跑一次 npm run build:blog 就会出现在这里。</p>`;
  }
  const [lead, ...rest] = posts.slice(0, HOME_LATEST);
  const grid = rest.length
    ? `\n  <div class="note-grid">\n${rest
        .map((p) => noteCardHtml(p, false))
        .join("\n")}\n  </div>`
    : "";
  return noteCardHtml(lead, true) + grid;
}

// inline=true 时把值紧贴在标记之间（用于行内的数字），否则单独成行
function inject(file, key, inner, inline) {
  const [start, end] = MARKERS[key];
  const re = new RegExp(`${escapeRe(start)}[\\s\\S]*?${escapeRe(end)}`);
  const src = fs.readFileSync(file, "utf8");
  if (!re.test(src)) {
    console.warn(
      `  ! ${path.relative(ROOT, file)} 缺少标记 ${start} / ${end}，未写入`
    );
    return false;
  }
  const replacement = inline ? `${start}${inner}${end}` : `${start}\n${inner}\n${end}`;
  // 替换值必须包成函数。当成字符串传的话，inner 里的 $& / $` / $' / $1
  // 会被 String.replace 当成替换模式解释 —— 文章标题或摘要里出现这几个
  // 字符就会被换掉。包一层函数走的是「原样插入」，没有这个解释步骤。
  fs.writeFileSync(file, src.replace(re, () => replacement));
  return true;
}

/* 抽出 FRAG 标记之间的内容，做成可以注入 SPA #view 的片段。
   标记不存在时返回 null —— 调用方负责警告，不能静默写一个空文件出去：
   空片段会让那篇文章在 SPA 里变成一张白页，而独立页看着完全正常。 */
function extractFragment(html, strips) {
  const [start, end] = FRAG;
  const i = html.indexOf(start);
  const j = html.indexOf(end);
  if (i < 0 || j < 0 || j < i) return null;
  let frag = html.slice(i + start.length, j);
  for (const [from, to] of strips) frag = frag.split(from).join(to);
  return frag.trim();
}

// 写片段。抽不出来时警告并跳过，独立页仍然是对的。
function writeFragment(dest, html, strips, label) {
  const frag = extractFragment(html, strips);
  if (!frag) {
    console.warn(`  ! ${label} 缺少 fragment:start / fragment:end 标记，未生成 SPA 片段`);
    return false;
  }
  fs.writeFileSync(dest, frag);
  return true;
}

/* ---------- 主流程 ---------- */

function main() {
  const posts = readPosts();
  console.log(`读到 ${posts.length} 篇文章`);

  const tpl = fs.readFileSync(TEMPLATE_PATH, "utf8");

  // 清掉上一轮的产物，避免删掉 md 后留下孤儿页面。
  // 片段目录要一起清：只清 blog/ 的话，删掉一篇 md 之后 SPA 路由仍然能
  // 访问到 partials/posts/ 里那个「已经删掉」的片段。
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith(".html")) fs.unlinkSync(path.join(OUT_DIR, f));
  }
  fs.mkdirSync(FRAG_DIR, { recursive: true });
  for (const f of fs.readdirSync(FRAG_DIR)) {
    if (f.endsWith(".html")) fs.unlinkSync(path.join(FRAG_DIR, f));
  }

  for (const p of posts) {
    const html = renderPost(p, tpl);
    fs.writeFileSync(path.join(OUT_DIR, `${p.slug}.html`), html);
    writeFragment(
      path.join(FRAG_DIR, `${p.slug}.html`),
      html,
      POST_STRIPS,
      "templates/post.html"
    );
    console.log(`  ✓ blog/${p.slug}.html`);
  }

  // 版权页是手写的独立页面，不是从 md 生成的 —— 但它同样需要一个片段，
  // 否则页脚的「版权声明」链接会整页跳转、把音乐掐断。工具链本来就在改它
  // （bump.js 会给它加版本号），这里再读一次不算越界。
  if (
    writeFragment(
      COPYRIGHT_FRAG,
      fs.readFileSync(COPYRIGHT_PATH, "utf8"),
      COPYRIGHT_STRIPS,
      "copyright.html"
    )
  ) {
    console.log("  ✓ partials/copyright.html");
  }

  inject(BLOG_PARTIAL, "blog", blogListHtml(posts));
  // 篇数。筛选取数时 main.js 会把它改写成「找到 N 篇」（见 blogCountHtml）
  inject(BLOG_PARTIAL, "count", blogCountHtml(posts.length), true);
  // 分类 chips。inline 写入：内容要么是一排 <button>，要么是空串，
  // 两边都不需要外层缩进。
  inject(BLOG_PARTIAL, "blogCats", blogCatsHtml(posts), true);
  inject(HOME_PARTIAL, "homeStats", homeStatsHtml(posts));
  inject(HOME_PARTIAL, "homeTags", homeTagsHtml(posts));
  inject(HOME_PARTIAL, "homeNotes", homeNotesHtml(posts));
  console.log("已更新 partials/blog.html 与 partials/home.html");
}

main();
