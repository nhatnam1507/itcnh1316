import type { Metadata, Viewport } from "next";
import { Chakra_Petch, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin", "latin-ext", "vietnamese"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext", "vietnamese"],
});

// Display face for titles, names and readouts.
const chakraPetch = Chakra_Petch({
  variable: "--font-chakra",
  weight: ["500", "600", "700"],
  subsets: ["latin", "latin-ext", "vietnamese"],
});

export const metadata: Metadata = {
  title: "CLASSNET // Directory",
  description: "Private class directory.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#050608",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${geist.variable} ${geistMono.variable} ${chakraPetch.variable}`}>
      <body className="backdrop">{children}</body>
    </html>
  );
}
