import type { Metadata, Viewport } from "next";
import { Archivo, Manrope, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

/*
 * Type pairing lifted from korbern-app: Archivo on display, Manrope on body.
 *
 * Archivo is variable on BOTH axes (weight 100-900, width 62-125) and the
 * width axis is load-bearing rather than decorative — brand moments can
 * condense a headline without the smeared strokes a scaleX() would give.
 * Manrope handles everything else because this UI lives at 12-14px in dense
 * tables, where a display grotesque that heavy turns to mud.
 */
const display = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-display",
  display: "swap",
});

const sans = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "House Cefani — Project CIP SRL",
  description:
    "Household and business ledger: expenses, invoices, chores, supplements.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "House Cefani",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#131318" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // use the full notch / home-indicator area on iPhone
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-[100dvh] bg-background antialiased">
        <ThemeProvider>
          {children}
          <Toaster
            position="top-right"
            closeButton
            richColors
            toastOptions={{
              classNames: {
                toast:
                  "font-sans border border-border shadow-sm bg-card text-card-foreground",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
