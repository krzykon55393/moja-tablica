import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moja Tablica",
  description: "Profesjonalna tablica do pracy z figurami, tekstem i szkicami.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
