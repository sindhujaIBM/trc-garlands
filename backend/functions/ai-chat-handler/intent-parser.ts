export type ChatIntent =
  | 'LEAD_CAPTURE'
  | 'RUSH_ESCALATION'
  | 'QUOTE_REQUEST'
  | 'ORDER_INTENT';

/**
 * Parse intents from the assistant response (architecture-plan.md §4A step 5).
 * TODO: replace keyword heuristics with structured tool-use output from the
 * model (ask Haiku to emit an <intents> tag or use tool calling).
 */
export function parseIntents(reply: string): ChatIntent[] {
  const intents: ChatIntent[] = [];
  if (/whatsapp/i.test(reply) && /rush|days away|minimum/i.test(reply)) {
    intents.push('RUSH_ESCALATION');
  }
  return intents;
}
