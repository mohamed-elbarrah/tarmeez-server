import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  AIProvider,
  AIGenerationInput,
  AIGenerationOutput,
} from './ai-provider.interface';

@Injectable()
export class GeminiProvider implements AIProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly model;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.getOrThrow<string>('GEMINI_API_KEY');
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }

  async generate(input: AIGenerationInput): Promise<AIGenerationOutput> {
    const systemPrompt = this.buildSystemPrompt(input);
    const userPrompt = this.buildUserPrompt(input);

    this.logger.debug(
      `Generating landing page content (lang=${input.language}, tone=${input.tone})`,
    );

    const result = await this.model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
    });

    const raw = result.response.text();

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.logger.warn('AI returned non-JSON response, attempting extraction');
      parsed = this.extractJSON(raw);
    }

    return { raw, parsed };
  }

  private buildSystemPrompt(input: AIGenerationInput): string {
    const lang = input.language === 'ar' ? 'Arabic' : 'English';

    return `You are an expert landing page copywriter. Generate a complete landing page structure in ${lang} with a ${input.tone} tone.

You MUST return valid JSON with this exact structure:
{
  "sections": [...],
  "metadata": { "language": "${input.language}", "tone": "${input.tone}" }
}

The "sections" array must contain objects for these 13 section types (in this order):
1. "hero" — { type: "hero", headline, subheadline, ctaText, backgroundStyle, alignment, badgeText? }
2. "problem" — { type: "problem", headline, description?, painPoints: [{ icon?, title, description }] }
3. "solution" — { type: "solution", headline, description, points: [{ icon?, title, description }], ctaText? }
4. "features" — { type: "features", headline, description?, features: [{ icon?, title, description }], layout }
5. "benefits" — { type: "benefits", headline, description?, benefits: [{ icon?, title, description }] }
6. "gallery" — { type: "gallery", headline, description?, images: [{ src, alt, caption? }], layout }
7. "useCases" — { type: "useCases", headline, description?, cases: [{ icon?, title, description, persona? }] }
8. "comparison" — { type: "comparison", headline, description?, mode, items: [{ label, before, after }] }
9. "trust" — { type: "trust", headline, stats?: [{ value, label }], badges?: [{ icon?, label }], partners? }
10. "testimonials" — { type: "testimonials", headline, testimonials: [{ quote, authorName, authorTitle?, rating? }], layout }
11. "offer" — { type: "offer", headline, description?, price, originalPrice?, currency, ctaText, urgencyText?, bulletPoints? }
12. "faq" — { type: "faq", headline, description?, questions: [{ question, answer }] }
13. "finalCta" — { type: "finalCta", headline, subheadline?, ctaText, guaranteeText? }

Rules:
- Return ONLY valid JSON, no markdown or explanations.
- All text content must be in ${lang}.
- For gallery images, use placeholder paths like "/placeholder/product-1.jpg".
- Keep all text concise and persuasive.
- Currency is SAR (Saudi Riyal).`;
  }

  private buildUserPrompt(input: AIGenerationInput): string {
    let prompt = input.prompt;

    if (input.productName) {
      prompt += `\n\nProduct Name: ${input.productName}`;
    }
    if (input.productDescription) {
      prompt += `\nProduct Description: ${input.productDescription}`;
    }
    if (input.productPrice) {
      prompt += `\nProduct Price: ${input.productPrice} SAR`;
    }

    return prompt;
  }

  private extractJSON(text: string): unknown {
    // Try to find JSON within markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }

    // Try to find raw JSON object
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }

    throw new Error('Could not extract JSON from AI response');
  }
}
