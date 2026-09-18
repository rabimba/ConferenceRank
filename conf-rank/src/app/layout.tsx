import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.GITHUB_ACTIONS === "true"
    ? `https://${(process.env.GITHUB_REPOSITORY ?? "rabimba/ConferenceRank").split("/")[0]}.github.io/${(process.env.GITHUB_REPOSITORY ?? "rabimba/ConferenceRank").split("/")[1]}`
    : "https://rabimba.github.io/ConferenceRank");

const ogImageUrl = `${siteUrl.replace(/\/$/, "")}/og-image.png`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ConferenceRank — CS Venue Rankings, Acceptance Rates & Deadlines",
    template: "%s | ConferenceRank",
  },
  description:
    "Evaluate computer science conferences: CORE/ICORE rankings (A*, A, B, C), multi-year acceptance rates, upcoming submission deadlines (AoE), and research topics across 980+ CS venues.",
  keywords: [
    "computer science conferences",
    "CORE rankings",
    "ICORE rankings",
    "conference acceptance rates",
    "upcoming CS deadlines",
    "AI conference deadlines",
    "call for papers",
    "Anywhere on Earth AoE",
    "conference selectivity",
    "academic publishing",
  ],
  authors: [{ name: "ConferenceRank" }],
  creator: "ConferenceRank",
  publisher: "ConferenceRank",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    siteName: "ConferenceRank",
    type: "website",
    locale: "en_US",
    url: siteUrl,
    title: "ConferenceRank — CS Venue Rankings, Acceptance Rates & Deadlines",
    description:
      "CORE/ICORE rankings, historical acceptance rates, topics, and upcoming submission deadlines for 980+ computer science conferences.",
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: "ConferenceRank — Computer Science Conference Rankings, Acceptance Rates & Deadlines",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ConferenceRank — CS Venue Rankings, Acceptance Rates & Deadlines",
    description:
      "CORE/ICORE rankings, historical acceptance rates, topics, and upcoming submission deadlines for 980+ computer science conferences.",
    images: [ogImageUrl],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/icon.svg`, type: "image/svg+xml" },
    ],
    apple: [
      { url: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/icon.svg` },
    ],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Google tag (gtag.js) */}
        <Script
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=G-Q1D3XG6NY2"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-Q1D3XG6NY2');
          `}
        </Script>

        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
