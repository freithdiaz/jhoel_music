/** Prueba aislada del reproductor oficial para un enlace conocido, no un buscador. */
export function SoundCloudWidgetTest() {
  return (
    <details className="border border-zinc-800 rounded-xl p-3 text-sm text-zinc-300">
      <summary className="cursor-pointer font-semibold">Prueba de widget oficial de SoundCloud</summary>
      <p className="text-xs text-zinc-400 my-3">
        Ejemplo fijo: Romeo Santos — Propuesta Indecente. La disponibilidad y reproducción dependen de SoundCloud.
        Este reproductor es independiente de la cola de la aplicación.
      </p>
      <iframe
        title="SoundCloud: Romeo Santos — Propuesta Indecente"
        className="w-full rounded-lg"
        height="166"
        loading="lazy"
        allow="autoplay"
        src="https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F256262843"
      />
      <a className="text-xs text-zinc-400 underline" href="https://soundcloud.com/romeo-santos/propuesta-indecente" target="_blank" rel="noopener noreferrer">
        Abrir el enlace en SoundCloud
      </a>
    </details>
  );
}
