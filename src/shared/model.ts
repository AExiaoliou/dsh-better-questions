import { z } from 'zod';
import type {} from '@deepseek-ai/dsh-session-projection/types';

export const TOOL_NAME = 'ask_with_prototype';
export const PROJECTION_KEY = 'betterQuestions';

export interface BetterOption {
  label: string;
  description?: string;
  /** Path to a prototype file the model wrote before asking; opened in the right Sidebar. */
  proto?: string;
  recommended?: boolean;
}
export interface BetterQuestion {
  id: string;
  question: string;
  header?: string;
  multi_select: boolean;
  options: BetterOption[];
}
export interface AnswerItem { id: string; selected: string[]; custom?: string }
export interface AnswerBatch { answers: AnswerItem[] }
export interface ProjectionView { active: { callId: string; questions: BetterQuestion[] }[] }

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap { betterQuestions: ProjectionView }
}

const nonblank = z.string().refine(value => value.trim().length > 0, 'Must not be blank');
export const optionSchema = z.object({
  label: nonblank,
  description: z.string().optional(),
  // A prototype is a file path, never inline content: the model writes the file first.
  proto: z.string().refine(value => value.trim().length > 0, 'Must be a nonempty file path').optional(),
  recommended: z.boolean().optional(),
}).strict();

export const questionSchema = z.object({
  id: nonblank,
  question: nonblank,
  header: z.string().optional(),
  multi_select: z.boolean().default(false),
  options: z.array(optionSchema).default([]),
}).strict().superRefine((question, context) => {
  const labels = new Set<string>();
  let recommendations = 0;
  question.options.forEach((option, index) => {
    if (labels.has(option.label)) context.addIssue({ code: 'custom', path: ['options', index, 'label'], message: 'Duplicate option label' });
    labels.add(option.label);
    if (option.recommended && ++recommendations > 1) context.addIssue({ code: 'custom', path: ['options', index, 'recommended'], message: 'At most one recommended option per question' });
  });
});

export const requestSchema = z.object({ questions: z.array(questionSchema).min(1) }).strict().superRefine(({ questions }, context) => {
  const ids = new Set<string>();
  questions.forEach((question, index) => {
    if (ids.has(question.id)) context.addIssue({ code: 'custom', path: ['questions', index, 'id'], message: 'Duplicate question id' });
    ids.add(question.id);
  });
});

/** Strict public input validation shared by the tool, the projection, and replay. */
export function parseRequest(input: unknown): { questions: BetterQuestion[] } {
  return requestSchema.parse(input);
}

const answerSchema = z.object({ answers: z.array(z.object({
  id: z.string(), selected: z.array(z.string()), custom: z.string().optional(),
}).strict()) }).strict();

/** Validate the user batch and preserve input/option order; never synthesize a missing answer. */
export function canonicalizeAnswers(questions: readonly BetterQuestion[], input: unknown): AnswerBatch {
  const batch = answerSchema.parse(input);
  const byId = new Map(batch.answers.map(answer => [answer.id, answer]));
  if (byId.size !== batch.answers.length || batch.answers.length !== questions.length || questions.some(question => !byId.has(question.id))) {
    throw new Error('Answer batch must contain each question id exactly once');
  }
  return { answers: questions.map(question => {
    const answer = byId.get(question.id)!;
    const selected = new Set(answer.selected);
    if (selected.size !== answer.selected.length) throw new Error(`answers.${question.id}.selected: duplicate selection`);
    if (!question.multi_select && selected.size > 1) throw new Error(`answers.${question.id}.selected: only one option is allowed`);
    const allowed = new Set(question.options.map(option => option.label));
    for (const label of selected) if (!allowed.has(label)) throw new Error(`answers.${question.id}.selected: unknown option ${JSON.stringify(label)}`);
    return {
      id: question.id,
      selected: question.options.filter(option => selected.has(option.label)).map(option => option.label),
      ...(answer.custom?.trim() ? { custom: answer.custom } : {}),
    };
  }) };
}

export const projectionViewSchema = z.object({ active: z.array(z.object({
  callId: nonblank,
  questions: z.array(questionSchema).min(1),
}).strict()) }).strict();
