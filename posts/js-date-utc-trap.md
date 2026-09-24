---
title: new Date("YYYY-MM-DD") 被当成 UTC
date: 2026-09-14
tags: [JavaScript, Date]
summary: 倒计时项目里，用户选定目标日期后，不同时区算出来的剩余天数会差一天。问题出在日期字符串的解析上。
---

倒计时项目里，用户选定目标日期后，不同时区算出来的剩余天数会差一天。问题出在日期字符串的解析上。

- `new Date("2026-01-01")` 这种纯日期字符串，按规范是以 **UTC 午夜**解析的；而 `new Date(2026, 0, 1)` 用的是本地时间。两者看起来一样，差 8 小时。
- 代码本意是把截止时间设到当天 23:59:59，用的是本地时间的 `setHours(23, 59, 59, 999)`。在 UTC+8 下，UTC 午夜正好是当天早上 8 点，所以一直没暴露问题；换成负时区，UTC 午夜其实是*前一天*，截止时间就整体提前了一天。
- 要拿「今天的本地日期字符串」，手写 `YYYY-MM-DD` 比 `toISOString().slice(0, 10)` 稳 —— 后者同样是 UTC，晚上打开会拿到明天的日期。

## 手写一个本地的 todayStr()

```js
function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
```

关键在于三个方法都取的**本地时间**：`getFullYear` / `getMonth` / `getDate`。对应的 `getUTCFullYear` 系列才是 UTC。

## 从字符串还原日期时也要当心

如果表单 `<input type="date">` 给的是 `"2026-01-01"`，想拿它构造一个**本地**零点的 Date，别直接 `new Date(value)`：

```js
// ✗ 按 UTC 解析，UTC+8 下变成 1 月 1 日早上 8 点
const d1 = new Date(value);

// ✓ 按本地时间解析
const [y, m, day] = value.split("-").map(Number);
const d2 = new Date(y, m - 1, day);
```

用 `d.getDate()` 取回来验证一下，能直观看出差别：`d1` 在东八区是 1 号，在西半球就变成 31 号了。

## 结论

日期只有「时刻」的概念，没有「日期」的概念。**凡是只关心年月日的地方，就只用手写字符串或本地时间构造函数，不要经过 `toISOString`。**
