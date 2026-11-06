export function youtubeEmbedUrl(videoId: string, origin: string): string {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new Error('ID de YouTube inválido');
  const url = new URL(`https://www.youtube.com/embed/${videoId}`);
  url.searchParams.set('enablejsapi', '1');
  url.searchParams.set('origin', origin);
  url.searchParams.set('autoplay', '1');
  url.searchParams.set('playsinline', '1');
  return url.toString();
}

export function youtubeErrorMessage(code: number): string {
  if (code === 101 || code === 150) return `Error ${code}: el propietario no permite reproducir este vídeo en sitios externos. Ábrelo en YouTube.`;
  if (code === 153) return 'Error 153: YouTube no recibió la identificación del reproductor (Referer). Revisa la política de privacidad, extensiones o la configuración de red; prueba abrirlo en YouTube.';
  if (code === 100) return 'Error 100: el vídeo no existe, es privado o fue eliminado. Prueba abrirlo en YouTube.';
  return `YouTube no pudo reproducir el vídeo (error ${code}). Puede tener restricciones o no estar disponible; prueba abrirlo en YouTube.`;
}
