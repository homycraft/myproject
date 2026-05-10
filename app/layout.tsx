// app/layout.tsx
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "ReviewBoost — AI-Powered Google Review Platform",
  description: "Help your customers leave better Google reviews in seconds.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={dmSans.variable}>
        <body className="font-sans antialiased bg-slate-950 text-white">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
