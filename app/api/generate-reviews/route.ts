// app/api/generate-reviews/route.ts
// POST /api/generate-reviews
// Generates AI review suggestions. Never called directly from the browser
// with the Anthropic key — the key lives only in this server route.

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// ─── Rate limiting ────────────────────────────────────────────────
// Simple in-memory map for dev. In production, swap for Upstash Redis.
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;      // max requests per window
const RATE_WINDOW = 60_000; // 1 minute in ms

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// ─── Sentiment prompts per star rating ───────────────────────────
const sentimentGuide: Record<number, string> = {
  1: "Politely dissatisfied. Mentions 1-2 specific problems. Constructive, not aggressive. Leaves room for improvement.",
  2: "Mild frustration. Acknowledges some positives but clearly underwhelmed. Fair and honest.",
  3: "Balanced mixed experience. Some things good, some average. Not particularly excited.",
  4: "Genuinely positive and specific. Highlights what stood out. Realistic — not gushing.",
  5: "Enthusiastic and authentic. Specific details that only a real customer would mention. Warm personal tone.",
};

// ─── Request validation ───────────────────────────────────────────
interface GenerateRequest {
  stars: number;
  businessName: string;
  category: string;
  location: string;
  keywords: string;
  services: string;
  tone: string;
  language: string;
  count: number; // 2–4
}

export async function POST(req: NextRequest) {
  // 1. Rate limit by IP
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute." },
      { status: 429 }
    );
  }

  // 2. Parse + validate body
  let body: GenerateRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { stars, businessName, category, location, keywords, services, tone, language, count } = body;

  if (!stars || stars < 1 || stars > 5) {
    return NextResponse.json({ error: "stars must be 1–5" }, { status: 400 });
  }
  if (!businessName || !category) {
    return NextResponse.json({ error: "businessName and category are required" }, { status: 400 });
  }

  const numReviews = Math.min(Math.max(count ?? 3, 2), 4);
  const starsDisplay = "★".repeat(stars) + "☆".repeat(5 - stars);

  // 3. Build prompt
  const systemPrompt = `You are a review-writing assistant. Your job is to generate realistic, human-sounding review suggestions that customers can choose to post on Google.

IMPORTANT RULES:
- Every review must feel written by a real person, not an AI
- Never use: "I must say", "needless to say", "I have to say", "truly", "absolutely wonderful"
- Vary sentence structure and length naturally
- Include specific believable details — not just generic praise/complaints
- Match the star rating's emotional tone precisely
- Respond ONLY with valid JSON — no markdown, no explanation, no preamble`;

  const userPrompt = `Generate ${numReviews} review suggestions for this business:

Business: ${businessName}
Category: ${category}
Location: ${location}
Keywords: ${keywords}
Services: ${services}
Brand tone: ${tone}
Language: ${language}
Star rating: ${stars}/5 (${starsDisplay})
Sentiment guide: ${sentimentGuide[stars]}

Make the reviews:
- Short variation: 1–2 sentences, punchy
- Medium variation: 3–4 sentences, specific details
- Long variation: 4–6 sentences, storytelling, personal context
${numReviews === 4 ? "- Extra variation: different angle or use case" : ""}

Return ONLY this JSON (no markdown fences):
{
  "reviews": [
    { "text": "...", "length": "short" },
    { "text": "...", "length": "medium" },
    { "text": "...", "length": "long" }
    ${numReviews === 4 ? `,{ "text": "...", "length": "medium" }` : ""}
  ]
}`;

  // 4. Call Anthropic
  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const raw = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    // Strip any accidental markdown fences
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    // Validate shape before returning
    if (!parsed.reviews || !Array.isArray(parsed.reviews)) {
      throw new Error("Unexpected response shape from AI");
    }

    return NextResponse.json(parsed, { status: 200 });
  } catch (err) {
    console.error("[generate-reviews] Error:", err);
    return NextResponse.json(
      { error: "Failed to generate reviews. Please try again." },
      { status: 500 }
    );
  }
}

// Block all other methods
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
