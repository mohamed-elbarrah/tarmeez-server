import type {
  ProductAnalysis,
  PagePlan,
  ProductContext,
  SectionGenerationContext,
} from '../prompts/types';

export type {
  ProductAnalysis,
  PagePlan,
  ProductContext,
  SectionGenerationContext,
};

export const AI_PROVIDER = Symbol('AI_PROVIDER');

export interface AIProvider {
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
}
