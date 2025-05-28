
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { AppProviders } from '@/providers/AppProviders';
import { siteConfig } from '@/config/site';
import { MainLayout } from '@/components/layout/MainLayout';

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  // Add more metadata here, like icons, theme color, etc.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={siteConfig.defaultLocale} suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased font-sans`}>
        <AppProviders>
          <MainLayout>
            {children}
          </MainLayout>
        </AppProviders>
      </body>
    </html>
  );
}
