import { z } from 'zod';
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection';
import type { SessionEvent } from '@deepseek-ai/dsh-session';
import type {} from '@deepseek-ai/dsh-tools';
import type {} from '@deepseek-ai/dsh-agent/types';
import { parseRequest, PROJECTION_KEY, projectionViewSchema, TOOL_NAME, type ProjectionView } from '../shared/model.js';

export interface ProjectionState {
  inheritedEventCount: number;
  view: ProjectionView;
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap { betterQuestions: ProjectionState }
}

/** The projection records display metadata only; it never creates an answer channel. */
export function applyQuestionEvent(state: ProjectionState, event: SessionEvent): ProjectionState {
  if (event.seq < state.inheritedEventCount) return state;
  if (event.type === 'tool/call' && event.data.name === TOOL_NAME) {
    try {
      const { questions } = parseRequest(JSON.parse(event.data.arguments));
      return { ...state, view: { active: [
        ...state.view.active.filter(call => call.callId !== event.data.callId),
        { callId: event.data.callId, questions },
      ] } };
    } catch {
      // Invalid args still have an ordinary tool error record, never an answerable card.
      return state;
    }
  }
  if (event.type === 'tool/result') {
    const callId = event.data.message.toolCallId;
    if (!state.view.active.some(call => call.callId === callId)) return state;
    return { ...state, view: { active: state.view.active.filter(call => call.callId !== callId) } };
  }
  if (event.type === 'turn/end' && state.view.active.length > 0) {
    // Includes aborted/unknown-outcome recovery. Blocking calls cannot legitimately outlive a turn.
    return { ...state, view: { active: [] } };
  }
  return state;
}

export const questionProjection = {
  key: PROJECTION_KEY,
  // v2 drops the question `type` field and the inline-proto projection state, so
  // persisted v1 rows are discarded and the log is folded with the current schema.
  stateVersion: 2,
  stateSchema: z.object({
    inheritedEventCount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    view: projectionViewSchema,
  }).strict(),
  init: (_header, inheritedEventCount) => ({ inheritedEventCount, view: { active: [] } }),
  apply: applyQuestionEvent,
  wire: { viewSchema: projectionViewSchema, view: state => state.view },
} satisfies ProjectionDefinition<'betterQuestions', ProjectionState>;
