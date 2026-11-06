/** Ejemplo fijo del embed oficial, independiente del buscador y la cola. */
export function SpotifyEmbedTest() {
  return (
    <details className="border border-zinc-800 rounded-xl p-3 text-sm text-zinc-300">
      <summary className="cursor-pointer font-semibold">Prueba de embed oficial de Spotify</summary>
      <p className="text-xs text-zinc-400 my-3">
        Ejemplo fijo: Romeo Santos — Propuesta Indecente. Spotify puede ofrecer solo una vista previa o requerir iniciar sesión;
        la disponibilidad y reproducción dependen de Spotify. Es independiente de la cola y puede sonar a la vez que el reproductor de la aplicación.
      </p>
      <iframe
        title="Spotify: Romeo Santos — Propuesta Indecente"
        className="w-full rounded-lg"
        height="152"
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        src="https://open.spotify.com/embed/track/5xmihaGRdgjU25Yps9gFD4"
      />
      <a className="text-xs text-zinc-400 underline" href="https://open.spotify.com/track/5xmihaGRdgjU25Yps9gFD4" target="_blank" rel="noopener noreferrer">
        Abrir la canción en Spotify
      </a>
    </details>
  );
}
