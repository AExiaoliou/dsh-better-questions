import React, { useMemo, useState } from 'react'
import { parseLayout } from './layout'
import { Wireframe } from './wireframe'

export type PreviewLanguage = 'en' | 'zh'

/** Static, non-interactive wireframe: no real controls, URLs or user CSS reach the DOM. */
export function LayoutPreview({ proto, label, language = 'en' }: { proto: string; label?: string; language?: PreviewLanguage }) {
  const result = useMemo(() => { try { return { node: parseLayout(proto) } } catch (error) { return { error: error instanceof Error ? error.message : String(error) } } }, [proto])
  if (!result.node) return <p className="bq-error" role="alert">{language === 'zh' ? '布局无效：' : 'Invalid layout: '}{result.error}</p>
  return <div className="bq-layout-preview"><Wireframe root={result.node} label={label} language={language} /></div>
}

/** Remove one complete Markdown fence; incomplete or multiple blocks remain literal. */
export function parseCode(proto: string): { code: string; language?: string } {
  const match = proto.match(/^(`{3,}|~{3,})([\w.+#-]*)[^\S\r\n]*\r?\n([\s\S]*?)\r?\n\1[^\S\r\n]*$/)
  if (!match || /^(?:`{3,}|~{3,})/m.test(match[3]!)) return { code: proto }
  return { code: match[3]!, ...(match[2] ? { language: match[2] } : {}) }
}
export function CodePreview({ proto, language = 'en' }: { proto: string; language?: PreviewLanguage }) {
  const parsed = parseCode(proto)
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(parsed.code)
      setStatus('copied')
    } catch { setStatus('error') }
  }
  return <div className="bq-code-preview"><div className="bq-code-toolbar"><span>{parsed.language || (language === 'zh' ? '纯文本' : 'Plain text')}</span><button type="button" onClick={() => void copy()}>{language === 'zh' ? '复制代码' : 'Copy code'}</button></div><pre tabIndex={0} aria-label={language === 'zh' ? '代码预览' : 'Code preview'}><code>{parsed.code}</code></pre><span role="status">{status === 'copied' ? (language === 'zh' ? '已复制' : 'Copied') : status === 'error' ? (language === 'zh' ? '复制失败，请手动选择并复制代码。' : 'Copy failed. Select and copy the code manually.') : ''}</span></div>
}

export const HTML_PREVIEW_CSP = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; media-src 'none'; connect-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'; navigate-to 'none'"
const htmlTags = new Set(['div', 'span', 'p', 'section', 'article', 'main', 'header', 'footer', 'aside', 'nav', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'strong', 'em', 'b', 'i', 'u', 's', 'small', 'sub', 'sup', 'br', 'hr', 'pre', 'code', 'blockquote', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col', 'button', 'label', 'input', 'textarea', 'select', 'option', 'progress', 'meter', 'details', 'summary', 'figure', 'figcaption', 'style'])
const discardTags = new Set(['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'template', 'svg', 'math', 'noscript', 'base', 'link', 'meta'])
const htmlAttrs = new Set(['class', 'id', 'style', 'title', 'role', 'aria-label', 'aria-hidden', 'colspan', 'rowspan', 'placeholder', 'value', 'min', 'max', 'step', 'checked', 'selected', 'open'])
const escapeText = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeAttribute = (text: string) => escapeText(text).replace(/"/g, '&quot;')

/**
 * Browser-only, inert HTML parsing and allowlist serialization. URLs, navigation,
 * event handlers, forms, foreign content and active embeds are never serialized.
 * CSP blocks CSS network loads; the empty iframe sandbox also denies scripts,
 * same-origin access, forms, popups and top navigation. CSS animations remain usable.
 */
export function sanitizeHtml(source: string): string {
  if (new TextEncoder().encode(source).length > 64 * 1024) throw new Error('HTML preview exceeds 64 KiB')
  // A template keeps parsing inert (including images) and never attaches source nodes.
  const template = document.createElement('template')
  template.innerHTML = source
  const serialize = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeText(node.textContent ?? '')
    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    const element = node as Element
    const tag = element.localName.toLowerCase()
    if (element.namespaceURI !== 'http://www.w3.org/1999/xhtml' || discardTags.has(tag)) return ''
    const children = () => Array.from(element.childNodes, serialize).join('')
    if (!htmlTags.has(tag)) return children()
    if (tag === 'style') return `<style>${(element.textContent ?? '').replace(/</g, '\\3c ')}</style>`
    let attributes = ''
    for (const attribute of Array.from(element.attributes)) if (htmlAttrs.has(attribute.name)) attributes += ` ${attribute.name}="${escapeAttribute(attribute.value)}"`
    if (['button', 'input', 'textarea', 'select', 'option'].includes(tag)) attributes += ' disabled=""'
    if (tag === 'input') attributes += ' type="text"'
    return `<${tag}${attributes}>${['br', 'hr', 'input', 'col'].includes(tag) ? '' : `${children()}</${tag}>`}`
  }
  const body = Array.from(template.content.childNodes, serialize).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${escapeAttribute(HTML_PREVIEW_CSP)}"><meta name="referrer" content="no-referrer"><style>html{color-scheme:light dark}body{margin:16px;font:14px system-ui;overflow-wrap:anywhere}*{box-sizing:border-box}</style></head><body>${body}</body></html>`
}
export function HtmlPreview({ proto, language = 'en' }: { proto: string; language?: PreviewLanguage }) {
  const result = useMemo(() => { try { return { source: sanitizeHtml(proto) } } catch (error) { return { error: error instanceof Error ? error.message : String(error) } } }, [proto])
  if (result.error) return <p role="alert" className="bq-error">{result.error}</p>
  return <iframe className="bq-html-preview" title={language === 'zh' ? '隔离的 HTML 预览' : 'Sandboxed HTML preview'} sandbox="" referrerPolicy="no-referrer" srcDoc={result.source} />
}
