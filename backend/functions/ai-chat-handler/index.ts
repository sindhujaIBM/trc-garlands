import type { AppSyncResolverEvent } from 'aws-lambda';
import { ulid } from 'ulid';
import { buildSystemPrompt } from './prompt-builder.js';
import { parseIntents } from './intent-parser.js';
import { invokeChatModel } from './bedrock-client.js';

interface SendChatMessageArgs {
  sessionId?: string;
  message: string;
}

export interface ChatResponse {
  sessionId: string;
  reply: string;
  escalated: boolean;
}

/**
 * ai-chat-handler — "Pooja" assistant (architecture-plan.md §4A).
 * MVP scope: FAQ + lead capture only. Quote/recommendation intents are Phase 2.
 */
export const handler = async (
  event: AppSyncResolverEvent<SendChatMessageArgs>
): Promise<ChatResponse> => {
  const sessionId = event.arguments.sessionId ?? ulid();

  // TODO: load session from trc-chat-sessions (last 20 messages)
  // TODO: load active seasonal events + surcharges for prompt context
  const systemPrompt = buildSystemPrompt({ activeSeasonalEvents: [] });

  const reply = await invokeChatModel({
    system: systemPrompt,
    history: [], // TODO: session messages
    userMessage: event.arguments.message,
  });

  const intents = parseIntents(reply);
  // TODO: LEAD_CAPTURE → persist capturedLead to session
  // TODO: RUSH_ESCALATION → set session ESCALATED + SNS alert to Muni
  // TODO: update trc-chat-sessions with new messages + ttl refresh

  return { sessionId, reply, escalated: intents.includes('RUSH_ESCALATION') };
};
