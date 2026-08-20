import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KONNEKSJONS",
  description: "A word-grouping puzzle game inspired by IKEA product names.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="border-t border-zinc-200 px-4 py-3 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
          KONNEKSJONS is an unaffiliated fan project. Not affiliated with, endorsed by, or connected to Inter IKEA Systems B.V. This website does not intend to promote IKEA, nor to mock it, but rather to appreciate its place in global culture.
        </footer>
      </body>
    </html>
  );
}
