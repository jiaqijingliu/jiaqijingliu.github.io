---
title: 用 SCSS map + @each 生成状态类，让 JS 不碰显示逻辑
date: 2026-08-19
tags: [CSS, Sass]
summary: 倒计时有 4 档显示精度（天 / 天时 / 天时分 / 天时分秒），每档要隐藏的单位都不一样。原本打算在 JS 里判断，最后放进 CSS 解决了。
---

倒计时有 4 档显示精度（天 / 天时 / 天时分 / 天时分秒），每档要隐藏的单位都不一样。原本打算在 JS 里判断，最后放进 CSS 解决了。

- 把 4 档规则写成一个 SCSS map：每档列出需要隐藏的单位，一次 `@each` 就生成全部选择器，不用手写十几条规则。
- JS 只负责把 `data-detail="dhms"` 写到卡片上，显示逻辑一行都不碰。以后加一档精度只需要改 map，不用动 JS。
- 好处是状态和样式始终同步：不会出现 JS 里加了新档位、CSS 忘了补规则，导致那一档什么都不显示的情况。

## map 的形状

「要隐藏的单位」比「要显示的单位」短，所以存前者：

```scss
// 精度档位 → 该档需要隐藏的时间单位
$detail-hide: (
  "d":    ("hour", "minute", "second"),
  "dh":   ("minute", "second"),
  "dhm":  ("second"),
  "dhms": (),
);
```

## 一次 @each 出全部规则

```scss
.countdown {
  .unit { display: flex; }

  @each $level, $units in $detail-hide {
    &[data-detail="#{$level}"] {
      @each $u in $units {
        .unit--#{$u} { display: none; }
      }
    }
  }
}
```

编译出来就是 `[data-detail="d"] .unit--hour { display: none }` 这一整套，四档共 6 条规则，全是自动生成的。

JS 侧只剩一行：

```js
card.dataset.detail = settings.detail; // "d" | "dh" | "dhm" | "dhms"
```

## 为什么值得这么绕

如果放在 JS 里，得写四组 `querySelectorAll` 再逐个改 `style.display`，而且**每次切换档位都要重新执行一遍**。放在 CSS 里，切换只是改一个属性值，浏览器自己做样式重算。

更实际的好处是维护性：新增一档精度 = 往 map 里加一行。忘了补规则这件事从根上不可能发生 —— 因为规则就是 map 生成的。

## 迁移到原生 CSS 的话

这个模式在原生 CSS 里没有直接对应物（`@each` 是 Sass 的编译期循环）。如果不想依赖 Sass，可以退回手写：

```css
[data-detail="d"] .unit--hour,
[data-detail="d"] .unit--minute,
[data-detail="d"] .unit--second { display: none; }
```

规则数量不多时完全可接受，只是失去了「单一数据源」这个性质。
