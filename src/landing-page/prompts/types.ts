// ─── Pipeline Types ──────────────────────────────────────────

/** Extracted product intelligence from Step 1 (Analyzer) */
export interface ProductAnalysis {
  targetAudience: string;
  primaryPainPoints: string[];
  productCategory: string;
  keyBenefits: string[];
  uniqueSellingPoint: string;
  emotionalTriggers: string[];
}

/** Section selection & order from Step 2 (Planner) */
export interface PagePlan {
  selectedSections: string[];
  reasoning?: string;
}

/** Product context loaded from the DB */
export interface ProductContext {
  productName?: string;
  productDescription?: string;
  productPrice?: number;
}

/** Input for per-section generation (Step 3) */
export interface SectionGenerationContext extends ProductContext {
  sectionType: string;
  analysis: ProductAnalysis;
  language: string;
  tone: string;
}

// ─── New types for 3-call orchestration ──────────────────────

export type CopywritingAngle =
  | 'fear_of_missing_out'
  | 'transformation'
  | 'social_proof'
  | 'urgency'
  | 'aspiration'
  | 'problem_agitation';

export type BrandPersonality =
  | 'luxury'
  | 'playful'
  | 'professional'
  | 'urgent'
  | 'friendly';

export type SectionComplexity = 'light' | 'heavy';

/** Rich product DNA produced by the combined Analyze+Plan call */
export interface PageDNA {
  targetAudience: string;
  primaryPainPoints: string[];
  copywritingAngle: CopywritingAngle;
  brandPersonality: BrandPersonality;
  /** The single hook sentence that all copy builds upon */
  primaryHook: string;
  /**
   * Three headline variants derived from the primary hook.
   * [0] = short form (<8 words)
   * [1] = question form
   * [2] = problem-first form
   */
  hookVariants: [string, string, string];
  emotionalTriggers: string[];
  keyBenefits: string[];
  uniqueSellingPoint: string;
}

/** Single section entry in the page plan */
export interface SectionPlan {
  type: string;
  order: number;
  complexity: SectionComplexity;
  reason: string;
}

/** Combined output from the merged Analyze+Plan call (Call 1) */
export interface AnalysisAndPlanResult {
  dna: PageDNA;
  plan: {
    selectedSections: SectionPlan[];
  };
}

/** Performance metrics logged after each generation */
export interface GenerationMetrics {
  totalCalls: number;
  totalTokensEstimate: number;
  durationMs: number;
  sectionsGenerated: number;
  lightSectionsCount: number;
  heavySectionsCount: number;
}

/**
 * Lightweight context passed from light→heavy batch.
 * Intentionally minimal (~100 tokens max) — just enough for
 * the heavy batch to maintain thematic consistency without
 * re-sending full section content.
 */
export interface LightSectionsContext {
  /** Section types that were already generated */
  generatedTypes: string[];
  /** The page's central hook (= dna.primaryHook) */
  mainTheme: string;
  /** The established brand voice (= dna.brandPersonality) */
  toneEstablished: string;
  /** Key benefits already mentioned in light sections (max 3) */
  keyBenefitsMentioned: string[];
}
