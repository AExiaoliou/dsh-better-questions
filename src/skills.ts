import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-skill';

export const skillSummaries = [
  { name: 'better-questions-select', description: 'Choose an ask_with_prototype question type using examples, then load its type-specific skill. Read this first.' },
  { name: 'better-questions-none', description: 'Use ask_with_prototype for ordinary choices or free-text clarification without previews.' },
  { name: 'better-questions-layout', description: 'Compare UI layouts using restricted YAML trees in ask_with_prototype.' },
  { name: 'better-questions-code', description: 'Compare API designs or pseudocode with read-only code previews in ask_with_prototype.' },
  { name: 'better-questions-html', description: 'Compare self-contained HTML/CSS prototypes or CSS animations in ask_with_prototype.' },
  { name: 'better-questions-file', description: 'Offer existing files as choices and open them in the Harness sidebar with ask_with_prototype.' },
] as const;

export function registerSkills(ctx: Pick<Context, 'skills'>): void {
  for (const summary of skillSummaries) {
    const name = summary.name;
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
