---
name: better-questions-file
description: Offer existing files as choices and open them in the Harness sidebar with ask_with_prototype.
---
# Existing file choices

Call `ask_with_prototype` with `type: "file"`. Every option's `proto` is a **native filesystem path string**. Relative paths resolve from the question's Session workspace, not the plugin directory; absolute paths preserve their meaning. Use `/` separators for portable examples. Do not put quotes, Markdown links, `file://` URIs, line-number suffixes, or embedded file contents into proto.

```json
{"questions":[{"id":"reference","question":"以哪个文档作为实现依据？","type":"file","options":[{"label":"当前方案","description":"已同步到现有接口。","recommended":true,"proto":"docs/current-design.md"},{"label":"备选方案","proto":"docs/alternative.md"}]}]}
```

Use paths that actually exist in the user's workspace. Selecting a file option opens it in the existing Harness sidebar; clicking its separate Open file button also opens it without selecting the option. There is no right-hand preview pane inside the question card. Missing, unreadable and unsupported files use the sidebar's existing error UI.

Keep question IDs and labels unique. At most one option per question can be recommended; recommendation does not select or grant approval. Use `multi_select: true` when several files may be chosen together. Returned selections are original labels, with optional custom text. Proto paths are not echoed into answers.
