// Dev-only visual harness: renders real QuestionCards with sample layout prototypes.
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { QuestionCard, createDraft } from '../../src/client/Card'
import { LayoutPreview } from '../../src/client/preview'
import { questionCardStyles } from '../../src/client/styles'
import type { BetterQuestion } from '../../src/shared/model'
import { samples } from './samples'

function Card({ question, language }: { question: BetterQuestion; language: 'en' | 'zh' }) {
  const [draft, setDraft] = useState(() => createDraft([question]))
  return <QuestionCard questions={[question]} draft={draft} onDraftChange={setDraft} openFile={() => {}} onSubmit={async () => {}} language={language} />
}

const params = new URLSearchParams(location.search)
const mode = params.get('mode') ?? 'card'
const width = Number(params.get('width') ?? 980)
function App() {
  if (mode === 'gallery') {
    // Every sample prototype at a fixed preview size, as it appears in the preview pane.
    return <div style={{ display: 'grid', gridTemplateColumns: `repeat(2, ${width / 2 - 30}px)`, gap: 20, padding: 20 }}>
      <style>{questionCardStyles}</style>
      {samples.flatMap(sample => sample.options.map(option => <figure key={`${sample.id}-${option.label}`} style={{ margin: 0 }}>
        <figcaption style={{ font: '12px system-ui', marginBottom: 6 }}>{sample.id} / {option.label}</figcaption>
        <div className="bq-card" style={{ borderRadius: 12 }}><div className="bq-preview-surface" style={{ minHeight: 0 }}><LayoutPreview proto={option.proto!} language="zh" /></div></div>
      </figure>))}
    </div>
  }
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 24, width }}>
    {samples.map(sample => <Card key={sample.id} question={sample} language="zh" />)}
  </div>
}
if (params.get('theme') === 'dark') document.body.setAttribute('data-ds-dark-theme', '')
createRoot(document.getElementById('root')!).render(<App />)
