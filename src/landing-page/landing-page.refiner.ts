import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { AI_PROVIDER } from './providers/ai-provider.interface';
import type { AIProvider } from './providers/ai-provider.interface';
import { NormalizationService } from './normalization.service';
import type { RefinePageDto, RefineScope } from './dto/refine-page.dto';
import {
  buildSurgicalRefinePrompt,
  buildSectionRefinePrompt,
  buildFieldRefinePrompt,
  type RefineDelta,
  type SectionPatch,
} from './prompts/refine.prompt';

// ─── Return types ─────────────────────────────────────────────

export interface RefineResult {
  success: boolean;
  scope: RefineScope;
  /** "FULL" or "PARTIAL" (only meaningful when scope="full") */
  updateType: 'FULL' | 'PARTIAL';
  updatedContent: Record<string, any>;
  affectedSection?: string;
  affectedField?: string;
  /** Sections that were patched (only when updateType="PARTIAL") */
  patchedSections?: string[];
  assistantMessage: string;
  durationMs: number;
}

// ─── LandingPageRefiner ──────────────────────────────────────

@Injectable()
export class LandingPageRefiner {
  private readonly logger = new Logger(LandingPageRefiner.name);

  constructor(
    @Inject(AI_PROVIDER) private readonly aiProvider: AIProvider,
    private readonly normalization: NormalizationService,
  ) {}

  async refine(
    dto: RefinePageDto,
    pageId: string,
    storeId: string,
  ): Promise<RefineResult> {
    const startTime = Date.now();
    this.logger.log(
      `[${pageId}] Refine request — scope=${dto.scope}, store=${storeId}`,
    );

    let result: RefineResult;

    switch (dto.scope) {
      case 'full':
        result = await this.refineSurgical(dto, startTime);
        break;
      case 'section':
        result = await this.refineSection(dto, startTime);
        break;
      case 'field':
        result = await this.refineField(dto, startTime);
        break;
      default:
        throw new Error(`Unknown scope: ${(dto as any).scope}`);
    }

    this.logger.log(
      `[${pageId}] Refine complete — scope=${dto.scope}, updateType=${result.updateType}, ` +
        `patches=${result.patchedSections?.length ?? 'n/a'}, duration=${result.durationMs}ms`,
    );

    return result;
  }

  // ─── Surgical full-page refine ──────────────────────────────
  // AI decides FULL vs PARTIAL and returns a delta.
  // PARTIAL: only affected sections are returned → merged into existing content.
  // FULL: entire page content is replaced (cross-cutting changes).

  private async refineSurgical(
    dto: RefinePageDto,
    startTime: number,
  ): Promise<RefineResult> {
    const { systemPrompt, userPrompt } = buildSurgicalRefinePrompt({
      instruction: dto.instruction,
      currentContent: dto.currentContent,
      conversationHistory: dto.conversationHistory,
    });

    let raw: string;
    try {
      raw = await this.aiProvider.generateRefinement(
        systemPrompt,
        userPrompt,
        'full',
      );
    } catch (err: any) {
      throw new Error(`AI refinement failed: ${err.message}`);
    }

    const delta = this.parseDelta(raw);

    if (delta.type === 'PARTIAL') {
      return this.applyPartialDelta(delta, dto.currentContent, startTime);
    } else {
      return this.applyFullDelta(delta, startTime);
    }
  }

  // ─── Apply PARTIAL delta ────────────────────────────────────

  private applyPartialDelta(
    delta: RefineDelta,
    currentContent: Record<string, any>,
    startTime: number,
  ): RefineResult {
    const patches = delta.patches ?? [];

    if (patches.length === 0) {
      this.logger.warn(
        'PARTIAL delta returned empty patches — falling back to unchanged content',
      );
      return {
        success: true,
        scope: 'full',
        updateType: 'PARTIAL',
        updatedContent: currentContent,
        patchedSections: [],
        assistantMessage: delta.message || 'لم يتم إجراء أي تغييرات.',
        durationMs: Date.now() - startTime,
      };
    }

    const updatedContent = this.applyPatches(currentContent, patches);
    const patchedSections = patches.map((p) => p.sectionType);

    this.logger.log(
      `PARTIAL update applied — sections changed: [${patchedSections.join(', ')}]`,
    );

    return {
      success: true,
      scope: 'full',
      updateType: 'PARTIAL',
      updatedContent,
      patchedSections,
      assistantMessage:
        delta.message || `تم تعديل: ${patchedSections.join('، ')}`,
      durationMs: Date.now() - startTime,
    };
  }

  // ─── Apply FULL delta ───────────────────────────────────────

  private applyFullDelta(delta: RefineDelta, startTime: number): RefineResult {
    if (!delta.fullContent) {
      throw new Error('FULL delta missing fullContent');
    }

    // Run normalization to validate section structure
    const normResult = this.normalization.normalize(delta.fullContent);
    const updatedContent =
      normResult.success && normResult.data
        ? normResult.data
        : delta.fullContent;

    this.logger.log('FULL update applied — entire page replaced');

    return {
      success: true,
      scope: 'full',
      updateType: 'FULL',
      updatedContent: updatedContent as Record<string, any>,
      assistantMessage: delta.message || 'تم تحديث الصفحة بالكامل.',
      durationMs: Date.now() - startTime,
    };
  }

  // ─── Patch merger ────────────────────────────────────────────
  // Merges section patches into currentContent without replacing untouched sections.

  private applyPatches(
    content: Record<string, any>,
    patches: SectionPatch[],
  ): Record<string, any> {
    // Shape 1: { sections: [{ type: 'hero', ... }, ...] }
    if (Array.isArray(content.sections)) {
      const updatedSections = content.sections.map((s: any) => {
        const patch = patches.find((p) => p.sectionType === s?.type);
        if (!patch) return s; // untouched
        return { ...s, ...patch.content };
      });
      return { ...content, sections: updatedSections };
    }

    // Shape 2: flat map { hero: {...}, features: {...}, ... }
    const patchMap: Record<string, any> = {};
    for (const patch of patches) {
      patchMap[patch.sectionType] = {
        ...(content[patch.sectionType] ?? {}),
        ...patch.content,
      };
    }
    return { ...content, ...patchMap };
  }

  // ─── Section refine ─────────────────────────────────────────

  private async refineSection(
    dto: RefinePageDto,
    startTime: number,
  ): Promise<RefineResult> {
    const { sectionType } = dto;

    if (!sectionType) {
      throw new Error('sectionType is required for scope=section');
    }

    const currentSectionContent = this.extractSection(
      dto.currentContent,
      sectionType,
    );

    const { systemPrompt, userPrompt } = buildSectionRefinePrompt({
      instruction: dto.instruction,
      sectionType,
      currentSectionContent,
      conversationHistory: dto.conversationHistory,
    });

    let raw: string;
    try {
      raw = await this.aiProvider.generateRefinement(
        systemPrompt,
        userPrompt,
        'section',
      );
    } catch (err: any) {
      throw new Error(
        `AI refinement failed for section=${sectionType}: ${err.message}`,
      );
    }

    const updatedSection = this.parseAIResponse(
      raw,
      `section:${sectionType}`,
    ) as Record<string, any>;

    const updatedContent = this.mergeSection(
      dto.currentContent,
      sectionType,
      updatedSection,
    );

    return {
      success: true,
      scope: 'section',
      updateType: 'PARTIAL',
      updatedContent,
      affectedSection: sectionType,
      patchedSections: [sectionType],
      assistantMessage: `تم تحديث قسم "${sectionType}".`,
      durationMs: Date.now() - startTime,
    };
  }

  // ─── Field refine ───────────────────────────────────────────

  private async refineField(
    dto: RefinePageDto,
    startTime: number,
  ): Promise<RefineResult> {
    const { sectionType, fieldPath } = dto;

    if (!sectionType) {
      throw new Error('sectionType is required for scope=field');
    }
    if (!fieldPath) {
      throw new Error('fieldPath is required for scope=field');
    }

    const currentSectionContent = this.extractSection(
      dto.currentContent,
      sectionType,
    );

    const currentFieldValue = this.extractField(
      currentSectionContent,
      fieldPath,
      sectionType,
    );

    const { systemPrompt, userPrompt } = buildFieldRefinePrompt({
      instruction: dto.instruction,
      sectionType,
      fieldPath,
      currentFieldValue,
      conversationHistory: dto.conversationHistory,
    });

    let raw: string;
    try {
      raw = await this.aiProvider.generateRefinement(
        systemPrompt,
        userPrompt,
        'field',
      );
    } catch (err: any) {
      throw new Error(
        `AI refinement failed for field=${fieldPath} in section=${sectionType}: ${err.message}`,
      );
    }

    const newFieldValue = this.parseFieldValue(raw.trim());

    const updatedSection = {
      ...currentSectionContent,
      [fieldPath]: newFieldValue,
    };

    const updatedContent = this.mergeSection(
      dto.currentContent,
      sectionType,
      updatedSection,
    );

    return {
      success: true,
      scope: 'field',
      updateType: 'PARTIAL',
      updatedContent,
      affectedSection: sectionType,
      affectedField: fieldPath,
      patchedSections: [sectionType],
      assistantMessage: `تم تحديث الحقل "${fieldPath}" في قسم "${sectionType}".`,
      durationMs: Date.now() - startTime,
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────

  /**
   * Parse the AI delta response `{ type, message, patches, fullContent }`.
   * Falls back gracefully: if response looks like bare page JSON (no .type field),
   * treat it as a FULL response to maintain backward compatibility.
   */
  private parseDelta(raw: string): RefineDelta {
    const parsed = this.parseAIResponse(raw, 'surgical-refine');

    const obj = parsed as Record<string, any>;

    // Valid delta response
    if (obj && (obj.type === 'PARTIAL' || obj.type === 'FULL')) {
      return {
        type: obj.type,
        message: typeof obj.message === 'string' ? obj.message : '',
        patches: Array.isArray(obj.patches) ? obj.patches : null,
        fullContent:
          obj.fullContent && typeof obj.fullContent === 'object'
            ? obj.fullContent
            : null,
      };
    }

    // Fallback: AI returned bare page JSON (old behavior) → treat as FULL
    this.logger.warn(
      'Delta parse fallback: AI returned bare JSON instead of delta schema. Treating as FULL.',
    );
    return {
      type: 'FULL',
      message: 'تم تحديث الصفحة.',
      patches: null,
      fullContent: obj as Record<string, any>,
    };
  }

  /**
   * Extract a section by type from the current page content.
   * Supports both { sections: [...] } and { hero: {...}, ... } shapes.
   */
  private extractSection(
    content: Record<string, any>,
    sectionType: string,
  ): Record<string, any> {
    if (Array.isArray(content.sections)) {
      const section = content.sections.find(
        (s: any) => s?.type === sectionType,
      );
      if (section) return section as Record<string, any>;
    }

    if (
      typeof content[sectionType] === 'object' &&
      content[sectionType] !== null
    ) {
      return content[sectionType] as Record<string, any>;
    }

    throw new NotFoundException(
      `Section type "${sectionType}" not found in page content`,
    );
  }

  private extractField(
    section: Record<string, any>,
    fieldPath: string,
    sectionType: string,
  ): unknown {
    if (!(fieldPath in section)) {
      throw new NotFoundException(
        `Field "${fieldPath}" not found in section "${sectionType}"`,
      );
    }
    return section[fieldPath];
  }

  private mergeSection(
    content: Record<string, any>,
    sectionType: string,
    updatedSection: Record<string, any>,
  ): Record<string, any> {
    if (Array.isArray(content.sections)) {
      const updatedSections = content.sections.map((s: any) =>
        s?.type === sectionType ? { ...s, ...updatedSection } : s,
      );
      return { ...content, sections: updatedSections };
    }
    return { ...content, [sectionType]: updatedSection };
  }

  /**
   * Parse the AI response as JSON with multiple fallback strategies.
   */
  private parseAIResponse(raw: string, context: string): unknown {
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

    throw new Error(
      `[${context}] AI returned unparseable content. Cannot apply refinement.`,
    );
  }

  /**
   * Parse a field value returned by the AI for field-scope refinement.
   */
  private parseFieldValue(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
}
