import type { Metadata, Viewport } from "next";
import { Montserrat, Fraunces, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const sans = Montserrat({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz", "SOFT"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Expense Tracker — Project CIP SRL",
  description:
    "Personal expense tracker with Romanian micro-enterprise tax math.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Expense Tracker",
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
    { media: "(prefers-color-scheme: light)", color: "#faf9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1917" },
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
      </body>
    </html>
  );
}
