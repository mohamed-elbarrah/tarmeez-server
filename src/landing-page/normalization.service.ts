import { Injectable, Logger } from '@nestjs/common';

// ─── Section type definitions (mirrors client Zod schemas) ──

const CANONICAL_SECTION_ORDER = [
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
] as const;

type SectionType = (typeof CANONICAL_SECTION_ORDER)[number];

export interface NormalizationError {
  section: string;
  path: string;
  message: string;
}

export interface NormalizationResult {
  success: boolean;
  data: Record<string, unknown> | null;
  errors: NormalizationError[];
  warnings: string[];
}

// ─── Per-section validators ─────────────────────────────────

const SECTION_VALIDATORS: Record<
  SectionType,
  (s: Record<string, unknown>) => string | null
> = {
  hero: (s) => {
    if (!nonEmptyStr(s.headline)) return 'headline required';
    if (!nonEmptyStr(s.subheadline)) return 'subheadline required';
    if (!nonEmptyStr(s.ctaText)) return 'ctaText required';
    return null;
  },
  problem: (s) => {
    if (!nonEmptyStr(s.headline)) return 'headline required';
    if (!isNonEmptyArray(s.painPoints)) return 'painPoints required (min 1)';
    return null;
  },
  solution: (s) => {
    if (!nonEmptyStr(s.headline)) return 'headline required';
    if (!nonEmptyStr(s.description)) return 'description required';
    if (!isNonEmptyArray(s.points)) return 'points required (min 1)';
    return null;
  },
  features: (s) => {
    if (!nonEmptyStr(s.headline)) return 'headline required';
    if (!isArrayMinLen(s.features, 2)) return 'features required (min 2)';
    return null;
  },
  benefits: (s) => {
    if (!nonEmptyStr(s.headline)) return 'headline required';
    if (!isArrayMinLen(s.benefits, 2)) return 'benefits required (min 2)';
    return null;
  },
  gallery: (s) => {
    if (!nonEmptyStr(s.headline)) return 'headline required';
    if (!isNonEmptyArray(s.images)) return 'images required (min 1)';
    return null;
  },
  useCases: (s) => {
    if (!nonEmptyStr(s.headline)) return 'headline required';
    if (!isArrayMinLen(s.cases, 2)) return 'cases required (min 2)';
    return null;
  },
  comparison: (s) => {
    if (!nonEmptyStr(s.headline)) return 'headline required';
    if (!isArrayMinLen(s.items, 2)) return 'items required (min 2)';
    return null;
  },
  trust: (s) => {
    if (!nonEmptyStr(s.headline)) return 'headline required';
    return null;
  },
  testimonials: (s) => {
    if (!nonEmptyStr(s.headline)) return 'headline required';
    if (!isNonEmptyArray(s.testimonials))
      return 'testimonials required (min 1)';
    return null;
  },
  offer: (s) => {
    if (!nonEmptyStr(s.headline)) return 'headline required';
    if (!nonEmptyStr(s.price)) return 'price required';
    if (!nonEmptyStr(s.ctaText)) return 'ctaText required';
    return null;
  },
  faq: (s) => {
    if (!nonEmptyStr(s.headline)) return 'headline required';
    if (!isArrayMinLen(s.questions, 2)) return 'questions required (min 2)';
    return null;
  },
  finalCta: (s) => {
    if (!nonEmptyStr(s.headline)) return 'headline required';
    if (!nonEmptyStr(s.ctaText)) return 'ctaText required';
    return null;
  },
};

// ─── Service ─────────────────────────────────────────────────

@Injectable()
export class NormalizationService {
  private readonly logger = new Logger(NormalizationService.name);

  normalize(raw: unknown): NormalizationResult {
    const errors: NormalizationError[] = [];
    const warnings: string[] = [];

    // Step 1: Parse input
    let parsed: Record<string, unknown>;
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw);
      } catch {
        return fail([{ section: 'root', path: '', message: 'Invalid JSON' }]);
      }
    } else if (typeof raw === 'object' && raw !== null) {
      parsed = raw as Record<string, unknown>;
    } else {
      return fail([
        { section: 'root', path: '', message: 'Expected object or JSON string' },
      ]);
    }

    // Step 2: Extract sections
    let rawSections: unknown[];
    if (Array.isArray(parsed.sections)) {
      rawSections = parsed.sections;
    } else if (Array.isArray(parsed)) {
      rawSections = parsed;
      warnings.push('AI returned array directly; wrapped as sections');
    } else {
      return fail([
        { section: 'root', path: 'sections', message: 'Missing sections array' },
      ]);
    }

    // Step 3: Validate each section
    const validSections: Record<string, unknown>[] = [];
    for (let i = 0; i < rawSections.length; i++) {
      const section = rawSections[i];
      if (typeof section !== 'object' || section === null) {
        errors.push({
          section: `index_${i}`,
          path: '',
          message: 'Section must be an object',
        });
        continue;
      }

      const s = section as Record<string, unknown>;
      const type = s.type as string;

      if (!type || !CANONICAL_SECTION_ORDER.includes(type as SectionType)) {
        errors.push({
          section: type || `index_${i}`,
          path: 'type',
          message: `Unknown section type: ${type}`,
        });
        continue;
      }

      const validator = SECTION_VALIDATORS[type as SectionType];
      const error = validator(s);
      if (error) {
        errors.push({ section: type, path: '', message: error });
        continue;
      }

      validSections.push(s);
    }

    if (validSections.length === 0) {
      return { success: false, data: null, errors, warnings };
    }

    // Step 4: Deduplicate
    const seen = new Set<string>();
    const deduped: Record<string, unknown>[] = [];
    for (const section of validSections) {
      const type = section.type as string;
      if (seen.has(type)) {
        warnings.push(`Duplicate section "${type}" removed`);
        continue;
      }
      seen.add(type);
      deduped.push(section);
    }

    // Step 5: Sort by canonical order
    const orderMap = new Map<string, number>();
    CANONICAL_SECTION_ORDER.forEach((t, i) => orderMap.set(t, i));
    deduped.sort(
      (a, b) =>
        (orderMap.get(a.type as string) ?? 999) -
        (orderMap.get(b.type as string) ?? 999),
    );

    // Step 6: Build metadata
    const rawMeta =
      typeof parsed.metadata === 'object' && parsed.metadata !== null
        ? (parsed.metadata as Record<string, unknown>)
        : {};

    const data = {
      sections: deduped,
      metadata: {
        language: typeof rawMeta.language === 'string' ? rawMeta.language : 'ar',
        tone:
          typeof rawMeta.tone === 'string' ? rawMeta.tone : 'professional',
        colorScheme:
          typeof rawMeta.colorScheme === 'string'
            ? rawMeta.colorScheme
            : undefined,
      },
    };

    if (errors.length > 0) {
      warnings.push(
        `${errors.length} section(s) failed validation and were dropped`,
      );
    }

    this.logger.debug(
      `Normalized ${deduped.length}/${rawSections.length} sections`,
    );

    return { success: true, data, errors, warnings };
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function nonEmptyStr(val: unknown): boolean {
  return typeof val === 'string' && val.trim().length > 0;
}

function isNonEmptyArray(val: unknown): boolean {
  return Array.isArray(val) && val.length > 0;
}

function isArrayMinLen(val: unknown, min: number): boolean {
  return Array.isArray(val) && val.length >= min;
}

function fail(errors: NormalizationError[]): NormalizationResult {
  return { success: false, data: null, errors, warnings: [] };
}
