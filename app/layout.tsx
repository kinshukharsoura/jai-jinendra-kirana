import type { Metadata, Viewport } from "next";import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 1. This colors the phone's top notch/status bar to match your theme
export const viewport: Viewport = {
  themeColor: "#ea580c", 
};

// 2. This changes the name in the browser tab and app installation
export const metadata: Metadata = {
  title: "Jai Jinendra Kirana Store",
  description: "Your premium local grocery store.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
