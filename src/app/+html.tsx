import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const base = process.env.EXPO_BASE_URL ?? '';

// Static HTML shell for every web page (build-time only, no client JS here).
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="description" content="Community map of freely pickable apple trees." />
        <meta name="theme-color" content="#F7F8F4" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#131A14" media="(prefers-color-scheme: dark)" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="JabkoZdarma" />
        <link rel="manifest" href={`${base}/manifest.json`} />
        <link rel="apple-touch-icon" href={`${base}/apple-touch-icon.png`} />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: baseStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const baseStyles = `
  body { background-color: #F7F8F4; }
  @media (prefers-color-scheme: dark) {
    body { background-color: #131A14; }
  }
  html, body, #root { height: 100%; overscroll-behavior: none; }
`;
