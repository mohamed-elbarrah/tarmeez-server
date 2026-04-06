export interface AIGenerationInput {
  prompt: string;
  productName?: string;
  productDescription?: string;
  productPrice?: number;
  language: string;
  tone: string;
}

export interface AIGenerationOutput {
  raw: string;
  parsed: unknown;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');

export interface AIProvider {
  generate(input: AIGenerationInput): Promise<AIGenerationOutput>;
}
