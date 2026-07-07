import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
} from '@aws-sdk/client-bedrock-runtime';
import { BEDROCK_MODELS, REGION } from '../../shared/constants/index.js';
import type { ChatMessage } from '../../shared/types/index.js';

const client = new BedrockRuntimeClient({ region: REGION });

export interface ChatInvocation {
  system: string;
  history: ChatMessage[];
  userMessage: string;
}

/** Invoke the chat model (Claude Haiku) via the Bedrock Converse API. */
export async function invokeChatModel(input: ChatInvocation): Promise<string> {
  const messages: Message[] = [
    ...input.history.map((m) => ({
      role: m.role,
      content: [{ text: m.content }],
    })),
    { role: 'user' as const, content: [{ text: input.userMessage }] },
  ];

  const response = await client.send(
    new ConverseCommand({
      modelId: BEDROCK_MODELS.chat,
      system: [{ text: input.system }],
      messages,
      inferenceConfig: { maxTokens: 1024, temperature: 0.7 },
    })
  );

  return response.output?.message?.content?.[0]?.text ?? '';
}
