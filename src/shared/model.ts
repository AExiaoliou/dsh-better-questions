import { z } from 'zod';
import type {} from '@deepseek-ai/dsh-session-projection/types';
import { parseLayout } from './layout.js';

export const TOOL_NAME = 'ask_better_questions';
export const PROJECTION_KEY = 'betterQuestions';
export const QUESTION_TYPES = ['none', 'layout', 'code', 'html', 'file'] as const;
export type QuestionType = typeof QUESTION_TYPES[number];
export const MAX_PROTO_BYTES = 64 * 1024;
export const MAX_BATCH_PROTO_BYTES = 256 * 1024;
const encoder = new TextEncoder();
export const byteLength = (value: string): number => encoder.encode(value).length;

export interface BetterOption {
  label: string;
  description?: string;
  proto?: string;
  recommended?: boolean;
}
export interface BetterQuestion {
  id: string;
  question: string;
  header?: string;
  type: QuestionType;
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
  proto: z.string().optional(),
  recommended: z.boolean().optional(),
}).strict();

export const questionSchema = z.object({
  id: nonblank,
  question: nonblank,
  header: z.string().optional(),
  type: z.enum(QUESTION_TYPES).default('none'),
  multi_select: z.boolean().default(false),
  options: z.array(optionSchema).default([]),
}).strict().superRefine((question, context) => {
  const labels = new Set<string>();
  let recommendations = 0;
  if (question.type !== 'none' && question.options.length === 0) {
    context.addIssue({ code: 'custom', path: ['options'], message: `${question.type} requires at least one option` });
  }
  question.options.forEach((option, index) => {
    if (labels.has(option.label)) context.addIssue({ code: 'custom', path: ['options', index, 'label'], message: 'Duplicate option label' });
    labels.add(option.label);
    if (option.recommended && ++recommendations > 1) context.addIssue({ code: 'custom', path: ['options', index, 'recommended'], message: 'At most one recommended option per question' });
    if (question.type !== 'none') {
      if (!option.proto?.trim()) context.addIssue({ code: 'custom', path: ['options', index, 'proto'], message: `${question.type} requires a nonempty string proto` });
      else if (byteLength(option.proto) > MAX_PROTO_BYTES) context.addIssue({ code: 'custom', path: ['options', index, 'proto'], message: `Prototype exceeds ${MAX_PROTO_BYTES} UTF-8 bytes` });
    }
  });
}).transform((question): BetterQuestion => question.type === 'none'
  ? { ...question, options: question.options.map(({ proto: _ignored, ...option }) => option) }
  : question);

export const requestSchema = z.object({ questions: z.array(questionSchema).min(1) }).strict().superRefine(({ questions }, context) => {
  const ids = new Set<string>();
  let bytes = 0;
  questions.forEach((question, index) => {
    if (ids.has(question.id)) context.addIssue({ code: 'custom', path: ['questions', index, 'id'], message: 'Duplicate question id' });
    ids.add(question.id);
    bytes += question.options.reduce((sum, option) => sum + byteLength(option.proto ?? ''), 0);
  });
  if (bytes > MAX_BATCH_PROTO_BYTES) context.addIssue({ code: 'custom', path: ['questions'], message: `Batch prototypes exceed ${MAX_BATCH_PROTO_BYTES} UTF-8 bytes` });
});

/**
 * Strict public input validation. `layouts: true` (tool execute only) also validates layout
 * grammar so the model gets an actionable error; replay/projection stays lenient and shows
 * layout errors locally in the preview, so older records keep their rich cards.
 */
export function parseRequest(input: unknown, { layouts = false }: { layouts?: boolean } = {}): { questions: BetterQuestion[] } {
  const request = requestSchema.parse(input);
  if (layouts) {
    const issues: z.core.$ZodIssue[] = [];
    request.questions.forEach((question, index) => {
      if (question.type === 'layout') question.options.forEach((option, optionIndex) => {
        try { parseLayout(option.proto!); } catch (error) {
          issues.push({ code: 'custom', input: option.proto, path: ['questions', index, 'options', optionIndex, 'proto'], message: `Invalid layout (${option.label}): ${error instanceof Error ? error.message : String(error)}` });
        }
      });
    });
    if (issues.length) throw new z.ZodError(issues);
  }
  return request;
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
