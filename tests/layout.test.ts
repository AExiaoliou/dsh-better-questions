import { describe, expect, it } from 'vitest'
import { LAYOUT_LIMITS, parseLayout } from '../src/client/layout'

const nested = (depth: number): string => JSON.stringify(depth === 1 ? { type: 'text', label: 'leaf' } : { type: 'box', children: [JSON.parse(nested(depth - 1))] })
describe('strict layout language', () => {
  it('parses YAML 1.2 containers and every leaf kind', () => {
    const result = parseLayout('type: grid\ncolumns: 12\ngap: 0\npadding: 128\nwidth: fill\nheight: 4096\nchildren:\n - {type: text, label: yes}\n - {type: button, label: Go}\n - {type: input, label: Name}\n - {type: image, label: Portrait}')
    expect(result.children?.map(node => node.type)).toEqual(['text', 'button', 'input', 'image'])
    expect(result.children?.[0]?.label).toBe('yes')
  })
  it.each([
    ['', /document|node/],
    ['type: text\n---\ntype: text', /one YAML/],
    ['%YAML 1.1\n---\ntype: text', /1.2/],
    ['type: text\ntype: box', /line 2, column 1/],
    ['type: !foo text', /tag|line/],
    ['type: !!str text', /tags/],
    ['&root {type: text}', /anchors/],
    ['type: row\nchildren: [*missing]', /aliases/],
    ['type: row\nchildren: [&child {type: text}, *child]', /anchors/],
    ['type: box\n<<: {padding: 2}', /merge/],
    ['type: text\nstyle: {color: red}', /\$\.style/],
    ['type: image\nsrc: https://example.com/image.png', /\$\.src/],
    ['type: text\nchildren: []', /children/],
    ['type: box\ncolumns: 2', /columns/],
    ['type: iframe', /type/],
    ['type: text\nlabel: 1', /label/],
    ['type: row\nchildren: {}', /children/],
    ['type: text\nwidth: 0', /width/],
    ['type: text\nheight: -1', /height/],
    ['type: text\nwidth: 4097', /width/],
    ['type: text\nwidth: .inf', /width/],
    ['type: text\nheight: .nan', /height/],
    ['type: text\nwidth: 100%', /width/],
    ['type: row\npadding: 129', /padding/],
    ['type: row\ngap: -1', /gap/],
    ['type: grid\ncolumns: 0', /columns/],
    ['type: grid\ncolumns: 13', /columns/],
    ['type: grid\ncolumns: 1.5', /columns/],
    ['type: box\n__proto__: {polluted: true}', /unknown field/],
    ['? [complex, key]\n: value\ntype: box', /keys/],
  ])('rejects adversarial or invalid layout %s', (source, error) => { expect(() => parseLayout(source)).toThrow(error) })
  it('accepts exactly ten levels and rejects eleven', () => {
    expect(() => parseLayout(nested(LAYOUT_LIMITS.depth))).not.toThrow()
    expect(() => parseLayout(nested(LAYOUT_LIMITS.depth + 1))).toThrow(/depth is 10/)
  })
  it('accepts 240 nodes and rejects 241', () => {
    const row = (n: number) => JSON.stringify({ type: 'row', children: Array.from({ length: n }, () => ({ type: 'text' })) })
    expect(() => parseLayout(row(LAYOUT_LIMITS.nodes - 1))).not.toThrow()
    expect(() => parseLayout(row(LAYOUT_LIMITS.nodes))).toThrow(/node count is 240/)
  })
  it('parses the v2 vocabulary with per-kind fields', () => {
    const result = parseLayout(`type: frame
variant: browser
label: app.example.com
children:
  - type: row
    align: center
    justify: between
    wrap: true
    variant: card
    children:
      - {type: heading, label: Title, span: 2}
      - {type: text, lines: 3, variant: caption}
      - {type: button, variant: primary, icon: plus, label: New}
      - {type: input, icon: search}
      - {type: select, label: Sort}
      - {type: checkbox, checked: true}
      - {type: radio}
      - {type: toggle, checked: false}
      - {type: avatar, label: A, width: 28}
      - {type: icon, icon: made-up-name}
      - {type: badge, variant: outline, label: Beta}
      - {type: divider}
      - {type: spacer}
      - {type: tabs, items: [One, Two], active: 1, variant: pills}
      - {type: nav, items: [Home, Docs], icons: [home, file], active: 0}
      - {type: list, count: 4, variant: media}
      - {type: table, items: [Name, Owner], rows: 5}
      - {type: table, columns: 4}
      - {type: chart, variant: pie}`)
    expect(result.variant).toBe('browser')
    expect(result.children?.[0]?.children?.map(node => node.type)).toEqual(['heading', 'text', 'button', 'input', 'select', 'checkbox', 'radio', 'toggle', 'avatar', 'icon', 'badge', 'divider', 'spacer', 'tabs', 'nav', 'list', 'table', 'table', 'chart'])
    expect(result.children?.[0]?.children?.[14]).toEqual({ type: 'nav', items: ['Home', 'Docs'], icons: ['home', 'file'], active: 0 })
  })
  it.each([
    ['type: button\nvariant: danger', /\$\.variant: expected one of secondary, primary, ghost, link/],
    ['type: row\nalign: middle', /align: expected one of start/],
    ['type: column\njustify: around', /justify/],
    ['type: column\nwrap: true', /\$\.wrap: unknown field for column/],
    ['type: row\nwrap: yes', /wrap: expected true or false/],
    ['type: text\nlines: 13', /lines/],
    ['type: tabs\nitems: 3', /items: expected an array/],
    ['type: tabs\nitems: [1]', /items\[0\]: expected a string/],
    [`type: tabs\nitems: [${Array.from({ length: 25 }, () => 'a').join(', ')}]`, /at most 24/],
    ['type: nav\nicons: [Home]', /lowercase icon name/],
    ['type: icon\nicon: "<svg>"', /icon name/],
    ['type: icon\nicon: home\nchildren: []', /children/],
    ['type: button\nchecked: true', /checked: unknown field for button/],
    ['type: text\nspan: 13', /span/],
    ['type: table\nrows: 0', /rows/],
    ['type: tabs\nactive: -1', /active/],
    ['type: frame\nvariant: tablet', /variant/],
    ['type: row\nchildren: [{type: card}]', /\$\.children\[0\]\.type: unknown node type; expected one of row/],
  ])('rejects invalid v2 field %s', (source, error) => { expect(() => parseLayout(source)).toThrow(error) })
  it('enforces UTF-8 byte limit inclusively', () => {
    const prefix = 'type: text\nlabel: '
    expect(() => parseLayout(prefix + 'a'.repeat(65536 - prefix.length))).not.toThrow()
    expect(() => parseLayout(prefix + 'a'.repeat(65537 - prefix.length))).toThrow(/64 KiB/)
    expect(() => parseLayout(prefix + '界'.repeat(22000))).toThrow(/64 KiB/)
  })
  it('rejects malformed syntax with a source location', () => {
    expect(() => parseLayout('type: box\nchildren: [')).toThrow(/line \d+, column \d+/)
  })
})
