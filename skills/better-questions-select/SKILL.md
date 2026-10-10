---
name: better-questions-select
description: Choose an ask_with_prototype question type using examples, then load its type-specific skill. Read this first.
---
# Choosing a question type

Read this skill before any type-specific skill when using `ask_with_prototype`. Reuse it for the rest of this conversation. Choose the type for **each question** from the decision the user needs to make and the evidence they need to see, then load the corresponding skill before composing its options. Load each type-specific skill only before its first use in this conversation; reuse it afterward. A batch may contain different question types.

## Examples and routing

| Decision and concrete alternatives | Choose | Read next | Why |
| --- | --- | --- | --- |
| “这次先做核心流程还是完整功能？” or “还有哪些约束？” | `none` (the default) | `better-questions-none` | Labels and tradeoffs suffice; omit options for free-text clarification. No preview is needed. |
| “导航放左侧还是顶部？” with the same dashboard content in both options | `layout` | `better-questions-layout` | Compare structure, placement and hierarchy with restricted YAML grayscale wireframes. |
| “search({ query, limit }) 还是 search(query, limit)？” or two short configuration snippets | `code` | `better-questions-code` | Compare source, API shape or pseudocode as read-only text; it is never executed. |
| “按钮用蓝色实心还是描边？” or “加载圆点用呼吸动画还是静态提示？” | `html` | `better-questions-html` | Compare self-contained HTML/CSS appearance or CSS animation. |
| “以 docs/current-design.md 还是 docs/alternative.md 为依据？” when both files exist | `file` | `better-questions-file` | Inspect existing workspace artifacts in the Harness sidebar; proto is a native filesystem path. |

## Resolving close cases

- **Layout or HTML:** use `layout` when the choice is structure, even if the eventual product is a web page. Use `html` when color, typography, styling or CSS motion is the deciding evidence. For “左侧导航还是顶部导航，并选按钮颜色”, separate the structural and styling decisions into two questions if they can be chosen independently.
- **File or code:** use `file` to inspect an existing document or full source file without copying it. Use `code` for focused inline alternatives, such as two proposed function signatures. A filename alone is not a code preview. Verify files exist before offering paths; if there is no file yet, show a short inline code alternative or ask a `none` question instead.
- **Script-dependent behavior:** neither `layout` nor `html` runs JavaScript. For “点击后如何校验表单？”, use `code` to compare handlers or pseudocode, or `none` to compare behavior descriptions. HTML supports static markup and CSS animation only; do not promise working forms, navigation, external images/fonts/resources or a running app.
- **No useful visual evidence:** choose `none` for scope, priorities, permissions or constraints that can be expressed with labels and descriptions. Do not add a prototype just because the topic involves code or UI.

After choosing, follow the named type-specific skill for payload syntax, examples and limits. The only question types are `none`, `layout`, `code`, `html` and `file`; this selection skill is not another type. For non-`none` types every option needs a nonempty string `proto` in that type's format. All options within one question share its type.

Selecting an option shows its preview (files open in the sidebar). Recommendations and opened previews are not approval; users explicitly choose and submit. Keep comparable alternatives focused on the same decision.
