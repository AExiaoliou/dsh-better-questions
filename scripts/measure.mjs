import { getEncoding } from 'js-tiktoken';
import { apply } from '../dist/index.js';

const tools = [];
apply({ tools: { register: tool => tools.push(tool) }, sessionProjections: { register() {} } });
if (tools[0] === undefined) throw new Error('ask_with_prototype did not register');

const encoder = getEncoding('o200k_base');
const measure = value => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return { utf8Bytes: Buffer.byteLength(text), o200kTokens: encoder.encode(text).length };
};
const tool = tools[0];
console.log(JSON.stringify({
  note: 'o200k_base comparison only; actual provider token counts and catalog envelope vary.',
  tool: measure({ name: tool.name, description: tool.description, parameters: tool.parameters }),
}, null, 2));
