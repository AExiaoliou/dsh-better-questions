// Dev-only: bundle the visual harness and capture screenshots with headless Chrome.
// Usage: node scripts/visual/shoot.mjs <outDir> [name:query ...]
import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const [outDir = '/tmp/bq-visual', ...shots] = process.argv.slice(2)
await mkdir(outDir, { recursive: true })
await build({
  entryPoints: [new URL('./harness.tsx', import.meta.url).pathname], outfile: resolve(outDir, 'harness.js'),
  bundle: true, format: 'iife', platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
})
const theme = await readFile(process.env.DSH_THEME_CSS ?? '/home/aexiaoliou/workspace/deepseek-harness/packages/client/ui-theme/src/styles/design-platform.css', 'utf8').catch(() => '')
await writeFile(resolve(outDir, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><style>${theme}body{margin:0;font-family:system-ui,"Noto Sans CJK SC",sans-serif;background:var(--dsw-alias-bg-base)}</style></head><body><div id="root"></div><script src="harness.js"></script></body></html>`)
const chrome = process.env.CHROME ?? '/usr/bin/google-chrome'
for (const shot of shots.length ? shots : ['card:mode=card&width=980:980,620']) {
  const [name, query, size = '1000,700'] = shot.split(':')
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${size}`,
    `--screenshot=${resolve(outDir, `${name}.png`)}`, '--virtual-time-budget=3000', `file://${resolve(outDir, 'index.html')}?${query}`], { stdio: 'ignore' })
  console.log(resolve(outDir, `${name}.png`))
}
