import type { Track } from '../types';

export async function searchYouTube(baseUrl: string, query: string, signal: AbortSignal): Promise<Track[]> {
  const response = await fetch(`${baseUrl}/youtube/search?q=${encodeURIComponent(query.trim().slice(0, 200))}`, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === 'string' ? body.detail : 'No se pudo consultar YouTube.');
  }
  const results: unknown = await response.json();
  if (!Array.isArray(results)) throw new Error('La respuesta de búsqueda de YouTube no es válida.');
  return results.filter((item): item is Track => item && item.sourceType === 'youtube' && typeof item.id === 'string' && /^yt-[A-Za-z0-9_-]{11}$/.test(item.id) && typeof item.title === 'string' && typeof item.artist === 'string');
}

export async function searchYouTubeStream(baseUrl: string, query: string, signal: AbortSignal, limit = 10): Promise<Track[]> {
  const safeLimit = limit === 50 ? 50 : 10;
  const response = await fetch(`${baseUrl}/search_online?q=${encodeURIComponent(query.trim().slice(0, 200))}&limit=${safeLimit}`, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === 'string' ? body.detail : 'No se pudo consultar el catálogo de audio.');
  }
  const results: unknown = await response.json();
  if (!Array.isArray(results)) throw new Error('La respuesta de búsqueda no es válida.');
  return results.filter((item): item is Track => item && item.sourceType === 'invidious' && typeof item.id === 'string' && /^yt-[A-Za-z0-9_-]{11}$/.test(item.id) && item.audioUrl === `/stream_yt?v=${item.id.slice(3)}` && typeof item.title === 'string' && typeof item.artist === 'string');
}
