import type { Metadata } from "next";
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
  title: "Expense Tracker — CEFANI",
  description:
    "Personal expense tracker with Romanian micro-enterprise tax math.",
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
      <body className="min-h-screen bg-background antialiased">
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
