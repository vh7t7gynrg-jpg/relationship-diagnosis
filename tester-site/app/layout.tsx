import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://relationship-evidence-lab.pages.dev"),
  title: "关系评测实验室",
  description: "同题独立作答、来源分开比较的单视角与双视角关系评测工具。",
  openGraph: {
    title: "关系评测实验室",
    description: "把双方的说法，整理成可比较的证据。",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "关系评测实验室" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "关系评测实验室",
    description: "把双方的说法，整理成可比较的证据。",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
