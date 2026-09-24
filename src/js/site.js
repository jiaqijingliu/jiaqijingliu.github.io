/* ========== 站点公共脚本：外观设置 + 页脚 ==========
   首页（SPA）和 blog/ 下的独立文章页都要用，所以单独拆出来。
   文章页只加载本文件，不加载带路由的 main.js。

   外观设置分两类：
   1. 枚举值（字体、宽度、可选中等）——「值 → 视觉」全部写在 CSS 里
      （_var_global.scss 的 html[data-*] 规则），本文件只把选择写回属性。
   2. 连续值（字号）——没法用枚举表达，只能走内联样式。
   这样 <head> 里那段防闪烁的内联脚本只需要几行 setAttribute / setProperty，
   不用把整张对照表在 JS 里再抄一份。 */
(function () {
  "use strict";

  const root = document.documentElement;

  /* ---------- localStorage：一律包 try/catch ----------
     隐私模式下 setItem 会直接抛异常，不能让它中断后续初始化 */
  function store(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
  }
  function read(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }
  function drop(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  }

  /* ---------- 主题：亮暗模式 ---------- */
  const PRESET_COLORS = [
    "#2e7be0", // 蓝（默认）
    "#16a34a", // 绿
    "#9333ea", // 紫
    "#db2777", // 粉
    "#ea580c", // 橙
    "#0d9488", // 青
  ];

  const darkToggleBtn = document.getElementById("dark-toggle");
  const colorPicker = document.getElementById("theme-color-picker");
  const themeToggleBtn = document.getElementById("theme-toggle-btn");
  const themePanel = document.getElementById("theme-panel");
  const swatchesBox = document.getElementById("theme-swatches");

  function prefersDark() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function currentTheme() {
    return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function setTheme(theme, persist) {
    root.setAttribute("data-theme", theme);
    if (persist !== false) store("theme", theme);
    updateDarkButton();
  }

  function updateDarkButton() {
    if (!darkToggleBtn) return;
    const dark = currentTheme() === "dark";
    darkToggleBtn.textContent = dark ? "☀️ 浅色" : "🌙 深色";
    darkToggleBtn.setAttribute("aria-label", dark ? "切换为浅色" : "切换为深色");
  }

  if (darkToggleBtn) {
    darkToggleBtn.addEventListener("click", () => {
      setTheme(currentTheme() === "dark" ? "light" : "dark");
    });
  }

  /* ---------- 主题色 ---------- */
  // 当前主题色的色板高亮；自定义色不匹配任何预设时，全部不高亮
  function markSwatch(color) {
    if (!swatchesBox) return;
    const want = String(color).toLowerCase();
    swatchesBox.querySelectorAll(".swatch").forEach((b) => {
      b.classList.toggle("is-on", b.dataset.color === want);
    });
  }

  function setThemeColor(color, persist) {
    root.style.setProperty("--primary", color);
    if (persist !== false) store("theme-color", color);
    if (colorPicker) colorPicker.value = color;
    markSwatch(color);
  }

  if (colorPicker) {
    colorPicker.addEventListener("input", (e) => setThemeColor(e.target.value));
  }

  if (swatchesBox) {
    PRESET_COLORS.forEach((color) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "swatch";
      btn.dataset.color = color;
      btn.style.background = color;
      btn.title = color;
      btn.setAttribute("aria-label", "主题色 " + color);
      btn.addEventListener("click", () => setThemeColor(color));
      swatchesBox.appendChild(btn);
    });
  }

  /* ---------- 枚举型可调项 ----------
     这里只存「显示了什么字」，具体数值在 CSS 的 html[data-*] 规则里 */
  const LOGO_FONTS = {
    script: { label: "手写", title: "Dancing Script" },
    brush: { label: "笔刷", title: "Kaushan Script" },
    elegant: { label: "飘逸", title: "Great Vibes" },
    round: { label: "圆润", title: "Pacifico" },
  };
  // 键名保持稳定：serif 沿用原名而不是改成 song，否则已经选过这项的用户
  // 存的是旧键，applyGroup 找不到会静默回退成「无衬线」，设置被悄悄重置。
  const TEXT_FONTS = {
    sans: { label: "无衬线", title: "系统默认无衬线（微软雅黑 / 苹方）" },
    serif: { label: "宋体", title: "宋体 SimSun / Songti SC" },
    kai: { label: "楷体", title: "楷体 KaiTi / Kaiti SC" },
    fangsong: { label: "仿宋", title: "仿宋 FangSong / STFangsong" },
    rounded: { label: "圆体", title: "幼圆 YouYuan / 圆体-简 Yuanti SC" },
  };
  const WIDTHS = {
    sm: { label: "窄" },
    md: { label: "标准" },
    lg: { label: "宽" },
  };
  const SELECTS = {
    off: { label: "不可选中", title: "鼠标无法选中文字" },
    on: { label: "可选中", title: "恢复正常的文字选中" },
  };

  const optionGroups = [
    {
      boxId: "logo-font-opts",
      attr: "data-logo-font",
      storeKey: "logo-font",
      dict: LOGO_FONTS,
      fallback: "script",
    },
    {
      boxId: "text-font-opts",
      attr: "data-font",
      storeKey: "text-font",
      dict: TEXT_FONTS,
      fallback: "sans",
    },
    {
      boxId: "width-opts",
      attr: "data-width",
      storeKey: "content-width",
      dict: WIDTHS,
      fallback: "md",
    },
    {
      boxId: "select-opts",
      attr: "data-select",
      storeKey: "text-select",
      dict: SELECTS,
      fallback: "off",
    },
  ];

  function applyGroup(g, key) {
    const k = g.dict[key] ? key : g.fallback;
    root.setAttribute(g.attr, k);
    if (g.box) {
      g.box.querySelectorAll(".theme-opt").forEach((b) => {
        b.classList.toggle("is-on", b.dataset.key === k);
      });
    }
  }

  function buildOptionGroups() {
    optionGroups.forEach((g) => {
      const box = document.getElementById(g.boxId);
      if (!box) return;
      g.box = box;

      Object.keys(g.dict).forEach((key) => {
        const item = g.dict[key];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "theme-opt";
        btn.dataset.key = key;
        btn.textContent = item.label;
        btn.title = item.title || item.label;
        btn.addEventListener("click", () => {
          applyGroup(g, key);
          store(g.storeKey, key);
        });
        box.appendChild(btn);
      });

      applyGroup(g, read(g.storeKey) || g.fallback);
    });
  }

  /* ---------- 字号滑块（连续值，只能走内联样式） ---------- */
  const fontRange = document.getElementById("font-size-range");
  const fontValue = document.getElementById("font-size-value");
  const FONT_MIN = 13;
  const FONT_MAX = 20;
  const FONT_DEFAULT = 16;

  function syncFontUI(px) {
    if (fontRange) fontRange.value = String(px);
    if (fontValue) fontValue.textContent = px + "px";
  }

  function setFontSize(px, persist) {
    const n = Math.min(Math.max(Number(px) || FONT_DEFAULT, FONT_MIN), FONT_MAX);
    root.style.fontSize = n + "px";
    syncFontUI(n);
    if (persist !== false) store("font-size", String(n));
  }

  if (fontRange) {
    fontRange.addEventListener("input", (e) => setFontSize(e.target.value));
  }

  /* ---------- 悬浮按钮：拖动 + 吸附到边缘并自动隐藏 ---------- */
  const DOCKS = ["left", "right"];

  function clampPct(p) {
    return Math.min(Math.max(p, 6), 94); // 别让它贴到屏幕最上/最下
  }

  function setDock(side, pct, persist) {
    const s = DOCKS.indexOf(side) >= 0 ? side : "right";
    root.setAttribute("data-dock", s);
    if (typeof pct === "number") {
      root.style.setProperty("--dock-y", clampPct(pct) + "%");
    }
    if (persist !== false) {
      store("toggle-dock", s);
      if (typeof pct === "number") store("toggle-y", String(clampPct(pct)));
    }
  }

  function placePanel() {
    if (!themePanel || themePanel.hidden) return;
    // 面板要跟着按钮走，但不能顶出视口
    const r = themeToggleBtn.getBoundingClientRect();
    const h = themePanel.offsetHeight;
    const maxTop = Math.max(window.innerHeight - h - 12, 12);
    const top = Math.min(Math.max(r.top + r.height / 2 - h / 2, 12), maxTop);
    themePanel.style.top = top + "px";
  }

  function openPanel() {
    if (!themePanel || !themeToggleBtn) return;
    themePanel.hidden = false;
    // 打开期间按钮必须保持滑出，否则鼠标一移进面板它就缩回边缘了
    themeToggleBtn.classList.add("is-open");
    placePanel(); // 得先显示才能量到高度
  }

  function closePanel() {
    if (!themePanel || !themeToggleBtn) return;
    themePanel.hidden = true;
    themeToggleBtn.classList.remove("is-open");
  }

  let suppressClick = false;

  if (themeToggleBtn && themePanel) {
    let drag = null;

    themeToggleBtn.addEventListener("pointerdown", (e) => {
      if (e.button && e.button !== 0) return; // 只响应左键 / 触摸
      suppressClick = false; // 每次交互都重新计，避免上一次的标记吃掉这一次的点击

      const r = themeToggleBtn.getBoundingClientRect();
      drag = {
        id: e.pointerId,
        offsetX: e.clientX - r.left,
        offsetY: e.clientY - r.top,
        startX: e.clientX,
        startY: e.clientY,
        size: r.width,
        moved: false,
      };
      // 捕获指针后，即使手指/鼠标移出按钮，move/up 事件也还是会回到这里
      themeToggleBtn.setPointerCapture(e.pointerId);
    });

    themeToggleBtn.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;

      if (!drag.moved) {
        // 4px 抖动阈值：小于它仍按「点击」处理，避免手一抖把按钮挪走
        const far = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
        if (far < 4) return;
        drag.moved = true;
        themeToggleBtn.classList.add("is-dragging");
        closePanel(); // 拖动时先收起面板
      }

      const maxX = window.innerWidth - drag.size - 4;
      const maxY = window.innerHeight - drag.size - 4;
      const x = Math.min(Math.max(e.clientX - drag.offsetX, 4), maxX);
      const y = Math.min(Math.max(e.clientY - drag.offsetY, 4), maxY);
      themeToggleBtn.style.left = x + "px";
      themeToggleBtn.style.top = y + "px";
    });

    function endDrag(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const moved = drag.moved;
      drag = null;

      if (moved) {
        // 先量位置再清内联样式 —— 清掉之后按钮会立刻弹回吸附位置，那时再量就错了
        const r = themeToggleBtn.getBoundingClientRect();
        const side = r.left + r.width / 2 < window.innerWidth / 2 ? "left" : "right";
        const pct = ((r.top + r.height / 2) / window.innerHeight) * 100;
        setDock(side, pct);
        suppressClick = true;
      }

      themeToggleBtn.classList.remove("is-dragging");
      themeToggleBtn.style.left = "";
      themeToggleBtn.style.top = "";
    }

    themeToggleBtn.addEventListener("pointerup", endDrag);
    themeToggleBtn.addEventListener("pointercancel", endDrag);

    // 齿轮开关面板（刚拖动过的那一次不算点击）
    themeToggleBtn.addEventListener("click", () => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      if (themePanel.hidden) openPanel();
      else closePanel();
    });

    // 点击面板外部关闭
    document.addEventListener("click", (e) => {
      if (
        !themePanel.hidden &&
        !themePanel.contains(e.target) &&
        e.target !== themeToggleBtn
      ) {
        closePanel();
      }
    });

    // 视口尺寸变了要重新贴一次，否则面板可能跑到屏幕外
    window.addEventListener("resize", placePanel);
  }

  /* ---------- 恢复默认 ---------- */
  const resetBtn = document.getElementById("theme-reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      // 后两个是旧版本的键，顺手一起清掉
      [
        "theme",
        "theme-color",
        "logo-font",
        "text-font",
        "font-size",
        "content-width",
        "text-select",
        "toggle-dock",
        "toggle-y",
        "toggle-corner",
        "font-scale",
      ].forEach(drop);

      // 逐项套回默认值（而不是只清 storage），面板上的高亮才会跟着复位
      setTheme(prefersDark() ? "dark" : "light", false);
      setThemeColor(PRESET_COLORS[0], false);
      optionGroups.forEach((g) => applyGroup(g, g.fallback));
      // 字号不写死成 16px，移除内联值交回浏览器默认字号（尊重用户的无障碍设置）
      root.style.removeProperty("font-size");
      syncFontUI(FONT_DEFAULT);
      setDock("right", 45, false);
      closePanel();
    });
  }

  /* ---------- 导航：滚动后再出现分隔阴影 ---------- */
  const navEl = document.getElementById("nav");
  if (navEl) {
    const syncNavShadow = () =>
      navEl.classList.toggle("is-scrolled", window.scrollY > 8);
    syncNavShadow();
    window.addEventListener("scroll", syncNavShadow, { passive: true });
  }

  /* ---------- 初始化 ---------- */
  // 页脚年份自动更新
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // 主题按钮文字 + 面板各项的当前值
  // （属性本身已由 <head> 里的内联脚本设好，这里只是把 UI 状态对齐）
  updateDarkButton();
  buildOptionGroups();

  // 字号：没存过就不要动，沿用浏览器默认
  const storedSize = Number(read("font-size"));
  if (storedSize) {
    root.style.fontSize = Math.min(Math.max(storedSize, FONT_MIN), FONT_MAX) + "px";
    syncFontUI(storedSize);
  } else {
    syncFontUI(FONT_DEFAULT);
  }

  // 当前主题色：读存下来的值，格式不对（被手改过）就退回默认预设。
  // 这里不读 getComputedStyle —— 它返回的是 rgb(46, 123, 224)，
  // 和色板上 dataset 里的 #2e7be0 对不上，会导致默认色反而不高亮。
  const storedColor = read("theme-color");
  const initialColor = /^#[0-9a-f]{6}$/i.test(storedColor || "")
    ? storedColor
    : PRESET_COLORS[0];
  if (colorPicker) colorPicker.value = initialColor;
  markSwatch(initialColor);
})();
