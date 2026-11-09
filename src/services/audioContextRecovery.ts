export function watchAudioContextRecovery(
  context: AudioContext,
  shouldResume: () => boolean,
  onError: (error: unknown) => void = error => console.warn('AudioContext recovery failed:', error)
): () => void {
  const handleStateChange = () => {
    if (context.state !== 'suspended' || !shouldResume()) return;
    try {
      void context.resume().catch(onError);
    } catch (error) {
      onError(error);
    }
  };

  context.addEventListener('statechange', handleStateChange);
  return () => context.removeEventListener('statechange', handleStateChange);
}
