import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await build({
  entryPoints: ['src/index.ts'], outfile: 'dist/index.js',
  bundle: true, format: 'esm', platform: 'node', target: 'node22',
  minify: true, sourcemap: true, legalComments: 'linked',
  // Bundled CJS dependencies (yaml) may require Node built-ins; give the ESM bundle a real require.
  banner: { js: "import { createRequire as __bqCreateRequire } from 'node:module'; const require = __bqCreateRequire(import.meta.url);" },
});
const client = await build({
  entryPoints: ['src/client/index.tsx'], outfile: 'dist/client.js',
  bundle: true, format: 'cjs', platform: 'browser', target: 'es2022',
  jsx: 'automatic', minify: true, write: false, legalComments: 'inline',
  external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/dsh-client-store'],
  metafile: true,
});
const code = client.outputFiles.find(file => file.path.endsWith('/client.js')).text;
await writeFile('dist/client.js', `window.__ModuleLoader__.load({id:"dsh-better-questions",factory(require){const module={exports:{}};const exports=module.exports;\n${code}\nreturn module.exports;}});\n`);
await writeFile('dist/client.meta.json', JSON.stringify(client.metafile, null, 2) + '\n');
console.log('Built standalone Host ESM and Harness Client module.');
