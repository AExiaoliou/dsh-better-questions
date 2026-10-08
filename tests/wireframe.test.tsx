// @vitest-environment jsdom
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LayoutPreview } from '../src/client/preview'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const admin = `type: frame
variant: browser
label: app.example.com
children:
  - type: row
    children:
      - {type: nav, items: [首页, 项目], icons: [home, unknown-icon], active: 1, width: 180}
      - type: column
        width: fill
        children:
          - {type: heading, label: 工作台}
          - {type: button, variant: primary, label: 新建}
          - {type: input, icon: search, label: 搜索}
          - {type: checkbox, checked: true, label: 已完成}
          - {type: table, items: [名称, 状态], rows: 2}
          - {type: chart, variant: bar}
`

describe('wireframe renderer', () => {
  it('renders one labelled image with no focusable or form controls inside', () => {
    render(<LayoutPreview proto={admin} label="左右分栏" language="zh" />)
    const figure = screen.getByRole('img', { name: '布局线框图: 左右分栏' })
    expect(figure.querySelector('button,input,textarea,select,a,iframe,[tabindex],[href],[src]')).toBeNull()
    expect(figure.textContent).toContain('app.example.com')
    for (const text of ['首页', '工作台', '新建', '搜索', '已完成', '名称']) expect(screen.getByText(text)).toBeTruthy()
    // Two nav icons (one unknown name falls back to a placeholder glyph) plus search and check icons.
    expect(figure.querySelectorAll('.bq-wf-nav svg')).toHaveLength(2)
    expect(figure.querySelector('.bq-wf-nav-item.bq-wf-on')?.textContent).toBe('项目')
    expect(figure.querySelectorAll('.bq-wf-th')).toHaveLength(2)
    expect(figure.querySelectorAll('.bq-wf-td')).toHaveLength(4)
  })
  it('maps fill to the parent axis and keeps fixed main-axis sizes from shrinking', () => {
    render(<LayoutPreview proto={'type: row\nchildren:\n  - {type: box, width: 160}\n  - {type: column, width: fill, height: fill, children: [{type: text, height: fill}]}'} />)
    const [fixed, fill] = Array.from(document.querySelectorAll<HTMLElement>('.bq-wf-row > div'))
    expect(fixed!.style.width).toBe('160px')
    expect(fixed!.style.flexShrink).toBe('0')
    expect(fill!.style.flex).toBe('1 1 0%')
    expect(fill!.style.alignSelf).toBe('stretch')
    expect(fill!.querySelector<HTMLElement>('.bq-wf-leaf')!.style.flex).toBe('1 1 0%')
  })
  it('renders skeleton bars for unlabeled text and keeps v1 labels and boxes', () => {
    render(<LayoutPreview proto={'type: column\nchildren:\n  - {type: text, lines: 3}\n  - {type: box, label: 内容区, height: 120}\n  - {type: image, label: Hero}'} />)
    expect(document.querySelectorAll('.bq-wf-lines > i')).toHaveLength(3)
    expect(screen.getByText('内容区')).toBeTruthy()
    expect(screen.getByText('Hero')).toBeTruthy()
  })
  it('scales fixed-width designs to the pane and toggles actual size', () => {
    let callback: () => void = () => {}
    vi.stubGlobal('ResizeObserver', class { constructor(cb: () => void) { callback = cb } observe() {} disconnect() {} })
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(480)
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(600)
    render(<LayoutPreview proto={'type: row\nwidth: 960\nchildren: [{type: text}]'} language="en" />)
    callback()
    expect(screen.getByText('Zoom 50%')).toBeTruthy()
    const stage = document.querySelector<HTMLElement>('.bq-wf-stage')!
    expect(stage.style.transform).toBe('scale(0.5)')
    fireEvent.click(screen.getByRole('button', { name: 'Actual size' }))
    expect(stage.style.transform).toBe('')
    expect(screen.getByRole('button', { name: 'Fit to pane' }).getAttribute('aria-pressed')).toBe('true')
  })
  it('lets fluid layouts follow the pane without a zoom control', () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
    render(<LayoutPreview proto={'type: row\nchildren: [{type: text}]'} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
  it('reports grammar errors locally', () => {
    render(<LayoutPreview proto={'type: text\nstyle: red'} />)
    expect(screen.getByRole('alert').textContent).toContain('$.style: unknown field for text')
  })
})

describe('layout skill stays in sync with the implementation', async () => {
  const { readFileSync } = await import('node:fs')
  const { parseLayout } = await import('../src/shared/layout')
  const { ICON_NAMES } = await import('../src/client/icons')
  const skill = readFileSync(`${process.cwd()}/skills/better-questions-layout/SKILL.md`, 'utf8')
  it('documents a parseable example and exactly the built-in icon names', () => {
    const example = skill.match(/```yaml\n([\s\S]*?)```/)![1]!
    expect(parseLayout(example).type).toBe('frame')
    const documented = skill.match(/^Icon names: (.*?)\. Unknown/m)![1]!.split(' ')
    expect(documented).toEqual(ICON_NAMES)
  })
})
