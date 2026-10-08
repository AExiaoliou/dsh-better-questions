// @vitest-environment jsdom
import React, { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuestionCard, createDraft, type QuestionCardProps } from '../src/client/Card'
import { CodePreview, HtmlPreview, parseCode, sanitizeHtml } from '../src/client/preview'
import type { BetterQuestion } from '../src/shared/model'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const questions: BetterQuestion[] = [
  { id: 'design', question: 'Choose a layout', type: 'layout', multi_select: false, options: [{ label: 'Compact', proto: 'type: text\nlabel: Compact preview' }, { label: 'Spacious', recommended: true, proto: 'type: text\nlabel: Spacious preview' }] },
  { id: 'features', question: 'Choose features', type: 'none', multi_select: true, options: [{ label: 'Search' }, { label: 'Filters' }] },
]
function Harness(props: Partial<QuestionCardProps> = {}) {
  const source = props.questions ?? questions
  const [draft, setDraft] = useState(() => props.draft ?? createDraft(source))
  return <QuestionCard questions={source} openFile={() => {}} {...props} draft={draft} onDraftChange={next => { setDraft(next); props.onDraftChange?.(next) }} />
}
const input = (name: string, role = 'radio') => screen.getByRole(role, { name }) as HTMLInputElement

describe('controlled question card', () => {
  it('starts preview at recommendation without selecting and follows a new selection', () => {
    render(<Harness />)
    expect(input('SpaciousRecommended').checked).toBe(false)
    expect(screen.getByText('Spacious preview')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Preview: Compact' }))
    expect(screen.getByText('Compact preview')).toBeTruthy()
    expect(input('Compact').checked).toBe(false)
    fireEvent.click(input('SpaciousRecommended'))
    expect(input('SpaciousRecommended').checked).toBe(true)
    expect(screen.getByText('Spacious preview')).toBeTruthy()
    fireEvent.click(input('Compact'))
    expect(screen.getByText('Compact preview')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Preview: Spacious' }))
    expect(input('Compact').checked).toBe(true)
    expect(screen.getByText('Spacious preview')).toBeTruthy()
  })
  it('follows newly checked options but not unchecked ones in multi-select', () => {
    render(<Harness questions={[{ ...questions[0]!, multi_select: true }]} />)
    fireEvent.click(input('Compact', 'checkbox'))
    expect(screen.getByText('Compact preview')).toBeTruthy()
    fireEvent.click(input('SpaciousRecommended', 'checkbox'))
    expect(screen.getByText('Spacious preview')).toBeTruthy()
    fireEvent.click(input('SpaciousRecommended', 'checkbox'))
    expect(screen.getByText('Spacious preview')).toBeTruthy()
  })
  it.each(['code', 'html'] as const)('switches %s preview when an option is selected', type => {
    const options = type === 'code'
      ? [{ label: 'First', proto: 'first()' }, { label: 'Second', proto: 'second()' }]
      : [{ label: 'First', proto: '<p>First</p>' }, { label: 'Second', proto: '<p>Second</p>' }]
    render(<Harness questions={[{ ...questions[0]!, type, options }]} />)
    fireEvent.click(input('Second'))
    if (type === 'code') expect(screen.getByLabelText('Code preview').textContent).toBe('second()')
    else expect((screen.getByTitle('Sandboxed HTML preview') as HTMLIFrameElement).srcdoc).toContain('<p>Second</p>')
  })
  it('preserves single/multi/custom answers across pagination and submits all', async () => {
    const submit = vi.fn().mockResolvedValue(undefined)
    render(<Harness onSubmit={submit} />)
    fireEvent.click(input('Compact'))
    fireEvent.change(screen.getByLabelText('Your own answer'), { target: { value: 'Please use soft corners' } })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(input('Search', 'checkbox'))
    fireEvent.click(input('Filters', 'checkbox'))
    fireEvent.change(screen.getByLabelText('Your own answer'), { target: { value: 'Also add export' } })
    fireEvent.click(screen.getByRole('button', { name: 'Question 1' }))
    expect(input('Compact').checked).toBe(true)
    expect((screen.getByLabelText('Your own answer') as HTMLTextAreaElement).value).toBe('Please use soft corners')
    fireEvent.click(screen.getByRole('button', { name: 'Question 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }))
    await waitFor(() => expect(submit).toHaveBeenCalledWith({ answers: [{ id: 'design', selected: ['Compact'], custom: 'Please use soft corners' }, { id: 'features', selected: ['Search', 'Filters'], custom: 'Also add export' }] }))
  })
  it('skip clears selection and custom, advances, and final skip submits empty entries', async () => {
    const submit = vi.fn().mockResolvedValue(undefined)
    render(<Harness onSubmit={submit} />)
    fireEvent.click(input('Compact'))
    fireEvent.change(screen.getByLabelText('Your own answer'), { target: { value: 'Discard this' } })
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(screen.getByText('Choose features')).toBeTruthy()
    fireEvent.click(input('Search', 'checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Skip & submit' }))
    await waitFor(() => expect(submit).toHaveBeenCalledWith({ answers: [{ id: 'design', selected: [] }, { id: 'features', selected: [] }] }))
  })
  it('retains answers on failure and guards concurrent submissions', async () => {
    let reject!: (error: Error) => void
    const submit = vi.fn(() => new Promise<void>((_resolve, fail) => { reject = fail }))
    render(<Harness questions={[questions[0]!]} onSubmit={submit} />)
    fireEvent.click(input('Compact'))
    fireEvent.change(screen.getByLabelText('Your own answer'), { target: { value: 'Keep me' } })
    const button = screen.getByRole('button', { name: 'Submit answers' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(submit).toHaveBeenCalledTimes(1)
    reject(new Error('Connection lost'))
    await screen.findByRole('alert')
    expect(input('Compact').checked).toBe(true)
    expect((screen.getByLabelText('Your own answer') as HTMLTextAreaElement).value).toBe('Keep me')
    expect(screen.getByRole('alert').textContent).toContain('Connection lost')
  })
  it('opens the file sidebar when selected, while the separate open action never selects', () => {
    const openFile = vi.fn()
    render(<Harness questions={[{ ...questions[0]!, type: 'file', options: [{ label: 'Readme', proto: '/project/README.md' }] }]} openFile={openFile} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open file: Readme' }))
    expect(openFile).toHaveBeenCalledWith('/project/README.md')
    expect(input('Readme').checked).toBe(false)
    fireEvent.click(input('Readme'))
    expect(input('Readme').checked).toBe(true)
    expect(openFile).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('complementary')).toBeNull()
  })
  it('uses controlled collapse and keeps composition/Enter inside the textarea', () => {
    const submit = vi.fn()
    render(<Harness questions={[questions[0]!]} onSubmit={submit} />)
    fireEvent.compositionStart(screen.getByLabelText('Your own answer'))
    fireEvent.keyDown(screen.getByLabelText('Your own answer'), { key: 'Enter', keyCode: 229, isComposing: true })
    fireEvent.compositionEnd(screen.getByLabelText('Your own answer'))
    expect(submit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Collapse questions' }))
    expect(screen.queryByRole('radiogroup')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Expand questions' }))
    expect(screen.getByRole('radiogroup')).toBeTruthy()
  })
  it('supports keyboard radio arrows and checkbox toggling', async () => {
    // jsdom lacks CSS.escape, which user-event needs for React's colon-bearing ids.
    vi.stubGlobal('CSS', { escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, character => `\\${character}`) })
    const user = userEvent.setup()
    render(<Harness />)
    input('Compact').focus()
    await user.keyboard('[Space][ArrowDown]')
    expect(input('SpaciousRecommended').checked).toBe(true)
    expect(input('Compact').checked).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    input('Search', 'checkbox').focus()
    await user.keyboard('[Space]')
    expect(input('Search', 'checkbox').checked).toBe(true)
    await user.keyboard('[Space]')
    expect(input('Search', 'checkbox').checked).toBe(false)
  })
  it('submits custom-only answers without requiring an option', async () => {
    const submit = vi.fn().mockResolvedValue(undefined)
    render(<Harness questions={[{ id: 'custom', question: 'Anything else?', type: 'none', multi_select: false, options: [] }]} onSubmit={submit} />)
    fireEvent.change(screen.getByLabelText('Your own answer'), { target: { value: 'My answer' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }))
    await waitFor(() => expect(submit).toHaveBeenCalledWith({ answers: [{ id: 'custom', selected: [], custom: 'My answer' }] }))
  })
  it('localizes UI and locks read-only answers while preserving preview controls', () => {
    const draft = createDraft(questions, { answers: [{ id: 'design', selected: ['Compact'], custom: 'Saved' }] })
    render(<Harness draft={draft} readOnly language="zh" />)
    expect(screen.getByText('只读')).toBeTruthy()
    expect(input('Compact').disabled).toBe(true)
    expect(input('Compact').checked).toBe(true)
    expect(screen.queryByRole('button', { name: '提交回答' })).toBeNull()
    expect(screen.getByText('Compact preview')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '预览: Spacious' }))
    expect(screen.getByText('Spacious preview')).toBeTruthy()
    expect(input('Compact').checked).toBe(true)
  })
})

describe('safe previews', () => {
  it('only removes one complete code fence and displays HTML as text', () => {
    expect(parseCode('```tsx\nconst n = 1\n```')).toEqual({ code: 'const n = 1', language: 'tsx' })
    expect(parseCode('```js\nnot closed').code).toBe('```js\nnot closed')
    const multiple = '```js\na\n```\n```js\nb\n```'
    expect(parseCode(multiple).code).toBe(multiple)
    render(<CodePreview proto={'<img src=x onerror=alert(1)>'} />)
    expect(document.querySelector('img')).toBeNull()
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy()
  })
  it('reports clipboard failure without throwing', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    render(<CodePreview proto="hello" />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Copy failed'))
  })
  it('strips active content, navigation, URLs, forms, foreign markup and unsafe attributes', () => {
    const html = sanitizeHtml('<meta http-equiv="refresh" content="0;url=https://evil.test"><base href="https://evil.test"><script>parent.hacked=true</script><iframe src="https://evil.test"></iframe><object data="https://evil.test"></object><svg><a href="https://evil.test">SVG</a></svg><form action="https://evil.test"><button formaction="https://evil.test" onclick="fetch(1)">Go</button></form><a href="https://evil.test" target="_top" ping="https://evil.test">Link</a><img src="https://evil.test"><input type="image" src="https://evil.test" autofocus><div onmouseover="alert(1)">Safe</div>')
    const doc = new DOMParser().parseFromString(html, 'text/html')
    expect(doc.querySelector('script,iframe,object,svg,form,a,img,base')).toBeNull()
    expect(doc.querySelector('[href],[src],[onclick],[formaction],[autofocus],[onmouseover],[target],[ping]')).toBeNull()
    expect(doc.querySelector('meta[http-equiv="refresh"]')).toBeNull()
    expect(doc.querySelector('button')?.disabled).toBe(true)
    expect(doc.querySelector('input')?.type).toBe('text')
    expect(doc.body.textContent).toContain('Link')
  })
  it('keeps inline CSS animations under CSP and an empty sandbox', () => {
    render(<HtmlPreview proto={'<style>@keyframes pulse{to{opacity:.5}}.box{animation:pulse 1s infinite;background:url(https://evil.test)}</style><div class="box">Animated</div>'} />)
    const frame = screen.getByTitle('Sandboxed HTML preview') as HTMLIFrameElement
    expect(frame.getAttribute('sandbox')).toBe('')
    expect(frame.srcdoc).toContain('@keyframes pulse')
    expect(frame.srcdoc).toContain("default-src 'none'")
    expect(frame.srcdoc).toContain("script-src 'none'")
    expect(frame.srcdoc).toContain("style-src 'unsafe-inline'")
    expect(frame.srcdoc).toContain("form-action 'none'")
  })
  it('rejects oversized HTML before parsing', () => { expect(() => sanitizeHtml('a'.repeat(65537))).toThrow(/64 KiB/) })
})
