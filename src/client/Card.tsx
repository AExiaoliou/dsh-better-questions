import React, { useId, useRef, useState } from 'react'
import { canonicalizeAnswers, type AnswerBatch, type BetterQuestion } from '../shared/model'
import { CodePreview, HtmlPreview, LayoutPreview } from './preview'
import { questionCardStyles } from './styles'

export interface CardDraft {
  index: number
  answers: Record<string, { selected: string[]; custom: string }>
  preview: Record<string, number>
  collapsed: boolean
}
export function createDraft(questions: BetterQuestion[], initialAnswers?: AnswerBatch): CardDraft {
  const initial = new Map(initialAnswers?.answers.map(answer => [answer.id, answer]))
  return {
    index: 0, collapsed: false,
    answers: Object.fromEntries(questions.map(question => [question.id, { selected: [...(initial.get(question.id)?.selected ?? [])], custom: initial.get(question.id)?.custom ?? '' }])),
    preview: Object.fromEntries(questions.map(question => {
      const selected = initial.get(question.id)?.selected[0]
      const selectedIndex = question.options.findIndex(option => option.label === selected)
      return [question.id, selectedIndex >= 0 ? selectedIndex : Math.max(0, question.options.findIndex(option => option.recommended))]
    })),
  }
}
export interface QuestionCardProps {
  questions: BetterQuestion[]
  draft: CardDraft
  onDraftChange: (draft: CardDraft) => void
  readOnly?: boolean
  onSubmit?: (batch: AnswerBatch) => Promise<void>
  onDismiss?: () => void | Promise<void>
  openFile: (path: string) => void
  language?: 'en' | 'zh'
}
const copy = {
  en: { title: 'A few details', collapse: 'Collapse questions', expand: 'Expand questions', close: 'Close questions', recommended: 'Recommended', preview: 'Preview', file: 'Open file', custom: 'Your own answer', placeholder: 'Add context or write a different answer…', single: 'Choose one, or write your own answer.', multi: 'Choose any that apply, and add your own answer.', skip: 'Skip', skipFinal: 'Skip & submit', next: 'Next', submit: 'Submit answers', submitting: 'Submitting…', previous: 'Previous question', question: 'Question', empty: 'No questions to answer.', noPreview: 'No preview available for this option.', readOnly: 'Read only', error: 'Unable to complete this action. Your answers are saved in this card.', previewHint: 'Previewing does not select an answer.' },
  zh: { title: '确认几个细节', collapse: '收起问题', expand: '展开问题', close: '关闭问题', recommended: '推荐', preview: '预览', file: '打开文件', custom: '自定义回答', placeholder: '补充说明或输入其他回答…', single: '选择一项，或输入自己的回答。', multi: '选择所有适用项，也可以补充自己的回答。', skip: '跳过', skipFinal: '跳过并提交', next: '下一题', submit: '提交回答', submitting: '提交中…', previous: '上一题', question: '问题', empty: '没有需要回答的问题。', noPreview: '此选项暂无预览。', readOnly: '只读', error: '操作未完成，回答已保留在此卡片中。', previewHint: '预览不会选中答案。' },
} as const

export function QuestionCard({ questions, draft, onDraftChange, readOnly = false, onSubmit, onDismiss, openFile, language = 'en' }: QuestionCardProps) {
  const text = copy[language]
  const instance = useId()
  const busy = useRef(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const index = Math.max(0, Math.min(draft.index, questions.length - 1))
  const current = questions[index]
  const answer = current ? draft.answers[current.id] ?? { selected: [], custom: '' } : { selected: [], custom: '' }
  const previewIndex = current ? Math.max(0, Math.min(draft.preview[current.id] ?? Math.max(0, current.options.findIndex(option => option.recommended)), current.options.length - 1)) : 0
  const preview = current?.options[previewIndex]
  const hasPreview = current && ['layout', 'code', 'html'].includes(current.type)
  const last = index === questions.length - 1
  const change = (next: CardDraft) => { if (!busy.current) onDraftChange(next) }
  const showFile = (path: string) => {
    try { openFile(path) } catch (cause) { setError(cause instanceof Error ? cause.message : text.error) }
  }
  const updateAnswer = (next: { selected: string[]; custom: string }, selectedIndex?: number) => {
    if (readOnly || busy.current || !current) return
    onDraftChange({ ...draft, answers: { ...draft.answers, [current.id]: next },
      ...(selectedIndex === undefined ? {} : { preview: { ...draft.preview, [current.id]: selectedIndex } }) })
    if (selectedIndex !== undefined && current.type === 'file') {
      const path = current.options[selectedIndex]?.proto
      if (path) showFile(path)
    }
  }
  const submit = async (next: CardDraft) => {
    if (busy.current || readOnly || !onSubmit) return
    busy.current = true
    setSubmitting(true)
    setError('')
    try {
      const batch = canonicalizeAnswers(questions, { answers: questions.map(question => {
        const value = next.answers[question.id]
        return { id: question.id, selected: value?.selected ?? [], ...(value?.custom.trim() ? { custom: value.custom } : {}) }
      }) })
      await onSubmit(batch)
    } catch (cause) {
      setError(`${text.error}${cause instanceof Error ? ` ${cause.message}` : ''}`)
    } finally { busy.current = false; setSubmitting(false) }
  }
  const skip = () => {
    if (!current || readOnly || busy.current) return
    const next = { ...draft, index: last ? index : index + 1, answers: { ...draft.answers, [current.id]: { selected: [], custom: '' } } }
    onDraftChange(next)
    if (last) void submit(next)
  }
  const dismiss = async () => {
    if (busy.current || !onDismiss) return
    busy.current = true
    setSubmitting(true)
    setError('')
    try { await onDismiss() } catch (cause) { setError(`${text.error}${cause instanceof Error ? ` ${cause.message}` : ''}`) }
    finally { busy.current = false; setSubmitting(false) }
  }
  return <section className={`bq-card${draft.collapsed ? ' bq-collapsed' : ''}`} aria-label={text.title} aria-busy={submitting} lang={language}>
    <style>{questionCardStyles}</style>
    <header className="bq-card-header"><div className="bq-heading"><span aria-hidden="true" className="bq-mark">?</span><strong>{current?.header || text.title}</strong><span className="bq-count">{questions.length ? `${index + 1} / ${questions.length}` : '0'}</span>{readOnly && <span className="bq-read-only">{text.readOnly}</span>}</div><div className="bq-header-actions"><button type="button" aria-label={draft.collapsed ? text.expand : text.collapse} aria-expanded={!draft.collapsed} aria-controls={`${instance}-content`} disabled={submitting} onClick={() => change({ ...draft, collapsed: !draft.collapsed })}>{draft.collapsed ? '+' : '−'}</button>{onDismiss && <button type="button" aria-label={text.close} disabled={submitting || readOnly} onClick={() => void dismiss()}>×</button>}</div></header>
    {!draft.collapsed && <div id={`${instance}-content`}>
      {!current ? <p className="bq-empty">{text.empty}</p> : <>
        <div className={`bq-card-body${hasPreview ? ' bq-with-preview' : ''}`}>
          <div className="bq-question-pane">
            <h3 id={`${instance}-question`}>{current.question}</h3><p className="bq-hint">{current.multi_select ? text.multi : text.single}</p>
            <div className="bq-options" role={current.multi_select ? 'group' : 'radiogroup'} aria-labelledby={`${instance}-question`}>
              {current.options.map((option, optionIndex) => {
                const selected = answer.selected.includes(option.label)
                return <div key={`${optionIndex}-${option.label}`} className={`bq-option${selected ? ' bq-selected' : ''}`}>
                  <label className="bq-option-label"><input type={current.multi_select ? 'checkbox' : 'radio'} name={`${instance}-${current.id}`} checked={selected} disabled={readOnly || submitting} onChange={() => updateAnswer({ ...answer, selected: current.multi_select ? (selected ? answer.selected.filter(label => label !== option.label) : [...answer.selected, option.label]) : [option.label] }, selected && current.multi_select ? undefined : optionIndex)} /><span className="bq-option-content"><span className="bq-option-title">{option.label}{option.recommended && <span className="bq-recommended">{text.recommended}</span>}</span>{option.description && <span className="bq-option-description">{option.description}</span>}</span></label>
                  {hasPreview && <button type="button" className="bq-option-action" aria-label={`${text.preview}: ${option.label}`} aria-pressed={previewIndex === optionIndex} disabled={submitting} onClick={() => change({ ...draft, preview: { ...draft.preview, [current.id]: optionIndex } })}>{text.preview}</button>}
                  {current.type === 'file' && option.proto && <button type="button" className="bq-option-action" aria-label={`${text.file}: ${option.label}`} onClick={() => showFile(option.proto!)}>{text.file}<span aria-hidden="true"> ↗</span></button>}
                </div>
              })}
            </div>
            <label className="bq-custom-label" htmlFor={`${instance}-custom`}>{text.custom}</label><textarea id={`${instance}-custom`} value={answer.custom} readOnly={readOnly} disabled={submitting} rows={3} placeholder={text.placeholder} onChange={event => updateAnswer({ ...answer, custom: event.target.value })} />
          </div>
          {hasPreview && <aside className="bq-preview-pane" aria-label={text.preview}><div className="bq-preview-heading"><span>{text.preview}</span><strong>{preview?.label}</strong></div><div className="bq-preview-surface" key={`${current.id}-${previewIndex}`}>{!preview?.proto ? <p className="bq-empty">{text.noPreview}</p> : current.type === 'layout' ? <LayoutPreview proto={preview.proto} label={preview.label} language={language} /> : current.type === 'code' ? <CodePreview proto={preview.proto} language={language} /> : <HtmlPreview proto={preview.proto} language={language} />}</div><p className="bq-preview-hint">{text.previewHint}</p></aside>}
        </div>
        <footer className="bq-card-footer"><nav className="bq-pagination" aria-label={language === 'zh' ? '问题导航' : 'Question navigation'}><button type="button" aria-label={text.previous} disabled={index === 0 || submitting} onClick={() => change({ ...draft, index: index - 1 })}>←</button>{questions.map((question, i) => <button key={question.id} type="button" aria-label={`${text.question} ${i + 1}`} aria-current={i === index ? 'step' : undefined} disabled={submitting} onClick={() => change({ ...draft, index: i })}>{i + 1}</button>)}</nav>{!readOnly && <div className="bq-footer-actions"><button type="button" disabled={submitting || (last && !onSubmit)} onClick={skip}>{last ? text.skipFinal : text.skip}</button><button type="button" className="bq-primary" disabled={submitting || (last && !onSubmit)} onClick={() => last ? void submit(draft) : change({ ...draft, index: index + 1 })}>{submitting ? text.submitting : last ? text.submit : text.next}</button></div>}</footer>
      </>}
    </div>}
    {error && <p className="bq-error bq-action-error" role="alert">{error}</p>}
  </section>
}
