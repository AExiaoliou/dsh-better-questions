export const toolViewStyles = `
.bq-tool{display:flex;flex-direction:column;width:100%;min-width:0;font-family:inherit}
.bq-tool *{box-sizing:border-box}
.bq-tool button{font-family:inherit;cursor:pointer}
.bq-tool button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.bq-tool-row{position:relative;display:flex;align-items:center;overflow:hidden;min-width:0;height:calc(24px + var(--dsh-content-font-delta,0px));color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));transition:color 100ms ease}
.bq-tool-row:hover{color:var(--dsw-alias-label-secondary)}
.bq-tool-leading{position:relative;display:inline-flex;align-items:center;justify-content:center;flex:none;width:calc(16px + var(--dsh-content-font-delta,0px));height:calc(16px + var(--dsh-content-font-delta,0px));margin-right:6px;padding:0;border:0;background:none;color:inherit}
.bq-tool-leading svg{width:calc(14px + var(--dsh-content-font-delta,0px));height:calc(14px + var(--dsh-content-font-delta,0px))}
.bq-tool-icon-idle{display:inline-flex;opacity:1;transition:opacity 100ms ease}
.bq-tool-icon-hover{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 100ms ease}
.bq-tool-row:hover .bq-tool-icon-idle{opacity:0}
.bq-tool-row:hover .bq-tool-icon-hover{opacity:1}
.bq-tool-title{flex:none;font-size:var(--dsh-content-font-size-secondary,13px);font-weight:400;line-height:calc(24px + var(--dsh-content-font-delta,0px))}
.bq-tool-sep{flex:none;width:2px;height:2px;margin:0 8px;border-radius:1px;background:var(--dsw-alias-label-caption,var(--dsw-alias-label-secondary))}
.bq-tool-summary{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px))}
.bq-tool-panel-button{display:inline-flex;align-items:center;flex:none;gap:4px;height:calc(22px + var(--dsh-content-font-delta,0px));margin-left:8px;padding:0 10px;border:0;border-radius:999px;background:var(--dsw-alias-button-floating-fill,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary);font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);line-height:1;white-space:nowrap;transition:background 100ms ease}
.bq-tool-panel-button:hover{background:var(--dsw-alias-button-floating-hover,var(--dsw-alias-bg-layer-2))}
.bq-tool-panel-button svg{width:13px;height:13px}
.bq-tool-body{display:flex;flex-direction:column;min-width:0}
.bq-tool-transcript{display:flex;flex-direction:column;gap:16px;max-height:360px;margin:4px 0 4px 4px;padding:16px 20px;overflow-y:auto;border:0.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,8px);background:var(--dsw-alias-bg-base)}
.bq-tool-entry{display:flex;flex-direction:column;gap:2px;min-width:0}
.bq-tool-question,.bq-tool-answer,.bq-tool-verdict,.bq-tool-unanswered{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:var(--dsh-content-font-size,14px);line-height:calc(24px + var(--dsh-content-font-delta,0px))}
.bq-tool-question,.bq-tool-skipped,.bq-tool-unanswered{color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}
.bq-tool-answer,.bq-tool-verdict{color:var(--dsw-alias-label-primary)}
.bq-tool-answer span{display:block}
.bq-tool-unanswered{display:flex;flex-direction:column;gap:8px;padding-left:20px}
.bq-tool-body>.bq-tool-verdict{margin:4px 0 4px 4px}
.bq-tool-inspect{display:inline-flex;align-self:flex-start;align-items:center;gap:4px;margin:4px 0 2px 4px;padding:2px 8px;border:0.5px solid var(--dsw-alias-border-l3,var(--dsw-alias-border-l1));border-radius:999px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;opacity:0;transition:opacity 100ms ease}
.bq-tool-inspect svg{width:12px;height:12px}
.bq-tool:hover .bq-tool-inspect,.bq-tool-inspect:focus-visible{opacity:1}
.bq-tool-inspect:hover{background:var(--dsw-alias-interactive-bg-hover-solid,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary)}
@media(prefers-reduced-motion:reduce){.bq-tool-row,.bq-tool-icon-idle,.bq-tool-icon-hover,.bq-tool-panel-button,.bq-tool-inspect{transition:none}}
`
