import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Soccer Fans World",
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
