import type { Metadata } from 'next';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import Providers from '../components/Providers';

const siteName = process.env.NEXT_PUBLIC_SITE_NAME;

export const metadata: Metadata = {
  title: siteName ? `MCS — ${siteName}` : 'Maintenance Call System',
  description: 'Industrial maintenance call tracking and andon board',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <AppRouterCacheProvider>
          <Providers>
            {children}
          </Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
