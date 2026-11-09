import type { Track } from '../types';

export type TelegramImportTarget = {
  nonce: number;
  title: string;
  artist: string;
  album: string;
  duration?: number;
  query: string;
};

const NOISE = [
  'official\\s*(?:music\\s*)?video',
  'video\\s*oficial',
  'official\\s*audio',
  'audio\\s*oficial',
  'lyric\\s*video',
  'lyrics?',
  'letra',
  'visualizer',
  'hd',
  '4k',
  'mv',
  'remaster(?:ed)?(?:\\s+\\d{4})?',
  'audio',
].join('|');

const BRACKET_NOISE = new RegExp(`\\s*[\\(\\[]\\s*(?:${NOISE})(?:\\s+(?:hd|4k))?\\s*[\\)\\]]`, 'gi');
const TRAILING_NOISE = new RegExp(`\\s*[-–—|]\\s*(?:${NOISE})(?:\\s+(?:hd|4k))?\\s*$`, 'gi');
const PLAIN_TRAILING_NOISE = new RegExp(`\\s+(?:${NOISE})(?:\\s+(?:hd|4k))?\\s*$`, 'gi');

function cleanText(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanTitle(value: string): string {
  let title = cleanText(value);
  for (const pattern of [BRACKET_NOISE, TRAILING_NOISE, PLAIN_TRAILING_NOISE]) {
    title = title.replace(pattern, ' ');
  }
  return cleanText(title).replace(/^[\s\-–—|]+|[\s\-–—|]+$/g, '').trim();
}

function cleanArtist(value: string): string {
  return cleanText(value)
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/\s+(?:VEVO|Official)$/i, '')
    .trim();
}

function normalizeForCompare(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Quita el prefijo «Artista - » cuando el título de YouTube repite el canal. */
function stripArtistPrefix(title: string, artist: string): string {
  if (!artist) return title;
  const normalizedTitle = normalizeForCompare(title);
  const normalizedArtist = normalizeForCompare(artist);
  if (!normalizedArtist || !normalizedTitle.startsWith(`${normalizedArtist} `)) return title;
  const stripped = title.replace(new RegExp(`^\\s*${escapeRegExp(artist)}\\s*[-–—|:]\\s*`, 'i'), '').trim();
  return stripped || title;
}

const VARIANT_SUFFIX = /^(?:remix|live|en vivo|cover|instrumental|karaoke|sped up|slowed|version|official|video|audio|lyrics?|letra)\b/i;
const NOISE_PREFIX = /^(?:official|video|audio|music|lyrics?|letra|hd|4k|mv|visualizer)\b/i;

/** Separa «Artista - Canción»; si no es claro, conserva el canal como artista. */
function splitArtistTitle(title: string, channel: string): { title: string; artist: string } {
  const match = title.match(/^(.{2,100}?)\s*[-–—|]\s*(.+)$/);
  if (!match) return { title, artist: channel };
  const prefix = match[1].trim();
  const suffix = match[2].trim();
  if (!prefix || !suffix || NOISE_PREFIX.test(prefix) || VARIANT_SUFFIX.test(suffix)) {
    return { title, artist: channel };
  }
  const normalizedPrefix = normalizeForCompare(prefix);
  const normalizedSuffix = normalizeForCompare(suffix);
  const normalizedChannel = normalizeForCompare(channel);
  // «Canción - Artista»: si el sufijo coincide con el canal o trae varios
  // artistas separados por coma, se invierte.
  if (normalizedChannel && (normalizedSuffix === normalizedChannel
      || normalizedSuffix.split(' ').every(token => normalizedChannel.split(' ').includes(token)))) {
    return { title: prefix, artist: suffix };
  }
  if (suffix.includes(',') && !prefix.includes(',')) {
    return { title: prefix, artist: suffix };
  }
  // «Artista, Artista2 - Canción» o «Artista - Canción».
  if (prefix.includes(',') || normalizedPrefix !== normalizedSuffix) {
    return { title: suffix, artist: prefix };
  }
  return { title, artist: channel };
}

/** Convierte una pista de YouTube en una consulta y una referencia de coincidencia. */
export function buildTelegramImport(track: Track, nonce: number): TelegramImportTarget | null {
  if (!track || (track.sourceType !== 'invidious' && track.sourceType !== 'youtube')) return null;
  const channel = cleanArtist(track.artist || '').slice(0, 200);
  const cleaned = stripArtistPrefix(cleanTitle(track.title || ''), channel);
  const parsed = splitArtistTitle(cleaned, channel);
  const title = parsed.title.slice(0, 200);
  const artist = parsed.artist.slice(0, 200);
  if (!title) return null;
  const normalizedTitle = normalizeForCompare(title);
  const normalizedArtist = normalizeForCompare(artist);
  const includeArtist = !!artist && !!normalizedArtist && !normalizedTitle.includes(normalizedArtist);
  const query = cleanText(includeArtist ? `${artist} ${title}` : title).slice(0, 200);
  if (!query) return null;
  return {
    nonce,
    title,
    artist,
    album: cleanText(track.album || '').slice(0, 200),
    duration: Number.isFinite(track.duration) && track.duration > 0 ? track.duration : undefined,
    query,
  };
}
