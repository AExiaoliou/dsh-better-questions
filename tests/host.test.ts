import { describe, expect, it, vi } from 'vitest';
import type { SessionEvent } from '@deepseek-ai/dsh-session';
import { parseRequest, canonicalizeAnswers, MAX_BATCH_PROTO_BYTES, MAX_PROTO_BYTES, TOOL_NAME } from '../src/shared/model';
import { applyQuestionEvent, questionProjection } from '../src/host/projection';
import { createQuestionTool } from '../src/host/tool';
import { registerSkills } from '../src/skills';

const question = { id: 'q', question: 'Choose', options: [{ label: 'A' }, { label: 'B', recommended: true }] };
const parsed = () => parseRequest({ questions: [question] }).questions;

describe('request and answer contract', () => {
  it('normalizes defaults, ignores none proto, retains ordering and recommendation', () => {
    const result = parseRequest({ questions: [{ ...question, options: [{ label: 'A', proto: 'ignored' }, question.options[1]] }] });
    expect(result.questions[0]).toEqual({ ...question, type: 'none', multi_select: false });
    expect(parsed()[0].options[0].recommended).toBeUndefined();
    expect(parseRequest({ questions: [{ id: 'text', question: 'Explain' }] }).questions[0].options).toEqual([]);
  });
  it.each(['layout', 'code', 'html', 'file'])('%s requires at least one option and nonempty string proto', type => {
    for (const options of [[], [{ label: 'A' }], [{ label: 'A', proto: '' }], [{ label: 'A', proto: '  ' }], [{ label: 'A', proto: {} }]]) {
      expect(() => parseRequest({ questions: [{ ...question, type, options }] })).toThrow();
    }
    // Replay/projection parsing stays lenient so older records keep their rich cards.
    expect(parseRequest({ questions: [{ ...question, type, options: [{ label: 'A', proto: 'invalid syntax is a local preview issue' }] }] }).questions[0].type).toBe(type);
  });
  it('validates layout grammar only when requested, with option label and node path', () => {
    const make = (proto: string) => ({ questions: [{ ...question, type: 'layout', options: [{ label: 'Wide', proto: 'type: row' }, { label: 'Bad', proto }] }] });
    expect(() => parseRequest(make('type: row\nchildren:\n  - {type: card}'), { layouts: true })).toThrow(/Invalid layout \(Bad\): \$\.children\[0\]\.type: unknown node type/);
    expect(() => parseRequest(make('type: text\ncolor: red'), { layouts: true })).toThrow(/options.*1.*proto|\$\.color/s);
    expect(parseRequest(make('type: frame\nchildren: [{type: nav, items: [A, B]}]'), { layouts: true }).questions[0].options).toHaveLength(2);
    expect(parseRequest({ questions: [{ ...question, type: 'code', options: [{ label: 'A', proto: 'type: nope' }] }] }, { layouts: true }).questions).toHaveLength(1);
  });
  it.each([
    { questions: [] },
    { questions: [question, question] },
    { questions: [{ ...question, options: [{ label: 'A' }, { label: 'A' }] }] },
    { questions: [{ ...question, options: [{ label: 'A', recommended: true }, { label: 'B', recommended: true }] }] },
    { questions: [{ ...question, type: 'unknown' }] },
    { questions: [{ ...question, question: '  ' }] },
    { questions: [{ ...question, multi_select: 'yes' }] },
    { questions: [{ ...question, typo: true }] },
  ])('rejects malformed API input with a field path', input => {
    try { parseRequest(input); throw new Error('unexpected success'); }
    catch (error) { expect(error).toHaveProperty('issues'); expect((error as { issues: { path: unknown[] }[] }).issues[0].path[0]).toBe('questions'); }
  });
  it('enforces UTF-8 per-prototype and batch byte budgets at exact boundaries', () => {
    const make = (protos: string[]) => ({ questions: [{ ...question, type: 'code', options: protos.map((proto, i) => ({ label: String(i), proto })) }] });
    expect(() => parseRequest(make(['a'.repeat(MAX_PROTO_BYTES)]))).not.toThrow();
    expect(() => parseRequest(make(['é'.repeat(MAX_PROTO_BYTES / 2 + 1)]))).toThrow('UTF-8 bytes');
    const four = Array.from({ length: MAX_BATCH_PROTO_BYTES / MAX_PROTO_BYTES }, () => 'a'.repeat(MAX_PROTO_BYTES));
    expect(() => parseRequest(make(four))).not.toThrow();
    expect(() => parseRequest(make([...four, 'a']))).toThrow('Batch prototypes');
  });
  it('has no arbitrary question/option count cap', () => {
    expect(parseRequest({ questions: Array.from({ length: 60 }, (_, i) => ({ ...question, id: String(i), options: Array.from({ length: 60 }, (_, n) => ({ label: String(n) })) })) }).questions).toHaveLength(60);
  });
  it('canonicalizes batch and selections to input order while retaining original labels and custom text', () => {
    const questions = parseRequest({ questions: [{ ...question, multi_select: true }, { id: 'empty', question: 'Anything else?' }] }).questions;
    expect(canonicalizeAnswers(questions, { answers: [{ id: 'empty', selected: [], custom: '   ' }, { id: 'q', selected: ['B', 'A'], custom: ' note ' }] })).toEqual({ answers: [{ id: 'q', selected: ['A', 'B'], custom: ' note ' }, { id: 'empty', selected: [] }] });
  });
  it.each([
    [], [{ id: 'other', selected: [] }], [{ id: 'q', selected: [] }, { id: 'q', selected: [] }],
    [{ id: 'q', selected: ['unknown'] }], [{ id: 'q', selected: ['A', 'B'] }], [{ id: 'q', selected: ['A', 'A'] }],
  ])('rejects forged, duplicate, missing, or excess selections', answers => {
    expect(() => canonicalizeAnswers(parsed(), { answers })).toThrow();
  });
});

describe('host tool and replay projection', () => {
  it('tells agents to load each type skill once and explains selection previews', () => {
    const description = createQuestionTool({ userQuestions: {} } as never).description;
    expect(description).toContain('only before its first use in this conversation');
    expect(description).toContain('Selecting an option shows its preview');
  });
  it('forwards only base question fields and uses the same call identity/signal', async () => {
    const ask = vi.fn(async () => ({ answers: [{ id: 'q', selected: ['B'] }] }));
    const tool = createQuestionTool({ userQuestions: { ask } } as never);
    const input = { questions: [{ ...question, type: 'code', options: [{ label: 'A', proto: 'one' }, { label: 'B', proto: 'two', recommended: true }] }] };
    const signal = new AbortController().signal;
    const exec = { callId: 'call', signal, agent: { id: 'agent' } };
    expect(await tool.execute(input, exec as never)).toEqual({ answers: [{ id: 'q', selected: ['B'] }] });
    expect(ask).toHaveBeenCalledExactlyOnceWith({
      questions: [{ id: 'q', question: 'Choose', multiSelect: false, options: [{ label: 'A' }, { label: 'B' }] }],
      signal, agent: exec.agent, wait: { callId: 'call' },
    });
  });
  it('rejects malformed input before asking and propagates abort/provider errors', async () => {
    const ask = vi.fn(async () => { throw new Error('ASK_ABORTED'); });
    const tool = createQuestionTool({ userQuestions: { ask } } as never);
    await expect(tool.execute({ questions: [] }, {} as never)).rejects.toThrow();
    expect(ask).not.toHaveBeenCalled();
    await expect(tool.execute({ questions: [question] }, {} as never)).rejects.toThrow('ASK_ABORTED');
    await expect(tool.execute({ questions: [{ ...question, type: 'layout', options: [{ label: 'A', proto: 'type: text\nstyle: x' }] }] }, {} as never)).rejects.toThrow(/\$\.style: unknown field for text/);
    expect(ask).toHaveBeenCalledTimes(1);
  });
  const call = (seq = 0, callId = 'call', name = TOOL_NAME, args = JSON.stringify({ questions: [question] })) => ({ seq, type: 'tool/call', data: { callId, name, arguments: args } }) as unknown as SessionEvent;
  const result = (callId = 'call', error?: string) => ({ seq: 5, type: 'tool/result', data: { message: { toolCallId: callId, content: [], isError: !!error }, ...(error ? { error: { code: error } } : {}) } }) as unknown as SessionEvent;
  const init = () => questionProjection.init({} as never, 0 as never);
  it('adds metadata from its own committed call only, without mutating prior state', () => {
    const initial = init();
    const active = applyQuestionEvent(initial, call());
    expect(active.view.active[0]).toEqual({ callId: 'call', questions: parsed() });
    expect(initial.view.active).toEqual([]);
    expect(applyQuestionEvent(initial, call(0, 'other', 'ask_user_question'))).toBe(initial);
    expect(applyQuestionEvent(initial, call(0, 'bad', TOOL_NAME, 'broken JSON'))).toBe(initial);
    expect(questionProjection.stateSchema.parse(active)).toEqual(active);
    expect(questionProjection.wire.view(active)).toBe(active.view);
  });
  it.each([undefined, 'ASK_ABORTED', 'NO_PROVIDER', 'TOOL_OUTCOME_UNKNOWN'])('removes even failed/interrupted result %s', error => {
    const active = applyQuestionEvent(init(), call());
    expect(applyQuestionEvent(active, result('call', error)).view.active).toEqual([]);
    expect(applyQuestionEvent(active, result('other', error))).toBe(active);
  });
  it('clears at turn completion and never revives inherited fork calls', () => {
    const fork = questionProjection.init({} as never, 3 as never);
    expect(applyQuestionEvent(fork, call(2))).toBe(fork);
    const active = applyQuestionEvent(fork, call(3));
    expect(active.view.active).toHaveLength(1);
    const ended = applyQuestionEvent(active, { seq: 6, type: 'turn/end', data: {} } as never);
    expect(ended.view.active).toEqual([]);
    expect(applyQuestionEvent(ended, { seq: 7, type: 'turn/end', data: {} } as never)).toBe(ended);
  });
  it('registers five discoverable summaries, with full instructions available separately', () => {
    const rows: any[] = [];
    registerSkills({ skills: { register: (value: unknown) => rows.push(value) } } as never);
    expect(rows.map(row => row.name)).toEqual(['none', 'layout', 'code', 'html', 'file'].map(type => `better-questions-${type}`));
    for (const row of rows) { expect(row.content).toContain('ask_better_questions'); expect(row.path).toMatch(/SKILL\.md$/); expect(row.content.startsWith('---')).toBe(false); }
  });
});
