import { Playlist, Track, UserData } from '../types';

function mergeCounts(local: Record<string, number> = {}, server: Record<string, number> = {}): Record<string, number> {
  const result: Record<string, number> = {};
  for (const key of new Set([...Object.keys(local), ...Object.keys(server)])) {
    result[key] = Math.max(Number(local[key]) || 0, Number(server[key]) || 0);
  }
  return result;
}

// No se infieren borrados sin una base común: se conserva cada versión distinta.
export function mergeUserData(local: UserData, server: UserData): UserData {
  const playlists: Playlist[] = local.playlists.map(playlist => ({ ...playlist, tracks: [...playlist.tracks] }));
  const ids = new Set(playlists.map(playlist => playlist.id));
  for (const remote of server.playlists) {
    const original = local.playlists.find(playlist => playlist.id === remote.id);
    if (!original) { playlists.push({ ...remote, tracks: [...remote.tracks] }); ids.add(remote.id); continue; }
    if (JSON.stringify(original) === JSON.stringify(remote)) continue;
    let suffix = 1;
    let id = `${remote.id}-servidor-${suffix}`;
    while (ids.has(id)) id = `${remote.id}-servidor-${++suffix}`;
    ids.add(id);
    playlists.push({ ...remote, id, name: `${remote.name} (servidor)`, tracks: [...remote.tracks] });
  }
  const favorites: Track[] = [...local.favorites50List];
  const favoriteIds = new Set(favorites.map(track => track.id));
  for (const track of server.favorites50List) {
    if (!favoriteIds.has(track.id)) { favorites.push(track); favoriteIds.add(track.id); }
  }
  return {
    playlists,
    favorites50List: favorites,
    userTasteProfile: {
      favoriteArtists: mergeCounts(local.userTasteProfile?.favoriteArtists, server.userTasteProfile?.favoriteArtists),
      favoriteGenres: mergeCounts(local.userTasteProfile?.favoriteGenres, server.userTasteProfile?.favoriteGenres),
    },
  };
}
