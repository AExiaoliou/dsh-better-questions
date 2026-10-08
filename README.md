# dsh-better-questions

[![CI](https://github.com/AExiaoliou/dsh-better-questions/actions/workflows/ci.yml/badge.svg)](https://github.com/AExiaoliou/dsh-better-questions/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A prototype-aware question plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It provides the `ask_better_questions` tool with paginated questions, single and multiple choice, custom answers, recommendations, YAML layouts, code, isolated HTML/CSS previews, and file sidebar links.

Recommendations affect the initial preview only; they never select an answer automatically. The plugin is currently version `0.1.0` and targets DSH `0.2.1-alpha.1`, Cordis `4.0.5-alpha.1`, and React 18.

- [Install and develop](#安装与开发)
- [Tool interface](#工具接口)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)

DSH 的原型提问插件，提供 `ask_better_questions` 工具。卡片支持分页问题、单选/多选、自定义回答、推荐标记，以及 YAML 布局、代码、隔离 HTML 和侧栏文件。推荐只影响初始预览，不会自动选中答案。

版本 **0.1.0**，针对 **DSH 0.2.1-alpha.1 / Cordis 4.0.5-alpha.1 / React 18** 实现并锁定 peer 版本。不同 DSH 版本需要重新核对契约，不能仅修改版本范围。

## 安装与开发

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm check
pnpm pack
```

通过 DSH 官方 `plugin_manager` 安装；先执行 `list_bundles`，再执行：

```json
{"action":"install_bundle","target":"/absolute/path/to/dsh-better-questions"}
```

换到其他机器时使用实际的包目录绝对路径。安装作用于当前 profile 的所有会话。以管理器返回的 `application` 和 `warnings` 判断生效；`restart-required` 需要重启，`applied` 才表示现场应用完成。不要手改 profile 文件或在 profile 目录执行包管理命令。

源码与已编译包独立于 Harness monorepo：Host 输出 ESM，Client 输出当前版本 ModuleLoader 包装的 CJS；React 和 client-store 复用平台单例，Zod/YAML 随包构建。没有安装脚本、外部服务或远程前端资源。

常用命令：`pnpm typecheck`、`pnpm test`、`pnpm build`、`node scripts/smoke.mjs`、`pnpm measure`。`pnpm visual [输出目录]` 用本机 Chrome 截取线框样例（开发用，不进入发布包）。最后两条需要先构建；`pnpm check` 按顺序执行全部检查。

## 工具接口

```ts
type QuestionType = 'none' | 'layout' | 'code' | 'html' | 'file';
interface Request {
  questions: {
    id: string;
    question: string;
    header?: string;
    type?: QuestionType; // 默认 none
    multi_select?: boolean; // 默认 false
    options?: {
      label: string;
      description?: string;
      proto?: string;
      recommended?: boolean;
    }[];
  }[];
}
interface Result {
  answers: { id: string; selected: string[]; custom?: string }[];
}
```

- 批次至少一题，题目 ID 在批次内唯一；选项标签在题内唯一；每题最多一个 `recommended: true`。
- `proto` 提供时始终是字符串；`none` 忽略它且允许没有选项，其他类型要求至少一个选项，并且每项有非空 `proto`。
- 单个原型最多 64 KiB UTF-8，整个批次最多 256 KiB；没有额外的题数/选项数上限。
- 提交结果按原始题目及选项顺序排列，`selected` 返回原始标签；允许选项和 `custom` 同时存在。空白自定义文本省略，其他自定义文本原样保留。
- 每道题都出现在结果中。跳过清空该题选择和自定义文本，返回 `selected: []`；最后一题的“跳过并提交”会提交整个批次。
- 关闭仅隐藏卡片，调用仍等待回答，可从工具记录重新打开；收起、关闭和跳过是不同动作。提交失败保留草稿并显示错误。
- 推荐选项或第一项用作初始预览；新选中选项时自动切换到对应预览，选中文件时打开侧栏。单独点击预览或打开文件不选中答案。已完成记录只读；文件操作和原型查看仍可使用。

完整混合示例：

```json
{
  "questions": [
    {"id":"scope","question":"本次要覆盖哪些范围？","multi_select":true,"options":[{"label":"桌面端","recommended":true},{"label":"移动端"}]},
    {"id":"layout","question":"使用这个页面布局吗？","type":"layout","options":[{"label":"双列","proto":"type: row\ngap: 16\nchildren:\n  - type: box\n    width: 180\n    label: 导航\n  - type: column\n    width: fill\n    children:\n      - type: text\n        label: 项目概览\n      - type: button\n        label: 新建项目\n","recommended":true}]},
    {"id":"code","question":"采用这个返回结构吗？","type":"code","options":[{"label":"结构化结果","proto":"```ts\nreturn { ok: true, data };\n```"}]},
    {"id":"html","question":"采用这个按钮样式吗？","type":"html","options":[{"label":"圆角按钮","proto":"<style>button{background:#526bdf;color:white;border:0;border-radius:12px;padding:12px 20px}</style><button>创建项目</button>"}]},
    {"id":"file","question":"以这份说明为准吗？","type":"file","options":[{"label":"项目说明","proto":"README.md"}]}
  ]
}
```

`file` 示例仅适用于会话工作目录确有该文件的情况；使用前检查真实路径。

## 五类原型

| 类型 | `proto` 内容 | 展示与限制 |
| --- | --- | --- |
| `none` | 可省略；提供也忽略 | 基础选项与自由文本 |
| `layout` | 受限 YAML 1.2 线框树 | 本地静态线框图，按设计宽度缩放适配预览窗格；新调用在提问前校验语法并把错误返回给模型 |
| `code` | 纯文本或单个完整 Markdown 围栏 | 转义显示、保留缩进、复制；不执行代码 |
| `html` | HTML/CSS 字符串 | 清洗后放入空 sandbox iframe；支持内联样式及 CSS 动画 |
| `file` | 原生绝对路径或会话工作目录相对路径 | 选中选项或点击“打开文件”时使用 DSH 原有文件侧栏，不在卡片内预览；v1 不接受 URI 或行号语法 |

布局容器为 `row / column / grid / box / frame`（`frame` 提供 browser / mobile / window 外框），叶节点为 `text / heading / button / input / select / checkbox / radio / toggle / image / avatar / icon / badge / divider / spacer / tabs / nav / list / table / chart`。字段按节点类型白名单校验：公共 `type / label / width / height / span`，容器另有 `children / gap / padding / align / justify / variant`（`row` 还可用 `wrap`，`grid` 可用 `columns`），叶节点按类型可用 `variant / lines / icon / items / icons / active / checked / rows / count`。`fill` 沿父容器主轴占满剩余空间、在交叉轴拉伸。无标签的 `text`/`heading` 渲染为骨架条。图标来自内置固定 SVG 集，未知名称显示中性占位。最多 10 层、240 节点、24 个 `items`；拒绝未知字段、多文档、重复键、标签、锚点、别名和合并键。v0.1 的原型仍然有效。

根节点有数值宽度或为 `frame` 时，线框按设计宽度渲染后等比缩放以适配窗格宽度和 500 px 高度，并提供“查看原尺寸”切换；流式布局随窗格重排。整个线框是一个带标签的 `role=img`，内部没有可聚焦或表单控件。颜色由主题文本色派生，在浅色纯白主题与深色主题下都保持可见。`tool.execute` 使用 `parseRequest(input, { layouts: true })` 在提问前校验布局，错误包含选项标签及行列或节点路径；投影与历史回放仍宽松解析，旧记录中的无效布局只在预览内报错。详细语法见 [layout skill](skills/better-questions-layout/SKILL.md)。

HTML 先在惰性 template 中解析并按白名单重新序列化，去除脚本、事件属性、链接、外部资源、表单、SVG/MathML 和嵌套框架；表单控件禁用。iframe 使用空 `sandbox` 和 CSP，拒绝脚本、网络资源、导航、弹窗、表单及同源访问。只允许内联 CSS；CSS 中的远程 URL 由 CSP 拦截。切换原型或收起卡片时销毁 iframe。该模式面向视觉原型，不能运行 JS 应用或加载图片/字体。

## 按需技能与上下文开销

工具描述要求每种 type 在同一会话首次使用前加载对应 skill 一次，后续复用。五个独立 skill 在目录中分别发现、按需加载：

- [better-questions-none](skills/better-questions-none/SKILL.md)：普通决策、单选/多选及自由文本。
- [better-questions-layout](skills/better-questions-layout/SKILL.md)：完整 YAML 语法与布局比较。
- [better-questions-code](skills/better-questions-code/SKILL.md)：代码/配置比较及围栏用法。
- [better-questions-html](skills/better-questions-html/SKILL.md)：隔离 HTML/CSS 原型及限制。
- [better-questions-file](skills/better-questions-file/SKILL.md)：真实文件路径与侧栏行为。

`pnpm measure` 的 `o200k_base` 估算：工具名称/描述/参数 335 tokens，五个技能目录条目合计 131 tokens；单项技能正文为 none 254、layout 1449、code 319、html 360、file 285 tokens。它们不是实际模型账单：模型 tokenizer、框架目录包装及动态内容会改变数值。技能正文不加入工具 schema。

## 生命周期与降级

Host 使用 `tools.register`、`userQuestions.ask`、`skills.register` 与 `sessionProjections.register`。`ask` 沿用原有 agent、signal、callId 及等待机制，没有新增回答 RPC、agent 可调用的回答工具或持久事件类型。

`betterQuestions` 投影只派生本工具日志里的活动调用元数据；任何工具结果及 turn/end 都移除对应活动项，分叉继承前缀不会复活问题。Client 观察框架已保留的会话代际，按活动调用注册 `conversation.composer`，优先级 -1；结构化匹配 session/call/PendingQuestion，通过原有 carrier 提交或隐藏。草稿保存在 Session 范围 store 中。订阅与动态注册在调用消失、会话替换、插槽撤销及插件卸载时清理。

运行中断或重启不会自动接受旧答案，也不提供超时续接。没有可关联工具日志时不能恢复富原型卡片，基础提问通道可继续展示标准题目。没有活动回答通道时卡片不可提交。关闭后的重新打开依赖原有 `userQuestionPanels` 服务。

## 验证与版本依据

本机安装记录（2026-10-07）：官方管理器通过上述目录安装成功，返回 `application: applied`、`warnings: []`。Host Inspect 已确认工具注册与 `include:better-questions`，五个 skill 已进入当前目录且 layout skill 可实际加载。本次是指向源码目录的本地链接安装，请保留目录；可分发产物由 `pnpm pack` 生成。安装后的 Client 插槽 Inspect 连续两次超时，因此暂未确认当前页完成 Client 激活，也未完成浏览器视觉验收。如页面尚未显示富卡片，刷新或重新连接原有 GUI 后再核对。

当前自动验证通过：Host/Client TypeScript、123 项测试（33 Host/数据/回放、54 布局语法、17 卡片/预览、7 线框渲染与技能同步、12 Client 生命周期/会话/存储），以及构建产物 Host 注册和浏览器模块装载 smoke。覆盖推荐不自动选择、选中即预览而单独预览不选中、草稿恢复与隔离、失败重试、停止/结果清理、分叉历史、恶意 HTML 和 YAML 约束。浏览器真实渲染、CSP 网络拦截、侧栏打开及移动端外观需要在实际 GUI 验收，jsdom 不提供这些保证。重新构建后切换 bundle 虽返回 `applied`，Host Inspect 仍显示旧工具描述；本地链接的已安装包代码更新需要重启当前 DSH 进程，再刷新现有 Web 页面验证。

契约核对使用官方文档与运行时 Inspect；官网可能领先当前版本，签名以 [dsh-v0.2.1-alpha.1 源码](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.2.1-alpha.1) 为准。

- [插件开发](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/index.md)与[持久安装](https://deepseek-harness.github.io/deepseek-harness/en/develop/practice/dynamic-cordis.md)
- [User questions](https://deepseek-harness.github.io/deepseek-harness/en/reference/subsystems/user-questions.md)、[Tools](https://deepseek-harness.github.io/deepseek-harness/en/reference/subsystems/tools.md)、[Skills](https://deepseek-harness.github.io/deepseek-harness/en/reference/subsystems/skills.md)
- [Session projection](https://deepseek-harness.github.io/deepseek-harness/en/reference/subsystems/session-projection.md)、[Slots](https://deepseek-harness.github.io/deepseek-harness/en/reference/subsystems/slots.md)、[Client modules](https://deepseek-harness.github.io/deepseek-harness/en/reference/subsystems/client-modules.md)

Runtime 核对对象：Host `tools / userQuestions / skills / sessionProjections`；Client `sessions / slots / uiSession / sidebarRight / locale`、`conversation.composer` 与 `tool.call.toolview`，以及主题 tokens。部分 Client Inspect 请求曾超时；相应签名由同版本公开源码及已发布类型包补充验证。公开 ModuleLoader 单例映射包含 React 和 client-store；未导入其他插件的运行时组件。
