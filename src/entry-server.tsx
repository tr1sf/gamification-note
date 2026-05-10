import {
  createHandler,
  StartServer,
} from "@solidjs/start/server";

const themeScript =
  "(function(){var t=localStorage.getItem('theme');if(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)t='dark';if(t)document.documentElement.setAttribute('data-theme',t);})()";

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
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
