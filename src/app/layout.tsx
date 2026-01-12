import type { Metadata } from "next";
import { Poppins, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { ToastHost } from "@/components/toast-host";
import { RefreshOnEvent } from "@/components/refresh-on-event";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Loopbox",
  description: "AI Music Generation Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${poppins.variable} ${geistMono.variable} antialiased bg-background text-foreground font-sans`}
      >
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="ml-64 flex-1">
            {children}
          </div>
        </div>
        <ToastHost />
        <RefreshOnEvent eventName="refresh-sidebar" />
      </body>
    </html>
  );
}
