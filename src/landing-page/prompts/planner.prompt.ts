import type { ProductAnalysis } from './types';

// ─── Step 2: Page Planner Prompt ─────────────────────────────

const CANONICAL_SECTIONS = [
  'hero',
  'problem',
  'solution',
  'features',
  'benefits',
  'gallery',
  'useCases',
  'comparison',
  'trust',
  'testimonials',
  'offer',
  'faq',
  'finalCta',
] as const;

const SECTION_DESCRIPTIONS: Record<string, string> = {
  hero: 'Above-the-fold headline + CTA. ALWAYS required.',
  problem: "Agitate the visitor's pain before presenting the solution.",
  solution: 'Introduce the product as the answer to the pain.',
  features: 'List specific product features with icons.',
  benefits: 'Transform features into customer outcomes.',
  gallery:
    'Visual showcase of the product. Use when product appearance matters.',
  useCases:
    'Show who uses the product and how. Good for multi-persona products.',
  comparison:
    "Before/after or vs-competitor. Use when there's a clear status quo.",
  trust:
    'Stats, certifications, partner logos. Use when brand authority needs building.',
  testimonials: 'Social proof via quotes. ALWAYS include if any reviews exist.',
  offer: 'Pricing and purchase CTA. ALWAYS required.',
  faq: 'Answer objections. Include for high-consideration purchases.',
  finalCta: 'Closing call to action. ALWAYS required.',
};

export function buildPlannerSystemPrompt(): string {
  const sectionList = CANONICAL_SECTIONS.map(
    (s) => `  - "${s}": ${SECTION_DESCRIPTIONS[s]}`,
  ).join('\n');

  return `You are a senior conversion rate optimization (CRO) expert.

Your task: Given a product analysis, select the optimal subset of landing page sections and their order.

Available sections and their purpose:
${sectionList}

You MUST respond with ONLY valid JSON:
{
  "selectedSections": ["hero", "problem", ...],
  "reasoning": "brief explanation of choices (optional)"
}

Rules:
- MANDATORY sections — ALWAYS include all four: "hero", "features", "offer", "finalCta".
- "selectedSections" must be in the canonical order shown above.
- You MUST select a minimum of 6 sections. Fewer than 6 is INVALID.
- You SHOULD select 6–10 sections total (never all 13 unless all add real value).
- The 2+ optional sections beyond the 4 mandatory ones should be chosen from:
  - "testimonials" — highly recommended for social proof (add by default).
  - "problem" — when the product solves a clear pain.
  - "faq" — for high-consideration or higher-priced products.
  - "trust" — when brand authority needs building.
  - "comparison" — when there is a clear before/after or competitor context.
  - "solution", "benefits", "useCases", "gallery" — when relevant.
- Omit sections that genuinely add no conversion value for this specific product.
- Return ONLY the JSON object.`;
}

export function buildPlannerUserPrompt(
  analysis: ProductAnalysis,
  language: string,
  tone: string,
): string {
  return `Create the optimal page plan for this product.

Language: ${language === 'ar' ? 'Arabic' : 'English'}
Tone: ${tone}

Product Analysis:
- Target Audience: ${analysis.targetAudience}
- Category: ${analysis.productCategory}
- Pain Points: ${analysis.primaryPainPoints.join(', ')}
- Key Benefits: ${analysis.keyBenefits.join(', ')}
- USP: ${analysis.uniqueSellingPoint}
- Emotional Triggers: ${analysis.emotionalTriggers.join(', ')}`;
}
