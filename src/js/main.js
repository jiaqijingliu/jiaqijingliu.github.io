/* ========== 路由：AJAX 无刷新切换 ==========
   主题与页脚在 site.js 里（blog/ 下的文章页也加载它），本文件只管路由。 */
const ROUTES = {
  home: "partials/home.html",
  projects: "partials/projects.html",
  blog: "partials/blog.html",
  about: "partials/about.html",
};

// 支持 #/projects/skills 这种带子锚点的形式，跳到页面内的对应区块（id 为 <子锚点>-item）
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [name, sub] = raw.split("/");
  return { route: ROUTES[name] ? name : "home", sub: sub || "" };
}

function highlightNav(route) {
  document.querySelectorAll("nav a[data-route]").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === route);
  });
}

// 快速连续切页时，旧的请求可能后返回并覆盖新页面，用令牌丢弃过期渲染
let renderToken = 0;

async function render() {
  const token = ++renderToken;
  const { route, sub } = parseHash();
  const view = document.getElementById("view");
  try {
    // cache:"no-cache" 不是「不缓存」，是「每次先拿 ETag 跟服务器核对，没变就 304」。
    // 不能省：线上经过 Cloudflare，静态资源的 Cache-Control 是 max-age=14400，
    // 只写相对路径的话浏览器 4 小时内根本不回来问，改了 partials 也看不到。
    const res = await fetch(ROUTES[route], { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const html = await res.text();
    if (token !== renderToken) return; // 已有更新的渲染，丢弃本次
    view.innerHTML = html;
    highlightNav(route);
    // 关闭移动端汉堡菜单
    const toggle = document.getElementById("nav-toggle");
    if (toggle) toggle.checked = false;

    if (sub) {
      // 有子锚点时跳到对应区块（等浏览器完成布局后再滚动）
      const target = document.getElementById(sub + "-item");
      if (target) {
        requestAnimationFrame(() =>
          target.scrollIntoView({ behavior: "smooth" })
        );
      }
    } else {
      window.scrollTo(0, 0);
    }
  } catch (err) {
    if (token !== renderToken) return;
    view.innerHTML =
      '<section class="hero"><h2>加载失败</h2>' +
      "<p>页面加载失败，请刷新重试。若为本地预览，请使用 HTTP 服务打开（如 VS Code Live Server）。</p></section>";
  }
}

window.addEventListener("hashchange", render);

// 启动路由
render();
