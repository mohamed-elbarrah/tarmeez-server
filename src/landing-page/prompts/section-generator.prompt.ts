import type { SectionGenerationContext } from './types';

// ─── Step 3: Per-Section Generator Prompt ────────────────────

/**
 * Exact JSON schema expected for each section type.
 * These are embedded verbatim in the AI prompt so the model
 * knows the exact output shape with no guessing.
 */
const SECTION_SCHEMAS: Record<string, string> = {
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
