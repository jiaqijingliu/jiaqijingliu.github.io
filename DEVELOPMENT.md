# 《蝴蝶效应：人生重启》开发文档

> 面向维护者 / 二次开发者的技术文档。游戏入口：`#/game/butterfly`（游戏大厅第三张卡）。

## 1. 在站点架构中的位置

本游戏严格遵循 StayInTop 站点的「按路由注入」游戏架构（详见 `dev/docs/game.md` 的「加一款新游戏」一节）：

```
浏览器请求 #/game/butterfly
  → main.js parseHash() 查 GAMES 表 → fetch partials/games/butterfly.html
  → main.js loadGameScript("butterfly") 注入 assets/js/game-butterfly.js
  → game-butterfly.js 的 MutationObserver 认领 .bf-root 挂载点
  → createUI(mount) 构建全部界面；切页时 dispose() 摘净
```

**接入清单（四处 + 构建两处，全部已就位）**：

| 位置 | 文件 |
|---|---|
| 逻辑入口 | `dev/js/game-butterfly.js`（命名必须对上 id `butterfly`） |
| 页面片段 | `dev/html/partials/games/butterfly.html`（只有标记，无 `<script>`） |
| 路由表 | `dev/js/main.js` 的 `GAMES.butterfly` |
| 大厅卡片 | `dev/html/partials/game.html` 第三张 `.game-card` |
| 构建脚本 | `package.json` `build:js`（`--bundle --format=iife`，见下） |
| 静态片段 | `scripts/build.js` 的 `STATIC_HTML` |

**构建注意**：`game-butterfly.js` 使用 ESM `import` 引入子模块，而站点其余脚本是无模块的 IIFE。esbuild 多入口混合时默认 format 会把 ESM 入口的 import 语句原样保留（产物只有 374B），**必须显式 `--bundle --format=iife`**——已在 `package.json` 固化，不要删。

## 2. 源码结构（全部在 `dev/js/butterfly/`）

| 文件 | 职责 | 依赖 |
|---|---|---|
| `engine.js` | 游戏引擎：状态、时间、行动、事件引擎、蝴蝶排程、关系、世界、职业、结局判定、序列化、无头模拟 | JSON 数据 |
| `ui.js` | 全部 DOM 界面：标题 / 出生 / HUD / 事件弹窗 / 命运之书 / 蝴蝶图 / 关系 / 存档 / 结局 | engine, pixel, audio, save |
| `pixel.js` | 程序化像素美术：12 种场景 painter、人物 sprite、头像 | 无 |
| `audio.js` | WebAudio 合成 BGM（八音盒循环）与音效 | 无 |
| `save.js` | LocalStorage 4 槽存档、版本迁移、损坏隔离 | engine |
| `skills.json` | 7 种技能定义 | — |
| `jobs.json` | 6 种职业（入职条件 / 收入 / 晋升 / 等级 / 专属事件） | — |
| `endings.json` | 11 个结局 + 兜底 + 早逝告别词（按 priority 判定） | — |
| `events-child/teen/young/mid/late.json` | 骨干剧情事件（96 个，含完整因果链） | — |
| `events-daily.json` | 日常/意外/世界事件包（26 个，多数带 2-3 情境变体，once:false 靠冷却复用） | — |
| `events-social.json` | 社交/朋友/恋爱事件包（24 个） | — |
| `events-career.json` | 职场/财富/晚年事件包（20 个） | — |
| `events-goal.json` | 人生目标节点（20 岁立志 / 42 岁换目标） | — |
| `tool-validate.js` | 数据校验器（node 直跑，不进 bundle） | — |
| `tool-simulate.js` | 无头模拟器（多策略跑完整人生） | `_sim_bundle.cjs` |
| `tool-fix-fields.js` | 一次性字段修复工具（历史遗留，可删） | — |

**事件总数 174**（骨干 96 + 扩充包 78），变体另计。

**为什么逻辑与数据分离**：事件 / 职业 / 技能 / 结局全部是数据（JSON），引擎是通用执行器。加内容不需要碰逻辑，改平衡不需要找代码。

## 3. 引擎核心概念

### 3.1 状态对象（state）

引擎唯一状态是一个可 JSON 序列化的对象（Set 在 serialize 时转为 `{__set:[...]}`）：

```
char      姓名/性别/城市/家庭/天赋/出生年
age/quarter/actionPoints   时间与行动点
attrs     智力/情商/健康/幸福/魅力/声望 (0-100)
money/knowledge/experience/energy/stress
skills    7 项技能 0-100
tags      隐藏标签 Set（tech_interest, resilient, ...）
flags     历史决策标记 Set（major_cs, startup_success, ...）
rels      人物数组 [{role, name, personality, rel, history[]}]
job/jobLevel   当前职业与等级
education/admission  学历档位(none/school/uni/elite)与高考录取档
married/hasChild/childBornAge
world     景气时代表 + 科技浪潮 + 当前状态
fired     已触发事件 id Set
pending   延迟排程队列 [{eventId, dueAge, cause, cond, chance, fromEvent, atAge}]
chains    已展开的蝴蝶因果链 [{fromEvent, fromAge, toEvent, atAge, cause}]
timeline  命运之书 [{age, quarter, year, text, kind}]
ending    死亡后填充
```

### 3.2 时间循环

`advanceQuarter(state)`：季度 +1 → 年度推进（age+1、世界、标签派生、里程碑队列、死亡判定）→ 新季度 3 AP → 收支结算 → 精力/压力自然变化 → **延迟排程命中则触发**（占用本季事件槽）→ 否则 65% 概率从随机池抽事件。

关键不变量：**一季最多一个事件**。年度队列事件（高考/求职等）触发后直接返回，否则会被随机 roll 覆盖（实测踩过的坑）。

### 3.3 事件 DSL

事件字段：

```jsonc
{
  "id": "ev_xxx",                  // 全局唯一，ev_ 前缀
  "title": "…", "desc": "…",       // 文案，支持 {name}{friend}{teacher}… 占位符
  "scene": "home",                 // 弹窗背景场景 id
  "category": "family",            // family/study/work/friend/love/money/health/social/special
  "minAge": 7, "maxAge": 12,       // 触发年龄窗（含边界）
  "weight": 30,                    // 随机池权重；0 = 只能被排程/队列触发
  "cond": { … },                   // 触发条件（AND，见下）
  "options": [
    {
      "id": "a",                   // 事件内唯一
      "label": "…", "result": "…",
      "hint": "…",                 // 选项副标题（可写条件提示）
      "req": { … },                // 不满足则选项隐藏（三选一变两选一）
      "goto": "ev_yyy",            // 选后接续事件（可选）
      "effects": { … }             // 效果（见下）
    }
  ]
}
```

**cond / req 条件键**：`tags` `notTags` `attrs` `skills` `skillsAny` `flags` `notFlags` `family` `job` `noJob` `education` `admission` `relMin` `moneyMin/moneyMax` `married` `hasChild` `chainsMin` `jobLevel` `worldEconomy`。

**effects 键**：`attrs`（六维） `energy` `stress` `money` `knowledge` `experience` `skills` `tags` `removeTags` `rel`（按角色桶） `flags` `job`（设职业，null=失业） `education` `married` `hasChild` `spawn`（生成 NPC） `schedule`（延迟排程，蝴蝶效应的核心） `log`（写入命运之书）。

**`result: "resolve:xxx"`**：动态结算器——高考、竞赛、创业成败等由引擎按人物状态 + 概率结算，返回文本并可 `goto` 下一个事件。结算器在 `engine.js` 的 `RESOLVERS` 表。

**`effects.schedule`（蝴蝶排程）**：

```jsonc
"schedule": [ { "eventId": "ev_code_contest", "atAge": 16,
                "cond": { "tags": ["tech_interest"] }, "chance": 1,
                "cause": "9岁得到第一本编程书" } ]
```

命中后记入 `state.chains`（只有 fromEvent 是真实事件 id 才记——引擎里程碑队列触发的节点是「人生起点」，不进因果图）。

### 3.4 事件变体 / 冷却 / 抽取日志（v2 新增）

- **变体**：事件可带 `"variants": [{title, desc}]`，`fireEvent` 时随机抽取写进事件副本（存档序列化副本本身，读档无缝）。
- **冷却**：`rollQuarterlyEvent` 跳过最近 4 个事件里出现过的 id；同类别在最近 4 事件里出现 2 次 → 权重 ×0.4、3 次 → 跳过。`state.recentEvents`（上限 12 条）随存档保存。
- **抽取日志**：`state.debugPicks`（上限 40 条）记录 `{age, pool, filtered, picked}`——排查「为什么某事件不出现」直接读这个字段。

### 3.5 恋爱倾向与 NPC 生成（v2 新增）

- `char.orientation`：hetero(88%) / homo(6%) / bi(6%)，出生随机；`loveGenderFor(state)` 统一决定恋爱 NPC 性别——**事件数据不写死对象性别**。
- `spawn.gender` 支持 `"same"`（室友等同性场景）与缺省（随机；lover/spouse 走倾向）。
- NPC 姓名从 SURNAMES/GIVEN_M/GIVEN_F 随机；personality/interest 缺省随机；年龄按 `ROLE_AGE_OFFSET` 与玩家年龄估算。

### 3.6 属性联动（v2 新增）

| 联动 | 公式 / 位置 |
|---|---|
| 精力上限 | `energyMax = 60 + 健康×0.4`（所有行动的 clamp 上限） |
| 行动效率 | `moraleFactor = 0.82 + 幸福/280`；压力>70 ×0.85；精力<25 ×0.8 → 学习/工作 |
| 结识新朋友 | 社交行动概率 `0.18 + 魅力/250 + 情商/400` |
| 休息质量 | 恢复量 × `(0.85 + 幸福/220)` |
| 工资 | × `(1 + 声望/500)` |
| 理财 | 收益率 `+声望/600` |
| 低健康 | 健康<30 → 每季度幸福 -1 |

### 3.7 人生目标（v2 新增）

`GOALS` 表（engine.js 内，8 种抱负）：`progress(state)/done(state)/applyReward(state)`。`effects.goal` 立下/更换目标；`advanceYear` 年度结算，完成时 `flags.add("goal_done_"+id)` + 奖励 + `out.goalDone`（UI toast）。20 岁 `ev_goal_pick`、42 岁 `ev_goal_review` 由引擎队列触发。

### 3.8 种子随机（v2 新增）

mulberry32：`seedRng(seed)` 设种子，`rng()` 全引擎统一随机入口；`state.seed` 随存档保存。读档恢复方式：`deserialize` 后调用 `seedRng(state.seed)`（由 save.read 完成）——**注意：读档续接的是重放起点，不是逐字节续接**；同种子整局重放可复现关键节点。

### 3.9 结局判定

`computeEnding` 按 `priority` 升序遍历 `endings.json`，第一个条件全过的生效；都不满足走 `fallback`。判定上下文含婚姻、家庭纽带（父母+配偶）、子女关系、朋友数、蝴蝶链数、遗憾标记等。

## 4. 像素美术（pixel.js）

- 逻辑分辨率 **160×120**，CSS `image-rendering: pixelated` 放大。`drawScene` 强制校正画布属性尺寸（否则新建 canvas 默认 300×150，画面只占左上角——实测踩过的坑）。
- 场景 painter 表：home / school / campus / office / hospital / lab / shop / outdoor / park / stage / dream / rain_room；`SCENE_ALIAS` 把事件与结局的 scene id 归一到这些 painter。
- 人物 sprite 是字符串网格画（`CHAR_GRID_ADULT/CHILD`），20 列 × N 行，2px 像素；按性别与年龄换衣色发色，600ms 两帧待机呼吸。
- 头像 `drawAvatar(canvas, role, gender)` 供事件弹窗与关系列表使用。
- 全部程序化生成，**零外部素材、零版权风险**。

## 5. 存档（save.js）

- 键：`game-butterfly-save-{1,2,3,auto}`，负载 `{v, t, label, state}`。
- 读档三级防御：JSON 解析失败 / 结构校验不过 / 版本过高 → 返回错误并**隔离**（不清槽、不崩游戏）。
- `migrate()` 目前是直通（v1）；改引擎状态结构时 `ENGINE_VERSION +1` 并在 migrate 里写升级路径。
- 跨局历史：`game-butterfly-history`（最近 12 段人生摘要），用于标题页展示与「前世记忆」解锁判定。

## 6. 音频（audio.js）

- 静音沿用站级键 `game-sfx`（与飞机大战 / 贪吃蛇共用）；BGM 单独键 `game-butterfly-bgm`。
- BGM 是 16 步八音盒循环（triangle 旋律 + sine 低音，音量 0.16），`setInterval 320ms` 步进；dispose 时停止。
- 音效全部 `sfxTone` 瞬时合成（click / confirm / event / big / money / hurt / year / death / butterfly）。

## 7. 测试工具

```bash
# 数据校验（ID 唯一、引用存在、字段拼写、结构完整）
node dev/js/butterfly/tool-validate.js

# 无头模拟（5 种策略 × N 局完整人生，输出结局分布 / 寿命 / 因果链均值）
npx esbuild dev/js/butterfly/engine.js --bundle --platform=node --format=cjs \
  --outfile=dev/js/butterfly/_sim_bundle.cjs --log-level=warning
node dev/js/butterfly/tool-simulate.js all 10
```

`simulate(policy, onEvent)` 可自定义行动策略与选项策略，用于回归：改引擎后先跑一遍校验器 + 模拟器，再 `npm run bump`。

**无头模拟抓出过的真实 bug**（改引擎前先跑模拟的理由）：
1. 高考链未接线 → 全人口无职业；
2. `advanceYear` 队列事件被同季随机 roll 覆盖 → 事件永久丢失；
3. 专业选择漏设 education → 毕业不触发求职。

## 8. 事件覆盖率的排查方法

`weight: 0` 的事件必须有触发路径（schedule / 引擎里程碑队列 / goto），否则是死数据。排查：

```bash
grep -n '"weight": 0' dev/js/butterfly/events-*.json
# 对每个 id 反查接线：
grep -n "ev_xxx" dev/js/butterfly/engine.js dev/js/butterfly/events-*.json
```

## 9. 如何添加内容

**加一个事件**：在对应人生阶段的 events-*.json 里加一条（照抄相邻结构）→ `node tool-validate.js` 通过 → 用模拟器确认可达（weight>0 直接可达；weight=0 需要接线）→ `npm run bump`。

**加一个职业**：jobs.json 加表项（levels 五级 + promo 晋升条件 + entry 入职条件）→ 在求职事件（ev_job_hunt）加对应选项，`effects: { "job": "id" }` → 需要专属剧情的话在 events 里加 weight>0 且 `cond: { "job": "id" }` 的事件，并把 id 加进 jobs.json 的 events 数组（校验器会查引用）。

**加一个结局**：endings.json 的 endings 数组加表项（priority 决定优先级，cond 决定判据，scene 选一张结局场景图）→ 校验器查 title/text。

**加一个场景**：pixel.js 加 painter 函数并注册进 painters 表 → 事件的 `scene` 字段即可引用。

**加跨局解锁**：参照 `reincarnationUnlocked()`（读 history 判定）+ `showNewGame` 里的应用点。

## 10. 已知限制与后续方向

- 人物只有待机呼吸动画，无行走/转场动画（场景切换为整帧重绘）
- BGM 是单一旋律循环，未随人生阶段变化编曲
- 移动端竖屏已适配，横屏无专门布局
- 手柄不支持（前两款游戏支持）
- 世界经济是分段时代表 + 随机偏移，不是连续仿真
- 结局文案对 `{name}` 等占位符的填充在引擎 `buildEnding`，事件文本的占位符在 UI `interp()`——两处都要注意新增占位符

## 11. 修改流程（站点约定）

任何改动落在 `dev/` → `npm run bump`（编译 SCSS/JS → 版本号 +1 绕 Cloudflare 缓存 → 重新生成 HTML 产物）→ 提交产物。**不要手改 `assets/`、`partials/`、根目录 HTML**——它们全是构建产物。
