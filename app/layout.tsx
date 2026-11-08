import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "STICKER RUSH — Spin. Collect. Dominate.",
  description: "A multiplayer sticker collecting spin game."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
