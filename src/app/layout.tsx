import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Language Library",
  description: "Homeschool language practice",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
