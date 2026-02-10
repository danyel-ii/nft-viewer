import type { Metadata } from "next";
import { Archivo_Black, JetBrains_Mono, Saira } from "next/font/google";
import "./globals.css";

const fontSans = Saira({
  variable: "--font-saira",
  subsets: ["latin"],
});

const fontDisplay = Archivo_Black({
  variable: "--font-archivo-black",
  subsets: ["latin"],
  weight: "400",
});

const fontMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NFT Trading Card Deck",
  description: "Enter an address or ENS and browse NFTs as a trading card deck.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${fontSans.variable} ${fontDisplay.variable} ${fontMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
