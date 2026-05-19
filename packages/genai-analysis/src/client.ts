import { GoogleGenAI } from "@google/genai";

let _client: GoogleGenAI | null = null;

export function getClient(): GoogleGenAI {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
    _client = new GoogleGenAI({ apiKey });
  }
  return _client;
}
