// @vitest-environment jsdom
import React, { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuestionCard, createDraft, type QuestionCardProps } from '../src/client/Card'
import type { BetterQuestion } from '../src/shared/model'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const questions: BetterQuestion[] = [
  { id: 'design', question: 'Choose a layout', multi_select: false, options: [{ label: 'Compact', proto: 'prototypes/compact.tsx' }, { label: 'Spacious', recommended: true, proto: 'prototypes/spacious.tsx' }] },
  { id: 'features', question: 'Choose features', multi_select: true, options: [{ label: 'Search' }, { label: 'Filters' }] },
]
function Harness(props: Partial<QuestionCardProps> = {}) {
  const source = props.questions ?? questions
  const [draft, setDraft] = useState(() => props.draft ?? createDraft(source))
  return <QuestionCard questions={source} openFile={() => {}} {...props} draft={draft} onDraftChange={next => { setDraft(next); props.onDraftChange?.(next) }} />
}
const input = (name: string, role = 'radio') => screen.getByRole(role, { name }) as HTMLInputElement

describe('controlled question card', () => {
  it('shows the recommended badge without selecting the option', () => {
    render(<Harness />)
    expect(screen.getByText('Recommended')).toBeTruthy()
    expect(input('SpaciousRecommended').checked).toBe(false)
    expect(input('Compact').checked).toBe(false)
  })
  it('opens the prototype file in the sidebar when its option is selected', () => {
    const openFile = vi.fn()
    render(<Harness openFile={openFile} />)
    fireEvent.click(input('SpaciousRecommended'))
    expect(input('SpaciousRecommended').checked).toBe(true)
    expect(openFile).toHaveBeenCalledTimes(1)
    expect(openFile).toHaveBeenCalledWith('prototypes/spacious.tsx')
  })
  it('opens a prototype from the separate action without selecting the option', () => {
    const openFile = vi.fn()
    render(<Harness openFile={openFile} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open file: Compact' }))
    expect(openFile).toHaveBeenCalledWith('prototypes/compact.tsx')
    expect(input('Compact').checked).toBe(false)
    expect(input('SpaciousRecommended').checked).toBe(false)
  })
  it('opens prototype files only when checking an option in multi-select', () => {
    const openFile = vi.fn()
    render(<Harness questions={[{ ...questions[0]!, multi_select: true }]} openFile={openFile} />)
    fireEvent.click(input('Compact', 'checkbox'))
    expect(input('Compact', 'checkbox').checked).toBe(true)
    expect(openFile).toHaveBeenCalledWith('prototypes/compact.tsx')
    fireEvent.click(input('SpaciousRecommended', 'checkbox'))
    expect(openFile).toHaveBeenCalledTimes(2)
    fireEvent.click(input('SpaciousRecommended', 'checkbox'))
    expect(input('SpaciousRecommended', 'checkbox').checked).toBe(false)
    expect(openFile).toHaveBeenCalledTimes(2)
  })
  it('never opens a file for an option without a proto path', () => {
    const openFile = vi.fn()
    render(<Harness questions={[questions[1]!]} openFile={openFile} />)
    fireEvent.click(input('Search', 'checkbox'))
    expect(input('Search', 'checkbox').checked).toBe(true)
    expect(openFile).not.toHaveBeenCalled()
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
  it('reports a sidebar open failure without dropping the selection', () => {
    const openFile = vi.fn(() => { throw new Error('sidebar unavailable') })
    render(<Harness questions={[questions[0]!]} openFile={openFile} />)
    fireEvent.click(input('Compact'))
    expect(input('Compact').checked).toBe(true)
    const alert = screen.getByRole('alert')
    expect(alert.className).toContain('bq-action-error')
    expect(alert.textContent).toContain('sidebar unavailable')
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
    render(<Harness questions={[{ id: 'custom', question: 'Anything else?', multi_select: false, options: [] }]} onSubmit={submit} />)
    fireEvent.change(screen.getByLabelText('Your own answer'), { target: { value: 'My answer' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }))
    await waitFor(() => expect(submit).toHaveBeenCalledWith({ answers: [{ id: 'custom', selected: [], custom: 'My answer' }] }))
  })
  it('localizes UI and locks read-only answers while keeping the open action usable', () => {
    const openFile = vi.fn()
    const draft = createDraft(questions, { answers: [{ id: 'design', selected: ['Compact'], custom: 'Saved' }] })
    render(<Harness draft={draft} readOnly language="zh" openFile={openFile} />)
    expect(screen.getByText('只读')).toBeTruthy()
    expect(screen.getByText('选择一项，或输入自己的回答。')).toBeTruthy()
    expect(input('Compact').disabled).toBe(true)
    expect(input('Compact').checked).toBe(true)
    expect(screen.queryByRole('button', { name: '提交回答' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '打开文件: Compact' }))
    expect(openFile).toHaveBeenCalledWith('prototypes/compact.tsx')
    expect(input('Compact').checked).toBe(true)
  })
})
