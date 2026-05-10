// app/api/stripe/webhook/route.ts
// Handles Stripe webhook events to sync subscription status to DB.
// Set webhook URL in Stripe dashboard: https://yourdomain.com/api/stripe/webhook

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { Plan } from "@prisma/client";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
});

// Map Stripe price IDs → internal plan enum
const PRICE_TO_PLAN: Record<string, Plan> = {
  [process.env.STRIPE_STARTER_PRICE_ID!]: Plan.STARTER,
  [process.env.STRIPE_PRO_PRICE_ID!]: Plan.PRO,
};

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("[stripe/webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      // ── Customer created ──────────────────────────────────────
      case "customer.created": {
        const customer = event.data.object as Stripe.Customer;
        const userId = customer.metadata?.userId;
        if (userId) {
          await db.user.update({
            where: { id: userId },
            data: { stripeCustomerId: customer.id },
          });
        }
        break;
      }

      // ── Subscription activated / updated ─────────────────────
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const priceId = sub.items.data[0]?.price.id;
        const plan = PRICE_TO_PLAN[priceId] ?? Plan.FREE;
        const customerId = sub.customer as string;

        await db.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            plan,
            stripeSubId: sub.id,
          },
        });
        break;
      }

      // ── Subscription cancelled / ended ────────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        await db.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: { plan: Plan.FREE, stripeSubId: null },
        });
        break;
      }

      default:
        // Unhandled event — that's fine, just acknowledge it
        break;
    }
  } catch (err) {
    console.error("[stripe/webhook] DB error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// Stripe sends raw body — disable Next.js body parsing
export const config = { api: { bodyParser: false } };
