import type { ProductContext } from './types';

// ─── Combined Analyze + Plan Prompt (Call 1) ─────────────────
// Replaces the separate analyzer.prompt.ts + planner.prompt.ts calls
// with a single, richer prompt that returns DNA + page plan together.

// Complexity classification for each canonical section
const SECTION_COMPLEXITY: Record<string, 'light' | 'heavy'> = {
  hero: 'heavy', // Above-the-fold, most critical — deep creativity needed
  problem: 'heavy', // Emotional agitation — requires nuanced copywriting
  solution: 'heavy', // Product narrative — must connect to hook
  features: 'light', // Structured list — minimal narrative required
  benefits: 'light', // Outcome bullets — templated format
  gallery: 'light', // Placeholder images, short captions
  useCases: 'light', // Persona list — structured and repetitive
  comparison: 'light', // Table-like format — structured
  trust: 'light', // Stats + badges — mostly factual
  testimonials: 'heavy', // Realistic quotes — requires creative voice
  offer: 'heavy', // Pricing + CTA — high-stakes copy
  faq: 'light', // Q&A format — structured
  finalCta: 'heavy', // Closing emotional punch — requires hook alignment
};

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
  hero: 'Above-the-fold headline + CTA. ALWAYS required. [heavy]',
  problem: "Agitate the visitor's pain before the solution. [heavy]",
  solution: 'Introduce the product as the answer to pain. [heavy]',
  features: 'List specific product features with icons. [light]',
  benefits: 'Transform features into customer outcomes. [light]',
  gallery: 'Visual showcase — use when appearance matters. [light]',
  useCases: 'Show who uses the product and how. [light]',
  comparison: 'Before/after or vs-competitor contrast. [light]',
  trust: 'Stats, certifications, partner logos. [light]',
  testimonials: 'Social proof via realistic quotes. [heavy]',
  offer: 'Pricing and purchase CTA. ALWAYS required. [heavy]',
  faq: 'Answer objections. For high-consideration purchases. [light]',
  finalCta: 'Closing call to action. ALWAYS required. [heavy]',
};

export interface AnalysisPlanInput extends ProductContext {
  merchantPrompt: string;
  language: string;
  tone: string;
}

export function buildAnalysisPlanSystemPrompt(): string {
  const sectionList = CANONICAL_SECTIONS.map(
    (s) => `  - "${s}" [${SECTION_COMPLEXITY[s]}]: ${SECTION_DESCRIPTIONS[s]}`,
  ).join('\n');

  return `You are simultaneously a market researcher AND a conversion strategist specializing in e-commerce landing pages.

Your analysis must answer one core question:
"What is the single most powerful reason someone would buy this product?"
Everything else builds around that answer.

Your task: In a SINGLE response, analyze the product AND design the optimal landing page.

You MUST respond with ONLY valid JSON matching this EXACT structure — no markdown, no explanations:
{
  "dna": {
    "targetAudience": "concise description of ideal buyer (1-2 sentences)",
    "primaryPainPoints": ["pain 1", "pain 2", "pain 3"],
    "copywritingAngle": "fear_of_missing_out | transformation | social_proof | urgency | aspiration | problem_agitation",
    "brandPersonality": "luxury | playful | professional | urgent | friendly",
    "primaryHook": "the ONE sentence the entire page builds upon — specific, emotional, in the user's language",
    "hookVariants": [
      "short form of the hook — under 8 words, punchy",
      "question form — makes the reader pause and think",
      "problem-first form — opens with the pain before the promise"
    ],
    "emotionalTriggers": ["one or more of: trust|urgency|social_proof|status|safety|savings|convenience|aspiration"],
    "keyBenefits": ["benefit 1", "benefit 2", "benefit 3", "benefit 4"],
    "uniqueSellingPoint": "the single most compelling reason to buy (1 sentence)"
  },
  "plan": {
    "selectedSections": [
      {
        "type": "hero",
        "order": 1,
        "complexity": "heavy",
        "reason": "why this section is essential for this specific product"
      }
    ]
  }
}

Available sections (you choose which to include):
${sectionList}

MANDATORY sections — ALWAYS include all four: "hero", "features", "offer", "finalCta".
Select minimum 6 sections total, recommended 6–10.
"selectedSections" MUST be sorted by canonical order as listed above.
"complexity" must match exactly: use "heavy" for hero/problem/solution/testimonials/offer/finalCta, "light" for everything else.
"order" is 1-based position in the page.

COPYWRITING ANGLE SELECTION RULES — choose based on these signals:
- transformation: product changes user's life, routine, or appearance
- fear_of_missing_out: product is limited, trending, or competitive market
- social_proof: product success depends on community/validation/results
- urgency: problem gets measurably worse without immediate action
- aspiration: product connects to identity, status, or self-image
- problem_agitation: pain point is strong, specific, and daily

primaryHook rules — write it as a human would say it, not a marketer:
  BAD: "Revolutionary solution for better sleep quality"
  BAD: "The best sleep supplement for modern lifestyles"
  GOOD: "You've tried everything for sleep. This is different."
  GOOD: "The only supplement built for the 3am feeding schedule"
The hook MUST be written in the SAME LANGUAGE as the merchant's description.

hookVariants rules:
  - [0] short form: strip to the emotional core, ≤8 words
  - [1] question form: rewrite as a question that creates curiosity or recognition
  - [2] problem-first: start with the pain, end with implied relief
  All three must be in the same language as primaryHook.

NEVER use generic phrases: "high quality", "best in class", "premium", "amazing", "great", "innovative", "revolutionary"
emotionalTriggers: 1–4 items from the allowed list.
primaryPainPoints: 3–5 items.
keyBenefits: 3–6 items.

Return ONLY the JSON object.`;
}

export function buildAnalysisPlanUserPrompt(input: AnalysisPlanInput): string {
  const lang = input.language === 'ar' ? 'Arabic-speaking' : 'English-speaking';

  const lines: string[] = [
    `Analyze this product and design the landing page for a ${lang} audience.`,
    `Merchant's tone preference: ${input.tone}`,
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

  lines.push('');
  lines.push(
    'Respond ONLY with the JSON. The primaryHook must be so specific and compelling it could appear verbatim as the hero headline.',
  );

  return lines.join('\n');
}
