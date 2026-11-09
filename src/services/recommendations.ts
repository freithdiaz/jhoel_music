import { Track, UserData } from '../types';
import { trackSourcePriority } from './musicSources';

type Taste = UserData['userTasteProfile'];
const normalize = (value: string) => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Orientaciones editoriales, no una afirmación de similitud calculada por Spotify.
const artistGroups = [
  ['beele', 'karol g', 'feid', 'daddy yankee', 'bad bunny', 'j balvin', 'maluma', 'ryan castro'],
  ['ed sheeran', 'maroon 5', 'shawn mendes', 'james arthur', 'lewis capaldi'],
  ['juan luis guerra', 'elvis crespo', 'eddy herrera', 'grupo mania', 'sergio vargas']
];
const genreGroups: [string, string[]][] = [
  ['reggaeton', ['reggaeton', 'regueton', 'urbano latino', 'latin urban']],
  ['merengue', ['merengue', 'mambo']],
  ['salsa', ['salsa']], ['bachata', ['bachata']], ['vallenato', ['vallenato']],
  ['tropical', ['tropical', 'cumbia', 'champeta']],
  ['pop', ['pop', 'singer songwriter', 'acoustic']],
  ['electronic', ['electronic', 'edm', 'house', 'techno']],
];

export function artistGroup(track: Track): string[] | undefined {
  const text = normalize(`${track.artist} ${track.title}`);
  return artistGroups.find(group => group.some(name => text.includes(name)));
}

export function trackGenre(track: Track): string {
  const text = normalize(`${track.genre} ${track.title} ${track.album}`);
  const found = genreGroups.find(([, aliases]) => aliases.some(alias => text.includes(alias)));
  if (found) return found[0];
  const group = artistGroup(track);
  if (group === artistGroups[0]) return 'reggaeton';
  if (group === artistGroups[1]) return 'pop';
  if (group === artistGroups[2]) return 'merengue';
  const raw = normalize(track.genre).trim();
  return ['musica universal', 'musica online', 'unknown', 'sin genero', ''].includes(raw) ? '' : raw;
}

export function relatedReason(current: Track, candidate: Track): string {
  const artist = normalize(current.artist);
  const candidateArtist = normalize(candidate.artist);
  if (artist.length > 2 && !['artista', 'artista oficial', 'unknown', 'various artists'].includes(artist) &&
      ((candidateArtist.length > 2 && (candidateArtist.includes(artist) || artist.includes(candidateArtist))) || normalize(candidate.title).includes(artist))) {
    return 'Coincide con el artista que estás escuchando';
  }
  const group = artistGroup(current);
  if (group && group === artistGroup(candidate)) return 'Artista relacionado con tu canción actual';
  const genre = trackGenre(current);
  if (genre && genre === trackGenre(candidate)) return `Comparte el género ${genre}`;
  return 'Relacionada con tu canción actual';
}

export function recommendationQuery(track: Track, recent: string[] = []): string {
  const group = artistGroup(track);
  const text = normalize(`${track.artist} ${track.title}`);
  const target = group?.find(artist => !text.includes(artist) && !recent.some(item => normalize(item).includes(artist)));
  if (target) return target;
  const genre = trackGenre(track);
  if (genre) return `${genre} musica`;
  return track.artist && !['artista', 'artista oficial'].includes(normalize(track.artist)) ? `${track.artist} musica` : track.title;
}

export function rankRelated(candidates: Track[], current: Track, taste: Taste, recentIds: string[]): Track[] {
  const currentGenre = trackGenre(current);
  const currentGroup = artistGroup(current);
  const artist = normalize(current.artist);
  const artistWeights = Object.entries(taste.favoriteArtists || {}).map(([name, count]) => [normalize(name), count] as const);
  const genreWeights = Object.entries(taste.favoriteGenres || {}).map(([name, count]) => [normalize(name), count] as const);
  const unique = new Map<string, Track>();
  for (const track of candidates) if (track?.id && track.id !== current.id && track.audioUrl && !unique.has(track.id)) unique.set(track.id, track);
  return [...unique.values()].map(track => {
    const candidateArtist = normalize(track.artist);
    const genericArtist = ['artista', 'artista oficial', 'unknown', 'various artists'].includes(artist);
    const sameArtist = !genericArtist && artist.length > 2 && ((candidateArtist.length > 2 && (candidateArtist.includes(artist) || artist.includes(candidateArtist))) || normalize(track.title).includes(artist));
    const candidateGenre = trackGenre(track);
    const relatedGroup = !!currentGroup && currentGroup === artistGroup(track);
    const sameGenre = !!currentGenre && candidateGenre === currentGenre;
    // Only select candidates related to the current listening context.
    if (!sameArtist && !relatedGroup && !sameGenre) return { track, score: -Infinity };
    let score = (sameArtist ? 45 : 0) + (relatedGroup ? 38 : 0) + (sameGenre ? 30 : 0);
    score += Math.min(15, (artistWeights.find(([name]) => name === candidateArtist)?.[1] || 0) * 3);
    score += Math.min(10, (genreWeights.find(([name]) => name === candidateGenre || name === normalize(track.genre))?.[1] || 0) * 2);
    if (recentIds.includes(track.id)) score -= 100;
    return { track, score };
  }).filter(item => item.score > 0).sort((a, b) => trackSourcePriority(a.track) - trackSourcePriority(b.track) || b.score - a.score).map(item => item.track);
}
