---
name: better-questions-code
description: Compare API designs or pseudocode with read-only code previews in ask_better_questions.
---
# Code comparisons

Call `ask_better_questions` with `type: "code"`. Every option supplies `proto` as raw source or pseudocode text. A single complete Markdown code fence may provide a language hint; otherwise the preview displays plain text. Code is read-only, copyable, and never executed. Do not rely on syntax highlighting.

```json
{"questions":[{"id":"api","question":"哪种调用方式更适合？","type":"code","options":[{"label":"对象参数","description":"可选参数更容易扩展。","recommended":true,"proto":"function search({ query, limit = 20 }) {\n  return index.search(query, { limit });\n}"},{"label":"位置参数","description":"简单调用更短。","proto":"function search(query, limit = 20) {\n  return index.search(query, { limit });\n}"}]}]}
```

Show comparable examples with the same inputs and purpose. Prefer short API signatures or a focused algorithm over full source files. Use `file` to browse an existing file instead of copying a large file into proto.

Each proto must be a nonempty string ≤64 KiB UTF-8; batch prototypes ≤256 KiB. Question IDs and option labels must be unique within their respective scope. At most one `recommended: true` per question; it does not choose the option. `multi_select` is for alternatives that can be combined. Users may add custom text; returned selections are original labels without code content. An opened preview is not approval.
