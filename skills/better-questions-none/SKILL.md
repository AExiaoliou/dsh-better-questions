---
name: better-questions-none
description: Use ask_better_questions for ordinary choices or free-text clarification without previews.
---
# Ordinary questions

Use `ask_better_questions` when you need a human choice or missing information. `type: "none"` is the default and ignores `proto`. Omit `options` for a free-text question. Prefer a small set of meaningful alternatives with concise tradeoff descriptions.

```json
{"questions":[{"id":"scope","question":"这次先完成哪个范围？","type":"none","options":[{"label":"核心流程","description":"先验证完整使用路径。","recommended":true},{"label":"完整功能","description":"同时覆盖高级场景。"}]},{"id":"constraints","question":"还有哪些限制需要考虑？"}]}
```

Question IDs must be unique in the batch, option labels unique within a question. At most one option per question may have `recommended: true`; it displays a badge and does not select an answer. Do not add a recommendation suffix to labels.

Use `multi_select: true` for independent, combinable choices. Users may select options and add custom text together. Results contain every question ID, selected original labels, and optional custom text. Empty selections with no custom text mean skipped. Closing the panel is not an answer. Do not infer approval from a recommendation or an opened preview.
