import prisma from "../../../../lib/prisma";

/**
 * Track filtering and ordering utilities based on SpotifyStreamingHistory
 */

// ============================================================================
// Types
// ============================================================================

export interface TrackWithStats {
  trackId: string;
  trackName: string;
  artistName: string;
  albumName: string;
  playCount: number;
  totalMsPlayed: number;
  totalHoursPlayed: number;
  firstPlayed: Date;
  lastPlayed: Date;
}

export interface DateRangeFilter {
  startDate?: Date;
  endDate?: Date;
}

export interface TrackFilters {
  trackIds?: string[]; // Filter within specific track IDs (e.g., from semantic search)
  artist?: string;
  album?: string;
  country?: string;
  platform?: string;
  year?: number;
  month?: number; // 1-12
  dateRange?: DateRangeFilter;
}

// ============================================================================
// Most Listened Tracks
// ============================================================================

/**
 * Get most listened tracks by play count
 */
export async function getMostListenedByPlayCount(
  filters?: TrackFilters,
  limit: number = 50
): Promise<TrackWithStats[]> {
  const whereClause = buildWhereClause(filters);

  // Build the where condition, ensuring we don't overwrite the trackId filter
  const where: any = {
    ...whereClause,
  };

  // If trackIds filter exists, combine it with the "not null" check
  if (filters?.trackIds && filters.trackIds.length > 0) {
    // trackId is already filtered in whereClause, just ensure it's not null is implicit
    // since we're filtering by specific IDs
  } else {
    // Only add "not null" if we're not filtering by specific IDs
    where.trackId = { not: null };
  }

  const results = await prisma.spotifyStreamingHistory.groupBy({
    by: ["trackId"],
    where,
    _count: {
      trackId: true,
    },
    _sum: {
      msPlayed: true,
    },
    _min: {
      ts: true,
    },
    _max: {
      ts: true,
    },
    orderBy: {
      _count: {
        trackId: "desc",
      },
    },
    take: limit,
  });
  console.log("Results from getMostListenedByPlayCount:", results);
  // Fetch track details
  const trackIds = results
    .map((r) => r.trackId)
    .filter((id): id is string => id !== null);
  console.log("Track IDs:", trackIds);
  const tracks = await prisma.track.findMany({
    where: { id: { in: trackIds } },
    select: {
      id: true,
      trackName: true,
      artistName: true,
      albumName: true,
    },
  });

  const trackMap = new Map(tracks.map((t) => [t.id, t]));

  return results.map((result) => {
    const track = trackMap.get(result.trackId!);
    const totalMs = result._sum.msPlayed || 0;

    return {
      trackId: result.trackId!,
      trackName: track?.trackName || "Unknown",
      artistName: track?.artistName || "Unknown",
      albumName: track?.albumName || "Unknown",
      playCount: result._count.trackId,
      totalMsPlayed: totalMs,
      totalHoursPlayed: totalMs / (1000 * 60 * 60),
      firstPlayed: result._min.ts!,
      lastPlayed: result._max.ts!,
    };
  });
}

/**
 * Get most listened tracks by total time played
 */
export async function getMostListenedByTime(
  filters?: TrackFilters,
  limit: number = 50
): Promise<TrackWithStats[]> {
  const whereClause = buildWhereClause(filters);

  // Build the where condition, ensuring we don't overwrite the trackId filter
  const where: any = {
    ...whereClause,
  };

  // If trackIds filter exists, combine it with the "not null" check
  if (filters?.trackIds && filters.trackIds.length > 0) {
    // trackId is already filtered in whereClause, just ensure it's not null is implicit
    // since we're filtering by specific IDs
  } else {
    // Only add "not null" if we're not filtering by specific IDs
    where.trackId = { not: null };
  }

  const results = await prisma.spotifyStreamingHistory.groupBy({
    by: ["trackId"],
    where,
    _count: {
      trackId: true,
    },
    _sum: {
      msPlayed: true,
    },
    _min: {
      ts: true,
    },
    _max: {
      ts: true,
    },
    orderBy: {
      _sum: {
        msPlayed: "desc",
      },
    },
    take: limit,
  });
  console.log("Results from getMostListenedByTime:", results);
  const trackIds = results
    .map((r) => r.trackId)
    .filter((id): id is string => id !== null);
  console.log("Track IDs:", trackIds);
  const tracks = await prisma.track.findMany({
    where: { id: { in: trackIds } },
    select: {
      id: true,
      trackName: true,
      artistName: true,
      albumName: true,
    },
  });

  const trackMap = new Map(tracks.map((t) => [t.id, t]));

  return results.map((result) => {
    const track = trackMap.get(result.trackId!);
    const totalMs = result._sum.msPlayed || 0;

    return {
      trackId: result.trackId!,
      trackName: track?.trackName || "Unknown",
      artistName: track?.artistName || "Unknown",
      albumName: track?.albumName || "Unknown",
      playCount: result._count.trackId,
      totalMsPlayed: totalMs,
      totalHoursPlayed: totalMs / (1000 * 60 * 60),
      firstPlayed: result._min.ts!,
      lastPlayed: result._max.ts!,
    };
  });
}

// ============================================================================
// Artist & Album Filters
// ============================================================================

/**
 * Get most listened artists
 */
export async function getMostListenedArtists(
  filters?: Omit<TrackFilters, "artist">,
  limit: number = 50
) {
  const whereClause = buildWhereClause(filters);

  const results = await prisma.spotifyStreamingHistory.findMany({
    where: {
      ...whereClause,
      trackId: { not: null },
    },
    select: {
      trackId: true,
      msPlayed: true,
      track: {
        select: {
          artistName: true,
        },
      },
    },
  });

  // Aggregate by artist
  const artistStats = new Map<
    string,
    { playCount: number; totalMsPlayed: number }
  >();

  for (const record of results) {
    const artistName = record.track?.artistName;
    if (!artistName) continue;

    const stats = artistStats.get(artistName) || {
      playCount: 0,
      totalMsPlayed: 0,
    };
    stats.playCount++;
    stats.totalMsPlayed += record.msPlayed;
    artistStats.set(artistName, stats);
  }

  return Array.from(artistStats.entries())
    .map(([artistName, stats]) => ({
      artistName,
      playCount: stats.playCount,
      totalMsPlayed: stats.totalMsPlayed,
      totalHoursPlayed: stats.totalMsPlayed / (1000 * 60 * 60),
    }))
    .sort((a, b) => b.playCount - a.playCount)
    .slice(0, limit);
}

/**
 * Get tracks by specific artist
 */
export async function getTracksByArtist(
  artistName: string,
  filters?: Omit<TrackFilters, "artist">,
  limit: number = 50
): Promise<TrackWithStats[]> {
  return getMostListenedByPlayCount({ ...filters, artist: artistName }, limit);
}

/**
 * Get tracks by specific album
 */
export async function getTracksByAlbum(
  albumName: string,
  filters?: Omit<TrackFilters, "album">,
  limit: number = 50
): Promise<TrackWithStats[]> {
  return getMostListenedByPlayCount({ ...filters, album: albumName }, limit);
}

// ============================================================================
// Time-based Filters
// ============================================================================

/**
 * Get tracks played in a specific year
 */
export async function getTracksByYear(
  year: number,
  limit: number = 50
): Promise<TrackWithStats[]> {
  return getMostListenedByPlayCount({ year }, limit);
}

/**
 * Get tracks played in a specific month
 */
export async function getTracksByMonth(
  year: number,
  month: number,
  limit: number = 50
): Promise<TrackWithStats[]> {
  return getMostListenedByPlayCount({ year, month }, limit);
}

/**
 * Get tracks played in a date range
 */
export async function getTracksByDateRange(
  startDate: Date,
  endDate: Date,
  limit: number = 50
): Promise<TrackWithStats[]> {
  return getMostListenedByPlayCount(
    { dateRange: { startDate, endDate } },
    limit
  );
}

/**
 * Get listening stats by month (for charting)
 */
export async function getListeningStatsByMonth(year: number) {
  const stats = [];

  for (let month = 1; month <= 12; month++) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const result = await prisma.spotifyStreamingHistory.aggregate({
      where: {
        ts: {
          gte: startDate,
          lte: endDate,
        },
        trackId: { not: null },
      },
      _count: {
        id: true,
      },
      _sum: {
        msPlayed: true,
      },
    });

    stats.push({
      month,
      monthName: new Date(year, month - 1).toLocaleString("default", {
        month: "long",
      }),
      playCount: result._count.id,
      totalMsPlayed: result._sum.msPlayed || 0,
      totalHoursPlayed: (result._sum.msPlayed || 0) / (1000 * 60 * 60),
    });
  }

  return stats;
}

// ============================================================================
// Platform & Country Filters
// ============================================================================

/**
 * Get tracks by platform
 */
export async function getTracksByPlatform(
  platform: string,
  limit: number = 50
): Promise<TrackWithStats[]> {
  return getMostListenedByPlayCount({ platform }, limit);
}

/**
 * Get tracks by country
 */
export async function getTracksByCountry(
  country: string,
  limit: number = 50
): Promise<TrackWithStats[]> {
  return getMostListenedByPlayCount({ country }, limit);
}

/**
 * Get listening stats by platform
 */
export async function getListeningStatsByPlatform() {
  const results = await prisma.spotifyStreamingHistory.groupBy({
    by: ["platform"],
    where: {
      trackId: { not: null },
    },
    _count: {
      id: true,
    },
    _sum: {
      msPlayed: true,
    },
    orderBy: {
      _count: {
        id: "desc",
      },
    },
  });

  return results.map((result) => ({
    platform: result.platform,
    playCount: result._count.id,
    totalMsPlayed: result._sum.msPlayed || 0,
    totalHoursPlayed: (result._sum.msPlayed || 0) / (1000 * 60 * 60),
  }));
}

/**
 * Get listening stats by country
 */
export async function getListeningStatsByCountry() {
  const results = await prisma.spotifyStreamingHistory.groupBy({
    by: ["connCountry"],
    where: {
      trackId: { not: null },
    },
    _count: {
      id: true,
    },
    _sum: {
      msPlayed: true,
    },
    orderBy: {
      _count: {
        id: "desc",
      },
    },
  });

  return results.map((result) => ({
    country: result.connCountry,
    playCount: result._count.id,
    totalMsPlayed: result._sum.msPlayed || 0,
    totalHoursPlayed: (result._sum.msPlayed || 0) / (1000 * 60 * 60),
  }));
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build Prisma where clause from filters
 */
function buildWhereClause(filters?: TrackFilters) {
  if (!filters) return {};

  const where: any = {};

  // Track IDs filter (e.g., from semantic search results)
  if (filters.trackIds && filters.trackIds.length > 0) {
    where.trackId = {
      in: filters.trackIds,
    };
  }

  // Date filters
  if (filters.year || filters.month || filters.dateRange) {
    where.ts = {};

    if (filters.year && filters.month) {
      // Specific month in year
      const startDate = new Date(filters.year, filters.month - 1, 1);
      const endDate = new Date(filters.year, filters.month, 0, 23, 59, 59);
      where.ts.gte = startDate;
      where.ts.lte = endDate;
    } else if (filters.year) {
      // Entire year
      const startDate = new Date(filters.year, 0, 1);
      const endDate = new Date(filters.year, 11, 31, 23, 59, 59);
      where.ts.gte = startDate;
      where.ts.lte = endDate;
    } else if (filters.dateRange) {
      // Custom date range
      if (filters.dateRange.startDate) {
        where.ts.gte = filters.dateRange.startDate;
      }
      if (filters.dateRange.endDate) {
        where.ts.lte = filters.dateRange.endDate;
      }
    }
  }

  // Artist filter
  if (filters.artist) {
    where.track = {
      artistName: {
        contains: filters.artist,
        mode: "insensitive",
      },
    };
  }

  // Album filter
  if (filters.album) {
    where.track = {
      ...where.track,
      albumName: {
        contains: filters.album,
        mode: "insensitive",
      },
    };
  }

  // Platform filter
  if (filters.platform) {
    where.platform = filters.platform;
  }

  // Country filter
  if (filters.country) {
    where.connCountry = filters.country;
  }

  return where;
}

/**
 * Get overall listening statistics
 */
export async function getOverallListeningStats(filters?: TrackFilters) {
  const whereClause = buildWhereClause(filters);

  const stats = await prisma.spotifyStreamingHistory.aggregate({
    where: {
      ...whereClause,
      trackId: { not: null },
    },
    _count: {
      id: true,
    },
    _sum: {
      msPlayed: true,
    },
    _min: {
      ts: true,
    },
    _max: {
      ts: true,
    },
  });

  const uniqueTracks = await prisma.spotifyStreamingHistory.groupBy({
    by: ["trackId"],
    where: {
      ...whereClause,
      trackId: { not: null },
    },
  });

  return {
    totalPlays: stats._count.id,
    totalMsPlayed: stats._sum.msPlayed || 0,
    totalHoursPlayed: (stats._sum.msPlayed || 0) / (1000 * 60 * 60),
    totalDaysPlayed: (stats._sum.msPlayed || 0) / (1000 * 60 * 60 * 24),
    uniqueTracks: uniqueTracks.length,
    firstPlay: stats._min.ts,
    lastPlay: stats._max.ts,
  };
}
