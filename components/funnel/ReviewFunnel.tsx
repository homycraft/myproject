"use client";
// components/funnel/ReviewFunnel.tsx
// Full customer-facing funnel: star select → AI generate → copy → redirect

import { useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";

// ─── Types ────────────────────────────────────────────────────────
interface Business {
  id: string;
  name: string;
  category: string;
  location: string;
  placeId: string;
  keywords: string;
  services: string;
  tone: string;
  language: string;
  emoji: string;
  avgRating: number;
  totalReviews: number;
}

interface Review {
  text: string;
  length: "short" | "medium" | "long";
}

type Step = "stars" | "generating" | "suggestions" | "redirect";

// Stable session ID per page load (anonymous tracking)
const SESSION_ID = uuidv4();

const STAR_HINTS: Record<number, string> = {
  1: "We're sorry to hear that — your feedback helps us improve.",
  2: "Thanks for your honesty.",
  3: "A mixed experience — that's valuable feedback.",
  4: "Great! Tell others what stood out.",
  5: "Amazing! Your review will mean the world 🙏",
};

// ─── Component ────────────────────────────────────────────────────
export function ReviewFunnel({ business }: { business: Business }) {
  const [step, setStep] = useState<Step>("stars");
  const [selectedStars, setSelectedStars] = useState(0);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [copiedReview, setCopiedReview] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [error, setError] = useState("");

  // ── Track event (fire-and-forget) ─────────────────────────────
  const track = useCallback(
    async (type: string, extra: Record<string, unknown> = {}) => {
      try {
        await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            businessId: business.id,
            sessionId: SESSION_ID,
            ...extra,
          }),
        });
      } catch {
        // Non-critical — never block UX
      }
    },
    [business.id]
  );

  // ── Star selection ─────────────────────────────────────────────
  const handleStarSelect = useCallback(
    async (stars: number) => {
      setSelectedStars(stars);
      await track("star_select", { stars });
      setTimeout(() => generateReviews(stars), 500);
    },
    [track]
  );

  // ── AI generation ──────────────────────────────────────────────
  const generateReviews = useCallback(
    async (stars: number) => {
      setStep("generating");
      setError("");

      try {
        const res = await fetch("/api/generate-reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stars,
            businessName: business.name,
            category: business.category,
            location: business.location,
            keywords: business.keywords,
            services: business.services,
            tone: business.tone,
            language: business.language,
            count: 3,
          }),
        });

        if (!res.ok) throw new Error("Generation failed");
        const data = await res.json();
        setReviews(data.reviews);
        setStep("suggestions");
      } catch {
        setError("Couldn't generate reviews. Please try again.");
        setStep("stars");
      }
    },
    [business]
  );

  // ── Copy review ───────────────────────────────────────────────
  const handleCopyReview = useCallback(
    async (text: string) => {
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(text);
        } else {
          // Fallback for older browsers
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.cssText = "position:fixed;opacity:0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
      } catch {
        // Clipboard can fail silently — UX still works
      }

      setCopiedReview(text);
      await track("copy", { reviewText: text, stars: selectedStars });

      // Show toast
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 2800);

      // Move to redirect step after toast
      setTimeout(() => setStep("redirect"), 1400);
    },
    [track, selectedStars]
  );

  // ── Redirect to Google ────────────────────────────────────────
  const handleGoogleRedirect = useCallback(async () => {
    await track("redirect");
    const url = `https://search.google.com/local/writereview?placeid=${business.placeId}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [track, business.placeId]);

  const starsLabel = "★".repeat(selectedStars) + "☆".repeat(5 - selectedStars);

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-950 to-slate-950 flex items-start justify-center py-8 px-4">
      {/* Funnel card */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl">

        {/* Business hero */}
        <div className="bg-gradient-to-br from-indigo-950 to-slate-900 p-8 text-center border-b border-slate-700">
          <div className="text-5xl mb-3">{business.emoji}</div>
          <h1 className="text-xl font-semibold text-white mb-1">{business.name}</h1>
          <p className="text-slate-400 text-sm">{business.category} · {business.location}</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="text-yellow-400 text-sm">{"★".repeat(Math.round(business.avgRating))}</span>
            <span className="text-slate-400 text-xs">{business.avgRating.toFixed(1)} · {business.totalReviews.toLocaleString()} reviews</span>
          </div>
        </div>

        {/* Step body */}
        <div className="p-7">

          {/* ── STEP 1: Stars ─── */}
          {step === "stars" && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-2">Step 1 of 3</p>
              <h2 className="text-2xl font-semibold text-white mb-2">How was your experience?</h2>
              <p className="text-slate-400 text-sm mb-7">Your feedback helps other customers and helps us grow.</p>
              {error && <p className="text-red-400 text-sm mb-4 bg-red-950 rounded-lg p-3">{error}</p>}
              <div className="flex gap-2 justify-center mb-6">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => handleStarSelect(n)}
                    className={`w-14 h-14 rounded-2xl text-3xl border transition-all duration-150 
                      ${selectedStars >= n
                        ? "bg-yellow-400/10 border-yellow-400 scale-110"
                        : "bg-slate-800 border-slate-600 hover:border-yellow-400 hover:scale-105"
                      }`}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  >
                    ⭐
                  </button>
                ))}
              </div>
              <p className="text-center text-slate-500 text-sm">
                {selectedStars > 0 ? STAR_HINTS[selectedStars] : "Tap a star to rate your experience"}
              </p>
            </div>
          )}

          {/* ── STEP 2: Generating ─── */}
          {step === "generating" && (
            <div className="py-10 text-center">
              <div className="w-12 h-12 border-4 border-slate-700 border-t-indigo-500 rounded-full mx-auto mb-5 animate-spin" />
              <p className="text-slate-300 text-sm">AI is crafting personalised reviews for you</p>
              <div className="flex gap-1.5 justify-center mt-3">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 3: Suggestions ─── */}
          {step === "suggestions" && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-2">Step 2 of 3</p>
              <h2 className="text-2xl font-semibold text-white mb-1">Pick your review</h2>
              <p className="text-slate-400 text-sm mb-5">
                AI generated these for your{" "}
                <span className="text-yellow-400">{starsLabel}</span> rating. Click any to copy.
              </p>
              <div className="flex flex-col gap-3 mb-4">
                {reviews.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => handleCopyReview(r.text)}
                    className="w-full text-left bg-slate-800 border border-slate-700 rounded-2xl p-4 
                      hover:border-indigo-500 hover:bg-indigo-500/5 transition-all duration-200 
                      active:scale-98 group"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-yellow-400 text-sm">{starsLabel}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide
                        ${r.length === "short" ? "bg-indigo-500/15 text-indigo-300" :
                          r.length === "medium" ? "bg-emerald-500/15 text-emerald-400" :
                          "bg-yellow-500/15 text-yellow-400"}`}>
                        {r.length}
                      </span>
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed">{r.text}</p>
                    <p className="text-slate-500 text-xs mt-2 group-hover:text-indigo-400 transition-colors">
                      ⊕ Click to copy this review
                    </p>
                  </button>
                ))}
              </div>
              <button
                onClick={() => generateReviews(selectedStars)}
                className="w-full py-3 rounded-xl bg-slate-800 border border-slate-700 
                  text-slate-400 text-sm font-medium hover:border-slate-500 hover:text-slate-300 transition-all"
              >
                ↻ Generate different reviews
              </button>
            </div>
          )}

          {/* ── STEP 4: Redirect ─── */}
          {step === "redirect" && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-2">Step 3 of 3</p>
              <h2 className="text-2xl font-semibold text-white mb-2">Post on Google</h2>
              <p className="text-slate-400 text-sm mb-4">Your review is copied and ready to paste.</p>

              {/* Copied preview */}
              <div className="relative bg-slate-800 border border-dashed border-emerald-600 rounded-xl p-4 mb-5">
                <span className="absolute top-3 right-3 text-emerald-400 text-lg">✓</span>
                <p className="text-slate-300 text-sm italic leading-relaxed pr-6">{copiedReview}</p>
              </div>

              {/* Step guide */}
              <div className="bg-slate-800 rounded-xl p-4 mb-5 flex flex-col gap-2.5">
                {[
                  "Click "Post on Google Maps" below",
                  "Select your star rating on Google",
                  "Paste the review (long press → Paste)",
                  "Hit "Post" — done! 🎉",
                ].map((text, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-slate-400 text-sm">{text}</span>
                  </div>
                ))}
              </div>

              {/* Google CTA */}
              <button
                onClick={handleGoogleRedirect}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-xl
                  bg-red-600 hover:bg-red-500 text-white font-semibold text-base
                  transition-all duration-200 hover:-translate-y-0.5 shadow-lg shadow-red-900/40"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Post on Google Maps
              </button>

              <button
                onClick={() => { setStep("stars"); setSelectedStars(0); }}
                className="w-full mt-3 py-3 rounded-xl bg-slate-800 border border-slate-700
                  text-slate-400 text-sm hover:text-slate-300 transition-all"
              >
                ← Try a different rating
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      <div
        className={`fixed bottom-7 left-1/2 -translate-x-1/2 
          bg-emerald-500 text-emerald-950 font-semibold text-sm
          px-5 py-3 rounded-full shadow-xl shadow-emerald-900/40
          flex items-center gap-2 whitespace-nowrap transition-all duration-500
          ${toastVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}
      >
        ✓ Review copied to clipboard!
      </div>
    </div>
  );
}
