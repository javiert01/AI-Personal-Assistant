import prisma from "../../lib/prisma";
import type {
  Prisma,
  SpotifyStreamingHistory,
  Track,
} from "../app/generated/prisma/client";

export type DateRange = {
  start: Date;
  end: Date;
};

export type StreamingHistoryWithTrack = SpotifyStreamingHistory & {
  track: Track | null;
};

export type TrackAggregate = {
  trackId: string | null;
  trackName: string;
  artistName: string;
  albumName: string;
  totalMsPlayed: number;
  playCount: number;
};

export type ArtistAggregate = {
  artistName: string;
  totalMsPlayed: number;
  playCount: number;
};

export type AlbumAggregate = {
  albumName: string;
  artistName: string;
  totalMsPlayed: number;
  playCount: number;
};

export type SkipRateByTrack = {
  trackId: string | null;
  trackName: string;
  artistName: string;
  albumName: string;
  totalCount: number;
  skippedCount: number;
  skipRate: number;
};

function clampRange(range?: DateRange): Prisma.DateTimeFilter | undefined {
  if (!range) return undefined;
  return {
    gte: range.start,
    lte: range.end,
  };
}

function rangeWhere(range?: DateRange): Prisma.SpotifyStreamingHistoryWhereInput {
  if (!range) return {};
  return { ts: clampRange(range) };
}

export function whereStreamingByYear(year: number): Prisma.SpotifyStreamingHistoryWhereInput {
  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
  return {
    ts: { gte: start, lte: end },
  };
}

export function whereStreamingByDateRange(
  start: Date,
  end: Date,
): Prisma.SpotifyStreamingHistoryWhereInput {
  return { ts: { gte: start, lte: end } };
}

export function whereStreamingByTrack(trackId: string): Prisma.SpotifyStreamingHistoryWhereInput {
  return { trackId };
}

export function whereStreamingByArtist(
  artistName: string,
): Prisma.SpotifyStreamingHistoryWhereInput {
  return { track: { is: { artistName } } };
}

export function whereStreamingByAlbum(
  albumName: string,
): Prisma.SpotifyStreamingHistoryWhereInput {
  return { track: { is: { albumName } } };
}

export function whereStreamingByGenre(
  genre: string,
): Prisma.SpotifyStreamingHistoryWhereInput {
  return { track: { is: { genre } } };
}

export function whereStreamingBySkipped(
  skipped: boolean,
): Prisma.SpotifyStreamingHistoryWhereInput {
  return { skipped };
}

export function whereStreamingByMinMsPlayed(
  minMs: number,
): Prisma.SpotifyStreamingHistoryWhereInput {
  return { msPlayed: { gte: minMs } };
}

export function whereStreamingByShuffle(
  shuffle: boolean,
): Prisma.SpotifyStreamingHistoryWhereInput {
  return { shuffle };
}

export function whereStreamingByCountry(
  connCountry: string,
): Prisma.SpotifyStreamingHistoryWhereInput {
  return { connCountry };
}

export function whereStreamingByPlatform(
  platform: string,
): Prisma.SpotifyStreamingHistoryWhereInput {
  return { platform };
}

export async function getTopTracksByMsPlayed(
  limit: number,
  range?: DateRange,
  minMs = 0,
): Promise<TrackAggregate[]> {
  const grouped = await prisma.spotifyStreamingHistory.groupBy({
    by: ["trackId"],
    where: {
      trackId: { not: null },
      msPlayed: { gte: minMs },
      ...rangeWhere(range),
    },
    _sum: { msPlayed: true },
    _count: { trackId: true },
    orderBy: { _sum: { msPlayed: "desc" } },
    take: limit,
  });

  const trackIds = grouped.map((row) => row.trackId).filter(Boolean) as string[];
  const tracks = await prisma.track.findMany({
    where: { id: { in: trackIds } },
  });
  const trackById = new Map(tracks.map((track) => [track.id, track]));

  return grouped
    .map((row) => {
      const track = row.trackId ? trackById.get(row.trackId) : null;
      if (!track) return null;
      const item: TrackAggregate = {
        trackId: track.id,
        trackName: track.trackName,
        artistName: track.artistName,
        albumName: track.albumName,
        totalMsPlayed: row._sum?.msPlayed ?? 0,
        playCount: row._count?.trackId ?? 0,
      };
      return item;
    })
    .filter((row): row is TrackAggregate => Boolean(row));
}

export async function getTopArtistsByMsPlayed(
  limit: number,
  range?: DateRange,
  minMs = 0,
): Promise<ArtistAggregate[]> {
  const grouped = await prisma.spotifyStreamingHistory.groupBy({
    by: ["trackId"],
    where: {
      trackId: { not: null },
      msPlayed: { gte: minMs },
      ...rangeWhere(range),
    },
    _sum: { msPlayed: true },
    _count: { trackId: true },
  });

  const trackIds = grouped.map((row) => row.trackId).filter(Boolean) as string[];
  const tracks = await prisma.track.findMany({
    where: { id: { in: trackIds } },
    select: { id: true, artistName: true },
  });
  const artistByTrackId = new Map(tracks.map((track) => [track.id, track.artistName]));

  const aggregates = new Map<string, ArtistAggregate>();
  for (const row of grouped) {
    if (!row.trackId) continue;
    const artistName = artistByTrackId.get(row.trackId);
    if (!artistName) continue;
    const existing = aggregates.get(artistName) ?? {
      artistName,
      totalMsPlayed: 0,
      playCount: 0,
    };
    existing.totalMsPlayed += row._sum?.msPlayed ?? 0;
    existing.playCount += row._count?.trackId ?? 0;
    aggregates.set(artistName, existing);
  }

  return Array.from(aggregates.values())
    .sort((a, b) => b.totalMsPlayed - a.totalMsPlayed)
    .slice(0, limit);
}

export async function getTopAlbumsByMsPlayed(
  limit: number,
  range?: DateRange,
  minMs = 0,
): Promise<AlbumAggregate[]> {
  const grouped = await prisma.spotifyStreamingHistory.groupBy({
    by: ["trackId"],
    where: {
      trackId: { not: null },
      msPlayed: { gte: minMs },
      ...rangeWhere(range),
    },
    _sum: { msPlayed: true },
    _count: { trackId: true },
  });

  const trackIds = grouped.map((row) => row.trackId).filter(Boolean) as string[];
  const tracks = await prisma.track.findMany({
    where: { id: { in: trackIds } },
    select: { id: true, albumName: true, artistName: true },
  });
  const albumByTrackId = new Map(tracks.map((track) => [track.id, track]));

  const aggregates = new Map<string, AlbumAggregate>();
  for (const row of grouped) {
    if (!row.trackId) continue;
    const track = albumByTrackId.get(row.trackId);
    if (!track) continue;
    const key = `${track.albumName}||${track.artistName}`;
    const existing = aggregates.get(key) ?? {
      albumName: track.albumName,
      artistName: track.artistName,
      totalMsPlayed: 0,
      playCount: 0,
    };
    existing.totalMsPlayed += row._sum?.msPlayed ?? 0;
    existing.playCount += row._count?.trackId ?? 0;
    aggregates.set(key, existing);
  }

  return Array.from(aggregates.values())
    .sort((a, b) => b.totalMsPlayed - a.totalMsPlayed)
    .slice(0, limit);
}

export async function getTopSkippedTracks(
  limit: number,
  range?: DateRange,
): Promise<TrackAggregate[]> {
  const grouped = await prisma.spotifyStreamingHistory.groupBy({
    by: ["trackId"],
    where: {
      trackId: { not: null },
      skipped: true,
      ...rangeWhere(range),
    },
    _count: { trackId: true },
    _sum: { msPlayed: true },
    orderBy: { _count: { trackId: "desc" } },
    take: limit,
  });

  const trackIds = grouped.map((row) => row.trackId).filter(Boolean) as string[];
  const tracks = await prisma.track.findMany({
    where: { id: { in: trackIds } },
  });
  const trackById = new Map(tracks.map((track) => [track.id, track]));

  return grouped
    .map((row) => {
      const track = row.trackId ? trackById.get(row.trackId) : null;
      if (!track) return null;
      const item: TrackAggregate = {
        trackId: track.id,
        trackName: track.trackName,
        artistName: track.artistName,
        albumName: track.albumName,
        totalMsPlayed: row._sum?.msPlayed ?? 0,
        playCount: row._count?.trackId ?? 0,
      };
      return item;
    })
    .filter((row): row is TrackAggregate => Boolean(row));
}

export async function getTopRepeatedTracks(
  limit: number,
  range?: DateRange,
): Promise<TrackAggregate[]> {
  const grouped = await prisma.spotifyStreamingHistory.groupBy({
    by: ["trackId"],
    where: {
      trackId: { not: null },
      ...rangeWhere(range),
    },
    _count: { trackId: true },
    _sum: { msPlayed: true },
    orderBy: { _count: { trackId: "desc" } },
    take: limit,
  });

  const trackIds = grouped.map((row) => row.trackId).filter(Boolean) as string[];
  const tracks = await prisma.track.findMany({
    where: { id: { in: trackIds } },
  });
  const trackById = new Map(tracks.map((track) => [track.id, track]));

  return grouped
    .map((row) => {
      const track = row.trackId ? trackById.get(row.trackId) : null;
      if (!track) return null;
      const item: TrackAggregate = {
        trackId: track.id,
        trackName: track.trackName,
        artistName: track.artistName,
        albumName: track.albumName,
        totalMsPlayed: row._sum?.msPlayed ?? 0,
        playCount: row._count?.trackId ?? 0,
      };
      return item;
    })
    .filter((row): row is TrackAggregate => Boolean(row));
}

export async function getSkipRateByTrack(
  range?: DateRange,
): Promise<SkipRateByTrack[]> {
  const total = await prisma.spotifyStreamingHistory.groupBy({
    by: ["trackId"],
    where: {
      trackId: { not: null },
      ...rangeWhere(range),
    },
    _count: { trackId: true },
  });

  const skipped = await prisma.spotifyStreamingHistory.groupBy({
    by: ["trackId"],
    where: {
      trackId: { not: null },
      skipped: true,
      ...rangeWhere(range),
    },
    _count: { trackId: true },
  });

  const skippedByTrackId = new Map(
    skipped.map((row) => [row.trackId, row._count?.trackId ?? 0]),
  );

  const trackIds = total.map((row) => row.trackId).filter(Boolean) as string[];
  const tracks = await prisma.track.findMany({
    where: { id: { in: trackIds } },
  });
  const trackById = new Map(tracks.map((track) => [track.id, track]));

  return total
    .map((row) => {
      if (!row.trackId) return null;
      const track = trackById.get(row.trackId);
      if (!track) return null;
      const totalCount = row._count?.trackId ?? 0;
      const skippedCount = skippedByTrackId.get(row.trackId) ?? 0;
      const item: SkipRateByTrack = {
        trackId: track.id,
        trackName: track.trackName,
        artistName: track.artistName,
        albumName: track.albumName,
        totalCount,
        skippedCount,
        skipRate: totalCount === 0 ? 0 : skippedCount / totalCount,
      };
      return item;
    })
    .filter((row): row is SkipRateByTrack => Boolean(row));
}

export function filterRecordsByYear(records: StreamingHistoryWithTrack[], year: number) {
  return records.filter((record) => record.ts.getUTCFullYear() === year);
}

export function filterRecordsByDateRange(
  records: StreamingHistoryWithTrack[],
  start: Date,
  end: Date,
) {
  return records.filter((record) => record.ts >= start && record.ts <= end);
}

export function filterRecordsByArtist(
  records: StreamingHistoryWithTrack[],
  artistName: string,
) {
  return records.filter((record) => record.track?.artistName === artistName);
}

export function filterRecordsByAlbum(
  records: StreamingHistoryWithTrack[],
  albumName: string,
) {
  return records.filter((record) => record.track?.albumName === albumName);
}

export function filterRecordsByGenre(
  records: StreamingHistoryWithTrack[],
  genre: string,
) {
  return records.filter((record) => record.track?.genre === genre);
}

export function filterRecordsBySkipped(
  records: StreamingHistoryWithTrack[],
  skipped = true,
) {
  return records.filter((record) => record.skipped === skipped);
}

export function filterRecordsByMinMsPlayed(
  records: StreamingHistoryWithTrack[],
  minMs: number,
) {
  return records.filter((record) => record.msPlayed >= minMs);
}

export function getMostListenedTracks(
  records: StreamingHistoryWithTrack[],
  options: { limit?: number; minMs?: number } = {},
): TrackAggregate[] {
  const limit = options.limit ?? 50;
  const minMs = options.minMs ?? 0;
  const aggregates = new Map<string, TrackAggregate>();

  for (const record of records) {
    if (!record.track) continue;
    if (record.msPlayed < minMs) continue;
    const key = record.trackId ?? `${record.track.trackName}||${record.track.artistName}`;
    const existing = aggregates.get(key) ?? {
      trackId: record.trackId ?? null,
      trackName: record.track.trackName,
      artistName: record.track.artistName,
      albumName: record.track.albumName,
      totalMsPlayed: 0,
      playCount: 0,
    };
    existing.totalMsPlayed += record.msPlayed;
    existing.playCount += 1;
    aggregates.set(key, existing);
  }

  return Array.from(aggregates.values())
    .sort((a, b) => b.totalMsPlayed - a.totalMsPlayed)
    .slice(0, limit);
}

export function getMostListenedArtists(
  records: StreamingHistoryWithTrack[],
  options: { limit?: number; minMs?: number } = {},
): ArtistAggregate[] {
  const limit = options.limit ?? 50;
  const minMs = options.minMs ?? 0;
  const aggregates = new Map<string, ArtistAggregate>();

  for (const record of records) {
    const artistName = record.track?.artistName;
    if (!artistName) continue;
    if (record.msPlayed < minMs) continue;
    const existing = aggregates.get(artistName) ?? {
      artistName,
      totalMsPlayed: 0,
      playCount: 0,
    };
    existing.totalMsPlayed += record.msPlayed;
    existing.playCount += 1;
    aggregates.set(artistName, existing);
  }

  return Array.from(aggregates.values())
    .sort((a, b) => b.totalMsPlayed - a.totalMsPlayed)
    .slice(0, limit);
}

export function getMostSkippedTracks(
  records: StreamingHistoryWithTrack[],
  options: { limit?: number } = {},
): TrackAggregate[] {
  const limit = options.limit ?? 50;
  const aggregates = new Map<string, TrackAggregate>();

  for (const record of records) {
    if (!record.track || !record.skipped) continue;
    const key = record.trackId ?? `${record.track.trackName}||${record.track.artistName}`;
    const existing = aggregates.get(key) ?? {
      trackId: record.trackId ?? null,
      trackName: record.track.trackName,
      artistName: record.track.artistName,
      albumName: record.track.albumName,
      totalMsPlayed: 0,
      playCount: 0,
    };
    existing.totalMsPlayed += record.msPlayed;
    existing.playCount += 1;
    aggregates.set(key, existing);
  }

  return Array.from(aggregates.values())
    .sort((a, b) => b.playCount - a.playCount)
    .slice(0, limit);
}

export function getMostSkippedArtists(
  records: StreamingHistoryWithTrack[],
  options: { limit?: number } = {},
): ArtistAggregate[] {
  const limit = options.limit ?? 50;
  const aggregates = new Map<string, ArtistAggregate>();

  for (const record of records) {
    const artistName = record.track?.artistName;
    if (!artistName || !record.skipped) continue;
    const existing = aggregates.get(artistName) ?? {
      artistName,
      totalMsPlayed: 0,
      playCount: 0,
    };
    existing.totalMsPlayed += record.msPlayed;
    existing.playCount += 1;
    aggregates.set(artistName, existing);
  }

  return Array.from(aggregates.values())
    .sort((a, b) => b.playCount - a.playCount)
    .slice(0, limit);
}

export function getTotalMsPlayedByTrack(
  records: StreamingHistoryWithTrack[],
): TrackAggregate[] {
  return getMostListenedTracks(records, { limit: Number.MAX_SAFE_INTEGER });
}

export function getTotalMsPlayedByArtist(
  records: StreamingHistoryWithTrack[],
): ArtistAggregate[] {
  return getMostListenedArtists(records, { limit: Number.MAX_SAFE_INTEGER });
}

export function getSkipRateByTrackFromRecords(
  records: StreamingHistoryWithTrack[],
): SkipRateByTrack[] {
  const totals = new Map<string, SkipRateByTrack>();

  for (const record of records) {
    if (!record.track) continue;
    const key = record.trackId ?? `${record.track.trackName}||${record.track.artistName}`;
    const existing = totals.get(key) ?? {
      trackId: record.trackId ?? null,
      trackName: record.track.trackName,
      artistName: record.track.artistName,
      albumName: record.track.albumName,
      totalCount: 0,
      skippedCount: 0,
      skipRate: 0,
    };
    existing.totalCount += 1;
    if (record.skipped) existing.skippedCount += 1;
    totals.set(key, existing);
  }

  return Array.from(totals.values()).map((row) => ({
    ...row,
    skipRate: row.totalCount === 0 ? 0 : row.skippedCount / row.totalCount,
  }));
}
