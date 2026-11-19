import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

/** Шрифт бренда (логотип). Самохостится Next.js при сборке. */
const brandFont = Onest({ subsets: ["latin", "cyrillic"], weight: ["600"], variable: "--font-brand-face", display: "swap" });

export const metadata: Metadata = {
  title: "Ритм",
  description: "Личная система задач, проектов и календаря",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={brandFont.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
