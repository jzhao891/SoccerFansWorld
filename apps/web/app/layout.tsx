import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fandar AI",
  description: "AI soccer fan trading card generator demo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
