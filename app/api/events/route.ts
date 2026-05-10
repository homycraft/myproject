// app/api/events/route.ts
// POST /api/events
// Tracks funnel events: scan, land, star_select, copy, redirect
// No auth required — public funnel sends these anonymously.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

type EventType = "land" | "star_select" | "copy" | "redirect";

interface EventBody {
  type: EventType;
  businessId: string;
  sessionId: string;
  stars?: number;
  reviewText?: string;
}

function hashIp(ip: string): string {
  // One-way hash for GDPR compliance — we never store raw IPs
  return crypto.createHash("sha256").update(ip + process.env.IP_SALT ?? "rb").digest("hex").slice(0, 16);
}

function detectDevice(ua: string): string {
  if (/mobile|android|iphone/i.test(ua)) return "mobile";
  if (/tablet|ipad/i.test(ua)) return "tablet";
  return "desktop";
}

export async function POST(req: NextRequest) {
  let body: EventBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, businessId, sessionId, stars, reviewText } = body;

  if (!type || !businessId || !sessionId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const ua = req.headers.get("user-agent") ?? "";
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  try {
    // Find or create event record for this session
    const existing = await db.reviewEvent.findFirst({
      where: { businessId, sessionId },
    });

    if (!existing) {
      // First event for this session — create the record
      await db.reviewEvent.create({
        data: {
          businessId,
          sessionId,
          stars: type === "star_select" ? stars : null,
          copied: type === "copy",
          redirected: type === "redirect",
          reviewText: type === "copy" ? reviewText : null,
          device: detectDevice(ua),
          userAgent: ua,
          ipHash: hashIp(ip),
        },
      });
    } else {
      // Update existing session record with progression
      await db.reviewEvent.update({
        where: { id: existing.id },
        data: {
          ...(type === "star_select" && stars ? { stars } : {}),
          ...(type === "copy" ? { copied: true, reviewText } : {}),
          ...(type === "redirect" ? { redirected: true } : {}),
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Non-critical — don't block the user if analytics fails
    console.error("[events] Error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
