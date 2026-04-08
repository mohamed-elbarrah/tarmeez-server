import type { RefineScope } from '../dto/refine-page.dto';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Conversation history block builder ──────────────────────

function buildConversationBlock(history?: ConversationMessage[]): string {
  if (!history || history.length === 0) return '';
  const lines = history
    .slice(-6) // cap at last 6 messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');
  return `\nConversation history:\n${lines}`;
}

// ─── Builder 1: Full page refine ─────────────────────────────

export function buildFullRefinePrompt(params: {
  instruction: string;
  currentContent: Record<string, any>;
  conversationHistory?: ConversationMessage[];
}): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You are a conversion copywriter and landing page strategist.
You will receive a full landing page JSON and an instruction.
Apply the instruction to the entire page while maintaining brand voice consistency across all sections.
Respond ONLY with the complete updated page JSON.
Keep all section types and structure intact.
Only change content, never add or remove sections.`;

  const conversationBlock = buildConversationBlock(params.conversationHistory);

  const userPrompt = `Instruction: ${params.instruction}

Current page content:
${JSON.stringify(params.currentContent, null, 2)}${conversationBlock}`;

  return { systemPrompt, userPrompt };
}

// ─── Builder 2: Section refine ───────────────────────────────

export function buildSectionRefinePrompt(params: {
  instruction: string;
  sectionType: string;
  currentSectionContent: Record<string, any>;
  conversationHistory?: ConversationMessage[];
}): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You are a conversion copywriter.
You will receive a single landing page section JSON and an instruction to improve it.
Respond ONLY with the updated section JSON.
Keep the exact same structure and field names.
Only change field values.`;

  const conversationBlock = buildConversationBlock(params.conversationHistory);

  const userPrompt = `Section type: ${params.sectionType}
Instruction: ${params.instruction}

Current section content:
${JSON.stringify(params.currentSectionContent, null, 2)}${conversationBlock}`;

  return { systemPrompt, userPrompt };
}

// ─── Builder 3: Field refine ─────────────────────────────────

export function buildFieldRefinePrompt(params: {
  instruction: string;
  sectionType: string;
  fieldPath: string;
  currentFieldValue: unknown;
  conversationHistory?: ConversationMessage[];
}): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You are a conversion copywriter.
You will receive a single field value and an instruction.
Respond ONLY with the new field value as a raw JSON string.
No explanation. No wrapper object. Just the value.`;

  const conversationBlock = buildConversationBlock(params.conversationHistory);

  const currentValueStr =
    typeof params.currentFieldValue === 'string'
      ? params.currentFieldValue
      : JSON.stringify(params.currentFieldValue);

  const userPrompt = `Field: ${params.fieldPath} (in section: ${params.sectionType})
Instruction: ${params.instruction}
Current value: ${currentValueStr}${conversationBlock}`;

  return { systemPrompt, userPrompt };
}
