import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("WARNING: GEMINI_API_KEY belum diset di dalam file .env! Fitur AI tidak akan berfungsi.");
}

const genAI = new GoogleGenerativeAI(apiKey || 'dummy-key');

export const aiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
