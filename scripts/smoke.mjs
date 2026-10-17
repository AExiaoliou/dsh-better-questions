import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import * as React from 'react';
import * as Jsx from 'react/jsx-runtime';
import * as Store from '@deepseek-ai/dsh-client-store';
import * as host from '../dist/index.js';

const registrations = { tools: [], projections: [] };
// Host.apply keeps working with only the registries it actually injects.
host.apply({
  tools: { register: tool => registrations.tools.push(tool) },
  sessionProjections: { register: projection => registrations.projections.push(projection) },
});

assert.deepEqual(host.inject, ['tools', 'userQuestions', 'sessionProjections'], 'Host must not inject a skills service');
assert.equal(registrations.tools.length, 1, 'Host must register exactly one tool');
const tool = registrations.tools[0];
assert.equal(tool.name, 'ask_with_prototype');
assert.equal(registrations.projections[0].key, 'betterQuestions');
assert.equal(registrations.projections[0].stateVersion, 2, 'Projection stateVersion must be 2');

// JSON Schema itself uses `type` keywords, so walk the schema instead of searching
// the serialized text: no object in `properties` may declare a `type` field.
const declaresProperty = (schema, property) => {
  if (Array.isArray(schema)) return schema.some(value => declaresProperty(value, property));
  if (schema === null || typeof schema !== 'object') return false;
  if (schema.properties !== null && typeof schema.properties === 'object'
    && Object.prototype.hasOwnProperty.call(schema.properties, property)) return true;
  return Object.values(schema).some(value => declaresProperty(value, property));
};
assert.ok(!declaresProperty(tool.parameters, 'type'), 'tool parameters must not declare a question-level `type` property');
assert.ok(!/"(?:none|layout|code|html|file)"/.test(JSON.stringify(tool.parameters)), 'tool parameters must not expose the removed question types');
const questionProperties = tool.parameters.properties.questions.items.properties;
assert.deepEqual(Object.keys(questionProperties).sort(), ['header', 'id', 'multi_select', 'options', 'question']);
assert.match(questionProperties.options.items.properties.proto.description, /sidebar/i);
assert.ok(!JSON.stringify(tool.parameters).includes('SKILL.md'));
assert.ok(!JSON.stringify(tool.parameters).includes('skills/'), 'tool parameters must not reference the removed skills directory');

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
assert.ok(!client.inject.includes('skills'), 'Client must not inject skills');
console.log('PASS: built Host registers the tool and v2 projection without skills and exposes no question `type`; Client loads with only supported baseline modules.');
