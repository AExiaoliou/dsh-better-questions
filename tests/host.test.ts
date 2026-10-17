import { describe, expect, it, vi } from 'vitest';
import type { SessionEvent } from '@deepseek-ai/dsh-session';
import { parseRequest, canonicalizeAnswers, TOOL_NAME } from '../src/shared/model';
import { applyQuestionEvent, questionProjection } from '../src/host/projection';
import { createQuestionTool, toolParameters } from '../src/host/tool';

const question = { id: 'q', question: 'Choose', options: [{ label: 'A', proto: 'prototypes/a.html' }, { label: 'B', recommended: true }] };
const parsed = () => parseRequest({ questions: [question] }).questions;

describe('request and answer contract', () => {
  it('normalizes defaults, retains prototype paths, ordering and recommendations', () => {
    const result = parseRequest({ questions: [{ id: 'q', question: 'Choose', options: [{ label: 'A', proto: ' prototypes/a.html ' }, { label: 'B', recommended: true }] }] });
    expect(result.questions[0]).toEqual({
      id: 'q', question: 'Choose', multi_select: false,
      options: [{ label: 'A', proto: ' prototypes/a.html ' }, { label: 'B', recommended: true }],
    });
    expect(parsed()[0].options[1]!.recommended).toBe(true);
    expect(parseRequest({ questions: [{ id: 'text', question: 'Explain' }] }).questions[0]).toEqual({
      id: 'text', question: 'Explain', multi_select: false, options: [],
    });
  });
  it('keeps proto optional per option so ordinary choices and free text still work', () => {
    const result = parseRequest({ questions: [
      { id: 'plain', question: 'Which one?', options: [{ label: 'A' }, { label: 'B' }] },
      { id: 'mixed', question: 'Compare', options: [{ label: 'A' }, { label: 'B', proto: 'docs/b.md' }] },
      { id: 'text', question: 'Anything else?' },
    ] }).questions;
    expect(result[0]!.options).toEqual([{ label: 'A' }, { label: 'B' }]);
    expect(result[1]!.options).toEqual([{ label: 'A' }, { label: 'B', proto: 'docs/b.md' }]);
    expect(result[2]!.options).toEqual([]);
  });
  it.each([
    ['', /nonempty file path/],
    ['   ', /nonempty file path/],
    [42, /string/],
    [{ path: 'a.html' }, /string/],
  ])('rejects a prototype that is not a nonempty path (%j)', (proto, error) => {
    expect(() => parseRequest({ questions: [{ ...question, options: [{ label: 'A', proto }] }] })).toThrow(error);
  });
  it('rejects the removed type field and any other unknown field', () => {
    for (const extra of [{ type: 'html' }, { typo: true }, { options: [{ label: 'A', type: 'file' }] }]) {
      try { parseRequest({ questions: [{ ...question, ...extra }] }); throw new Error('unexpected success'); }
      catch (error) { expect(error).toHaveProperty('issues'); expect((error as { issues: { path: unknown[] }[] }).issues[0]!.path[0]).toBe('questions'); }
    }
  });
  it.each([
    { questions: [] },
    { questions: [question, question] },
    { questions: [{ ...question, options: [{ label: 'A' }, { label: 'A' }] }] },
    { questions: [{ ...question, options: [{ label: 'A', recommended: true }, { label: 'B', recommended: true }] }] },
    { questions: [{ ...question, question: '  ' }] },
    { questions: [{ ...question, multi_select: 'yes' }] },
    { questions: [{ ...question, id: ' ' }] },
  ])('rejects malformed API input with a field path', input => {
    try { parseRequest(input); throw new Error('unexpected success'); }
    catch (error) { expect(error).toHaveProperty('issues'); expect((error as { issues: { path: unknown[] }[] }).issues[0]!.path[0]).toBe('questions'); }
  });
  it('has no arbitrary question/option count cap', () => {
    expect(parseRequest({ questions: Array.from({ length: 60 }, (_, i) => ({
      id: String(i), question: 'Choose', options: Array.from({ length: 60 }, (_, n) => ({ label: String(n) })),
    })) }).questions).toHaveLength(60);
  });
  it('canonicalizes batch and selections to input order while retaining original labels and custom text', () => {
    const questions = parseRequest({ questions: [{ ...question, multi_select: true }, { id: 'empty', question: 'Anything else?' }] }).questions;
    expect(canonicalizeAnswers(questions, { answers: [{ id: 'empty', selected: [], custom: '   ' }, { id: 'q', selected: ['B', 'A'], custom: ' note ' }] })).toEqual({
      answers: [{ id: 'q', selected: ['A', 'B'], custom: ' note ' }, { id: 'empty', selected: [] }],
    });
  });
  it.each([
    [], [{ id: 'other', selected: [] }], [{ id: 'q', selected: [] }, { id: 'q', selected: [] }],
    [{ id: 'q', selected: ['unknown'] }], [{ id: 'q', selected: ['A', 'B'] }], [{ id: 'q', selected: ['A', 'A'] }],
  ])('rejects forged, duplicate, missing, or excess selections', answers => {
    expect(() => canonicalizeAnswers(parsed(), { answers })).toThrow();
  });
});

describe('host tool and replay projection', () => {
  it('requires writing the prototype file before putting its path in proto', () => {
    const description = createQuestionTool({ userQuestions: {} } as never).description;
    expect(description).toContain('first write the prototype file');
    expect(description).toContain("put its path in that option's proto");
    expect(description).toContain('opens the file in the right sidebar');
    expect(description).toContain('Never put prototype content in proto');
    expect(description).toContain('Options without proto are ordinary choices');
    expect(description).not.toMatch(/better-questions-|skill/i);
  });
  it('exposes no type property and describes proto as a written file path', () => {
    const parameters = JSON.parse(JSON.stringify(toolParameters)) as {
      properties: { questions: { items: { properties: Record<string, { description?: string }>; required: string[] } } };
    };
    const item = parameters.properties.questions.items;
    expect(Object.keys(item.properties)).toEqual(['id', 'question', 'header', 'options', 'multi_select']);
    expect(item.properties).not.toHaveProperty('type');
    expect(item.required).toEqual(['id', 'question']);
    expect(item.properties.options).toBeDefined();
    const proto = JSON.stringify(parameters).match(/"proto":\{[^}]*\}/)?.[0] ?? '';
    expect(proto).toContain('Path to a prototype file');
    expect(proto).toContain('right sidebar');
  });
  it('forwards only base question fields and uses the same call identity/signal', async () => {
    const ask = vi.fn(async () => ({ answers: [{ id: 'q', selected: ['B'] }] }));
    const tool = createQuestionTool({ userQuestions: { ask } } as never);
    const input = { questions: [{ ...question, options: [{ label: 'A', proto: 'prototypes/a.html' }, { label: 'B', proto: '/tmp/b.tsx', recommended: true }] }] };
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
    await expect(tool.execute({ questions: [{ ...question, type: 'layout' }] }, {} as never)).rejects.toThrow();
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
  it('ignores pre-upgrade call records that still carry a question type', () => {
    const legacy = JSON.stringify({ questions: [{ ...question, type: 'html', options: [{ label: 'A', proto: '<p>A</p>' }] }] });
    const initial = init();
    expect(applyQuestionEvent(initial, call(0, 'legacy', TOOL_NAME, legacy))).toBe(initial);
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
  it('bumps the projection state version so pre-upgrade persisted rows are discarded', () => {
    expect(questionProjection.stateVersion).toBe(2);
  });
});
