import type { RefineScope } from '../dto/refine-page.dto';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Conversation history block builder ──────────────────────

function buildConversationBlock(history?: ConversationMessage[]): string {
  if (!history || history.length === 0) return '';
  const lines = history
    .slice(-8) // last 8 messages for full context
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');
  return `\n\nConversation history (for context):\n${lines}`;
}

// ─── Delta type (shared with refiner) ────────────────────────

export interface SectionPatch {
  sectionType: string;
  content: Record<string, any>;
}

export interface RefineDelta {
  type: 'FULL' | 'PARTIAL';
  message: string;
  patches: SectionPatch[] | null;
  fullContent: Record<string, any> | null;
}

// ─── Builder 1: Surgical full-page refine ────────────────────
// Single call — AI decides FULL vs PARTIAL and returns a delta.

export function buildSurgicalRefinePrompt(params: {
  instruction: string;
  currentContent: Record<string, any>;
  conversationHistory?: ConversationMessage[];
}): { systemPrompt: string; userPrompt: string } {
  // Build a compact section map so AI understands page structure at a glance
  const sections: any[] = Array.isArray(params.currentContent.sections)
    ? params.currentContent.sections
    : [];
  const sectionMap =
    sections.length > 0
      ? sections
          .map(
            (s: any, i: number) =>
              `  [${i}] type="${s?.type ?? 'unknown'}" — headline: "${s?.headline ?? s?.title ?? s?.heading ?? '...'}"`,
          )
          .join('\n')
      : '  (flat object — no sections array)';

  const systemPrompt = `You are a conversion copywriter and landing page strategist.
You receive a landing page JSON and a merchant instruction.

STEP 1 — DECIDE SCOPE:
- PARTIAL: instruction targets ≤ 3 specific sections (e.g. "change the hero headline",
  "update button color", "rewrite the features list", "fix the CTA text").
- FULL: instruction requires changes across 4+ sections (e.g. "change the entire tone",
  "translate everything to English", "rewrite for a different audience", "make it shorter").

STEP 2 — RESPOND with EXACTLY this JSON schema. Nothing else. No explanation outside JSON:

{
  "type": "PARTIAL" | "FULL",
  "message": "<short Arabic summary of what you changed>",
  "patches": [
    { "sectionType": "<exact section type string>", "content": { <complete updated section object> } }
  ] | null,
  "fullContent": { <complete updated page JSON> } | null
}

RULES:
- type=PARTIAL → patches must be a non-empty array, fullContent must be null.
- type=FULL    → fullContent must be the complete page JSON, patches must be null.
- In patches: include ONLY the sections that actually changed. Include ALL fields of each updated section (not just the changed field).
- Never add or remove sections. Never change section types or field names. Only change values.
- Keep the language and tone consistent with the existing content.
- Respond ONLY with the JSON object. No markdown fences, no explanation.`;

  const conversationBlock = buildConversationBlock(params.conversationHistory);

  const userPrompt = `Instruction: ${params.instruction}

Page sections:
${sectionMap}

Full page content:
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

// ─── Legacy alias (kept for any external callers) ─────────────
/** @deprecated Use buildSurgicalRefinePrompt instead */
export function buildFullRefinePrompt(params: {
  instruction: string;
  currentContent: Record<string, any>;
  conversationHistory?: ConversationMessage[];
}): { systemPrompt: string; userPrompt: string } {
  return buildSurgicalRefinePrompt(params);
}
