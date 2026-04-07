import type {
  ProductAnalysis,
  PagePlan,
  ProductContext,
  SectionGenerationContext,
  AnalysisAndPlanResult,
  PageDNA,
  LightSectionsContext,
} from '../prompts/types';

export type {
  ProductAnalysis,
  PagePlan,
  ProductContext,
  SectionGenerationContext,
  AnalysisAndPlanResult,
  PageDNA,
  LightSectionsContext,
};

export type { SectionPlan, GenerationMetrics } from '../prompts/types';

export const AI_PROVIDER = Symbol('AI_PROVIDER');

export interface AIProvider {
  // ─── Legacy 3-step methods (kept for backward compat) ──────
  /** Step 1 — Extract audience, pain points, category from the merchant's prompt */
  analyzeProduct(
    merchantPrompt: string,
    context: ProductContext,
    language: string,
    tone: string,
  ): Promise<ProductAnalysis>;

  /** Step 2 — Decide which sections to include and their order */
  planPage(
    analysis: ProductAnalysis,
    language: string,
    tone: string,
  ): Promise<PagePlan>;

  /** Step 3 — Generate content for a single section */
  generateSection(ctx: SectionGenerationContext): Promise<unknown>;

  // ─── New optimized 3-call methods ─────────────────────────
  /** Call 1 — Combined Analyze + Plan in a single AI call */
  generateAnalysisAndPlan(
    merchantPrompt: string,
    context: ProductContext,
    language: string,
    tone: string,
  ): Promise<AnalysisAndPlanResult>;

  /** Call 2 — Generate all "light" sections in a single batch call */
  generateLightSections(
    sectionTypes: string[],
    dna: PageDNA,
    context: ProductContext,
    language: string,
    tone: string,
  ): Promise<unknown[]>;

  /** Call 3 — Generate all "heavy" sections in a single batch call */
  generateHeavySections(
    sectionTypes: string[],
    dna: PageDNA,
    context: ProductContext,
    language: string,
    tone: string,
    lightSectionsContext?: LightSectionsContext,
  ): Promise<unknown[]>;
}
