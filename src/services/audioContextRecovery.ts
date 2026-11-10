export function audioContextNeedsResume(context: AudioContext | null | undefined): boolean {
  const state = (context as unknown as { state?: string } | null | undefined)?.state;
  return state === 'suspended' || state === 'interrupted';
}

export function resumeAudioContextIfNeeded(
  context: AudioContext | null | undefined,
  shouldResume: () => boolean,
  onError: (error: unknown) => void = error => console.warn('AudioContext recovery failed:', error)
): void {
  if (!context || !audioContextNeedsResume(context) || !shouldResume()) return;
  try {
    void Promise.resolve(context.resume()).catch(onError);
  } catch (error) {
    onError(error);
  }
}

export function watchAudioContextRecovery(
  context: AudioContext,
  shouldResume: () => boolean,
  onError: (error: unknown) => void = error => console.warn('AudioContext recovery failed:', error)
): () => void {
  const handleStateChange = () => {
    resumeAudioContextIfNeeded(context, shouldResume, onError);
  };

  context.addEventListener('statechange', handleStateChange);
  return () => context.removeEventListener('statechange', handleStateChange);
}
