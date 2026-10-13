---
name: better-questions-layout
description: Compare UI layouts using restricted YAML trees in ask_with_prototype.
---
# Layout comparisons

Call `ask_with_prototype` with `questions[].type: layout`. Each option's `proto` is a **string containing one YAML 1.2 node tree** rendered as a grayscale, theme-aware wireframe (not a working app). Put labels and tradeoffs in `label`/`description`, not in the tree. Before asking, call `check_layout_prototype` once per candidate proto when you need to verify the tree or inspect its image preview. It returns `valid: true` with a preview image, or `valid: false` with the exact parse error. Invalid trees are also rejected before the user is asked; the error names the option, the YAML line/column or node path, and the allowed values. Fix the prototype and call again.

## Making good wireframes

- Use a fixed design width so the preview scales cleanly: `type: frame` (browser/window 960 px, mobile 375 px) or a root with `width: 960`. Without a numeric root width the layout reflows to the narrow preview pane.
- Make options differ in **structure**, and keep shared content the same so the difference stands out. Use 2–4 options.
- Prefer content-free placeholders (`text` without a label renders skeleton bars; `heading` without a label renders a title bar). Label only what explains the structure: navigation items, section names, primary actions.
- Use `fill` for the region that should take the remaining space, and fixed pixels for sidebars and rails.

## Nodes

Every node has `type` and optionally `label`, `width`, `height` (pixels 1–4096 or `fill`), and `span` (grid columns, 1–12).

Containers (`children` allowed):

| type | Extra fields |
| --- | --- |
| `row` / `column` | `gap`, `padding` (0–128), `align` (start/center/end/stretch), `justify` (start/center/end/between), `variant`; `row` also has `wrap: true` |
| `grid` | as above, plus `columns` (1–12, default 2) |
| `box` | as above; a bordered panel (default padding 12) |
| `frame` | as above; `variant: browser \| mobile \| window \| plain`; `label` is the URL or window title |

Container `variant`: `plain` (default for row/column/grid), `outline` (default for box), `filled`, `card`, `dashed`, `selected`. A container `label` renders as a small section caption.

Leaves (no `children`):

| type | Fields / meaning |
| --- | --- |
| `text` | label text, or `lines: 1–12` skeleton bars; `variant: body \| caption` |
| `heading` | bold title (or a title bar) |
| `button` | `variant: secondary \| primary \| ghost \| link`, `icon` |
| `input` / `select` | label is the placeholder; `input` takes `icon`; a height over 48 renders a textarea |
| `checkbox` / `radio` / `toggle` | `checked: true/false` |
| `image` | picture placeholder (no URLs) |
| `avatar` | circle; first character of `label`, or a person icon; size from `width` |
| `icon` | `icon` name; `width` sets size |
| `badge` | `variant: neutral \| primary \| outline` |
| `divider` / `spacer` | line along the parent's cross axis / flexible gap |
| `tabs` | `items` (strings), `active` index, `variant: underline \| pills` |
| `nav` | vertical menu: `items`, optional `icons` (same order), `active` |
| `list` | `items` or `count`, optional `icons`, `variant: simple \| media` |
| `table` | header `items` or `columns`, `rows` (default 4) |
| `chart` | `variant: bar \| line \| area \| pie` |

Icon names: home search user users settings bell mail menu plus minus close check chevron-down chevron-up chevron-left chevron-right arrow-left arrow-right more filter calendar clock chart file folder image star heart edit trash download upload share link lock eye cart message phone globe grid list info help warning play refresh logout sun moon dashboard bookmark tag location. Unknown lowercase names render as a neutral square.

## Example

```yaml
type: frame
variant: browser
children:
  - type: row
    gap: 0
    height: 520
    children:
      - type: column
        width: 200
        padding: 12
        variant: filled
        children:
          - {type: heading, label: Console}
          - {type: nav, items: [概览, 项目, 成员, 设置], icons: [home, folder, users, settings], active: 0}
      - type: column
        width: fill
        padding: 16
        children:
          - type: row
            children: [{type: heading, label: 项目, width: fill}, {type: input, icon: search, width: 200}, {type: button, variant: primary, label: 新建}]
          - type: grid
            columns: 3
            children:
              - {type: box, variant: card, children: [{type: image, height: 90}, {type: text, lines: 2}]}
              - {type: box, variant: card, children: [{type: image, height: 90}, {type: text, lines: 2}]}
              - {type: box, variant: card, children: [{type: image, height: 90}, {type: text, lines: 2}]}
          - {type: table, items: [名称, 负责人, 状态], rows: 3}
```

In the tool call, the YAML is one JSON string (`"proto": "type: frame\nvariant: browser\nchildren:\n  - ..."`). Flow mappings like `{type: text, lines: 2}` keep prototypes short.

## Limits

No tags, anchors, aliases, merge keys, duplicate keys, multiple documents, unknown fields, CSS, URLs, or expressions. Nesting is at most 10 levels and 240 nodes, with at most 24 `items`. Each prototype is ≤64 KiB UTF-8 and the whole batch ≤256 KiB. Fields belong to specific node types; for example, `wrap` is valid only on `row` and `checked` only on choice controls.

At most one `recommended: true` per question; it sets the initial preview but does not select anything. Keep labels unique and stable, because results return the original labels, not YAML. Viewing does not imply choosing, and choosing does not imply submitting. Use `none` for questions without preview options.
