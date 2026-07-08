import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/ThemeProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Groweasy CSV Importer",
  description: "Intelligently map and import CRM records using Gemini AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <ThemeProvider>
          <main>
            <div className="container">
              <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>Groweasy CRM Importer</h1>
                <p style={{ color: 'var(--text-muted)' }}>Upload messy CSVs and let AI standardize them.</p>
              </header>
              {children}
            </div>
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
