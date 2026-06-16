import { createSignal, Show, onMount } from "solid-js";

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = createSignal(false);
  let deferredPrompt: any = null;

  onMount(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      setShowPrompt(true);
    });
  });

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setShowPrompt(false);
    }
    deferredPrompt = null;
  };

  return (
    <Show when={showPrompt()}>
      <div class="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 bg-surface-elevated rounded-xl p-4 border border-accent/30 shadow-lg">
        <p class="text-sm font-medium text-ink-primary mb-2">Install TavernoteX</p>
        <p class="text-xs text-ink-secondary mb-3">Add to your home screen for quick access</p>
        <div class="flex gap-2">
          <button onClick={handleInstall} class="flex-1 py-1.5 bg-accent text-white rounded-lg text-sm font-medium">Install</button>
          <button onClick={() => setShowPrompt(false)} class="px-3 py-1.5 text-ink-secondary text-sm">Not now</button>
        </div>
      </div>
    </Show>
  );
}
