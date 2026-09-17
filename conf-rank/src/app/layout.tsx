import type { Metadata } from "next";
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
    ? `https://${(process.env.GITHUB_REPOSITORY ?? "rabimba/ranking").split("/")[0]}.github.io/${(process.env.GITHUB_REPOSITORY ?? "rabimba/ranking").split("/")[1]}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ConferenceRank — CS venue rankings, acceptance rates & trends",
    template: "%s",
  },
  description:
    "One-stop shop to evaluate computer-science conference venues: CORE/ICORE ranks, rank history, acceptance-rate trends, topics and top publishing institutions.",
  openGraph: {
    siteName: "ConferenceRank",
    type: "website",
    title: "ConferenceRank — CS venue rankings, acceptance rates & trends",
    description:
      "CORE/ICORE ranks, rank history, acceptance-rate trends, topics and top publishing institutions for computer-science venues.",
  },
  twitter: {
    card: "summary",
    title: "ConferenceRank — CS venue rankings, acceptance rates & trends",
    description:
      "CORE/ICORE ranks, rank history, acceptance-rate trends, topics and top publishing institutions for computer-science venues.",
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/icon.svg`, type: "image/svg+xml" },
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
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
