import { Injectable, Inject, Logger } from '@nestjs/common';
import { AI_PROVIDER } from './providers/ai-provider.interface';
import type {
  AIProvider,
  ProductContext,
  LightSectionsContext,
} from './providers/ai-provider.interface';
import type { GenerationMetrics } from './prompts/types';
import {
  NormalizationService,
  type NormalizationResult,
} from './normalization.service';

// ─── Orchestrator Result ──────────────────────────────────────

export interface OrchestratorResult {
  normalized: NormalizationResult;
  metrics: GenerationMetrics;
}

// ─── Orchestrator ─────────────────────────────────────────────
//
// This is the SINGLE source of truth for AI call ordering.
// It reduces calls from N+2 (one per section + analyze + plan)
// to exactly 3 calls for any page:
//
//   Call 1 — Analyze + Plan  (combined)
//   Call 2 — Light sections  (all in one batch)
//   Call 3 — Heavy sections  (all in one batch, with light context)

@Injectable()
export class LandingPageOrchestrator {
  private readonly logger = new Logger(LandingPageOrchestrator.name);

  constructor(
    @Inject(AI_PROVIDER) private readonly aiProvider: AIProvider,
    private readonly normalization: NormalizationService,
  ) {}

  async generate(
    merchantPrompt: string,
    productContext: ProductContext,
    language: string,
    tone: string,
    generationId?: string,
  ): Promise<OrchestratorResult> {
    const startTime = Date.now();
    let totalTokensEstimate = 0;

    // ── Call 1: Analyze + Plan ──────────────────────────────
    this.logger.log('Orchestrator → Call 1: generateAnalysisAndPlan');
    const { dna, plan } = await this.aiProvider.generateAnalysisAndPlan(
      merchantPrompt,
      productContext,
      language,
      tone,
    );
    totalTokensEstimate += estimateTokens(
      JSON.stringify(dna) + JSON.stringify(plan),
    );

    this.logger.log(
      `Call 1 done. Hook: "${dna.primaryHook}" | ` +
        `Sections: ${plan.selectedSections.length} | ` +
        `Angle: ${dna.copywritingAngle}`,
    );

    // ── Split into light vs heavy batches ──────────────────
    const lightTypes = plan.selectedSections
      .filter((s) => s.complexity === 'light')
      .map((s) => s.type);

    const heavyTypes = plan.selectedSections
      .filter((s) => s.complexity === 'heavy')
      .map((s) => s.type);

    this.logger.log(
      `Section split — light: [${lightTypes.join(', ')}] | heavy: [${heavyTypes.join(', ')}]`,
    );

    // ── Call 2: Light Sections Batch ───────────────────────
    this.logger.log(
      `Orchestrator → Call 2: generateLightSections (${lightTypes.length} sections)`,
    );
    const lightSections = await this.aiProvider.generateLightSections(
      lightTypes,
      dna,
      productContext,
      language,
      tone,
    );
    totalTokensEstimate += estimateTokens(JSON.stringify(lightSections));
    this.logger.log(`Call 2 done. Got ${lightSections.length} light sections.`);

    // ── Build lightweight context for heavy batch ───────────
    // Intentionally minimal (~100 tokens) — avoids re-sending full content
    const lightContext: LightSectionsContext = {
      generatedTypes: lightTypes,
      mainTheme: dna.primaryHook,
      toneEstablished: dna.brandPersonality,
      keyBenefitsMentioned: dna.keyBenefits.slice(0, 3),
    };

    // ── Call 3: Heavy Sections Batch ───────────────────────
    this.logger.log(
      `Orchestrator → Call 3: generateHeavySections (${heavyTypes.length} sections)`,
    );
    const heavySections = await this.aiProvider.generateHeavySections(
      heavyTypes,
      dna,
      productContext,
      language,
      tone,
      lightContext,
    );
    totalTokensEstimate += estimateTokens(JSON.stringify(heavySections));
    this.logger.log(`Call 3 done. Got ${heavySections.length} heavy sections.`);

    // ── Combine & Normalize ────────────────────────────────
    const allSections = [...lightSections, ...heavySections];

    const rawOutput = {
      sections: allSections,
      metadata: { language, tone },
    };

    const normalized = this.normalization.normalize(rawOutput);

    // ── Metrics ────────────────────────────────────────────
    const metrics: GenerationMetrics = {
      totalCalls: 3,
      totalTokensEstimate,
      durationMs: Date.now() - startTime,
      sectionsGenerated: Array.isArray(normalized.data?.sections)
        ? (normalized.data.sections as unknown[]).length
        : allSections.length,
      lightSectionsCount: lightSections.length,
      heavySectionsCount: heavySections.length,
    };

    // Old system: N+2 calls (where N = number of sections).
    // New system: always 3 calls regardless of page size.
    const oldCallCount = metrics.sectionsGenerated + 2;

    this.logger.log(
      `[METRICS] generationId=${generationId ?? 'n/a'} | ` +
        `calls=3/${oldCallCount} | ` +
        `sections=${metrics.sectionsGenerated} | ` +
        `duration=${metrics.durationMs}ms | ` +
        `lightBatch=${metrics.lightSectionsCount} | ` +
        `heavyBatch=${metrics.heavySectionsCount}`,
    );

    return { normalized, metrics };
  }
}

// ─── Token Estimation ─────────────────────────────────────────
// Rough heuristic: 1 token ≈ 4 characters (for English/Arabic mix)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
