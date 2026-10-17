import type { Context } from '@deepseek-ai/cordis';
import type { ToolDefinition } from '@deepseek-ai/dsh-tools';
import type {} from '@deepseek-ai/dsh-user-questions';
import { canonicalizeAnswers, parseRequest, TOOL_NAME } from '../shared/model.js';

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
          options: {
            type: 'array',
            items: {
              type: 'object', additionalProperties: false, required: ['label'],
              properties: {
                label: { type: 'string', description: 'Unique within this question; selected labels are returned unchanged.' },
                description: { type: 'string', description: 'Optional tradeoff or explanation.' },
                proto: { type: 'string', description: 'Path to a prototype file you wrote before asking, relative to the session workspace or absolute. Selecting the option opens it in the right sidebar. Omit for an ordinary option.' },
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
    description: 'Ask the user to choose or clarify. For a prototype option, first write the prototype file, then put its path in that option\'s proto; selecting the option opens the file in the right sidebar, which renders it by file type. Never put prototype content in proto. Options without proto are ordinary choices.',
    parameters: toolParameters,
    output: {
      schema: outputSchema,
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(input, exec) {
      const { questions } = parseRequest(input);
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
