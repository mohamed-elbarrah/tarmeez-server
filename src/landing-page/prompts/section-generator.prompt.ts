import type {
  PageDNA,
  ProductContext,
  SectionGenerationContext,
  LightSectionsContext,
} from './types';

// ─── Section Generator Prompt — Single & Batch ────────────────
//
// Single-section functions (legacy, still used by old path).
// Batch functions (new): generate multiple sections in one call
// using selective schema injection — only schemas for the requested
// sections are sent, reducing token usage.

/**
 * Exact JSON schema expected for each section type.
 * These are embedded verbatim in the AI prompt so the model
 * knows the exact output shape with no guessing.
 */
export const SECTION_SCHEMAS: Record<string, string> = {
  hero: `{
  "type": "hero",
  "headline": "string — main headline (max 120 chars, highly compelling)",
  "subheadline": "string — supporting text (max 300 chars)",
  "ctaText": "string — button label (max 50 chars, action verb)",
  "backgroundStyle": "gradient" | "image" | "solid",
  "alignment": "center" | "right" | "left",
  "badgeText": "string (optional, e.g. 'New', '#1 Rated', max 60 chars)"
}`,

  problem: `{
  "type": "problem",
  "headline": "string — agitates the pain (max 120 chars)",
  "description": "string (optional — adds context, max 500 chars)",
  "painPoints": [
    { "icon": "emoji or icon name (optional)", "title": "string (max 100)", "description": "string (max 300)" }
  ]
  // painPoints: 3–5 items
}`,

  solution: `{
  "type": "solution",
  "headline": "string — positions product as the answer (max 120 chars)",
  "description": "string — 1–2 sentences introducing the solution (max 500 chars)",
  "points": [
    { "icon": "emoji or icon name (optional)", "title": "string (max 100)", "description": "string (max 300)" }
  ],
  // points: 3–4 items
  "ctaText": "string (optional, max 50 chars)"
}`,

  features: `{
  "type": "features",
  "headline": "string (max 120 chars)",
  "description": "string (optional, max 500 chars)",
  "features": [
    { "icon": "emoji or icon name (optional)", "title": "string (max 100)", "description": "string (max 300)" }
  ],
  // features: 4–8 items
  "layout": "grid" | "list" | "alternating"
}`,

  benefits: `{
  "type": "benefits",
  "headline": "string — outcome-focused (max 120 chars)",
  "description": "string (optional, max 500 chars)",
  "benefits": [
    { "icon": "emoji or icon name (optional)", "title": "string (max 100)", "description": "string (max 300)" }
  ]
  // benefits: 3–6 items
}`,

  gallery: `{
  "type": "gallery",
  "headline": "string (max 120 chars)",
  "description": "string (optional, max 300 chars)",
  "images": [
    { "src": "/placeholder/product-1.jpg", "alt": "descriptive alt text", "caption": "string (optional)" }
  ],
  // images: 3–6 items, use /placeholder/product-N.jpg paths
  "layout": "grid" | "carousel" | "masonry"
}`,

  useCases: `{
  "type": "useCases",
  "headline": "string (max 120 chars)",
  "description": "string (optional, max 500 chars)",
  "cases": [
    {
      "icon": "emoji or icon name (optional)",
      "title": "string — use case name (max 100)",
      "description": "string — how this persona benefits (max 400)",
      "persona": "string — who this is for (optional, max 100)"
    }
  ]
  // cases: 2–5 items
}`,

  comparison: `{
  "type": "comparison",
  "headline": "string — sets up the contrast (max 120 chars)",
  "description": "string (optional, max 500 chars)",
  "mode": "before_after" | "vs_competitor" | "table",
  "items": [
    { "label": "string — aspect being compared", "before": "string — old/competitor state", "after": "string — with this product" }
  ]
  // items: 3–6 items
}`,

  trust: `{
  "type": "trust",
  "headline": "string — builds credibility (max 120 chars)",
  "stats": [
    { "value": "string — e.g. '10,000+'", "label": "string — e.g. 'Happy Customers'" }
  ],
  // stats: up to 4 items (optional)
  "badges": [
    { "icon": "emoji or icon name (optional)", "label": "string — e.g. 'Secure Payment'" }
  ],
  // badges: up to 6 items (optional)
  "partners": ["string (logo path or partner name)"]
  // partners: optional
}`,

  testimonials: `{
  "type": "testimonials",
  "headline": "string (max 120 chars)",
  "testimonials": [
    {
      "quote": "string — realistic customer quote (max 500 chars)",
      "authorName": "string — first name + last initial (max 100)",
      "authorTitle": "string (optional, e.g. 'Business Owner', max 100)",
      "rating": 5
    }
  ],
  // testimonials: 3–6 items
  "layout": "grid" | "carousel" | "stacked"
}`,

  offer: `{
  "type": "offer",
  "headline": "string — value-packed offer headline (max 120 chars)",
  "description": "string (optional, max 500 chars)",
  "price": "string — e.g. '299'",
  "originalPrice": "string (optional — for showing discount, e.g. '499')",
  "currency": "SAR",
  "ctaText": "string — purchase CTA (max 50 chars)",
  "urgencyText": "string (optional — scarcity or deadline, max 200 chars)",
  "bulletPoints": ["string — what's included (max 200 chars each)"]
  // bulletPoints: 3–7 items
}`,

  faq: `{
  "type": "faq",
  "headline": "string (max 120 chars)",
  "description": "string (optional, max 300 chars)",
  "questions": [
    {
      "question": "string — common objection as a question (max 300)",
      "answer": "string — clear, reassuring answer (max 1000)"
    }
  ]
  // questions: 4–8 items
}`,

  finalCta: `{
  "type": "finalCta",
  "headline": "string — closing, urgency-driven headline (max 120 chars)",
  "subheadline": "string (optional, max 300 chars)",
  "ctaText": "string — final button label (max 50 chars)",
  "guaranteeText": "string (optional — risk reversal, e.g. '30-day money-back', max 300)"
}`,
};

// ─── Prompt Builders ─────────────────────────────────────────

export function buildSectionGeneratorSystemPrompt(
  sectionType: string,
  language: string,
): string {
  const schema = SECTION_SCHEMAS[sectionType];
  if (!schema) {
    throw new Error(`Unknown section type: ${sectionType}`);
  }

  const lang = language === 'ar' ? 'Arabic' : 'English';

  return `You are an expert landing page copywriter.

Your task: Generate the content for a single landing page section of type "${sectionType}".

You MUST respond with ONLY valid JSON matching this exact schema (comments are explanatory, not part of JSON):
${schema}

Strict rules:
- Return ONLY the JSON object — no markdown, no code blocks, no explanation.
- All text content must be written in ${lang}.
- Make copy persuasive, specific, and conversion-focused.
- Never use generic placeholder text like "Lorem ipsum".
- Icons field: use relevant emoji (e.g. "✅", "🚀") or leave as null.`;
}

export function buildSectionGeneratorUserPrompt(
  ctx: SectionGenerationContext,
): string {
  const lines: string[] = [
    `Generate the "${ctx.sectionType}" section for the following product.`,
    '',
    `Target Audience: ${ctx.analysis.targetAudience}`,
    `Pain Points: ${ctx.analysis.primaryPainPoints.join(', ')}`,
    `Key Benefits: ${ctx.analysis.keyBenefits.join(', ')}`,
    `USP: ${ctx.analysis.uniqueSellingPoint}`,
    `Emotional Triggers: ${ctx.analysis.emotionalTriggers.join(', ')}`,
    `Tone: ${ctx.tone}`,
  ];

  if (ctx.productName) {
    lines.push(`Product Name: ${ctx.productName}`);
  }
  if (ctx.productDescription) {
    lines.push(`Product Description: ${ctx.productDescription}`);
  }
  if (ctx.productPrice) {
    lines.push(`Price: ${ctx.productPrice} SAR`);
  }

  return lines.join('\n');
}

// ─── Batch Prompt Builders (new 3-call architecture) ─────────

/**
 * Builds the system prompt for a batch of sections.
 * Only sends schemas for the specific sections in the batch,
 * reducing token overhead dramatically vs sending all 13 schemas.
 */
export function buildBatchSectionSystemPrompt(
  sectionTypes: string[],
  language: string,
  dna: PageDNA,
): string {
  const lang = language === 'ar' ? 'Arabic' : 'English';

  // Selective schema: only include schemas for requested sections
  const schemasBlock = sectionTypes
    .filter((t) => SECTION_SCHEMAS[t])
    .map((t) => `--- Section: "${t}" ---\n${SECTION_SCHEMAS[t]}`)
    .join('\n\n');

  // Section-specific rules — only include rules for sections in this batch
  const relevantSectionRules = buildSectionSpecificRules(sectionTypes);

  return `You are a world-class conversion copywriter generating landing page content.

BRAND CONTEXT (apply to every word you write):
- Copywriting angle: ${dna.copywritingAngle.replace(/_/g, ' ')}
- Brand personality: ${dna.brandPersonality}
- Primary hook to build upon: "${dna.primaryHook}"
- Target audience: ${dna.targetAudience}
- Core USP: ${dna.uniqueSellingPoint}

COPYWRITING RULES (non-negotiable):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Every headline must create curiosity OR promise transformation.
   Never state features as headlines.
   ✗ "High Quality Materials"
   ✓ "Built to outlast every alternative you've tried"

2. Body text must speak to ONE person, not a crowd.
   ✗ "Customers love our product"
   ✓ "If you've spent months searching for something that actually works"

3. Apply the [${dna.copywritingAngle.replace(/_/g, ' ')}] framework throughout.
   Every section must feel like it's written by the same voice.

4. The primaryHook "${dna.primaryHook}" must echo in at least
   one element of each section (not copy-paste, but the same idea).

5. FORBIDDEN phrases (will cause rejection):
   - "high quality" / "جودة عالية"
   - "best in class" / "الأفضل في فئته"
   - "revolutionary" / "ثوري"
   - "innovative solution" / "حل مبتكر"
   - "seamlessly" / "بسلاسة"
   - Any generic superlative without specific proof

6. Numbers and specifics beat adjectives always.
   ✗ "saves you a lot of time"
   ✓ "saves 2 hours every morning"

Write in ${lang}. Make copy specific, emotionally resonant, and conversion-focused.
${relevantSectionRules}
YOUR TASK:
Generate content for ${sectionTypes.length} landing page section(s): ${sectionTypes.map((t) => `"${t}"`).join(', ')}.

Return a JSON object with a "sections" array containing ONE object per section, in this order: ${sectionTypes.map((t) => `"${t}"`).join(', ')}.

Response format:
{
  "sections": [
    <section object 1>,
    <section object 2>,
    ...
  ]
}

Exact schema for each section (comments are explanatory, not JSON):
${schemasBlock}

STRICT RULES:
- Return ONLY the JSON object — no markdown, no code blocks, no explanation.
- "sections" array must contain exactly ${sectionTypes.length} object(s).
- Each section object must include its "type" field matching the schema.
- Icons: use relevant emoji (e.g. "✅", "🚀") or omit the field.
- Never use placeholder text like "Lorem ipsum".`;
}

/**
 * Builds the user prompt for a batch of sections.
 * For heavy sections, receives a lightweight LightSectionsContext
 * for thematic consistency (~100 tokens max, not full content).
 */
export function buildBatchSectionUserPrompt(
  sectionTypes: string[],
  dna: PageDNA,
  productContext: ProductContext,
  language: string,
  tone: string,
  lightSectionsContext?: LightSectionsContext,
): string {
  const lines: string[] = [
    `Generate ${sectionTypes.length} section(s): ${sectionTypes.map((t) => `"${t}"`).join(', ')}`,
    '',
    `=== PAGE DNA ===`,
    `Pain Points: ${dna.primaryPainPoints.join(' | ')}`,
    `Key Benefits: ${dna.keyBenefits.join(' | ')}`,
    `Emotional Triggers: ${dna.emotionalTriggers.join(', ')}`,
    `Tone: ${tone}`,
    `Language: ${language === 'ar' ? 'Arabic' : 'English'}`,
  ];

  if (productContext.productName) {
    lines.push(`Product: ${productContext.productName}`);
  }
  if (productContext.productDescription) {
    lines.push(`Description: ${productContext.productDescription}`);
  }
  if (productContext.productPrice) {
    lines.push(`Price: ${productContext.productPrice} SAR`);
  }

  if (lightSectionsContext) {
    lines.push('');
    lines.push(
      '=== CONSISTENCY CONTEXT (light sections already generated) ===',
    );
    lines.push(
      `Generated section types: ${lightSectionsContext.generatedTypes.join(', ')}`,
    );
    lines.push(
      `Central theme established: "${lightSectionsContext.mainTheme}"`,
    );
    lines.push(
      `Voice/tone established: ${lightSectionsContext.toneEstablished}`,
    );
    if (lightSectionsContext.keyBenefitsMentioned.length > 0) {
      lines.push(
        `Benefits already mentioned: ${lightSectionsContext.keyBenefitsMentioned.join(', ')}`,
      );
      lines.push(
        `(avoid repeating these — introduce complementary benefits instead)`,
      );
    }
  }

  lines.push('');
  lines.push(
    'Return the JSON object with the "sections" array now. Make every word earn its place.',
  );

  return lines.join('\n');
}

// ─── Section-Specific Rules Builder ──────────────────────────

/**
 * Returns targeted copywriting rules only for the sections present
 * in the current batch. Injected into the system prompt to avoid
 * sending irrelevant rules for sections not being generated.
 */
function buildSectionSpecificRules(sectionTypes: string[]): string {
  const requested = new Set(sectionTypes);
  const rules: string[] = [];

  if (requested.has('hero')) {
    rules.push(`hero:
  - headline = use hookVariants[0] or improve upon it
  - subheadline explains the transformation in ONE sentence
  - avoid naming the product in the headline if possible`);
  }

  if (requested.has('features')) {
    rules.push(`features:
  - each feature title starts with an action verb (protects, saves, ensures)
  - maximum 6 features — quality over quantity
  - order them: strongest first`);
  }

  if (requested.has('testimonials')) {
    rules.push(`testimonials:
  - each quote tells a micro-story: problem → product → result
  - avoid generic praise ("great product!")
  - add ONE realistic specific detail per testimonial`);
  }

  if (requested.has('faq')) {
    rules.push(`faq:
  - questions must reflect genuine doubts, not marketing questions
  ✗ "What are the product's advantages?"
  ✓ "Does this work if I'm a complete beginner?"`);
  }

  if (requested.has('finalCta') || requested.has('offer')) {
    rules.push(`cta / offer:
  - CTA text describes what happens NEXT, not what to do
  ✗ "Buy Now"
  ✓ "Start Your Experience Today"
  - the section must complete the primaryHook narrative, not restart it`);
  }

  if (rules.length === 0) return '';

  return `
SECTION-SPECIFIC RULES:
━━━━━━━━━━━━━━━━━━━━━━━
${rules.join('\n\n')}

`;
}
