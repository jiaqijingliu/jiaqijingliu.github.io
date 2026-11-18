// ============================================================
//  倒计时 · Countdown — 逻辑
// ============================================================

(() => {
  "use strict";

  // ---------- DOM 引用 ----------
  const targetNameInput = document.getElementById("target-name");
  const targetDateInput = document.getElementById("target-date");
  const setBtn = document.getElementById("set-target");

  const card = document.querySelector(".card");
  const targetLabel = document.getElementById("target-label");
  const encouragementEl = document.getElementById("encouragement");

  const valueEls = {
    days: document.getElementById("v-days"),
    hours: document.getElementById("v-hours"),
    minutes: document.getElementById("v-minutes"),
    seconds: document.getElementById("v-seconds"),
  };
  const unitEls = {
    days: document.querySelector('.unit[data-unit="days"]'),
    hours: document.querySelector('.unit[data-unit="hours"]'),
    minutes: document.querySelector('.unit[data-unit="minutes"]'),
    seconds: document.querySelector('.unit[data-unit="seconds"]'),
  };

  const switchBtns = Array.from(document.querySelectorAll(".switch__btn"));

  // ---------- 状态 ----------
  const STORAGE_KEY = "countdown.target.v1";
  const state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch {
      /* 隐私模式等场景下静默失败 */
    }
    return {};
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* 隐私模式等场景下静默失败 */
    }
  }

  // 默认目标：30 天后
  function defaultTargetDate() {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return toISODate(d);
  }

  function toISODate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // ---------- 鼓励词 ----------
  const ENCOURAGEMENTS = [
    {
      keywords: ["高考", "中考", "考研", "期末", "考试", "四级", "六级", "英语", "面试", "笔试", "答辩", "论文"],
      messages: [
        "每一份努力都不会被辜负，加油！",
        "稳住心态，你就是下一个上岸的人。",
        "把今天的每一秒都用成最好的状态。",
        "坚持到最后的人，运气都不会太差。",
      ],
    },
    {
      keywords: ["生日", "诞辰", "周岁"],
      messages: [
        "值得期待的日子，总是闪闪发光。",
        "悄悄准备一份惊喜吧，那一天一定很甜。",
        "又长大一岁，去拥抱更好的自己。",
      ],
    },
    {
      keywords: ["新年", "春节", "元旦", "除夕", "放假"],
      messages: [
        "团圆的日子正在赶来，一切都会变好。",
        "倒数的每一天，都是离温暖更近一步。",
      ],
    },
    {
      keywords: ["毕业", "旅行", "旅游", "度假", "出发"],
      messages: [
        "远方在招手，把期待装进行囊吧。",
        "世界很大，值得你为它倒数。",
      ],
    },
    {
      keywords: ["婚礼", "结婚", "周年", "纪念"],
      messages: [
        "把日子过成诗，把期待酿成蜜。",
        "那一天，会成为回忆里最亮的一页。",
      ],
    },
    {
      keywords: ["工资", "发薪", "奖金", "发钱"],
      messages: [
        "快乐就是这么朴实无华，钱包即将回血。",
        "再坚持一下，账户余额要上涨啦。",
      ],
    },
  ];

  const DEFAULT_MESSAGES = [
    "每一秒都在靠近，加油！",
    "把平凡的日子，过成值得期待的旅程。",
    "时间会奖励坚持的人。",
    "别急，好东西都值得等待。",
  ];

  // 根据目标名称 + 剩余时间生成鼓励词
  function pickEncouragement(name, daysLeft, isPast) {
    const n = (name || "").trim();

    // 已过期
    if (isPast) {
      return "那一天已经到来啦，愿一切如你所愿 ✨";
    }
    // 就是今天
    if (daysLeft <= 0) {
      return "就是今天！去迎接属于你的时刻吧 🎉";
    }

    // 关键词匹配
    const hit = ENCOURAGEMENTS.find((e) =>
      e.keywords.some((k) => n.includes(k))
    );
    const pool = hit ? hit.messages : DEFAULT_MESSAGES;

    // 距离很近时，追加一句增强语气
    let msg = pickStable(pool, n);
    if (daysLeft <= 7) {
      msg = `近在眼前了，${msg}`;
    }
    return msg;
  }

  // 稳定（同一目标不随机跳动）地选一条
  function pickStable(pool, seed) {
    let h = 0;
    const s = String(seed);
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) >>> 0;
    }
    return pool[h % pool.length];
  }

  // ---------- 渲染 ----------
  function pad(n, len = 2) {
    return String(n).padStart(len, "0");
  }

  let lastSeconds = null;

  function tick() {
    const target = new Date(state.targetDate);
    target.setHours(23, 59, 59, 999); // 目标日期当天 23:59:59 为止

    const now = new Date();
    let diff = target - now;
    const isPast = diff <= 0;
    const daysLeft = Math.floor(diff / 86400000);

    if (isPast) diff = 0;

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    valueEls.days.textContent = String(days);
    valueEls.hours.textContent = pad(hours);
    valueEls.minutes.textContent = pad(minutes);
    valueEls.seconds.textContent = pad(seconds);

    // 秒数跳动动画
    if (lastSeconds !== null && seconds !== lastSeconds) {
      unitEls.seconds.classList.remove("unit--tick");
      // 触发重排以重播动画
      void unitEls.seconds.offsetWidth;
      unitEls.seconds.classList.add("unit--tick");
    }
    lastSeconds = seconds;

    // 鼓励词（仅在状态变化时更新，避免每秒重算 DOM）
    const label = (state.targetName || "我的目标").trim() || "我的目标";
    if (targetLabel.dataset.text !== label || encouragementEl.dataset.key !== state.targetDate) {
      targetLabel.textContent = label;
      targetLabel.dataset.text = label;
      encouragementEl.textContent = pickEncouragement(state.targetName, daysLeft, isPast);
      encouragementEl.dataset.key = state.targetDate;
    }
  }

  // ---------- 事件 ----------
  function applyDetailLevel(level) {
    card.dataset.detail = level;
    switchBtns.forEach((b) =>
      b.classList.toggle("is-active", b.dataset.level === level)
    );
    state.detail = level;
    saveState();
  }

  function setTarget() {
    const name = targetNameInput.value.trim() || "我的目标";
    const date = targetDateInput.value || defaultTargetDate();
    state.targetName = name;
    state.targetDate = date;
    saveState();
    targetLabel.textContent = name;
    targetLabel.dataset.text = "";
    encouragementEl.dataset.key = "";
    tick();
  }

  setBtn.addEventListener("click", setTarget);
  targetNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") setTarget();
  });

  switchBtns.forEach((btn) =>
    btn.addEventListener("click", () => applyDetailLevel(btn.dataset.level))
  );

  // ---------- 初始化 ----------
  function init() {
    if (!state.targetName && !state.targetDate) {
      state.targetName = "高考";
      state.targetDate = defaultTargetDate();
      state.detail = "dhms";
    }
    state.detail = state.detail || "dhms";

    targetNameInput.value = state.targetName;
    targetDateInput.value = state.targetDate;
    targetDateInput.min = toISODate(new Date());
    applyDetailLevel(state.detail);

    tick();
    setInterval(tick, 1000);
  }

  init();
})();
