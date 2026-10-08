import { isAlias, isMap, isScalar, isSeq, LineCounter, parseAllDocuments } from 'yaml'

/**
 * A deliberately small YAML 1.2 wireframe language. Fields are enumerated per node
 * kind; there are never style objects, URLs, CSS or expressions. Shared by the host
 * (so the model receives actionable errors) and the client renderer.
 */
export const CONTAINER_KINDS = ['row', 'column', 'grid', 'box', 'frame'] as const
export const LEAF_KINDS = ['text', 'heading', 'button', 'input', 'select', 'checkbox', 'radio', 'toggle', 'image', 'avatar', 'icon', 'badge', 'divider', 'spacer', 'tabs', 'nav', 'list', 'table', 'chart'] as const
export type ContainerKind = typeof CONTAINER_KINDS[number]
export type LeafKind = typeof LEAF_KINDS[number]
export type LayoutKind = ContainerKind | LeafKind
export type Size = number | 'fill'
export type Align = 'start' | 'center' | 'end' | 'stretch'
export type Justify = 'start' | 'center' | 'end' | 'between'

export interface LayoutNode {
  type: LayoutKind
  label?: string
  width?: Size
  height?: Size
  span?: number
  children?: LayoutNode[]
  gap?: number
  padding?: number
  align?: Align
  justify?: Justify
  wrap?: boolean
  columns?: number
  variant?: string
  lines?: number
  icon?: string
  items?: string[]
  icons?: string[]
  active?: number
  checked?: boolean
  rows?: number
  count?: number
}

export const LAYOUT_LIMITS = { bytes: 64 * 1024, depth: 10, nodes: 240, items: 24 } as const
const containerSet = new Set<string>(CONTAINER_KINDS)
const kindSet = new Set<string>([...CONTAINER_KINDS, ...LEAF_KINDS])
export const isContainer = (node: LayoutNode): boolean => containerSet.has(node.type)

const boxVariants = ['plain', 'outline', 'filled', 'card', 'dashed', 'selected']
/** Variant vocabularies; the first entry is the default. */
export const VARIANTS: Partial<Record<LayoutKind, readonly string[]>> = {
  row: boxVariants, column: boxVariants, grid: boxVariants, box: ['outline', ...boxVariants.filter(v => v !== 'outline')],
  frame: ['browser', 'mobile', 'window', 'plain'],
  text: ['body', 'caption'],
  button: ['secondary', 'primary', 'ghost', 'link'],
  badge: ['neutral', 'primary', 'outline'],
  tabs: ['underline', 'pills'],
  list: ['simple', 'media'],
  chart: ['bar', 'line', 'area', 'pie'],
}

const common = ['type', 'label', 'width', 'height', 'span']
const containerFields = ['children', 'gap', 'padding', 'align', 'justify', 'variant']
/** Allowed keys per node kind (in addition to the common keys). */
const FIELDS: Record<LayoutKind, readonly string[]> = {
  row: [...containerFields, 'wrap'], column: containerFields, grid: [...containerFields, 'columns'], box: containerFields, frame: containerFields,
  text: ['variant', 'lines'], heading: [], button: ['variant', 'icon'], input: ['icon'], select: [],
  checkbox: ['checked'], radio: ['checked'], toggle: ['checked'], image: [], avatar: [], icon: ['icon'], badge: ['variant'],
  divider: [], spacer: [], tabs: ['items', 'active', 'variant'], nav: ['items', 'icons', 'active'],
  list: ['items', 'icons', 'count', 'variant'], table: ['items', 'columns', 'rows'], chart: ['variant'],
}
const ICON_NAME = /^[a-z][a-z0-9-]{0,31}$/

/** Parse and validate one layout prototype; errors carry a YAML line/column or a node path. */
export function parseLayout(source: string): LayoutNode {
  if (new TextEncoder().encode(source).length > LAYOUT_LIMITS.bytes) throw new Error('$: layout exceeds 64 KiB')
  const lineCounter = new LineCounter()
  const docs = parseAllDocuments(source, { version: '1.2', schema: 'core', uniqueKeys: true, lineCounter })
  if (docs.length !== 1) throw new Error('$: expected exactly one YAML document')
  const doc = docs[0]!
  if (doc.directives?.yaml.version !== '1.2') throw new Error('$: only YAML 1.2 is supported')
  if (doc.errors.length || doc.warnings.length) {
    const issue = doc.errors[0] ?? doc.warnings[0]!
    const at = issue.linePos?.[0]
    throw new Error(`${at ? `line ${at.line}, column ${at.col}` : '$'}: ${issue.message}`)
  }
  // Check the AST before conversion: aliases must never be expanded, even once.
  const check = (node: unknown, path: string, nesting = 0): void => {
    if (nesting > 40) throw new Error(`${path}: YAML nesting limit exceeded`)
    if (isAlias(node)) throw new Error(`${path}: aliases are not allowed`)
    if (isMap(node) || isSeq(node) || isScalar(node)) {
      if (node.tag) throw new Error(`${path}: explicit tags are not allowed`)
      if (node.anchor) throw new Error(`${path}: anchors are not allowed`)
      if (isMap(node)) for (const pair of node.items) {
        check(pair.key, `${path}.key`, nesting + 1)
        if (!isScalar(pair.key) || typeof pair.key.value !== 'string') throw new Error(`${path}: keys must be strings`)
        if (pair.key.value === '<<') throw new Error(`${path}: merge keys are not allowed`)
        check(pair.value, `${path}.${pair.key.value}`, nesting + 1)
      }
      if (isSeq(node)) node.items.forEach((child, i) => check(child, `${path}[${i}]`, nesting + 1))
    }
  }
  check(doc.contents, '$')

  let count = 0
  const int = (v: unknown, path: string, min: number, max: number): number => {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw new Error(`${path}: expected an integer from ${min} to ${max}`)
    return v
  }
  const oneOf = <T extends string>(v: unknown, path: string, values: readonly T[]): T => {
    if (typeof v !== 'string' || !values.includes(v as T)) throw new Error(`${path}: expected one of ${values.join(', ')}`)
    return v as T
  }
  const strings = (v: unknown, path: string, icon = false): string[] => {
    if (!Array.isArray(v) || v.length > LAYOUT_LIMITS.items) throw new Error(`${path}: expected an array of at most ${LAYOUT_LIMITS.items} strings`)
    return v.map((item, i) => {
      if (typeof item !== 'string' || (icon && !ICON_NAME.test(item))) throw new Error(`${path}[${i}]: expected ${icon ? 'a lowercase icon name' : 'a string'}`)
      return item
    })
  }
  const validate = (value: unknown, path: string, depth: number): LayoutNode => {
    if (depth > LAYOUT_LIMITS.depth) throw new Error(`${path}: maximum layout depth is ${LAYOUT_LIMITS.depth}`)
    if (++count > LAYOUT_LIMITS.nodes) throw new Error(`${path}: maximum layout node count is ${LAYOUT_LIMITS.nodes}`)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path}: expected a node object`)
    const record = value as Record<string, unknown>
    if (!kindSet.has(record.type as string)) throw new Error(`${path}.type: unknown node type; expected one of ${[...kindSet].join(', ')}`)
    const type = record.type as LayoutKind
    const allowed = new Set([...common, ...FIELDS[type]])
    for (const key of Object.keys(record)) if (!allowed.has(key)) throw new Error(`${path}.${key}: unknown field for ${type}`)
    const result: LayoutNode = { type }
    for (const [key, raw] of Object.entries(record)) {
      const at = `${path}.${key}`
      switch (key) {
        case 'type': break
        case 'label': if (typeof raw !== 'string') throw new Error(`${at}: expected a string`); result.label = raw; break
        case 'width': case 'height':
          if (raw !== 'fill' && (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0 || raw > 4096)) throw new Error(`${at}: expected a positive finite number up to 4096 or fill`)
          result[key] = raw as Size; break
        case 'gap': case 'padding':
          if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 || raw > 128) throw new Error(`${at}: expected a number from 0 to 128`)
          result[key] = raw; break
        case 'span': case 'columns': result[key] = int(raw, at, 1, 12); break
        case 'lines': result.lines = int(raw, at, 1, 12); break
        case 'rows': case 'count': result[key] = int(raw, at, 1, LAYOUT_LIMITS.items); break
        case 'active': result.active = int(raw, at, 0, LAYOUT_LIMITS.items - 1); break
        case 'align': result.align = oneOf(raw, at, ['start', 'center', 'end', 'stretch'] as const); break
        case 'justify': result.justify = oneOf(raw, at, ['start', 'center', 'end', 'between'] as const); break
        case 'variant': result.variant = oneOf(raw, at, VARIANTS[type]!); break
        case 'wrap': case 'checked': if (typeof raw !== 'boolean') throw new Error(`${at}: expected true or false`); result[key] = raw; break
        case 'icon': if (typeof raw !== 'string' || !ICON_NAME.test(raw)) throw new Error(`${at}: expected a lowercase icon name such as search`); result.icon = raw; break
        case 'items': result.items = strings(raw, at); break
        case 'icons': result.icons = strings(raw, at, true); break
        case 'children':
          if (!Array.isArray(raw)) throw new Error(`${at}: expected an array`)
          result.children = raw.map((child, i) => validate(child, `${at}[${i}]`, depth + 1)); break
      }
    }
    return result
  }
  return validate(doc.toJS({ maxAliasCount: 0 }), '$', 1)
}
