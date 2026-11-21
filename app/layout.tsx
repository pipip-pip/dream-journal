import type { Metadata, Viewport } from "next";
import "./globals.css";
import { themeScript } from "@/components/ThemeToggle";
import { APP_NAME } from "@/lib/config";
import ServiceWorker from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Your day, turned into tonight's dream.",
  // Lets iPhone open it full screen from the Home Screen.
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "black-translucent" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // use the whole screen, including around the notch
  themeColor: "#0b1026",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="night" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
