// @vitest-environment jsdom
import React, { useSyncExternalStore } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { apply, createDraftStore } from '../src/client/index.tsx'
import { fileResourceAddress, matchPending, validDraft } from '../src/client/runtime.ts'
import { createDraft } from '../src/client/Card.tsx'
import { PROJECTION_KEY, type ProjectionView } from '../src/shared/model.ts'

function observable<T>(initial: T) {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    listeners,
    getSnapshot: () => value,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    set: (next: T) => { value = next; for (const listener of [...listeners]) listener() },
  }
}
const questions = [{ id: 'q1', question: 'Choose a design', multi_select: false,
  options: [{ label: 'A', recommended: true }, { label: 'B' }] }]
const row = (callId = 'c1') => ({ callId, questions })
function carrier(sessionId = 's1', callId = 'c1') {
  const source = observable({ closed: false, channel: 'waterfall', state: 'open' })
  return { ...source, snapshot: source.getSnapshot, sessionId, callId, key: `${sessionId}:${callId}`, kind: 'question', questions,
    answer: vi.fn(async (_batch: unknown) => {}), dismiss: vi.fn(async () => {}) }
}

type Entry = { options: any; Component: React.ComponentType<any>; removed: boolean }
/** Service-level test doubles retain declaration/registration and observable lifetimes. */
function harness() {
  const list = observable({ byId: {} as Record<string, { id: string }> })
  const bindings = new Map<string, any>()
  const status = observable(new Map<string, any>())
  const locale = observable({ active: 'en' })
  const entries: Entry[] = []
  const injections = new Map<string, { callback: () => () => void; dispose?: () => void }>()
  const declared = new Set(['conversation.composer', 'tool.call.toolview'])
  const reveal = vi.fn(() => true)
  let panels: { reveal: typeof reveal } | undefined = { reveal }
  const ctx = {
    sessions: { list, binding: (id: string) => bindings.get(id) },
    uiSession: { sessionStatus: status }, locale,
    sidebarRight: { openResource: vi.fn() },
    get: (name: string) => name === 'userQuestionPanels' ? panels : undefined,
    slots: {
      inject: (name: string, callback: () => () => void) => {
        const injection = { callback, dispose: declared.has(name) ? callback() : undefined }
        injections.set(name, injection)
        return () => { injection.dispose?.(); injections.delete(name) }
      },
      register: (options: any, Component: React.ComponentType<any>) => {
        if (!declared.has(options.name)) throw new Error('slot is not declared')
        const entry = { options, Component, removed: false }
        entries.push(entry)
        return () => { entry.removed = true }
      },
    },
  }
  const add = (id: string, initial: ProjectionView | undefined = undefined) => {
    const projection = observable(initial)
    bindings.set(id, { session: { projections: { faceOf: (key: string) => {
      expect(key).toBe(PROJECTION_KEY); return projection
    } } } })
    list.set({ byId: { ...list.getSnapshot().byId, [id]: { id } } })
    return projection
  }
  const remove = (id: string) => {
    bindings.delete(id)
    const { [id]: _removed, ...rest } = list.getSnapshot().byId
    list.set({ byId: rest })
  }
  const live = (name = 'conversation.composer') => entries.filter(entry => !entry.removed && entry.options.name === name)
  const collapse = (name: string) => { declared.delete(name); injections.get(name)?.dispose?.() }
  const redeclare = (name: string) => { declared.add(name); const item = injections.get(name)!; item.dispose = item.callback() }
  const dispose = () => { for (const item of injections.values()) item.dispose?.() }
  apply(ctx as unknown as Context)
  return { ctx, add, remove, live, entries, list, status, locale, reveal, collapse, redeclare, dispose,
    noPanels: () => { panels = undefined } }
}

function useSource(source: any, select: (value: any) => any = value => value) {
  const value = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot)
  return select(value)
}
const absent = observable(undefined)
function composerProps(entry: Entry, pending: ReturnType<typeof carrier>, store = entry.options.store.create(pending.sessionId)) {
  const face = entry.options.inject(pending.sessionId)
  return {
    matched: pending, questions: face.questions, openFile: face.openFile,
    useLanguage: (selector: any) => useSource(face.hooks.language, selector),
    useQuestionCard: (key: string, selector?: any) => useSource(face.keyedHooks.questionCard(key) ?? absent, selector),
    useStore: (selector: any) => useSource(store, selector), actions: store.actions,
  }
}
function publishPending(h: ReturnType<typeof harness>, pending: ReturnType<typeof carrier>) {
  h.status.set(new Map([[pending.sessionId, { pendingInteraction: pending }]]))
}

// Node's experimental localStorage can shadow jsdom's Storage. Supply a browser
// Storage face so the real framework persistence engine is exercised in Node too.
beforeEach(() => {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) },
    removeItem: (key: string) => { data.delete(key) },
    clear: () => data.clear(), key: (index: number) => [...data.keys()][index] ?? null,
    get length() { return data.size },
  })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('composer registration and lifecycle', () => {
  it.each(['projection first', 'pending first'])('matches exact session and call with %s', order => {
    const h = harness()
    const projection = h.add('s1')
    const pending = carrier()
    if (order === 'pending first') publishPending(h, pending)
    projection.set({ active: [row()] })
    if (order === 'projection first') publishPending(h, pending)
    const entry = h.live()[0]!
    expect(entry.options.priority).toBe(-1)
    const select = entry.options.select
    expect(select({ sessionId: 's1', pendingInteraction: pending })).toBe(pending)
    expect(select({ sessionId: 's2', pendingInteraction: pending })).toBeNull()
    expect(select({ sessionId: 's1', pendingInteraction: carrier('s2') })).toBeNull()
    expect(select({ sessionId: 's1', pendingInteraction: carrier('s1', 'other') })).toBeNull()
    expect(select({ sessionId: 's1', pendingInteraction: { ...pending, kind: 'approval' } })).toBeNull()
    expect(select({ sessionId: 's1', pendingInteraction: undefined })).toBeNull()
    h.dispose()
  })

  it('removes settled calls, replaces generations, and cleans declaration and plugin lifetimes', () => {
    const h = harness()
    const old = h.add('s1', { active: [row(), row('c2')] })
    const second = h.add('s2', { active: [row()] })
    expect(h.live()).toHaveLength(3)
    old.set({ active: [row('c2')] }) // Any tool result, including interruption, removes the projection row.
    expect(h.live()).toHaveLength(2)
    const replacement = h.add('s1', { active: [row('c3')] })
    expect(old.listeners.size).toBe(0)
    expect(replacement.listeners.size).toBe(1)
    old.set({ active: [row('stale')] })
    expect(h.live()).toHaveLength(2)
    h.collapse('conversation.composer')
    expect(h.live()).toHaveLength(0)
    expect(replacement.listeners.size).toBe(0)
    expect(h.list.listeners.size).toBe(0)
    h.redeclare('conversation.composer')
    expect(h.live()).toHaveLength(2)
    h.remove('s2')
    expect(second.listeners.size).toBe(0)
    expect(h.live()).toHaveLength(1)
    h.dispose()
    expect(h.live()).toHaveLength(0)
    expect(replacement.listeners.size).toBe(0)
    expect(h.list.listeners.size).toBe(0)
  })

  it('does not churn equal projection data or fabricate a pending carrier after restart', () => {
    const h = harness()
    const projection = h.add('s1', { active: [row()] })
    const first = h.live()[0]!
    projection.set({ active: [structuredClone(row())] })
    expect(h.live()[0]).toBe(first)
    expect(first.options.select({ sessionId: 's1' })).toBeNull()
    expect(first.options.inject('s1').keyedHooks.questionCard('s1:c1')).toBeUndefined()
    h.dispose()
  })
})

describe('live composer behavior', () => {
  it('keeps a draft through close/reopen and failed submission; answers only on the carrier', async () => {
    const h = harness()
    h.add('s1', { active: [row()] })
    const pending = carrier()
    publishPending(h, pending)
    const entry = h.live()[0]!
    const store = entry.options.store.create('s1')
    const props = composerProps(entry, pending, store)
    const Component = entry.Component
    const mounted = render(<Component {...props} />)
    expect((screen.getByRole('radio', { name: /A/ }) as HTMLInputElement).checked).toBe(false)
    fireEvent.click(screen.getByRole('radio', { name: 'B' }))
    await waitFor(() => expect((screen.getByRole('radio', { name: 'B' }) as HTMLInputElement).checked).toBe(true))
    fireEvent.click(screen.getByRole('button', { name: 'Close questions' }))
    await waitFor(() => expect(pending.dismiss).toHaveBeenCalledOnce())
    mounted.unmount()
    render(<Component {...composerProps(entry, pending, store)} />)
    expect((screen.getByRole('radio', { name: 'B' }) as HTMLInputElement).checked).toBe(true)
    pending.answer.mockRejectedValueOnce(new Error('transport unavailable'))
    fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }))
    await screen.findByRole('alert')
    expect((screen.getByRole('radio', { name: 'B' }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }))
    await waitFor(() => expect(pending.answer).toHaveBeenCalledTimes(2))
    expect(pending.answer).toHaveBeenLastCalledWith({ answers: [{ id: 'q1', selected: ['B'] }] })
    await waitFor(() => expect(store.getSnapshot().byCall).toEqual({}))
    h.dispose()
  })

  it('observes the live carrier channel and uses the session sidebar resource address', async () => {
    const h = harness()
    h.add('s1', { active: [row()] })
    const pending = carrier()
    pending.set({ closed: false, channel: 'none', state: 'open' })
    publishPending(h, pending)
    const entry = h.live()[0]!
    const Component = entry.Component
    render(<Component {...composerProps(entry, pending)} />)
    expect(screen.queryByRole('button', { name: 'Submit answers' })).toBeNull()
    act(() => pending.set({ closed: false, channel: 'waterfall', state: 'open' }))
    expect(screen.getByRole('button', { name: 'Submit answers' })).toBeTruthy()
    entry.options.inject('s1').openFile('/tmp/a b#c.ts')
    expect(h.ctx.sidebarRight.openResource).toHaveBeenCalledWith('dsh-resource://file/session/s1//tmp/a%20b%23c.ts')
    act(() => h.locale.set({ active: 'zh-CN' }))
    expect(screen.getByRole('button', { name: '提交回答' })).toBeTruthy()
    h.dispose()
  })

  it('persists session drafts without letting malformed stored state become answers', async () => {
    const store = createDraftStore()
    const first = store.create('draft-test')
    const draft = createDraft(questions)
    draft.answers.q1!.custom = 'Keep this draft'
    first.actions.replace('c1', draft)
    await waitFor(() => expect(store.create('draft-test').getSnapshot().byCall['"c1"']).toEqual(draft))
    expect(store.create('different-session').getSnapshot().byCall).toEqual({})
    expect(validDraft(draft, questions)).toBe(true)
    expect(validDraft({ ...draft, index: 500 }, questions)).toBe(false)
    expect(validDraft({ ...draft, answers: { q1: { selected: ['invented'], custom: '' } } }, questions)).toBe(false)
  })
})

describe('tool view and file addresses', () => {
  it('reopens an active call through the optional public panel face', () => {
    const h = harness()
    const entry = h.live('tool.call.toolview')[0]!
    expect(entry.options.key).toBe('ask_with_prototype')
    const face = entry.options.inject('s1')
    expect(face.revealPanel('c1')).toBe(true)
    expect(h.reveal).toHaveBeenCalledWith('s1', 'c1')
    h.noPanels()
    expect(face.revealPanel('c1')).toBe(false)
    h.dispose()
  })

  it('renders completed answers inline read-only and uses the tool owner file callback', () => {
    const h = harness()
    const entry = h.live('tool.call.toolview')[0]!
    const Component = entry.Component
    const face = entry.options.inject('s1')
    const fileQuestions = [{ ...questions[0], options: [{ label: 'Report', proto: '/tmp/report.md' }] }]
    const openFile = vi.fn()
    const disclosure = observable(false)
    render(<Component phase="result" callId="c1" openFile={openFile}
      block={{ call: { argsRaw: JSON.stringify({ questions: fileQuestions }) },
        content: [{ type: 'text', text: JSON.stringify({ answers: [{ id: 'q1', selected: ['Report'] }] }) }] }}
      useProjection={(_key: string, selector: any) => selector({ active: [] })}
      useDisclosure={() => ({ expanded: useSource(disclosure), toggle: () => disclosure.set(!disclosure.getSnapshot()) })}
      useLanguage={(selector: any) => useSource(face.hooks.language, selector)} revealPanel={face.revealPanel} />)
    expect(screen.getByText('Ask question')).toBeTruthy()
    expect(screen.getByText('1/1 answered')).toBeTruthy()
    const leading = screen.getByRole('button', { name: 'Ask question' })
    expect(leading.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(leading)
    expect(leading.getAttribute('aria-expanded')).toBe('true')
    const transcript = document.querySelector('.bq-tool-transcript')!
    expect(transcript.tagName).toBe('DL')
    expect(transcript.querySelector('dt')?.textContent).toBe('Choose a design')
    expect(transcript.querySelector('dd')?.textContent).toBe('Report')
    fireEvent.click(screen.getByRole('button', { name: 'View answers' }))
    expect(screen.queryByRole('button', { name: 'Submit answers' })).toBeNull()
    const choice = screen.getByRole('radio', { name: 'Report' }) as HTMLInputElement
    expect(choice.checked).toBe(true)
    expect(choice.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Open file: Report' }))
    expect(openFile).toHaveBeenCalledWith('/tmp/report.md')
    expect(h.reveal).not.toHaveBeenCalled()
    h.dispose()
  })

  it('keeps the native answer action on a running row', () => {
    const h = harness()
    const entry = h.live('tool.call.toolview')[0]!
    const face = entry.options.inject('s1')
    const disclosure = observable(false)
    render(<entry.Component phase="running" callId="c1" block={{ argsRaw: JSON.stringify({ questions }) }}
      useProjection={(_key: string, selector: any) => selector({ active: [] })}
      useDisclosure={() => ({ expanded: useSource(disclosure), toggle: () => disclosure.set(!disclosure.getSnapshot()) })}
      useLanguage={(selector: any) => useSource(face.hooks.language, selector)} revealPanel={face.revealPanel} />)
    expect(screen.getByText('waiting')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }))
    expect(h.reveal).toHaveBeenCalledWith('s1', 'c1')
    expect(screen.getByRole('button', { name: 'Ask question' }).getAttribute('aria-expanded')).toBe('false')
    h.dispose()
  })

  it('opens read-only review from the collapsed row and distinguishes missing answers from skips', () => {
    const h = harness()
    const entry = h.live('tool.call.toolview')[0]!
    const face = entry.options.inject('s1')
    const disclosure = observable(false)
    const props = {
      phase: 'result', callId: 'c1', openFile: vi.fn(),
      useProjection: (_key: string, selector: any) => selector({ active: [] }),
      useDisclosure: () => ({ expanded: useSource(disclosure), toggle: () => disclosure.set(!disclosure.getSnapshot()) }),
      useLanguage: (selector: any) => useSource(face.hooks.language, selector), revealPanel: face.revealPanel,
    }
    const Component = entry.Component
    const { rerender } = render(<Component {...props} block={{ call: { argsRaw: JSON.stringify({ questions }) },
      content: [{ type: 'text', text: JSON.stringify({ answers: [{ id: 'q1', selected: [] }] }) }] }} />)
    expect(screen.getByText('0/1 answered')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ask question' }))
    expect(screen.getByText('Not answered')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ask question' }))
    fireEvent.click(screen.getByRole('button', { name: 'View answers' }))
    expect(screen.getByRole('button', { name: 'Ask question' }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: 'View answers' }).getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'View answers' }))
    rerender(<Component {...props} block={{ call: { argsRaw: JSON.stringify({ questions }) }, content: [] }} />)
    expect(screen.getByText('No answers submitted')).toBeTruthy()
    expect(screen.getByText('Choose a design')).toBeTruthy()
    expect(document.querySelector('.bq-tool-transcript dd')).toBeNull()
    h.dispose()
  })

  it('encodes session and path segments separately, preserving absolute paths', () => {
    expect(fileResourceAddress('s/1', '/work/a b#c?.md')).toBe('dsh-resource://file/session/s%2F1//work/a%20b%23c%3F.md')
    expect(fileResourceAddress('s1', 'src/main.ts')).toBe('dsh-resource://file/session/s1/src/main.ts')
    expect(fileResourceAddress('s:1', String.raw`C:\work\a b.ts`)).toBe('dsh-resource://file/session/s:1/C:/work/a%20b.ts')
    expect(fileResourceAddress('s1', String.raw`\\server\share\a#b.txt`)).toBe('dsh-resource://file/session/s1///server/share/a%23b.txt')
    expect(fileResourceAddress('s1', '././src/a b.ts')).toBe('dsh-resource://file/session/s1/src/a%20b.ts')
    expect(fileResourceAddress('s1', String.raw`.\.\src\main.ts`)).toBe('dsh-resource://file/session/s1/src/main.ts')
    expect(matchPending({ kind: 'question', sessionId: 's1', callId: 'c1' }, 's1', 'c1')).toBeNull()
  })
})
