/**
 * Manual test script for the Refine endpoint — no BullMQ, no DB, no NestJS.
 * Tests all three refine scopes directly against the Gemini API.
 *
 * Usage:
 *   cd server
 *   npx ts-node -r tsconfig-paths/register src/landing-page/test-refine.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  buildFullRefinePrompt,
  buildSectionRefinePrompt,
  buildFieldRefinePrompt,
} from './prompts/refine.prompt';
import type { RefineScope } from './dto/refine-page.dto';

// ─── Mock page content (sleep supplement product) ────────────

const MOCK_PAGE_CONTENT = {
  sections: [
    {
      type: 'hero',
      headline: 'نوم عميق لأمهات لا يعرفن الراحة',
      subheadline:
        'مكمل طبيعي 100% يبدأ مفعوله خلال 20 دقيقة — مصمم لمن تقضي الليل مستيقظة',
      ctaText: 'جربي الآن',
      backgroundStyle: 'gradient',
      alignment: 'center',
      badgeText: 'طبيعي 100%',
    },
    {
      type: 'features',
      headline: 'لماذا تختاره الأمهات',
      description: 'تركيبة دقيقة تناسب احتياجات الأم في مرحلة الرضاعة',
      features: [
        {
          icon: '🌿',
          title: 'مكونات طبيعية',
          description: 'خالٍ من الكيماويات والمواد الصناعية',
        },
        {
          icon: '⚡',
          title: 'سريع المفعول',
          description: 'تشعرين بالفرق خلال 20 دقيقة فقط',
        },
        {
          icon: '🤱',
          title: 'آمن أثناء الرضاعة',
          description: 'مراجع طبياً ومعتمد للاستخدام الآمن',
        },
        {
          icon: '💊',
          title: 'سهل الاستخدام',
          description: 'قرص واحد قبل النوم بـ30 دقيقة',
        },
      ],
      layout: 'grid',
    },
    {
      type: 'offer',
      headline: 'ابدئي رحلتك نحو نوم هادئ',
      price: '149 ريال',
      originalPrice: '199 ريال',
      ctaText: 'اطلبي الآن',
      guarantee: 'ضمان استرداد كامل خلال 30 يوم',
      urgencyText: 'عرض محدود — الكمية تنفد بسرعة',
    },
    {
      type: 'finalCta',
      headline: 'لأنك تستحقين ليلة هادئة',
      subheadline: 'انضمي لآلاف الأمهات اللواتي استعدن نومهن',
      ctaText: 'ابدئي الآن',
    },
  ],
};

// ─── Gemini helpers ──────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('❌  GEMINI_API_KEY env variable is not set.');
  process.exit(1);
}

const MODEL_NAME = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const TOKEN_LIMITS: Record<
  RefineScope,
  { maxOutputTokens: number; temperature: number }
> = {
  full: { maxOutputTokens: 4000, temperature: 0.6 },
  section: { maxOutputTokens: 1500, temperature: 0.7 },
  field: { maxOutputTokens: 300, temperature: 0.8 },
};

async function callGeminiRefine(
  systemPrompt: string,
  userPrompt: string,
  scope: RefineScope,
  attempt = 1,
): Promise<string> {
  const { maxOutputTokens, temperature } = TOKEN_LIMITS[scope];
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const combinedPrompt =
    systemPrompt +
    '\n\n' +
    userPrompt +
    '\n\nRespond ONLY with raw JSON. No markdown, no code blocks, no explanations.';

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: combinedPrompt }] }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      generationConfig: {
        temperature,
        maxOutputTokens,
        thinkingConfig: { thinkingBudget: 0 },
      } as any,
    });

    return result.response.text();
  } catch (err: any) {
    const is503 =
      err?.message?.includes('503') ||
      err?.message?.includes('Service Unavailable');

    if (is503 && attempt <= 4) {
      const delay = attempt * 8000; // 8s, 16s, 24s, 32s
      console.log(
        `  ⚠️  503 from API (attempt ${attempt}), retrying in ${delay / 1000}s...`,
      );
      await new Promise((r) => setTimeout(r, delay));
      return callGeminiRefine(systemPrompt, userPrompt, scope, attempt + 1);
    }

    throw err;
  }
}

function parseResponse(raw: string, context: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* */
    }
  }
  const obj = trimmed.match(/\{[\s\S]*\}/);
  if (obj) {
    try {
      return JSON.parse(obj[0]);
    } catch {
      /* */
    }
  }
  throw new Error(`[${context}] Cannot parse response as JSON`);
}

function printSeparator(title: string) {
  console.log('\n' + '═'.repeat(60) + '\n  ' + title + '\n' + '═'.repeat(60));
}

// ─── Test 1: Field scope ─────────────────────────────────────

async function testFieldScope() {
  printSeparator('TEST 1 — scope: field');
  console.log('Section: hero | Field: headline');
  console.log('Instruction: "make it more emotional and urgent"');

  const heroSection = (MOCK_PAGE_CONTENT.sections as any[]).find(
    (s) => s.type === 'hero',
  );
  const currentFieldValue = heroSection?.headline;

  console.log(`\nCurrent value: "${currentFieldValue}"`);

  const start = Date.now();

  const { systemPrompt, userPrompt } = buildFieldRefinePrompt({
    instruction: 'make it more emotional and urgent',
    sectionType: 'hero',
    fieldPath: 'headline',
    currentFieldValue,
  });

  const raw = await callGeminiRefine(systemPrompt, userPrompt, 'field');
  const duration = Date.now() - start;

  let newValue: unknown;
  try {
    newValue = JSON.parse(raw.trim());
  } catch {
    newValue = raw.trim();
  }

  console.log(`\n✅  New value: ${JSON.stringify(newValue)}`);
  console.log(`⏱   Duration: ${duration}ms`);

  if (duration > 8000) {
    console.warn('⚠️  WARNING: field scope took > 8 seconds');
  } else {
    console.log('✓  Under 8-second threshold');
  }

  return duration;
}

// ─── Test 2: Section scope ───────────────────────────────────

async function testSectionScope() {
  printSeparator('TEST 2 — scope: section');
  console.log('Section: features');
  console.log(
    'Instruction: "rewrite all features to focus on what the mother feels, not what the product does"',
  );

  const featuresSection = (MOCK_PAGE_CONTENT.sections as any[]).find(
    (s) => s.type === 'features',
  );

  const start = Date.now();

  const { systemPrompt, userPrompt } = buildSectionRefinePrompt({
    instruction:
      'rewrite all features to focus on what the mother feels, not what the product does',
    sectionType: 'features',
    currentSectionContent: featuresSection,
  });

  const raw = await callGeminiRefine(systemPrompt, userPrompt, 'section');
  const duration = Date.now() - start;

  let parsed: unknown;
  try {
    parsed = parseResponse(raw, 'section:features');
    console.log('\n✅  Updated section (features):');
    console.log(JSON.stringify(parsed, null, 2));
  } catch (err: any) {
    console.error(`\n❌  Parse failed: ${err.message}`);
    console.log('Raw response (last 300 chars):', raw.slice(-300));
  }

  console.log(`\n⏱   Duration: ${duration}ms`);

  if (duration > 15000) {
    console.warn('⚠️  WARNING: section scope took > 15 seconds');
  } else {
    console.log('✓  Under 15-second threshold');
  }

  return duration;
}

// ─── Test 3: Full scope ──────────────────────────────────────

async function testFullScope() {
  printSeparator('TEST 3 — scope: full');
  console.log(
    'Instruction: "rewrite the entire page with a more premium, scientific tone — less emotional, more credible"',
  );

  const start = Date.now();

  const { systemPrompt, userPrompt } = buildFullRefinePrompt({
    instruction:
      'rewrite the entire page with a more premium, scientific tone — less emotional, more credible',
    currentContent: MOCK_PAGE_CONTENT,
  });

  const raw = await callGeminiRefine(systemPrompt, userPrompt, 'full');
  const duration = Date.now() - start;

  let parsed: unknown;
  try {
    parsed = parseResponse(raw, 'full');
    console.log('\n✅  Updated page sections count:');
    const sections = (parsed as any)?.sections;
    if (Array.isArray(sections)) {
      for (const s of sections) {
        console.log(`  - ${s.type}: headline="${s.headline}"`);
      }
    } else {
      console.log('  (response shape):', Object.keys(parsed as any));
    }
  } catch (err: any) {
    console.error(`\n❌  Parse failed: ${err.message}`);
    console.log('Raw response (last 300 chars):', raw.slice(-300));
  }

  console.log(`\n⏱   Duration: ${duration}ms`);
  return duration;
}

// ─── Main ─────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '█'.repeat(60));
  console.log('  Landing Page Refine — Test Script');
  console.log('  Model: ' + MODEL_NAME);
  console.log('█'.repeat(60));

  try {
    const d1 = await testFieldScope();
    const d2 = await testSectionScope();
    const d3 = await testFullScope();

    printSeparator('SUMMARY');
    console.log(`field   scope: ${d1}ms ${d1 < 8000 ? '✓' : '✗ OVER LIMIT'}`);
    console.log(`section scope: ${d2}ms ${d2 < 15000 ? '✓' : '✗ OVER LIMIT'}`);
    console.log(`full    scope: ${d3}ms`);
    console.log('\n✅  All three refine scopes completed successfully.');
  } catch (err: any) {
    console.error('\n❌  Test failed:', err.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
