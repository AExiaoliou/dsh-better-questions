import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-tools';
import type {} from '@deepseek-ai/dsh-user-questions';
import type {} from '@deepseek-ai/dsh-session-projection';
import type {} from '@deepseek-ai/dsh-skill';
import { createQuestionTool } from './host/tool.js';
import { questionProjection } from './host/projection.js';
import { registerSkills } from './skills.js';

export const name = 'better-questions';
export const inject = ['tools', 'userQuestions', 'sessionProjections', 'skills'];

export function apply(ctx: Context): void {
  // Each registry owns its registration effect on this plugin's calling fiber.
  registerSkills(ctx);
  ctx.sessionProjections.register(questionProjection);
  ctx.tools.register(createQuestionTool(ctx));
}
