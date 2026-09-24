---
title: navigator.clipboard 只在安全上下文可用
date: 2026-08-28
tags: [JavaScript, 浏览器 API]
summary: 名片页的「点击复制联系方式」，在 https 下正常，直接双击打开 html 文件就失效了。
---

名片页的「点击复制联系方式」，在 https 下正常，直接双击打开 html 文件就失效了。

- `navigator.clipboard` 只在**安全上下文**（https 或 localhost）下存在。用 `file://` 或普通 http 打开时它是 `undefined`，直接调用会报错。
- 回退方案是经典的三步：建一个隐藏 `<textarea>` → `select()` 选中 → `document.execCommand("copy")` → 移除节点。这个 API 已经废弃，但兼容性最广。
- 把两条路径封装进一个 async 函数并返回布尔值，调用方只管按真假提示「已复制」或「复制失败，请手动选择」，不用自己判断该走哪条分支。

## 封装成返回布尔值的函数

```js
async function copyText(text) {
  // 路线一：安全上下文下的标准 API
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // 用户拒绝授权、页面失焦等情况会走到这里，继续往下试
    }
  }

  // 路线二：execCommand 回退
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;top:-9999px;opacity:0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch (e) {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}
```

调用方就干净了：

```js
const ok = await copyText(text);
toast(ok ? "已复制" : "复制失败，请手动选择");
```

## 两个容易忽略的点

- **不要用 `display: none` 隐藏 textarea。** 隐藏的元素没法 `select()`，复制必然失败。用 `position: fixed` 挪到视口外是常规做法。
- **`window.isSecureContext` 比判断 `location.protocol` 准。** 它把 localhost、`127.0.0.1`、以及通过 https 加载的 iframe 都算进去，和浏览器自己的判断标准一致。

## 为什么还是保留废弃 API

`execCommand("copy")` 已被标记废弃，但没有替代品能覆盖非安全上下文 —— 而「本地双击打开 html 预览」这种场景恰恰就是非安全上下文。所以两条路都得留着。
