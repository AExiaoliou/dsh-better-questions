import React, { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { isContainer, type Align, type LayoutNode } from '../shared/layout'
import { Icon } from './icons'

export type WireLanguage = 'en' | 'zh'
type Axis = 'row' | 'column' | 'grid' | 'root'
const FRAME_WIDTH: Record<string, number> = { browser: 960, window: 960, mobile: 375 }
const ALIGN: Record<Align, CSSProperties['alignItems']> = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' }
const JUSTIFY = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between' } as const
const COMPACT = new Set(['button', 'badge', 'avatar', 'icon', 'checkbox', 'radio', 'toggle'])
const BAR_WIDTHS = ['100%', '92%', '96%', '84%']

/** Sizes follow the parent axis: `fill` grows along the main axis and stretches across it. */
function sizeStyle(node: LayoutNode, axis: Axis, parentAlign?: Align): CSSProperties {
  const style: CSSProperties = {}
  const main = axis === 'row' ? 'width' : axis === 'column' ? 'height' : undefined
  for (const key of ['width', 'height'] as const) {
    const value = node[key]
    if (value === undefined) continue
    if (value === 'fill') {
      if (key === main) Object.assign(style, { flex: '1 1 0%', [key === 'width' ? 'minWidth' : 'minHeight']: 0 })
      else if (axis === 'root') style[key] = '100%'
      else if (axis !== 'grid') style.alignSelf = 'stretch'
    } else {
      style[key] = value
      if (key === main) style.flexShrink = 0
      else if (key === 'width') style.maxWidth = '100%'
    }
  }
  if (node.span) style.gridColumn = `span ${node.span}`
  if (!parentAlign && !style.alignSelf) {
    const leaf = !isContainer(node)
    if (axis === 'row' && leaf && node.type !== 'divider' && node.type !== 'spacer') style.alignSelf = 'center'
    else if ((axis === 'column' || axis === 'root') && COMPACT.has(node.type) && node.width !== 'fill') style.alignSelf = 'flex-start'
    else if (axis === 'grid' && COMPACT.has(node.type)) Object.assign(style, { justifySelf: 'start', alignSelf: 'center' })
  }
  return style
}

const Bars = ({ lines = 1, className = 'bq-wf-lines' }: { lines?: number; className?: string }) =>
  <span className={className}>{Array.from({ length: lines }, (_, i) => <i key={i} style={{ width: lines > 1 && i === lines - 1 ? '60%' : BAR_WIDTHS[i % 4] }} />)}</span>
const range = (n: number) => Array.from({ length: n }, (_, i) => i)

function Chart({ variant = 'bar' }: { variant?: string }) {
  if (variant === 'pie') return <svg className="bq-wf-chart-svg" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" className="bq-wf-c1" /><path d="M50 50L50 10A40 40 0 0 1 62.4 88Z" className="bq-wf-c3" /><path d="M50 50L62.4 88A40 40 0 0 1 10 50Z" className="bq-wf-c2" /></svg>
  const points = '0,72 33,55 66,62 100,36 133,46 166,22 200,30'
  return <svg className="bq-wf-chart-svg" viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true">
    {[25, 50, 75].map(y => <line key={y} x1="0" x2="200" y1={y} y2={y} className="bq-wf-grid-line" vectorEffect="non-scaling-stroke" />)}
    {variant === 'bar' ? [42, 64, 50, 82, 58, 92, 70].map((h, i) => <rect key={i} x={8 + i * 27.5} y={100 - h} width="16" height={h} rx="2" className={i === 5 ? 'bq-wf-c3' : 'bq-wf-c2'} />)
      : <>{variant === 'area' && <polygon points={`${points} 200,100 0,100`} className="bq-wf-c1" />}<polyline points={points} fill="none" className="bq-wf-stroke" vectorEffect="non-scaling-stroke" /></>}
  </svg>
}

function Leaf({ node, axis, language }: { node: LayoutNode; axis: Axis; language: WireLanguage }): ReactNode {
  const { label } = node
  const zh = language === 'zh'
  switch (node.type) {
    case 'heading': return label ? <strong className="bq-wf-heading">{label}</strong> : <Bars className="bq-wf-lines bq-wf-heading-bar" />
    case 'button': return <span className={`bq-wf-btn bq-wf-btn-${node.variant ?? 'secondary'}`}>{node.icon && <Icon name={node.icon} size={14} />}{label ?? (node.icon ? null : (zh ? '按钮' : 'Button'))}</span>
    case 'input': case 'select': {
      const tall = typeof node.height === 'number' && node.height > 48
      return <span className={`bq-wf-input${tall ? ' bq-wf-tall' : ''}`}>{node.icon && <Icon name={node.icon} size={14} />}<span className="bq-wf-ph">{label}</span>{node.type === 'select' && <Icon name="chevron-down" size={14} />}</span>
    }
    case 'checkbox': case 'radio': case 'toggle':
      return <span className="bq-wf-choice"><span className={`bq-wf-${node.type}${node.checked ? ' bq-wf-on' : ''}`}>{node.type === 'checkbox' && node.checked && <Icon name="check" size={10} />}</span>{label ? <span>{label}</span> : <Bars />}</span>
    case 'image': return <span className="bq-wf-image"><svg viewBox="0 0 48 32" width="44" height="30" aria-hidden="true"><circle cx="34" cy="9" r="4" /><path d="M2 30L16 13l9 10 6-6 15 13z" /></svg>{label && <span>{label}</span>}</span>
    case 'avatar': {
      const size = typeof node.width === 'number' ? node.width : typeof node.height === 'number' ? node.height : 32
      const initial = label ? Array.from(label.trim())[0] : undefined
      return <span className="bq-wf-avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>{initial ?? <Icon name="user" size={Math.round(size * 0.55)} />}</span>
    }
    case 'icon': return <span className="bq-wf-icon"><Icon name={node.icon ?? 'square'} size={typeof node.width === 'number' ? node.width : 16} />{label && <span>{label}</span>}</span>
    case 'badge': return <span className={`bq-wf-badge bq-wf-badge-${node.variant ?? 'neutral'}`}>{label ?? '•••'}</span>
    case 'divider': return <span className={`bq-wf-divider${axis === 'row' ? ' bq-wf-vertical' : ''}`} />
    case 'spacer': return <span className="bq-wf-spacer" style={node.width === undefined && node.height === undefined ? { flex: '1 1 0%' } : undefined} />
    case 'tabs': {
      const items = node.items?.length ? node.items : ['', '', '']
      return <span className={`bq-wf-tabs bq-wf-tabs-${node.variant ?? 'underline'}`}>{items.map((item, i) => <span key={i} className={i === (node.active ?? 0) ? 'bq-wf-on' : undefined}>{item || <Bars />}</span>)}</span>
    }
    case 'nav': {
      const items = range(Math.max(node.items?.length ?? 0, node.icons?.length ?? 0) || 5).map(i => node.items?.[i] ?? '')
      return <span className="bq-wf-nav">{label && <span className="bq-wf-caption">{label}</span>}{items.map((item, i) => <span key={i} className={`bq-wf-nav-item${i === node.active ? ' bq-wf-on' : ''}`}>{node.icons?.[i] ? <Icon name={node.icons[i]!} size={14} /> : <i className="bq-wf-dot" />}{item || <Bars />}</span>)}</span>
    }
    case 'list': {
      const items: string[] = node.items?.length ? node.items : range(node.count ?? 3).map(() => '')
      const media = node.variant === 'media'
      return <span className={`bq-wf-list${media ? ' bq-wf-media' : ''}`}>{label && <span className="bq-wf-caption">{label}</span>}{items.map((item, i) => <span key={i} className="bq-wf-list-item">
        {node.icons?.[i] ? <Icon name={node.icons[i]!} size={14} /> : <i className={media ? 'bq-wf-thumb' : 'bq-wf-dot'} />}
        <span className="bq-wf-list-text">{item ? <span>{item}</span> : <Bars />}{media && <Bars className="bq-wf-lines bq-wf-faint" />}</span>
      </span>)}</span>
    }
    case 'table': {
      const columns = node.items?.length ?? node.columns ?? 3
      return <span className="bq-wf-table" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {range(columns).map(i => <span key={`h${i}`} className="bq-wf-th">{node.items?.[i] || <Bars />}</span>)}
        {range((node.rows ?? 4) * columns).map(i => <span key={i} className="bq-wf-td"><i style={{ width: BAR_WIDTHS[(i * 7) % 4] }} /></span>)}
      </span>
    }
    case 'chart': return <span className="bq-wf-chart">{label && <span className="bq-wf-caption">{label}</span>}<Chart variant={node.variant} /></span>
    default: return label ? <span className={`bq-wf-text${node.variant === 'caption' ? ' bq-wf-muted' : ''}`}>{label}</span> : <Bars lines={node.lines} />
  }
}

function Node({ node, axis, parentAlign, root, language }: { node: LayoutNode; axis: Axis; parentAlign?: Align; root?: boolean; language: WireLanguage }) {
  const size = sizeStyle(node, axis, parentAlign)
  if (!isContainer(node)) {
    const content = <Leaf node={node} axis={axis} language={language} />
    return <span className={`bq-wf-leaf bq-wf-${node.type}-slot`} style={size}>{content}</span>
  }
  const flowAxis: Axis = node.type === 'row' ? 'row' : node.type === 'grid' ? 'grid' : 'column'
  const variant = node.variant ?? (node.type === 'box' ? 'outline' : node.type === 'frame' ? 'browser' : 'plain')
  const framed = node.type === 'frame'
  const defaultPad = framed ? 0 : node.type === 'box' || variant !== 'plain' ? 12 : root ? 16 : 0
  const flow: CSSProperties = {
    display: node.type === 'grid' ? 'grid' : 'flex', flexDirection: node.type === 'row' ? 'row' : 'column',
    gap: node.gap ?? (node.type === 'box' ? 8 : 12), alignItems: node.align ? ALIGN[node.align] : 'stretch',
    ...(node.justify ? { justifyContent: JUSTIFY[node.justify] } : {}),
    ...(node.wrap ? { flexWrap: 'wrap' } : {}),
    ...(node.type === 'grid' ? { gridTemplateColumns: `repeat(${node.columns ?? 2}, minmax(0, 1fr))` } : {}),
  }
  const children = node.children?.map((child, i) => <Node key={i} node={child} axis={flowAxis} parentAlign={node.align} language={language} />)
  const outer: CSSProperties = { ...size, padding: framed ? 0 : node.padding ?? defaultPad }
  if (framed) {
    if (node.width === undefined && FRAME_WIDTH[variant]) outer.width = FRAME_WIDTH[variant]
    return <div className={`bq-wf-frame bq-wf-frame-${variant}`} style={outer}>
      {variant === 'mobile' ? <span className="bq-wf-status"><b>9:41</b><i className="bq-wf-notch" /><b>●●●</b></span>
        : variant !== 'plain' && <span className="bq-wf-chrome"><i /><i /><i />{node.label ? <span className={variant === 'browser' ? 'bq-wf-url' : 'bq-wf-title'}>{node.label}</span> : variant === 'browser' && <span className="bq-wf-url" />}</span>}
      <div className="bq-wf-body" style={{ ...flow, padding: node.padding ?? 0 }}>{children}</div>
    </div>
  }
  const className = `bq-wf-c bq-wf-${node.type} bq-wf-v-${variant}`
  if (!node.label) return <div className={className} style={{ ...outer, ...flow }}>{children}</div>
  return <div className={className} style={{ ...outer, display: 'flex', flexDirection: 'column', gap: 8 }}>
    <span className="bq-wf-caption">{node.label}</span>
    {children?.length ? <div style={{ ...flow, flex: '1 1 auto', minHeight: 0 }}>{children}</div> : null}
  </div>
}

/** Fixed-size designs fit the pane by width and height; the toolbar toggles actual size with scrolling. */
export const FIT_MAX_HEIGHT = 500
function Fit({ designWidth, label, language, children }: { designWidth?: number; label: string; language: WireLanguage; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ available: 0, height: 0 })
  const [actual, setActual] = useState(false)
  useLayoutEffect(() => {
    const o = outer.current, s = stage.current
    if (!o || !s || typeof ResizeObserver === 'undefined') return
    const update = () => setBox({ available: o.clientWidth, height: s.offsetHeight })
    const observer = new ResizeObserver(update)
    observer.observe(o); observer.observe(s); update()
    return () => observer.disconnect()
  }, [])
  // Fluid layouts (no numeric root width) follow the pane instead of scaling.
  const fit = designWidth && box.available > 0 && box.height > 0 ? Math.min(1, box.available / designWidth, FIT_MAX_HEIGHT / box.height) : 1
  const scale = actual ? 1 : fit
  const zh = language === 'zh'
  const fitted = scale < 1
  return <>
    {fit < 1 && <div className="bq-wf-toolbar">
      <span className="bq-wf-scale">{zh ? '缩放' : 'Zoom'} {Math.round(scale * 100)}%</span>
      <button type="button" className="bq-wf-zoom" aria-pressed={actual} onClick={() => setActual(!actual)}>{actual ? (zh ? '适应窗口' : 'Fit to pane') : (zh ? '查看原尺寸' : 'Actual size')}</button>
    </div>}
    <div ref={outer} className="bq-wf-fit" role="img" aria-label={label} style={fitted ? { overflow: 'hidden', height: Math.ceil(box.height * scale) } : { overflow: 'auto' }}>
      <div ref={stage} className="bq-wf-stage" style={{ width: designWidth, ...(fitted ? { transform: `scale(${scale})`, transformOrigin: '0 0', marginLeft: Math.max(0, (box.available - designWidth! * scale) / 2) } : { margin: '0 auto' }) }}>{children}</div>
    </div>
  </>
}

export function Wireframe({ root, label, language = 'en' }: { root: LayoutNode; label?: string; language?: WireLanguage }) {
  const designWidth = typeof root.width === 'number' ? root.width : root.type === 'frame' ? FRAME_WIDTH[root.variant ?? 'browser'] : undefined
  const name = `${language === 'zh' ? '布局线框图' : 'Layout wireframe'}${label ? `: ${label}` : ''}`
  const tree = <Node node={root} axis="root" root language={language} />
  return <Fit designWidth={designWidth} label={name} language={language}>{root.type === 'frame' ? tree : <div className="bq-wf-sheet">{tree}</div>}</Fit>
}
