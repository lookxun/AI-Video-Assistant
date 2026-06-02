import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "闪念后台 Management",
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
