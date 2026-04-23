import type { ReactNode } from 'react';
import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className="dark">
      <body className="min-h-screen font-sans">
        {children}
      </body>
    </html>
  );
}
