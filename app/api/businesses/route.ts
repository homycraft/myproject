// app/api/businesses/route.ts
// GET  /api/businesses        — list user's businesses
// POST /api/businesses        — create new business

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { z } from "zod";

// ─── Validation schema ────────────────────────────────────────────
const createBusinessSchema = z.object({
  name:        z.string().min(1).max(100),
  category:    z.string().min(1).max(100),
  location:    z.string().min(1).max(200),
  placeId:     z.string().min(1).max(200),
  tone:        z.enum(["friendly", "professional", "enthusiastic", "casual", "formal"]).default("friendly"),
  keywords:    z.string().max(500).default(""),
  services:    z.string().max(1000).default(""),
  language:    z.string().default("English"),
  reviewStyle: z.string().default("mix"),
  emoji:       z.string().max(4).default("🏪"),
});

// ─── Helper: generate unique slug ────────────────────────────────
async function generateSlug(name: string): Promise<string> {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  // Check for conflicts and append random suffix if needed
  let slug = base;
  let attempt = 0;
  while (await db.business.findUnique({ where: { slug } })) {
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    if (++attempt > 10) throw new Error("Could not generate unique slug");
  }
  return slug;
}

// ─── Plan limits ─────────────────────────────────────────────────
const PLAN_BUSINESS_LIMITS: Record<string, number> = {
  FREE:       1,
  STARTER:    3,
  PRO:        10,
  ENTERPRISE: Infinity,
};

// ─── GET ─────────────────────────────────────────────────────────
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businesses = await db.business.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { events: true } },
    },
  });

  return NextResponse.json({ businesses });
}

// ─── POST ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Parse + validate
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = createBusinessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  // Check plan limit
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const existingCount = await db.business.count({ where: { userId } });
  const limit = PLAN_BUSINESS_LIMITS[user.plan] ?? 1;

  if (existingCount >= limit) {
    return NextResponse.json(
      { error: `Your ${user.plan} plan allows up to ${limit} business${limit > 1 ? "es" : ""}. Upgrade to add more.` },
      { status: 403 }
    );
  }

  // Create
  const slug = await generateSlug(parsed.data.name);
  const business = await db.business.create({
    data: { ...parsed.data, userId, slug },
  });

  return NextResponse.json({ business }, { status: 201 });
}
