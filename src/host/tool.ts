import type { Context } from '@deepseek-ai/cordis';
import type { ToolDefinition } from '@deepseek-ai/dsh-tools';
import type {} from '@deepseek-ai/dsh-user-questions';
import { canonicalizeAnswers, parseRequest, QUESTION_TYPES, TOOL_NAME } from '../shared/model.js';

/** Deliberately compact: preview grammar and examples are loaded through the named skills. */
export const toolParameters = {
  type: 'object',
  additionalProperties: false,
  required: ['questions'],
  properties: {
    questions: {
      type: 'array', minItems: 1,
      items: {
        type: 'object', additionalProperties: false, required: ['id', 'question'],
        properties: {
          id: { type: 'string', description: 'Unique question id; echoed in the answer.' },
          question: { type: 'string', description: 'The question to ask.' },
          header: { type: 'string', description: 'Optional short heading.' },
          type: { type: 'string', enum: [...QUESTION_TYPES], description: 'Default none. Other types require options with proto; file is a path, others are inline content.' },
          options: {
            type: 'array',
            items: {
              type: 'object', additionalProperties: false, required: ['label'],
              properties: {
                label: { type: 'string', description: 'Unique within this question; selected labels are returned unchanged.' },
                description: { type: 'string', description: 'Optional tradeoff or explanation.' },
                proto: { type: 'string', description: 'Required nonempty for layout (restricted YAML), code, html, file. Ignored for none.' },
                recommended: { type: 'boolean', description: 'At most one per question. Default false; displays a badge without selecting.' },
              },
            },
          },
          multi_select: { type: 'boolean', description: 'Allow several selected options; default false. Custom text may accompany selections.' },
        },
      },
    },
  },
};

export const outputSchema = {
  type: 'object' as const, additionalProperties: false, required: ['answers'],
  properties: { answers: { type: 'array' as const, items: {
    type: 'object' as const, additionalProperties: false, required: ['id', 'selected'],
    properties: {
      id: { type: 'string' as const },
      selected: { type: 'array' as const, items: { type: 'string' as const } },
      custom: { type: 'string' as const },
    },
  } } },
};

export function createQuestionTool(ctx: Pick<Context, 'userQuestions'>): ToolDefinition {
  return {
    name: TOOL_NAME,
    description: 'Ask the user to choose or clarify, optionally comparing prototypes. Read better-questions-select before any type-specific skill; use it to choose each question type. Load each better-questions-{type} skill only before its first use in this conversation; reuse the selection and type skills afterward. Selecting an option shows its preview (files open in the sidebar).',
    parameters: toolParameters,
    output: {
      schema: outputSchema,
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(input, exec) {
      const { questions } = parseRequest(input, { layouts: true });
      const result = await ctx.userQuestions.ask({
        questions: questions.map(question => ({
          id: question.id,
          question: question.question,
          ...(question.header !== undefined ? { header: question.header } : {}),
          options: question.options.map(option => ({
            label: option.label,
            ...(option.description !== undefined ? { description: option.description } : {}),
          })),
          multiSelect: question.multi_select,
        })),
        ...(exec.agent !== undefined ? { agent: exec.agent } : {}),
        signal: exec.signal,
        ...(exec.callId !== undefined ? { wait: { callId: exec.callId } } : {}),
      });
      // A Client is not an authority for which question IDs/options exist.
      return { answers: canonicalizeAnswers(questions, result).answers.map(answer => ({ ...answer })) };
    },
  };
}
