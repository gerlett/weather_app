import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Wetter Strudengau · Wetterstation Perg/Thurnhof",
  description:
    "Aktuelles Wetter, Vorhersage, Wetterhistorie und Klimaanalyse für Perg/Thurnhof und den Strudengau – live, interaktiv und mobilfreundlich.",
};

export const viewport: Viewport = {
  themeColor: "#020617",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body className={`${inter.variable} antialiased`}>{children}</body>
    </html>
  );
}
