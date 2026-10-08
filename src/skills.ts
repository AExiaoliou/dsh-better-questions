import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-skill';

export const skillSummaries = [
  { type: 'none', description: 'Use ask_better_questions for ordinary choices or free-text clarification without previews.' },
  { type: 'layout', description: 'Compare UI layouts using restricted YAML trees in ask_better_questions.' },
  { type: 'code', description: 'Compare API designs or pseudocode with read-only code previews in ask_better_questions.' },
  { type: 'html', description: 'Compare self-contained HTML/CSS prototypes or CSS animations in ask_better_questions.' },
  { type: 'file', description: 'Offer existing files as choices and open them in the Harness sidebar with ask_better_questions.' },
] as const;

export function registerSkills(ctx: Pick<Context, 'skills'>): void {
  for (const summary of skillSummaries) {
    const name = `better-questions-${summary.type}`;
    const url = new URL(`../skills/${name}/SKILL.md`, import.meta.url);
    ctx.skills.register({
      name,
      description: summary.description,
      path: fileURLToPath(url),
      source: 'bundled',
      content: readFileSync(url, 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim(),
      resourceBase: { kind: 'directory', path: fileURLToPath(new URL('./', url)) },
    });
  }
}
