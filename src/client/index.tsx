import { useEffect, useMemo, useState } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { defineStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { ComposerChainProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PendingQuestion } from '@deepseek-ai/dsh-client-ui-user-questions/client'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { canonicalizeAnswers, parseRequest, TOOL_NAME, type AnswerBatch, type BetterQuestion } from '../shared/model'
import { createDraft, QuestionCard, type CardDraft } from './Card'
import { fileResourceAddress, matchPending, observeActiveQuestions, validDraft } from './runtime'
import { toolViewStyles } from './toolViewStyles'

export const inject = ['slots', 'sessions', 'uiSession', 'sidebarRight', 'locale']

/** One shared handle; the Slot framework owns and persists its Session instances. */
export function createDraftStore() {
  return defineStore({
    init: (): { byCall: Record<string, CardDraft> } => ({ byCall: {} }),
    persist: 'dsh.better-questions.drafts.v1',
    actions: {
      replace: (state, callId: string, value: CardDraft) => { state.byCall[JSON.stringify(callId)] = value },
      clear: (state, callId: string) => { delete state.byCall[JSON.stringify(callId)] },
    },
  })
}

type LocaleSource = Context['locale']
type ComposerInjection = {
  questions: BetterQuestion[]
  openFile: (path: string) => void
  hooks: { language: LocaleSource }
  keyedHooks: { questionCard: (key: string) => PendingQuestion | undefined }
}
type ComposerProps = PropsRuntime<'conversation.composer'> & PropsStore<ReturnType<typeof createDraftStore>>
  & InjectFace<ComposerInjection> & { matched: PendingQuestion }

export function BetterQuestionComposer(props: ComposerProps) {
  const { matched: pending, questions, actions } = props
  const language = props.useLanguage(locale => locale.active.startsWith('zh') ? 'zh' : 'en')
  const snapshot = props.useQuestionCard(pending.key)
  const saved = props.useStore(state => state.byCall[JSON.stringify(pending.callId)])
  const initial = useMemo(() => createDraft(questions), [questions])
  const draft = validDraft(saved, questions) ? saved! : initial
  useEffect(() => {
    if (snapshot?.closed && pending.callId !== undefined) actions.clear(pending.callId)
  }, [snapshot?.closed, pending.callId, actions])
  return <QuestionCard questions={questions} draft={draft} language={language}
    readOnly={snapshot === undefined || snapshot.closed || snapshot.channel === 'none'}
    onDraftChange={next => { if (pending.callId !== undefined) actions.replace(pending.callId, next) }}
    onSubmit={async batch => {
      await pending.answer(canonicalizeAnswers(questions, batch))
      if (pending.callId !== undefined) actions.clear(pending.callId)
    }}
    onDismiss={() => pending.dismiss()} openFile={props.openFile} />
}

type ToolInjection = {
  revealPanel: (callId: string) => boolean
  hooks: { language: LocaleSource }
}
type ToolProps = ToolCallViewProps & InjectFace<ToolInjection>

function questionRecord(props: ToolCallViewProps): { questions: BetterQuestion[]; answers?: AnswerBatch } | undefined {
  if (props.phase === 'preparing') return undefined
  const call = props.phase === 'result' ? props.block.call : props.block
  if (call === null) return undefined
  try {
    const { questions } = parseRequest(JSON.parse(call.argsRaw))
    if (props.phase !== 'result' || props.block.error !== undefined) return { questions }
    const only = props.block.content.length === 1 ? props.block.content[0] : undefined
    if (only?.type !== 'text') return { questions }
    try { return { questions, answers: canonicalizeAnswers(questions, JSON.parse(only.text)) } }
    catch { return { questions } }
  } catch { return undefined }
}

function ReadOnlyRecord({ questions, answers, openFile, language }: {
  questions: BetterQuestion[]; answers?: AnswerBatch; openFile: (path: string) => void; language: 'en' | 'zh'
}) {
  const [draft, setDraft] = useState(() => createDraft(questions, answers))
  return <QuestionCard questions={questions} draft={draft} onDraftChange={setDraft}
    readOnly openFile={openFile} language={language} />
}

function QuestionIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
    <path d="M8 14.5C11.5899 14.5 14.5 11.5899 14.5 8C14.5 4.41015 11.5899 1.5 8 1.5C4.41015 1.5 1.5 4.41015 1.5 8C1.5 11.5899 4.41015 14.5 8 14.5Z" />
    <path d="M5.75 6.69646C5.75 6.29865 5.88196 5.90976 6.12919 5.57899C6.37643 5.24821 6.72783 4.99041 7.13896 4.83817C7.5501 4.68593 8.0025 4.6461 8.43895 4.72371C8.87541 4.80132 9.27632 4.99289 9.59099 5.27419C9.90566 5.55549 10.12 5.91388 10.2068 6.30406C10.2936 6.69423 10.249 7.09866 10.0787 7.4662C9.90843 7.83373 9.62004 8.14787 9.25003 8.36889C9.19476 8.4019 9.13803 8.43262 9.08004 8.46099C8.52566 8.73217 8 9.20817 8 9.82532" />
    <path d="M8 10.7416V11.7416" />
  </svg>
}

function ChevronIcon({ open }: { open: boolean }) {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
    <path d={open ? 'M12 10L8.70711 6.70711C8.31658 6.31658 7.68342 6.31658 7.29289 6.70711L4 10'
      : 'M4 6L7.29289 9.29289C7.68342 9.68342 8.31658 9.68342 8.70711 9.29289L12 6'} />
  </svg>
}

function InspectIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
    <path d="M4.67398 4.25061L1.36094 7.86484C1.29085 7.9413 1.29085 8.05866 1.36094 8.13513L4.67398 11.7494" />
    <path d="M11.3262 4.25061L14.6392 7.86484C14.7093 7.9413 14.7093 8.05866 14.6392 8.13513L11.3262 11.7494" />
    <path d="M9.56222 3.62573L6.43774 12.3743" />
  </svg>
}

export function BetterQuestionToolView(props: ToolProps) {
  const language = props.useLanguage(locale => locale.active.startsWith('zh') ? 'zh' : 'en')
  const zh = language === 'zh'
  const [reopenFailed, setReopenFailed] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const { expanded, toggle } = props.useDisclosure()
  const record = questionRecord(props)
  const settled = props.phase === 'result'
  const answered = record?.answers?.answers.filter(answer => answer.selected.length > 0 || (answer.custom ?? '') !== '').length
  const summary = !settled ? (zh ? '等待回答' : 'waiting')
    : answered !== undefined ? (zh ? `${answered}/${record!.questions.length} 已回答` : `${answered}/${record!.questions.length} answered`)
      : (zh ? '未回答' : 'Not answered')
  const title = zh ? '提问' : 'Ask question'
  const canExpand = record !== undefined || (settled && props.block.error !== undefined) || reopenFailed
  const open = expanded && canExpand
  const openPanel = () => {
    if (props.revealPanel(props.callId)) return
    setReopenFailed(true)
    if (!open) toggle()
  }
  const review = () => {
    if (record?.answers === undefined) {
      if (canExpand) toggle()
      return
    }
    setShowOptions(value => !value)
    if (!open) toggle()
  }
  return <div className="bq-tool" data-state={settled ? 'settled' : 'running'}>
    <style>{toolViewStyles}</style>
    <div className="bq-tool-row">
      {canExpand ? <button type="button" className="bq-tool-leading" aria-label={title} aria-expanded={open} onClick={toggle}>
        {open ? <ChevronIcon open /> : <><span className="bq-tool-icon-idle"><QuestionIcon /></span><span className="bq-tool-icon-hover"><ChevronIcon open={false} /></span></>}
      </button> : <span className="bq-tool-leading"><QuestionIcon /></span>}
      <span className="bq-tool-title">{title}</span>
      <span className="bq-tool-sep" aria-hidden="true" />
      <span className="bq-tool-summary">{summary}</span>
      <button type="button" className="bq-tool-panel-button" aria-expanded={settled && record?.answers !== undefined ? open && showOptions : undefined}
        onClick={settled ? review : openPanel}>
        <QuestionIcon />{settled ? (zh ? '查看回答' : 'View answers') : (zh ? '回答' : 'Answer')}
      </button>
    </div>
    {open && <div className="bq-tool-body">
      {reopenFailed && !settled && <p role="status" className="bq-tool-verdict">{zh ? '此问题当前无法打开。' : 'This question is not currently available.'}</p>}
      {settled && props.block.error !== undefined && <p role="status" className="bq-tool-verdict">{props.block.error.message}</p>}
      {record !== undefined && (showOptions && record.answers !== undefined
        ? <ReadOnlyRecord key={`${props.callId}:${JSON.stringify(record.answers)}`} {...record}
          openFile={props.openFile} language={language} />
        : record.answers === undefined ? <div className="bq-tool-transcript">
          <p className="bq-tool-verdict">{!settled ? (zh ? '等待回答' : 'Waiting for answers') : (zh ? '未提交回答' : 'No answers submitted')}</p>
          <ul className="bq-tool-unanswered">{record.questions.map(question => <li key={question.id}>{question.question}</li>)}</ul>
        </div> : <dl className="bq-tool-transcript">
          {record.questions.map(question => {
            const answer = record.answers?.answers.find(item => item.id === question.id)
            const lines = [...(answer?.selected ?? []), ...(answer?.custom ? [answer.custom] : [])]
            return <div className="bq-tool-entry" key={question.id}>
              <dt className="bq-tool-question">{question.question}</dt>
              <dd className="bq-tool-answer">{lines.length > 0 ? lines.map((line, i) => <span key={i}>{line}</span>)
                : <span className="bq-tool-skipped">{zh ? '未回答' : 'Not answered'}</span>}</dd>
            </div>
          })}
        </dl>)}
      {props.inspect !== undefined && <button type="button" className="bq-tool-inspect" onClick={props.inspect}><InspectIcon />{zh ? '查看' : 'Inspect'}</button>}
    </div>}
  </div>
}

export function apply(ctx: Context): void {
  const store = createDraftStore()
  // Each declaration lifetime owns a complete observer. The observer retains
  // every dynamic registration disposer, including ones made after activation.
  ctx.slots.inject('conversation.composer', () => observeActiveQuestions(ctx.sessions, (sessionId, row) =>
    ctx.slots.register({
      name: 'conversation.composer', priority: -1, store,
      select: (owner: ComposerChainProps) => owner.sessionId === sessionId
        ? matchPending(owner.pendingInteraction, sessionId, row.callId) : null,
      inject: (): ComposerInjection => ({
        questions: row.questions,
        openFile: path => ctx.sidebarRight.openResource(fileResourceAddress(sessionId, path)),
        hooks: { language: ctx.locale },
        keyedHooks: {
          questionCard: key => {
            const pending = matchPending(ctx.uiSession.sessionStatus.getSnapshot().get(sessionId)?.pendingInteraction,
              sessionId, row.callId)
            return pending?.key === key ? pending : undefined
          },
        },
      }),
    }, BetterQuestionComposer)))
  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
    name: 'tool.call.toolview', key: TOOL_NAME,
    inject: (sessionId): ToolInjection => ({
      revealPanel: callId => ctx.get('userQuestionPanels')?.reveal(sessionId, callId) ?? false,
      hooks: { language: ctx.locale },
    }),
  }, BetterQuestionToolView))
}
