import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Excel HR Consultancy",
  description: "Recruitment Intelligence Platform",
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