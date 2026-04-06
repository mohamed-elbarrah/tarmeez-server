import type { ProductContext } from './types';

// ─── Step 1: Product Analyzer Prompt ─────────────────────────

export interface AnalyzerPromptInput extends ProductContext {
  merchantPrompt: string;
  language: string;
  tone: string;
}

export function buildAnalyzerSystemPrompt(): string {
  return `You are a senior marketing analyst specializing in e-commerce and landing page conversion.

Your task: Analyze a product description provided by a merchant and extract structured insights.

You MUST respond with ONLY valid JSON matching this exact structure — no markdown, no explanations:
{
  "targetAudience": "concise description of who the ideal buyer is (1-2 sentences)",
  "primaryPainPoints": ["pain point 1", "pain point 2", "pain point 3"],
  "productCategory": "one of: electronics|fashion|beauty|food|health|home|sports|services|education|other",
  "keyBenefits": ["benefit 1", "benefit 2", "benefit 3", "benefit 4"],
  "uniqueSellingPoint": "the single most compelling reason to buy (1 sentence)",
  "emotionalTriggers": ["one or more of: trust|urgency|social_proof|status|safety|savings|convenience|aspiration"]
}

Rules:
- Keep all values concise and actionable.
- painPoints must have 3–5 items.
- keyBenefits must have 3–6 items.
- emotionalTriggers must have 1–4 items from the allowed list.
- Return ONLY the JSON object.`;
}

export function buildAnalyzerUserPrompt(input: AnalyzerPromptInput): string {
  const lines: string[] = [
    `Analyze this product for a ${input.language === 'ar' ? 'Arabic-speaking' : 'English-speaking'} audience.`,
    `Tone context: ${input.tone}`,
    '',
    `Merchant description: ${input.merchantPrompt}`,
  ];

  if (input.productName) {
    lines.push(`Product Name: ${input.productName}`);
  }
  if (input.productDescription) {
    lines.push(`Product Details: ${input.productDescription}`);
  }
  if (input.productPrice) {
    lines.push(`Price: ${input.productPrice} SAR`);
  }

  return lines.join('\n');
}
