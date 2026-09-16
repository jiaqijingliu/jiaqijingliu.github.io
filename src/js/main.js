/* ========== 路由：AJAX 无刷新切换 ========== */
const ROUTES = {
  home: "partials/home.html",
  blog: "partials/blog.html",
  about: "partials/about.html",
};

function currentRoute() {
  const hash = location.hash.replace(/^#\/?/, "");
  return ROUTES[hash] ? hash : "home";
}

function highlightNav(route) {
  document.querySelectorAll("nav a[data-route]").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === route);
  });
}

async function render() {
  const route = currentRoute();
  const view = document.getElementById("view");
  try {
    const res = await fetch(ROUTES[route]);
    if (!res.ok) throw new Error("HTTP " + res.status);
    view.innerHTML = await res.text();
    highlightNav(route);
    // 关闭移动端汉堡菜单
    const toggle = document.getElementById("nav-toggle");
    if (toggle) toggle.checked = false;
    window.scrollTo(0, 0);
    if (route === "home") initHome();
  } catch (err) {
    view.innerHTML =
      '<section class="home-intro"><h2>加载失败</h2>' +
      "<p>页面加载失败，请刷新重试。若为本地预览，请使用 HTTP 服务打开（如 VS Code Live Server）。</p></section>";
  }
}

window.addEventListener("hashchange", render);

/* ========== 分页（静态网页 / JavaScript小练习） ========== */
const pagers = [];

function isMobile() {
  return window.matchMedia("(max-width: 700px)").matches;
}
// 移动端 1 张/页，PC 2 张/页
function pageCount() {
  return isMobile() ? 1 : 2;
}

function setupPager(cardsSelector, containerSelector, pagerId) {
  const cards = Array.from(document.querySelectorAll(cardsSelector));
  const container = document.querySelector(containerSelector);
  const pager = document.getElementById(pagerId);
  if (!cards.length || !container || !pager) return;

  let totalPage = Math.ceil(cards.length / pageCount());
  let currentPage = 1;

  function showCards() {
    const per = pageCount();
    const start = (currentPage - 1) * per;
    const end = start + per;
    cards.forEach((card, i) => {
      card.style.display = i >= start && i < end ? "" : "none";
    });
  }

  function renderPager() {
    pager.innerHTML = "";
    for (let i = 1; i <= totalPage; i++) {
      const btn = document.createElement("button");
      btn.textContent = i;
      btn.className = i === currentPage ? "page-btn active" : "page-btn";
      btn.addEventListener("click", () => {
        currentPage = i;
        showCards();
        renderPager();
      });
      pager.appendChild(btn);
    }
  }

  // 锁定容器最小高度，避免切页时各页卡片总高度不同导致页面跳动
  function lockHeight() {
    const saved = currentPage;
    let maxHeight = 0;
    for (let p = 1; p <= totalPage; p++) {
      currentPage = p;
      showCards();
      maxHeight = Math.max(maxHeight, container.offsetHeight);
    }
    const style = getComputedStyle(container);
    const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    container.style.minHeight = Math.max(0, maxHeight - padY) + "px";
    currentPage = saved;
    showCards();
  }

  // 跨断点时每页张数变化，需重算总页数并重新锁定高度
  function recalc() {
    totalPage = Math.ceil(cards.length / pageCount());
    if (currentPage > totalPage) currentPage = totalPage;
    renderPager();
    lockHeight();
  }

  renderPager();
  lockHeight();

  pagers.push(recalc);
}

function initHome() {
  pagers.length = 0;
  setupPager(".static-item--box", ".static-item--container", "static-item--page");
  setupPager("#js-item .mini-card", "#js-item .mini-card--container", "js-item--page");
}

// 窗口尺寸变化时重新计算，避免缓存的最小高度失效
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    pagers.forEach((recalc) => recalc());
  }, 150);
});

/* ========== 主题：主题色 + 亮暗模式 ========== */
const PRESET_COLORS = [
  "#2e7be0", // 蓝（默认）
  "#16a34a", // 绿
  "#9333ea", // 紫
  "#db2777", // 粉
  "#ea580c", // 橙
  "#0d9488", // 青
];

const root = document.documentElement;
const darkToggleBtn = document.getElementById("dark-toggle");
const colorPicker = document.getElementById("theme-color-picker");
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const themePanel = document.getElementById("theme-panel");
const swatchesBox = document.getElementById("theme-swatches");

function currentTheme() {
  return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function setTheme(theme) {
  root.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("theme", theme);
  } catch (e) {}
  updateDarkButton();
}

function updateDarkButton() {
  if (!darkToggleBtn) return;
  darkToggleBtn.textContent = currentTheme() === "dark" ? "☀️ 浅色" : "🌙 深色";
  darkToggleBtn.setAttribute("aria-label", currentTheme() === "dark" ? "切换为浅色" : "切换为深色");
}

function setThemeColor(color) {
  root.style.setProperty("--primary", color);
  try {
    localStorage.setItem("theme-color", color);
  } catch (e) {}
  if (colorPicker) colorPicker.value = color;
}

if (darkToggleBtn) {
  darkToggleBtn.addEventListener("click", () => {
    setTheme(currentTheme() === "dark" ? "light" : "dark");
  });
}

if (colorPicker) {
  colorPicker.addEventListener("input", (e) => setThemeColor(e.target.value));
}

// 预设色板
PRESET_COLORS.forEach((color) => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "swatch";
  btn.style.background = color;
  btn.title = color;
  btn.setAttribute("aria-label", "主题色 " + color);
  btn.addEventListener("click", () => setThemeColor(color));
  swatchesBox.appendChild(btn);
});

// 浮动齿轮开关面板
if (themeToggleBtn && themePanel) {
  themeToggleBtn.addEventListener("click", () => {
    themePanel.hidden = !themePanel.hidden;
  });
  // 点击面板外部关闭
  document.addEventListener("click", (e) => {
    if (!themePanel.hidden && !themePanel.contains(e.target) && e.target !== themeToggleBtn) {
      themePanel.hidden = true;
    }
  });
}

/* ========== 初始化 ========== */
// 页脚年份自动更新
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

// 主题 UI 状态同步（首次渲染时按钮文字 / 取色器值）
updateDarkButton();
// 取色器只接受 #rrggbb；从 :root 读取的可能是 rgb()，需校验格式
const savedColor = getComputedStyle(root).getPropertyValue("--primary").trim();
if (colorPicker && /^#[0-9a-f]{6}$/i.test(savedColor)) {
  colorPicker.value = savedColor;
}

// 启动路由
render();
