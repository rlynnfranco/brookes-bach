import type { Metadata, Viewport } from "next";
import { Fraunces, Geist } from "next/font/google";
import appleIcon from "./apple-icon.png";
import favicon32 from "./favicon-32.png";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#f4efe6",
};

export const metadata: Metadata = {
  title: "For the Record",
  description: "A private record of Brooke’s weekend.",
  applicationName: "For the Record",
  appleWebApp: {
    capable: true,
    title: "For the Record",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: favicon32.src, sizes: "32x32", type: "image/png" }],
    apple: [{ url: appleIcon.src, sizes: "180x180", type: "image/png" }],
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
