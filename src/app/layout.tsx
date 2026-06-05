import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GlobalScrollbarController } from "@/components/global-scrollbar-controller";
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
window.addEventListener('error', function (event) {
  try {
    navigator.sendBeacon('/api/client-error', new Blob([JSON.stringify({
      message: event.message,
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error && event.error.stack,
      href: location.href,
      userAgent: navigator.userAgent
    })], { type: 'application/json' }));
  } catch (_) {}
});
window.addEventListener('unhandledrejection', function (event) {
  try {
    var reason = event.reason || {};
    navigator.sendBeacon('/api/client-error', new Blob([JSON.stringify({
      message: reason.message || String(reason),
      stack: reason.stack,
      href: location.href,
      userAgent: navigator.userAgent
    })], { type: 'application/json' }));
  } catch (_) {}
});`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col"><GlobalScrollbarController />{children}</body>
    </html>
  );
}
