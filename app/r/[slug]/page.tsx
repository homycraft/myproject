// app/r/[slug]/page.tsx
// Public review funnel — no auth required.
// URL: reviewboost.ai/r/spice-garden

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ReviewFunnel } from "@/components/funnel/ReviewFunnel";
import type { Metadata } from "next";

interface Props {
  params: { slug: string };
}

// Generate OG metadata per business for link previews
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const business = await db.business.findUnique({
    where: { slug: params.slug },
  });
  if (!business) return { title: "Review" };

  return {
    title: `Review ${business.name}`,
    description: `Share your experience at ${business.name} on Google`,
    openGraph: {
      title: `How was your experience at ${business.name}?`,
      description: "Take 60 seconds to share your feedback",
    },
  };
}

export default async function FunnelPage({ params }: Props) {
  const business = await db.business.findUnique({
    where: { slug: params.slug, isActive: true },
  });

  if (!business) notFound();

  // Increment QR scan count (fire-and-forget, don't await)
  db.qRCode
    .updateMany({
      where: { businessId: business.id },
      data: { scanCount: { increment: 1 } },
    })
    .catch(() => {});

  return (
    <ReviewFunnel
      business={{
        id: business.id,
        name: business.name,
        category: business.category,
        location: business.location,
        placeId: business.placeId,
        keywords: business.keywords,
        services: business.services,
        tone: business.tone,
        language: business.language,
        emoji: business.emoji,
        avgRating: business.avgRating ?? 4.8,
        totalReviews: business.totalReviews,
      }}
    />
  );
}
