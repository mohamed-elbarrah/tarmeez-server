import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  type GenerativeModel,
} from '@google/generative-ai';
import type {
  AIProvider,
  ProductAnalysis,
  PagePlan,
  ProductContext,
  SectionGenerationContext,
  AnalysisAndPlanResult,
  PageDNA,
  SectionPlan,
  LightSectionsContext,
} from './ai-provider.interface';
import {
  buildAnalyzerSystemPrompt,
  buildAnalyzerUserPrompt,
  buildPlannerSystemPrompt,
  buildPlannerUserPrompt,
  buildSectionGeneratorSystemPrompt,
  buildSectionGeneratorUserPrompt,
  buildAnalysisPlanSystemPrompt,
  buildAnalysisPlanUserPrompt,
  buildBatchSectionSystemPrompt,
  buildBatchSectionUserPrompt,
} from '../prompts';

// Sections that are always required regardless of planner output
const MANDATORY_SECTIONS = new Set(['hero', 'features', 'offer', 'finalCta']);

// Recommended fallback sections added to reach the minimum of 6
const RECOMMENDED_FILL_SECTIONS = ['testimonials', 'problem', 'faq', 'trust'];

const MIN_SECTIONS = 6;

const CANONICAL_ORDER = [
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
];

@Injectable()
export class GeminiProvider implements AIProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private _model: GenerativeModel | null = null;

  constructor(private readonly config: ConfigService) {}

  // ─── Lazy model initialization ─────────────────────────────
  private getModel(): GenerativeModel {
    if (!this._model) {
      const apiKey = this.config.getOrThrow<string>('GEMINI_API_KEY');
      const genAI = new GoogleGenerativeAI(apiKey);
      this._model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    }
    return this._model;
  }

  // ─── Step 1: Analyze ───────────────────────────────────────
  async analyzeProduct(
    merchantPrompt: string,
    context: ProductContext,
    language: string,
    tone: string,
  ): Promise<ProductAnalysis> {
    this.logger.debug('Analyzer: extracting product intelligence...');

    const systemPrompt = buildAnalyzerSystemPrompt();
    const userPrompt = buildAnalyzerUserPrompt({
      merchantPrompt,
      language,
      tone,
      ...context,
    });

    const raw = await this.callGemini(systemPrompt, userPrompt, 0.3);
    const parsed = this.parseJSON(raw, 'analyzer');

    return this.validateAnalysis(parsed);
  }

  // ─── Step 2: Plan ──────────────────────────────────────────
  async planPage(
    analysis: ProductAnalysis,
    language: string,
    tone: string,
  ): Promise<PagePlan> {
    this.logger.debug('Planner: selecting sections...');

    const systemPrompt = buildPlannerSystemPrompt();
    const userPrompt = buildPlannerUserPrompt(analysis, language, tone);

    const raw = await this.callGemini(systemPrompt, userPrompt, 0.4);
    const parsed = this.parseJSON(raw, 'planner');

    return this.validatePlan(parsed);
  }

  // ─── Step 3: Generate Section ──────────────────────────────
  async generateSection(ctx: SectionGenerationContext): Promise<unknown> {
    this.logger.debug(`Section generator: "${ctx.sectionType}"...`);

    const systemPrompt = buildSectionGeneratorSystemPrompt(
      ctx.sectionType,
      ctx.language,
    );
    const userPrompt = buildSectionGeneratorUserPrompt(ctx);

    const raw = await this.callGemini(systemPrompt, userPrompt, 0.7);

    return this.parseJSON(raw, `section:${ctx.sectionType}`);
  }

  // ─── Call 1: Combined Analyze + Plan ───────────────────────
  async generateAnalysisAndPlan(
    merchantPrompt: string,
    context: ProductContext,
    language: string,
    tone: string,
  ): Promise<AnalysisAndPlanResult> {
    this.logger.debug('Call 1: Analyze + Plan (combined)...');

    const systemPrompt = buildAnalysisPlanSystemPrompt();
    const userPrompt = buildAnalysisPlanUserPrompt({
      merchantPrompt,
      language,
      tone,
      ...context,
    });

    // temperature=0.4: creative enough for hook, stable enough for planning
    // maxOutputTokens=2500: Arabic JSON is token-heavy; 1200 truncated responses
    const raw = await this.callGemini(systemPrompt, userPrompt, 0.4, 2500);
    const parsed = this.parseJSON(raw, 'analysis-plan');

    return this.validateAnalysisAndPlan(parsed);
  }

  // ─── Call 2: Generate Light Sections (batch) ───────────────
  async generateLightSections(
    sectionTypes: string[],
    dna: PageDNA,
    context: ProductContext,
    language: string,
    tone: string,
  ): Promise<unknown[]> {
    if (sectionTypes.length === 0) return [];

    this.logger.debug(
      `Call 2: Light sections batch [${sectionTypes.join(', ')}]...`,
    );

    const systemPrompt = buildBatchSectionSystemPrompt(
      sectionTypes,
      language,
      dna,
    );
    const userPrompt = buildBatchSectionUserPrompt(
      sectionTypes,
      dna,
      context,
      language,
      tone,
    );

    const raw = await this.callGemini(systemPrompt, userPrompt, 0.5, 3000);
    const parsed = this.parseJSON(raw, 'light-batch') as Record<
      string,
      unknown
    >;

    return this.extractSectionsFromBatch(parsed, sectionTypes, 'light-batch');
  }

  // ─── Call 3: Generate Heavy Sections (batch) ───────────────
  async generateHeavySections(
    sectionTypes: string[],
    dna: PageDNA,
    context: ProductContext,
    language: string,
    tone: string,
    lightSectionsContext?: LightSectionsContext,
  ): Promise<unknown[]> {
    if (sectionTypes.length === 0) return [];

    this.logger.debug(
      `Call 3: Heavy sections batch [${sectionTypes.join(', ')}]...`,
    );

    const systemPrompt = buildBatchSectionSystemPrompt(
      sectionTypes,
      language,
      dna,
    );
    const userPrompt = buildBatchSectionUserPrompt(
      sectionTypes,
      dna,
      context,
      language,
      tone,
      lightSectionsContext,
    );

    // Higher temperature for deep creative copy
    const raw = await this.callGemini(systemPrompt, userPrompt, 0.7, 4000);
    const parsed = this.parseJSON(raw, 'heavy-batch') as Record<
      string,
      unknown
    >;

    return this.extractSectionsFromBatch(parsed, sectionTypes, 'heavy-batch');
  }

  // ─── Core Gemini call ──────────────────────────────────────
  private async callGemini(
    systemInstruction: string,
    userPrompt: string,
    temperature: number,
    maxOutputTokens: number = 4096,
  ): Promise<string> {
    // 2-second delay to stay within free-tier per-minute rate limits
    await new Promise((resolve) => setTimeout(resolve, 2000));
    this.logger.log(
      `DEBUG: Calling Gemini API (model: gemini-2.5-flash, temp: ${temperature}, maxTokens: ${maxOutputTokens})`,
    );
    const model = this.getModel();

    const combinedPrompt =
      systemInstruction +
      '\n\n' +
      userPrompt +
      '\n\nRespond ONLY with a raw JSON object. No markdown, no code blocks.';

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: combinedPrompt }] }],
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

  // ─── JSON parsing with fallback extraction ─────────────────
  private parseJSON(raw: string, context: string): unknown {
    const trimmed = raw.trim();

    // 1. Direct parse
    try {
      return JSON.parse(trimmed);
    } catch {
      /* fall through */
    }

    // 2. Strip markdown code fences
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      try {
        return JSON.parse(fenceMatch[1].trim());
      } catch {
        /* fall through */
      }
    }

    // 3. Extract first JSON object
    const objMatch = trimmed.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]);
      } catch {
        /* fall through */
      }
    }

    throw new Error(`[${context}] Failed to parse AI response as JSON`);
  }

  // ─── Response validators ───────────────────────────────────
  private validateAnalysisAndPlan(parsed: unknown): AnalysisAndPlanResult {
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Analysis+Plan returned non-object');
    }
    const root = parsed as Record<string, unknown>;

    // Validate DNA
    const rawDna = (root.dna ?? {}) as Record<string, unknown>;
    const VALID_ANGLES = new Set([
      'fear_of_missing_out',
      'transformation',
      'social_proof',
      'urgency',
      'aspiration',
      'problem_agitation',
    ]);
    const VALID_PERSONALITIES = new Set([
      'luxury',
      'playful',
      'professional',
      'urgent',
      'friendly',
    ]);

    const dna: PageDNA = {
      targetAudience: String(rawDna.targetAudience ?? ''),
      primaryPainPoints: toStringArray(rawDna.primaryPainPoints),
      copywritingAngle: VALID_ANGLES.has(String(rawDna.copywritingAngle))
        ? (rawDna.copywritingAngle as PageDNA['copywritingAngle'])
        : 'aspiration',
      brandPersonality: VALID_PERSONALITIES.has(String(rawDna.brandPersonality))
        ? (rawDna.brandPersonality as PageDNA['brandPersonality'])
        : 'professional',
      primaryHook: String(rawDna.primaryHook ?? ''),
      hookVariants: buildHookVariants(
        rawDna.hookVariants,
        String(rawDna.primaryHook ?? ''),
      ),
      emotionalTriggers: toStringArray(rawDna.emotionalTriggers),
      keyBenefits: toStringArray(rawDna.keyBenefits),
      uniqueSellingPoint: String(rawDna.uniqueSellingPoint ?? ''),
    };

    // Validate Plan
    const rawPlan = (root.plan ?? {}) as Record<string, unknown>;
    const rawSections = Array.isArray(rawPlan.selectedSections)
      ? rawPlan.selectedSections
      : [];

    const HEAVY_SECTIONS = new Set([
      'hero',
      'problem',
      'solution',
      'testimonials',
      'offer',
      'finalCta',
    ]);

    const selectedSections: SectionPlan[] = rawSections
      .filter(
        (s): s is Record<string, unknown> =>
          typeof s === 'object' && s !== null,
      )
      .filter((s) => CANONICAL_ORDER.includes(String(s.type)))
      .map((s, idx) => ({
        type: String(s.type),
        order: typeof s.order === 'number' ? s.order : idx + 1,
        complexity: HEAVY_SECTIONS.has(String(s.type)) ? 'heavy' : 'light',
        reason: String(s.reason ?? ''),
      }));

    // Enforce mandatory sections
    const existingTypes = new Set(selectedSections.map((s) => s.type));
    let orderCounter = selectedSections.length + 1;
    for (const mandatory of MANDATORY_SECTIONS) {
      if (!existingTypes.has(mandatory)) {
        selectedSections.push({
          type: mandatory,
          order: orderCounter++,
          complexity: HEAVY_SECTIONS.has(mandatory) ? 'heavy' : 'light',
          reason: 'mandatory section',
        });
      }
    }

    // Fill to minimum 6 if needed
    if (selectedSections.length < MIN_SECTIONS) {
      for (const filler of RECOMMENDED_FILL_SECTIONS) {
        if (selectedSections.length >= MIN_SECTIONS) break;
        if (!existingTypes.has(filler)) {
          selectedSections.push({
            type: filler,
            order: orderCounter++,
            complexity: HEAVY_SECTIONS.has(filler) ? 'heavy' : 'light',
            reason: 'added to reach minimum sections',
          });
          existingTypes.add(filler);
        }
      }
    }

    // Sort by canonical order
    const sorted = selectedSections.sort(
      (a, b) =>
        CANONICAL_ORDER.indexOf(a.type) - CANONICAL_ORDER.indexOf(b.type),
    );

    this.logger.debug(
      `Analysis+Plan validated: ${sorted.length} sections — ` +
        `light: [${sorted
          .filter((s) => s.complexity === 'light')
          .map((s) => s.type)
          .join(', ')}], ` +
        `heavy: [${sorted
          .filter((s) => s.complexity === 'heavy')
          .map((s) => s.type)
          .join(', ')}]`,
    );

    return { dna, plan: { selectedSections: sorted } };
  }

  private extractSectionsFromBatch(
    parsed: Record<string, unknown>,
    expectedTypes: string[],
    context: string,
  ): unknown[] {
    // Handle both { sections: [...] } and direct array responses
    let arr: unknown[];
    if (Array.isArray(parsed)) {
      arr = parsed;
    } else if (Array.isArray(parsed.sections)) {
      arr = parsed.sections;
    } else {
      // Fallback: try to collect any object values that look like sections
      arr = Object.values(parsed).filter(
        (v) => typeof v === 'object' && v !== null && 'type' in (v as object),
      );
    }

    if (arr.length === 0) {
      throw new Error(
        `[${context}] Batch response contained no section objects`,
      );
    }

    this.logger.debug(
      `[${context}] Extracted ${arr.length}/${expectedTypes.length} sections`,
    );

    return arr;
  }

  private validateAnalysis(parsed: unknown): ProductAnalysis {
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Analyzer returned non-object');
    }
    const a = parsed as Record<string, unknown>;

    return {
      targetAudience: String(a.targetAudience ?? ''),
      primaryPainPoints: toStringArray(a.primaryPainPoints),
      productCategory: String(a.productCategory ?? 'other'),
      keyBenefits: toStringArray(a.keyBenefits),
      uniqueSellingPoint: String(a.uniqueSellingPoint ?? ''),
      emotionalTriggers: toStringArray(a.emotionalTriggers),
    };
  }

  private validatePlan(parsed: unknown): PagePlan {
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Planner returned non-object');
    }
    const p = parsed as Record<string, unknown>;
    const raw = toStringArray(p.selectedSections);

    // Step 1: Keep only valid canonical sections
    const validRaw = raw.filter((s) => CANONICAL_ORDER.includes(s));

    // Step 2: Merge with mandatory sections (adds any missing mandatory)
    const withMandatory = dedupePreserveOrder([
      ...validRaw,
      ...Array.from(MANDATORY_SECTIONS),
    ]);

    // Step 3: Enforce minimum 6 by filling with recommended sections
    const filled = [...withMandatory];
    if (filled.length < MIN_SECTIONS) {
      for (const filler of RECOMMENDED_FILL_SECTIONS) {
        if (filled.length >= MIN_SECTIONS) break;
        if (!filled.includes(filler)) {
          filled.push(filler);
        }
      }
    }

    // Step 4: Sort by canonical order
    const sorted = CANONICAL_ORDER.filter((s) => filled.includes(s));

    this.logger.debug(
      `Plan validated: ${sorted.length} sections [min=${MIN_SECTIONS}]: ${sorted.join(', ')}`,
    );

    return {
      selectedSections: sorted,
      reasoning: typeof p.reasoning === 'string' ? p.reasoning : undefined,
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────
function toStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((v) => typeof v === 'string');
}

function dedupePreserveOrder(arr: string[]): string[] {
  const seen = new Set<string>();
  return arr.filter((s) => {
    if (seen.has(s)) return false;
    seen.add(s);
    return true;
  });
}

/**
 * Validates and normalises the hookVariants array from the AI response.
 * Guarantees a tuple of exactly 3 strings. Falls back to deriving
 * variants from primaryHook if the model didn't return them correctly.
 */
function buildHookVariants(
  raw: unknown,
  primaryHook: string,
): [string, string, string] {
  if (Array.isArray(raw) && raw.length >= 3) {
    const [a, b, c] = raw;
    if (
      typeof a === 'string' &&
      typeof b === 'string' &&
      typeof c === 'string'
    ) {
      return [a, b, c];
    }
  }
  // Fallback: derive variants from primaryHook
  const words = primaryHook.split(/\s+/);
  const shortForm = words.slice(0, 6).join(' ');
  return [shortForm, `${primaryHook}؟`, primaryHook];
}
