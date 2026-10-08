import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import * as React from 'react';
import * as Jsx from 'react/jsx-runtime';
import * as Store from '@deepseek-ai/dsh-client-store';
import * as host from '../dist/index.js';

const registrations = { tools: [], skills: [], projections: [] };
host.apply({
  tools: { register: tool => registrations.tools.push(tool) },
  skills: { register: skill => registrations.skills.push(skill) },
  sessionProjections: { register: projection => registrations.projections.push(projection) },
});
assert.equal(registrations.tools[0].name, 'ask_with_prototype');
assert.equal(registrations.projections[0].key, 'betterQuestions');
assert.equal(registrations.skills.length, 5);
for (const skill of registrations.skills) assert.ok(skill.content.length > 100 && !skill.content.startsWith('---'));
let client;
const modules = { react: React, 'react/jsx-runtime': Jsx, '@deepseek-ai/dsh-client-store': Store };
runInNewContext(await readFile(new URL('../dist/client.js', import.meta.url), 'utf8'), {
  TextEncoder, TextDecoder, console,
  window: { __ModuleLoader__: { load(definition) {
    assert.equal(definition.id, 'dsh-better-questions');
    client = definition.factory(id => {
      assert.ok(id in modules, `Unsupported Client runtime import: ${id}`);
      return modules[id];
    });
  } } },
});
assert.equal(typeof client.apply, 'function');
assert.ok(client.inject.includes('slots'));
assert.ok(!JSON.stringify(registrations.tools[0].parameters).includes('SKILL.md'));
console.log('PASS: built Host registers tool/projection/five skill resources; Client loads with only supported baseline modules.');
