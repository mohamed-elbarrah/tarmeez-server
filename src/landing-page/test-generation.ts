/**
 * Manual test script — run directly via ts-node (no BullMQ, no DB).
 *
 * Usage:
 *   cd server
 *   npx ts-node -r tsconfig-paths/register src/landing-page/test-generation.ts
 *
 * Prints:
 *   1. Full DNA (copywritingAngle, primaryHook, hookVariants)
 *   2. Section plan with complexity per section
 *   3. Hero section headline + subheadline
 *   4. Generation metrics (calls, duration)
 */

// Load .env before anything else (works when cwd = server/)
import * as dotenv from 'dotenv';
dotenv.config();

import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  buildAnalysisPlanSystemPrompt,
  buildAnalysisPlanUserPrompt,
  buildBatchSectionSystemPrompt,
  buildBatchSectionUserPrompt,
} from './prompts';
import type {
  AnalysisAndPlanResult,
  PageDNA,
  SectionPlan,
  LightSectionsContext,
} from './prompts/types';

// ─── Test payload ─────────────────────────────────────────────
const TEST_INPUT = {
  prompt:
    'منتج مكمل غذائي لتحسين النوم للأمهات الجدد اللواتي يعانين من الأرق بسبب رعاية الأطفال، طبيعي 100%، يبدأ مفعوله خلال 20 دقيقة',
  language: 'ar',
  tone: 'friendly',
};

// ─── Helpers ──────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('❌  GEMINI_API_KEY env variable is not set.');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

async function callGemini(
  systemInstruction: string,
  userPrompt: string,
  temperature: number,
  maxOutputTokens: number,
): Promise<string> {
  await new Promise((r) => setTimeout(r, 2000));
  const combined =
    systemInstruction +
    '\n\n' +
    userPrompt +
    '\n\nRespond ONLY with a raw JSON object. No markdown, no code blocks.';

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: combined }] }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generationConfig: {
      temperature,
      maxOutputTokens,
      // Disable thinking — thinking tokens consume the output budget,
      // leaving too few tokens for actual JSON content (Arabic text is token-heavy)
      thinkingConfig: { thinkingBudget: 0 },
    } as any,
  });
  return result.response.text();
}

function parseJSON(raw: string, ctx: string): unknown {
  const t = raw.trim();
  try {
    return JSON.parse(t);
  } catch {
    /* */
  }
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* */
    }
  }
  const obj = t.match(/\{[\s\S]*\}/);
  if (obj) {
    try {
      return JSON.parse(obj[0]);
    } catch {
      /* */
    }
  }
  console.error(
    `\n[${ctx}] length=${t.length} | last 200 chars:\n${t.slice(-200)}\n`,
  );
  throw new Error(`[${ctx}] Cannot parse JSON`);
}

// ─── Main ─────────────────────────────────────────────────────

async function main() {
  console.log('\n════════════════════════════════════════════════');
  console.log('  Landing Page Generation Test');
  console.log('════════════════════════════════════════════════');
  console.log(`Prompt (ar): ${TEST_INPUT.prompt}\n`);

  const startTime = Date.now();

  // ── Call 1: Analyze + Plan ──────────────────────────────────
  console.log('▶  Call 1 — Analyze + Plan...');
  const sysPlan = buildAnalysisPlanSystemPrompt();
  const userPlan = buildAnalysisPlanUserPrompt({
    merchantPrompt: TEST_INPUT.prompt,
    language: TEST_INPUT.language,
    tone: TEST_INPUT.tone,
  });
  const rawPlan = await callGemini(sysPlan, userPlan, 0.4, 2500);
  const parsed = parseJSON(rawPlan, 'analysis-plan') as AnalysisAndPlanResult;

  const dna: PageDNA = parsed.dna;
  const sections: SectionPlan[] = parsed.plan?.selectedSections ?? [];

  console.log('\n════════════ 1. DNA ════════════');
  console.log(`copywritingAngle : ${dna.copywritingAngle}`);
  console.log(`brandPersonality : ${dna.brandPersonality}`);
  console.log(`primaryHook      : ${dna.primaryHook}`);
  if (dna.hookVariants) {
    console.log(`hookVariants[0]  : ${dna.hookVariants[0]}`);
    console.log(`hookVariants[1]  : ${dna.hookVariants[1]}`);
    console.log(`hookVariants[2]  : ${dna.hookVariants[2]}`);
  }
  console.log(`targetAudience   : ${dna.targetAudience}`);
  console.log(`primaryPainPoints: ${dna.primaryPainPoints?.join(' | ')}`);
  console.log(`keyBenefits      : ${dna.keyBenefits?.join(' | ')}`);
  console.log(`uniqueSellingPoint: ${dna.uniqueSellingPoint}`);

  console.log('\n════════════ 2. Section Plan ════════════');
  for (const s of sections) {
    const flag = s.complexity === 'heavy' ? '⚡' : '💡';
    console.log(
      `  ${flag}  [${s.complexity}] ${String(s.order).padStart(2, '0')}. ${s.type}`,
    );
  }

  // ── Identify light/heavy types ──────────────────────────────
  const lightTypes = sections
    .filter((s) => s.complexity === 'light')
    .map((s) => s.type);
  const heavyTypes = sections
    .filter((s) => s.complexity === 'heavy')
    .map((s) => s.type);

  // ── Call 2: Light Sections ──────────────────────────────────
  console.log(`\n▶  Call 2 — Light sections: [${lightTypes.join(', ')}]...`);
  const sysLight = buildBatchSectionSystemPrompt(
    lightTypes,
    TEST_INPUT.language,
    dna,
  );
  const userLight = buildBatchSectionUserPrompt(
    lightTypes,
    dna,
    {},
    TEST_INPUT.language,
    TEST_INPUT.tone,
  );
  const rawLight = await callGemini(sysLight, userLight, 0.5, 3000);
  const parsedLight = parseJSON(rawLight, 'light-batch') as Record<
    string,
    unknown
  >;
  const lightSections: unknown[] = Array.isArray(parsedLight)
    ? parsedLight
    : Array.isArray(parsedLight.sections)
      ? (parsedLight.sections as unknown[])
      : [];
  console.log(`  ✓ Got ${lightSections.length} light sections`);

  // ── Build LightSectionsContext (minimal) ────────────────────
  const lightContext: LightSectionsContext = {
    generatedTypes: lightTypes,
    mainTheme: dna.primaryHook,
    toneEstablished: dna.brandPersonality,
    keyBenefitsMentioned: (dna.keyBenefits ?? []).slice(0, 3),
  };

  // ── Call 3: Heavy Sections ──────────────────────────────────
  console.log(`\n▶  Call 3 — Heavy sections: [${heavyTypes.join(', ')}]...`);
  const sysHeavy = buildBatchSectionSystemPrompt(
    heavyTypes,
    TEST_INPUT.language,
    dna,
  );
  const userHeavy = buildBatchSectionUserPrompt(
    heavyTypes,
    dna,
    {},
    TEST_INPUT.language,
    TEST_INPUT.tone,
    lightContext,
  );
  const rawHeavy = await callGemini(sysHeavy, userHeavy, 0.7, 4000);
  const parsedHeavy = parseJSON(rawHeavy, 'heavy-batch') as Record<
    string,
    unknown
  >;
  const heavySections: unknown[] = Array.isArray(parsedHeavy)
    ? parsedHeavy
    : Array.isArray(parsedHeavy.sections)
      ? (parsedHeavy.sections as unknown[])
      : [];
  console.log(`  ✓ Got ${heavySections.length} heavy sections`);

  // ── Print Hero section ──────────────────────────────────────
  const allSections = [...lightSections, ...heavySections];
  const heroSection = allSections.find(
    (s) => (s as Record<string, unknown>).type === 'hero',
  ) as Record<string, unknown> | undefined;

  console.log('\n════════════ 3. Hero Section ════════════');
  if (heroSection) {
    console.log(`  headline    : ${heroSection.headline}`);
    console.log(`  subheadline : ${heroSection.subheadline}`);
    console.log(`  ctaText     : ${heroSection.ctaText}`);
  } else {
    console.log('  (hero not found in heavy batch output)');
  }

  // ── Metrics ────────────────────────────────────────────────
  const durationMs = Date.now() - startTime;
  const totalSections = lightSections.length + heavySections.length;
  const oldCallCount = totalSections + 2;

  console.log('\n════════════ 4. Metrics ════════════');
  console.log(`  calls        : 3 (vs ${oldCallCount} in old system)`);
  console.log(
    `  sections     : ${totalSections} (light=${lightSections.length}, heavy=${heavySections.length})`,
  );
  console.log(`  duration     : ${durationMs}ms`);
  console.log(`  (includes 3× 2s rate-limit delay = ~6s minimum)\n`);

  // ── Forbidden phrase check ──────────────────────────────────
  const FORBIDDEN = [
    'high quality',
    'جودة عالية',
    'best in class',
    'الأفضل في فئته',
    'revolutionary',
    'ثوري',
    'innovative solution',
    'حل مبتكر',
    'seamlessly',
    'بسلاسة',
  ];
  const allText = JSON.stringify(allSections).toLowerCase();
  const found = FORBIDDEN.filter((f) => allText.includes(f.toLowerCase()));
  if (found.length > 0) {
    console.log(`⚠️  FORBIDDEN PHRASES DETECTED: ${found.join(', ')}`);
  } else {
    console.log('✅  No forbidden phrases detected.');
  }

  console.log('════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
