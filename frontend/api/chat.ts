import { graphqlClient } from "./client";

const SEND_CHAT_MESSAGE = /* GraphQL */ `
  mutation SendChatMessage($sessionId: ID, $message: String!) {
    sendChatMessage(sessionId: $sessionId, message: $message) {
      sessionId
      reply
      escalated
    }
  }
`;

export interface ChatResponse {
  sessionId: string;
  reply: string;
  escalated: boolean;
}

// Same rush-language pattern the real intent-parser.ts checks, so the
// escalation UI path is testable even before the real endpoint is wired up.
const RUSH_PATTERN = /rush|days? away|minimum/i;

function mockSendChatMessage(input: { sessionId?: string; message: string }): Promise<ChatResponse> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        sessionId: input.sessionId ?? crypto.randomUUID(),
        reply:
          "Namaste! I'm Pooja (mock mode — no live backend configured yet). " +
          "Ask me about garlands for a wedding, pooja, or celebration.",
        escalated: RUSH_PATTERN.test(input.message),
      });
    }, 500);
  });
}

export async function sendChatMessage(input: { sessionId?: string; message: string }): Promise<ChatResponse> {
  if (!process.env.NEXT_PUBLIC_APPSYNC_ENDPOINT) {
    // Seam only — delete this branch once frontend/.env.local is populated
    // with real deploy outputs. Kept as insurance for future local dev.
    return mockSendChatMessage(input);
  }

  const result = await graphqlClient.graphql({
    query: SEND_CHAT_MESSAGE,
    variables: { sessionId: input.sessionId ?? null, message: input.message },
  });

  if (!("data" in result) || !result.data) {
    throw new Error("sendChatMessage returned no data");
  }
  return result.data.sendChatMessage;
}
