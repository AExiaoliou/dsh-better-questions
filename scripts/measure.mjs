import { getEncoding } from 'js-tiktoken';
import { apply } from '../dist/index.js';
const tools = [], skills = [];
apply({ tools: { register: tool => tools.push(tool) }, skills: { register: skill => skills.push(skill) }, sessionProjections: { register() {} } });
const encoder = getEncoding('o200k_base');
const measure = value => { const text = typeof value === 'string' ? value : JSON.stringify(value); return { utf8Bytes: Buffer.byteLength(text), o200kTokens: encoder.encode(text).length }; };
console.log(JSON.stringify({
  note: 'o200k_base comparison only; actual provider token counts and catalog envelope vary.',
  tool: measure({ name: tools[0].name, description: tools[0].description, parameters: tools[0].parameters }),
  skillCatalog: measure(skills.map(({ name, description }) => ({ name, description }))),
  loadedSkillBodies: Object.fromEntries(skills.map(skill => [skill.name, measure(skill.content)])),
}, null, 2));
