import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-tools';
import type {} from '@deepseek-ai/dsh-user-questions';
import type {} from '@deepseek-ai/dsh-session-projection';
import { createQuestionTool } from './host/tool.js';
import { questionProjection } from './host/projection.js';

export const name = 'better-questions';
export const inject = ['tools', 'userQuestions', 'sessionProjections'];

export function apply(ctx: Context): void {
  // Each registry owns its registration effect on this plugin's calling fiber.
  ctx.sessionProjections.register(questionProjection);
  ctx.tools.register(createQuestionTool(ctx));
}
