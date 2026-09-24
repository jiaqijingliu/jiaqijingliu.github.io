---
title: 全量重渲染的代价：滚动位置归零、动画重放
date: 2026-09-06
tags: [JavaScript, DOM]
summary: 待办应用每次改动都重建整个列表。写起来最简单，但有两个不容易第一时间注意到的副作用。
---

待办应用每次改动都重建整个列表。写起来最简单，但有两个不容易第一时间注意到的副作用。

- `listEl.innerHTML = ""` 之后重建所有行，滚动容器 `.list` 的 `scrollTop` 会一起归零 —— 滚到列表下面再在搜索框敲一个字，视图会跳回顶部。
- CSS 动画是按元素挂载触发的。重建出来的行都是新元素，`@keyframes slideIn` 于是一次全部重放 —— 在搜索框里每敲一个字，整个列表就集体滑入一遍。
- 不必推翻架构也能修：重建前存下 `scrollTop` 再还原，或者改成事件委托 + 只更新变化的行。在重建模式下，给每一行单独 `addEventListener` 也是白付的开销。

## 最小代价的修法

```js
function render(list) {
  const scroller = document.querySelector(".list");
  const keep = scroller.scrollTop;   // 先把位置存下来
  scroller.innerHTML = "";
  list.forEach((item) => scroller.appendChild(createRow(item)));
  scroller.scrollTop = keep;         // 重建完再还原
}
```

`scrollTop` 在元素内容清空时会归零，但容器本身还在，所以赋值回去是有效的。

## 动画问题不适合用同一招

滚动位置能还原，动画重放却不能 —— 它是「新元素挂载」这个事实本身触发的，没有状态可以恢复。三个可选方向：

1. 只在**首次**渲染时挂动画类，后续更新不加；
2. 把入场动画挪到 `@starting-style` / View Transitions，让浏览器区分「新增」和「已存在」；
3. 干脆改成事件委托 + 精准更新，从根上避免元素重建。

## 顺带一提：事件委托

全量重建时如果给每一行都绑了监听，那些监听会随着旧元素一起被丢弃，白白付了绑定开销。改成在容器上委托一次：

```js
scroller.addEventListener("click", (e) => {
  const row = e.target.closest(".item");
  if (!row) return;
  // 从 row.dataset 里拿 id，再决定删 / 改
});
```

这样重建多少次，监听始终只有一个。
