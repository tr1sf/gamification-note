import {
  createHandler,
  StartServer,
} from "@solidjs/start/server";

const themeScript =
  "(function(){var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark')t='dark';document.documentElement.setAttribute('data-theme',t);})()";

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en" data-theme="dark">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/assets/images/favicon.png" />
          <link rel="apple-touch-icon" href="/assets/images/favicon.png" />
          <meta name="theme-color" content="#1a1a2e" />
          <link rel="manifest" href="/manifest.json" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="apple-mobile-web-app-title" content="TavernoteX" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700;800;900&family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=JetBrains+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap"
          />
          <script>{themeScript}</script>
          {assets}
        </head>
        <body class="bg-surface text-ink-primary font-body">
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
