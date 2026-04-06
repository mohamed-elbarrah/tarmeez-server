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
