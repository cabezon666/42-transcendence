import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Essential mobile viewport meta tag */}
        <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5" />
        
        {/* Accessibility and SEO meta tags */}
        <meta name="description" content="ft_transcendence - A modern web application with responsive design and accessibility features" />
        <meta name="author" content="ft_transcendence Team" />
        <meta name="robots" content="index, follow" />
        
        {/* Theme color for mobile browsers */}
        <meta name="theme-color" content="#1e293b" />
        <meta name="msapplication-TileColor" content="#1e293b" />
        
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
        
        {/* Prevent zoom on input focus for iOS */}
        <style dangerouslySetInnerHTML={{
          __html: `
            @media screen and (max-width: 768px) {
              input[type="email"],
              input[type="password"],
              input[type="text"],
              select {
                font-size: 16px !important;
              }
            }
          `
        }} />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
