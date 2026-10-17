import type { ISessions, SessionBinding } from '@deepseek-ai/dsh-api-session-controller/client'
import type { PendingQuestion } from '@deepseek-ai/dsh-client-ui-user-questions/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { PROJECTION_KEY, type BetterQuestion, type ProjectionView } from '../shared/model'

/** Narrow the public carrier face without importing the feature's private class. */
export function matchPending(value: unknown, sessionId: string, callId: string): PendingQuestion | null {
  if (typeof value !== 'object' || value === null) return null
  const carrier = value as Partial<PendingQuestion>
  return carrier.kind === 'question' && carrier.sessionId === sessionId && carrier.callId === callId
    && typeof carrier.key === 'string' && typeof carrier.answer === 'function'
    && typeof carrier.dismiss === 'function' && typeof carrier.subscribe === 'function'
    && typeof carrier.getSnapshot === 'function'
    ? carrier as PendingQuestion : null
}

/** Match the Host's sessionFileAddress grammar, including Windows and UNC paths. */
export function fileResourceAddress(sessionId: string, path: string): string {
  const encodeSegment = (segment: string): string => encodeURIComponent(segment).replace(/%3A/gi, ':')
  const normalized = path.replace(/\\/g, '/').replace(/^(?:\.\/)+/, '')
  return `dsh-resource://file/session/${encodeSegment(sessionId)}/${normalized.split('/').map(encodeSegment).join('/')}`
}

type ActiveRegistration = (sessionId: SessionId, row: ProjectionView['active'][number]) => () => void
interface ObservedSession {
  binding: SessionBinding
  unsubscribe: () => void
  calls: Map<string, { signature: string; dispose: () => void }>
}

/**
 * Observe already-retained generations only. The UI/gateway owns their references;
 * acquiring our own for every catalog row would keep sessions alive indefinitely.
 * The enclosing slots.inject lifetime owns both subscriptions and registrations.
 */
export function observeActiveQuestions(sessions: ISessions, register: ActiveRegistration): () => void {
  const observed = new Map<SessionId, ObservedSession>()
  let stopped = false
  let reconciling = false
  let rerun = false
  const disposeSession = (entry: ObservedSession): void => {
    entry.unsubscribe()
    for (const call of entry.calls.values()) call.dispose()
    entry.calls.clear()
  }
  const reconcile = (): void => {
    if (stopped) return
    if (reconciling) { rerun = true; return }
    reconciling = true
    try {
      do {
        rerun = false
        const bindings = new Map<SessionId, SessionBinding>()
        for (const summary of Object.values(sessions.list.getSnapshot().byId)) {
          const binding = sessions.binding(summary.id)
          if (binding !== undefined) bindings.set(summary.id, binding)
        }
        for (const [sessionId, entry] of observed) {
          if (bindings.get(sessionId) === entry.binding) continue
          observed.delete(sessionId)
          disposeSession(entry)
        }
        for (const [sessionId, binding] of bindings) {
          let entry = observed.get(sessionId)
          if (entry === undefined) {
            entry = { binding, calls: new Map(), unsubscribe: () => {} }
            observed.set(sessionId, entry)
            entry.unsubscribe = binding.session.projections.faceOf(PROJECTION_KEY).subscribe(reconcile)
          }
          const view = binding.session.projections.faceOf(PROJECTION_KEY).getSnapshot() as ProjectionView | undefined
          const active = new Map((view?.active ?? []).map(row => [row.callId, row]))
          for (const [callId, call] of entry.calls) {
            const row = active.get(callId)
            if (row !== undefined && call.signature === JSON.stringify(row.questions)) continue
            entry.calls.delete(callId)
            call.dispose()
          }
          for (const row of active.values()) {
            if (entry.calls.has(row.callId)) continue
            const dispose = register(sessionId, row)
            entry.calls.set(row.callId, { signature: JSON.stringify(row.questions), dispose })
          }
        }
      } while (rerun && !stopped)
    } finally { reconciling = false }
  }
  const stopList = sessions.list.subscribe(reconcile)
  const dispose = (): void => {
    if (stopped) return
    stopped = true
    stopList()
    for (const entry of observed.values()) disposeSession(entry)
    observed.clear()
  }
  try { reconcile() } catch (error) { dispose(); throw error }
  return dispose
}

/** Read a persisted UI draft only when its shape and question identities still fit. */
export function validDraft(value: unknown, questions: BetterQuestion[]): boolean {
  if (typeof value !== 'object' || value === null) return false
  const draft = value as Record<string, unknown>
  if (!Number.isInteger(draft.index) || (draft.index as number) < 0 || (draft.index as number) >= questions.length
    || typeof draft.collapsed !== 'boolean' || typeof draft.answers !== 'object' || draft.answers === null) return false
  return questions.every(question => {
    const answer = (draft.answers as Record<string, unknown>)[question.id]
    if (typeof answer !== 'object' || answer === null) return false
    const row = answer as Record<string, unknown>
    return Array.isArray(row.selected) && (question.multi_select || row.selected.length <= 1)
      && new Set(row.selected).size === row.selected.length
      && row.selected.every(label => typeof label === 'string'
        && question.options.some(option => option.label === label)) && typeof row.custom === 'string'
  })
}
