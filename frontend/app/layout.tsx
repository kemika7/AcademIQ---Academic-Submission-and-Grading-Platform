import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/components/shared/QueryProvider";

export const metadata: Metadata = {
  title: "AcademIQ — AI-powered academic project management",
  description: "Submit, analyze, grade — in one place.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
