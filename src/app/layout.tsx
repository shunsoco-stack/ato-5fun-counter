import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://ato-5fun-counter.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "あと5分カウンター",
    template: "%s | あと5分カウンター",
  },
  description:
    "「あと5分」を押した回数と、崩壊していく予定を可視化する先延ばしカウンター。",
  applicationName: "あと5分カウンター",
  authors: [{ name: "shunsoco-stack" }],
  creator: "shunsoco-stack",
  keywords: ["あと5分", "先延ばし", "カウンター", "時間管理", "PWA"],
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: "/",
    siteName: "あと5分カウンター",
    title: "あと5分カウンター",
    description:
      "押すほど予定が赤く崩れていく、全力でくだらない先延ばし可視化アプリ。",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "あと5分カウンター — 予定は、押すほど崩れていく。",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "あと5分カウンター",
    description: "予定は、押すほど崩れていく。",
    images: ["/og-image.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "あと5分",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

const themeScript = `
  (() => {
    try {
      const saved = localStorage.getItem('ato5fun:theme');
      const theme = saved === 'light' || saved === 'dark'
        ? saved
        : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    } catch (_) {}
  })();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <ServiceWorkerRegistration />
        <Analytics />
      </body>
    </html>
  );
}
