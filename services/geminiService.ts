
import { GoogleGenAI } from "@google/genai";

/**
 * Service to handle Gemini API interactions.
 * Note: process.env.API_KEY is automatically available.
 */
export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async generateSimpleText(prompt: string) {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      return response.text;
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  }

  // Ready for more methods (streaming, vision, live, etc.)
}

export const gemini = new GeminiService();
