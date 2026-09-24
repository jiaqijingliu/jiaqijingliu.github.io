/**
 * StayInTop 博客构建脚本
 *
 *   posts/*.md  ──►  blog/<slug>.html      （带主题的独立文章页）
 *                └─►  partials/blog.html    （重写标记之间的列表）
 *                     partials/home.html    （重写「最新笔记」）
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

const HOME_LATEST = 2; // 首页「最新笔记」放几条
const CHARS_PER_MIN = 300; // 中文技术文阅读速度（字/分钟），仅用于估算

const MARKERS = {
  blog: ["<!-- posts:start -->", "<!-- posts:end -->"],
  home: ["<!-- latest-posts:start -->", "<!-- latest-posts:end -->"],
  count: ["<!-- post-count:start -->", "<!-- post-count:end -->"],
};

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
    .replace(/\{\{tags\}\}/g, tags)
    .replace(/\{\{content\}\}/g, marked.parse(post.body));
}

/* ---------- 列表片段 ---------- */

function blogListHtml(posts) {
  return posts
    .map((p) => {
      const tags = p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("");
      const href = `blog/${encodeURIComponent(p.slug)}.html`;
      return `    <article class="blog-item">
      <h3><a href="${href}">${esc(p.title)}</a></h3>
      <div class="blog-meta">
        <time datetime="${esc(p.date)}">${esc(p.date)}</time>
        <span class="blog-read">约 ${readTime(p.body)} 分钟</span>
        <div class="blog-tags">${tags}</div>
      </div>
      <p>${esc(p.summary)}</p>
    </article>`;
    })
    .join("\n\n");
}

function homeListHtml(posts) {
  return posts
    .slice(0, HOME_LATEST)
    .map((p) => {
      const href = `blog/${encodeURIComponent(p.slug)}.html`;
      return `    <li class="brief-list__item">
      <a class="brief-list__link" href="${href}">
        <span class="brief-list__name">${esc(p.title)}</span>
        <span class="brief-list__meta">${esc(p.date)} · 约 ${readTime(p.body)} 分钟</span>
      </a>
    </li>`;
    })
    .join("\n");
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
  fs.writeFileSync(file, src.replace(re, replacement));
  return true;
}

/* ---------- 主流程 ---------- */

function main() {
  const posts = readPosts();
  console.log(`读到 ${posts.length} 篇文章`);

  const tpl = fs.readFileSync(TEMPLATE_PATH, "utf8");

  // 清掉上一轮的产物，避免删掉 md 后留下孤儿页面
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith(".html")) fs.unlinkSync(path.join(OUT_DIR, f));
  }

  for (const p of posts) {
    const out = path.join(OUT_DIR, `${p.slug}.html`);
    fs.writeFileSync(out, renderPost(p, tpl));
    console.log(`  ✓ blog/${p.slug}.html`);
  }

  inject(BLOG_PARTIAL, "blog", blogListHtml(posts));
  inject(HOME_PARTIAL, "home", homeListHtml(posts));
  inject(HOME_PARTIAL, "count", String(posts.length), true);
  console.log("已更新 partials/blog.html 与 partials/home.html");
}

main();
