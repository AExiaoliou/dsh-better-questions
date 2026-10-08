---
name: better-questions-html
description: Compare self-contained HTML/CSS prototypes or CSS animations in ask_with_prototype.
---
# HTML and CSS prototypes

Call `ask_with_prototype` with `type: "html"`. Each option supplies a self-contained HTML/CSS **string** in `proto`. Fragments and full documents are accepted; the preview sanitizes them into an isolated document. Prefer simple semantic HTML with inline styles or a `<style>` element.

```json
{"questions":[{"id":"motion","question":"选择加载动效","type":"html","options":[{"label":"呼吸圆点","recommended":true,"proto":"<style>@keyframes pulse{to{opacity:.25;transform:scale(.7)}}.dot{width:32px;height:32px;border-radius:50%;background:#2563eb;animation:pulse 1s ease-in-out infinite alternate}</style><div class='dot'></div>"},{"label":"静态提示","proto":"<div style='padding:24px;font:16px system-ui'>正在加载…</div>"}]}]}
```

Supported: static HTML, inline CSS, CSS keyframes and animations. No JavaScript, external images/styles/fonts/network resources, forms, popups, navigation, embedded frames, or parent-page access. Unsupported elements and URL/event attributes are removed. Do not produce a prototype that needs script execution; use `code` to discuss its behavior instead. Design for the preview pane's available width and avoid rapid flashing.

Each proto must be nonempty and ≤64 KiB UTF-8; batch prototypes ≤256 KiB. Preview failures do not choose or skip an option. Use stable unique labels and concise descriptions to explain differences outside the preview. At most one `recommended: true` per question; users explicitly choose and submit. Answers contain labels and optional custom text, not HTML.
