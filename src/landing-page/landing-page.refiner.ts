import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { AI_PROVIDER } from './providers/ai-provider.interface';
import type { AIProvider } from './providers/ai-provider.interface';
import { NormalizationService } from './normalization.service';
import type { RefinePageDto, RefineScope } from './dto/refine-page.dto';
import {
  buildFullRefinePrompt,
  buildSectionRefinePrompt,
  buildFieldRefinePrompt,
} from './prompts/refine.prompt';

// ─── Return types ─────────────────────────────────────────────

export interface RefineResult {
  success: boolean;
  scope: RefineScope;
  updatedContent: Record<string, any>;
  affectedSection?: string;
  affectedField?: string;
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
        result = await this.refineFull(dto, startTime);
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
      `[${pageId}] Refine complete — scope=${dto.scope}, duration=${result.durationMs}ms`,
    );

    return result;
  }

  // ─── Full page refine ───────────────────────────────────────

  private async refineFull(
    dto: RefinePageDto,
    startTime: number,
  ): Promise<RefineResult> {
    const { systemPrompt, userPrompt } = buildFullRefinePrompt({
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
      throw new Error(`AI refinement failed for full scope: ${err.message}`);
    }

    const parsed = this.parseAIResponse(raw, 'full');

    // Run normalization to validate section structure
    const normResult = this.normalization.normalize(parsed);

    const updatedContent: Record<string, any> =
      normResult.success && normResult.data
        ? normResult.data
        : (parsed as Record<string, any>);

    return {
      success: true,
      scope: 'full',
      updatedContent,
      assistantMessage:
        "I've updated the entire page based on your instruction.",
      durationMs: Date.now() - startTime,
    };
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

    // Merge the updated section back into the full content
    const updatedContent = this.mergeSection(
      dto.currentContent,
      sectionType,
      updatedSection,
    );

    return {
      success: true,
      scope: 'section',
      updatedContent,
      affectedSection: sectionType,
      assistantMessage: `I've updated the ${sectionType} section.`,
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

    // For field scope, the AI returns just the new value (a raw string or JSON primitive)
    const newFieldValue = this.parseFieldValue(raw.trim());

    // Patch the field in section, then merge section back into content
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
      updatedContent,
      affectedSection: sectionType,
      affectedField: fieldPath,
      assistantMessage: `I've updated the ${fieldPath} in ${sectionType}.`,
      durationMs: Date.now() - startTime,
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────

  /**
   * Extract a section by type from the current page content.
   * Supports both { sections: [...] } and { hero: {...}, ... } shapes.
   */
  private extractSection(
    content: Record<string, any>,
    sectionType: string,
  ): Record<string, any> {
    // Shape 1: { sections: [{ type: 'hero', ... }, ...] }
    if (Array.isArray(content.sections)) {
      const section = content.sections.find(
        (s: any) => s?.type === sectionType,
      );
      if (section) return section as Record<string, any>;
    }

    // Shape 2: { hero: { ... }, features: { ... } }
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

  /**
   * Extract a single field value from a section.
   */
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

  /**
   * Merge an updated section back into the full page content.
   */
  private mergeSection(
    content: Record<string, any>,
    sectionType: string,
    updatedSection: Record<string, any>,
  ): Record<string, any> {
    // Shape 1: { sections: [...] }
    if (Array.isArray(content.sections)) {
      const updatedSections = content.sections.map((s: any) =>
        s?.type === sectionType ? { ...s, ...updatedSection } : s,
      );
      return { ...content, sections: updatedSections };
    }

    // Shape 2: flat map
    return { ...content, [sectionType]: updatedSection };
  }

  /**
   * Parse the AI response as JSON with multiple fallback strategies.
   * Throws a descriptive error if parsing fails.
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
   * The AI should return just the value (string, number, etc.).
   * If it returns quoted JSON string, unwrap it.
   */
  private parseFieldValue(raw: string): unknown {
    // Try JSON parse first (handles quoted strings, numbers, booleans, arrays)
    try {
      return JSON.parse(raw);
    } catch {
      // If not valid JSON, treat as plain string
      return raw;
    }
  }
}
