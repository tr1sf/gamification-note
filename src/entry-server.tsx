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
          <title>TavernoteX — Gamified AI Note-Taking App</title>
          <meta name="description" content="AI-powered gamified note-taking with medieval tavern theme. Write notes, complete quests, battle bosses, and join guilds. Built-in AI quiz generation and spaced repetition." />
          <meta name="keywords" content="note-taking, gamification, AI quiz, spaced repetition, productivity, study app, journal, medieval theme" />
          <meta name="author" content="TavernoteX" />
          <meta name="robots" content="index, follow" />
          <link rel="canonical" href="https://gamification-note-production.up.railway.app" />
          {/* Open Graph */}
          <meta property="og:title" content="TavernoteX — Gamified AI Note-Taking App" />
          <meta property="og:description" content="Write notes, battle bosses, join guilds. AI quizzes + spaced repetition built in. Your knowledge adventure starts here." />
          <meta property="og:type" content="website" />
          <meta property="og:url" content="https://gamification-note-production.up.railway.app" />
          <meta property="og:image" content="https://gamification-note-production.up.railway.app/assets/images/favicon.png" />
          <meta property="og:image:width" content="512" />
          <meta property="og:image:height" content="512" />
          <meta property="og:site_name" content="TavernoteX" />
          <meta property="og:locale" content="en_US" />
          {/* Twitter Card */}
          <meta name="twitter:card" content="summary" />
          <meta name="twitter:title" content="TavernoteX — Gamified AI Note-Taking" />
          <meta name="twitter:description" content="AI-powered notes with quests, boss fights, and guilds. Built-in quiz generation." />
          <meta name="twitter:image" content="https://gamification-note-production.up.railway.app/assets/images/favicon.png" />
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
