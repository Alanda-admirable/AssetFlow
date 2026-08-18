import type { Metadata } from "next";
import { Noto_Sans_Thai, IBM_Plex_Sans_Thai } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-body",
  subsets: ["thai", "latin"],
});

const ibmPlexThai = IBM_Plex_Sans_Thai({
  variable: "--font-display",
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "assetflow.local";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const baseUrl = `${protocol}://${host}`;
  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: "AssetFlow — ระบบบริหารครุภัณฑ์",
      template: "%s | AssetFlow",
    },
    description: "ทะเบียน ยืม–คืน โอนย้าย ซ่อม ตรวจนับ และติดตามวงจรชีวิตครุภัณฑ์ในระบบเดียว",
    applicationName: "AssetFlow",
    openGraph: {
      title: "AssetFlow — ทุกครุภัณฑ์ มีที่มา มีเจ้าของ และตรวจสอบได้",
      description: "ระบบบริหารครุภัณฑ์ครบวงจรสำหรับหน่วยงานยุคใหม่",
      type: "website",
      images: [{ url: `${baseUrl}/og.png`, width: 1672, height: 909, alt: "AssetFlow ระบบบริหารครุภัณฑ์ครบวงจร" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "AssetFlow — ระบบบริหารครุภัณฑ์ครบวงจร",
      description: "ทะเบียน ยืม–คืน อนุมัติ ซ่อม ตรวจนับ และรายงานในระบบเดียว",
      images: [`${baseUrl}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body
        className={`${notoSansThai.variable} ${ibmPlexThai.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
