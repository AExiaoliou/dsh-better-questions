import type { Context } from '@deepseek-ai/cordis';
import type { ToolDefinition } from '@deepseek-ai/dsh-tools';
import { parseLayout } from '../shared/layout.js';
import { renderLayoutPng } from './layout-preview.js';

export const LAYOUT_CHECK_TOOL_NAME = 'check_layout_prototype';

const imageSchema = {
  type: 'object' as const,
  additionalProperties: false,
  required: ['attachmentId', 'mediaType', 'bytes', 'width', 'height'],
  properties: {
    attachmentId: { type: 'string' as const }, mediaType: { type: 'string' as const, const: 'image/png' },
    bytes: { type: 'integer' as const }, width: { type: 'integer' as const }, height: { type: 'integer' as const },
    name: { type: 'string' as const },
  },
};

export const layoutToolParameters = {
  type: 'object', additionalProperties: false, required: ['proto'],
  properties: { proto: { type: 'string', description: 'One restricted YAML 1.2 layout tree accepted by ask_with_prototype type layout.' } },
};

export const layoutToolOutputSchema = {
  type: 'object' as const, additionalProperties: false, required: ['valid'],
  properties: {
    valid: { type: 'boolean' as const },
    error: { type: 'string' as const },
    image: imageSchema,
  },
};

interface ImageAttachmentRef {
  attachmentId: string;
  mediaType: string;
  bytes: number;
  width: number;
  height: number;
  name?: string;
}
interface AttachmentService {
  saveImage(input: { data: Uint8Array; mediaType: 'image/png'; name?: string }): Promise<ImageAttachmentRef>;
}

type LayoutCheckResult = { valid: true; image: ImageAttachmentRef } | { valid: false; error: string };

export function createLayoutCheckTool(ctx: Pick<Context, 'attachments'> & { attachments: AttachmentService }): ToolDefinition {
  return {
    name: LAYOUT_CHECK_TOOL_NAME,
    description: 'Pre-check one proto before calling ask_with_prototype with type layout. Returns valid true and a wireframe preview image when the restricted YAML layout is valid; otherwise returns valid false with the exact parse error. Call this after loading better-questions-layout and before asking the user.',
    parameters: layoutToolParameters,
    output: {
      schema: layoutToolOutputSchema,
      render: (_args, value) => {
        const result = value as LayoutCheckResult;
        return result.valid
          ? ([{ type: 'text', text: 'Layout is valid. Preview image attached.' }, { type: 'image', attachment: result.image }] as any)
          : [{ type: 'text', text: `Layout is invalid: ${result.error}` }];
      },
    },
    async execute(input): Promise<LayoutCheckResult> {
      const proto = (input as { proto: string }).proto;
      try {
        const root = parseLayout(proto);
        const image = await ctx.attachments.saveImage({ data: renderLayoutPng(root), mediaType: 'image/png', name: 'layout-preview.png' });
        return { valid: true, image };
      } catch (error) {
        return { valid: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  };
}
