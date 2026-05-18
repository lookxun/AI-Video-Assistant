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
  title: "闪念 FlashMuse",
  description: "简单版即梦，聊天式生图生视频工作台",
  icons: {
    icon: [{ url: "/home-assets/logo.png?v=20260518", type: "image/png" }],
    shortcut: [{ url: "/home-assets/logo.png?v=20260518", type: "image/png" }],
    apple: [{ url: "/home-assets/logo.png?v=20260518", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <link rel="icon" href="/home-assets/logo.png?v=20260518-2" type="image/png" />
        <link rel="shortcut icon" href="/home-assets/logo.png?v=20260518-2" type="image/png" />
        <link rel="apple-touch-icon" href="/home-assets/logo.png?v=20260518-2" type="image/png" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
