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
} from './ai-provider.interface';
import {
  buildAnalyzerSystemPrompt,
  buildAnalyzerUserPrompt,
  buildPlannerSystemPrompt,
  buildPlannerUserPrompt,
  buildSectionGeneratorSystemPrompt,
  buildSectionGeneratorUserPrompt,
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
      this._model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
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

  // ─── Core Gemini call ──────────────────────────────────────
  private async callGemini(
    systemInstruction: string,
    userPrompt: string,
    temperature: number,
  ): Promise<string> {
    const model = this.getModel();

    const result = await model.generateContent({
      systemInstruction,
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature,
        maxOutputTokens: 4096,
      },
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
