export default function PrivacyPage() {
  return (
    <div class="min-h-screen bg-surface" data-theme="dark">
      <div class="max-w-2xl mx-auto p-8 prose prose-invert">
        <h1 class="text-2xl font-display font-bold text-ink-primary mb-6">Privacy Policy</h1>

        <h2 class="text-lg font-semibold mt-6">1. Data We Collect</h2>
        <p>TavernoteX stores your account information (email, username), notes, and gamification progress. AI features send anonymized note content to Neuralwatt's API for processing.</p>

        <h2 class="text-lg font-semibold mt-6">2. How We Use Your Data</h2>
        <p>Your data is used to provide the service (note-taking, AI quiz generation). Anonymized aggregate data may be used for academic research on gamification effectiveness.</p>

        <h2 class="text-lg font-semibold mt-6">3. Data Sharing</h2>
        <p>We do not sell your data. Note content is shared with Neuralwatt (AI provider) solely for quiz generation and summarization. No personal identifiers are sent.</p>

        <h2 class="text-lg font-semibold mt-6">4. Your Rights</h2>
        <p>You can delete your account and all associated data at any time by contacting the developer. You can export your notes in Markdown format from the app.</p>

        <h2 class="text-lg font-semibold mt-6">5. Academic Research</h2>
        <p>This app is part of a thesis project on gamification in note-taking apps. Anonymized usage data (XP earned, quiz scores, feature usage) may be included in the thesis. No individual user is identifiable in research outputs.</p>

        <h2 class="text-lg font-semibold mt-6">6. Contact</h2>
        <p>For questions about this privacy policy or to request data deletion, contact the developer at the email provided in the thesis documentation.</p>
      </div>
    </div>
  );
}
