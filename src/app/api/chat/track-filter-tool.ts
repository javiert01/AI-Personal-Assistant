// src/app/api/chat/track-filter-tool.ts
import { tool } from "ai";
import { z } from "zod";
import {
  getMostListenedByPlayCount,
  getMostListenedByTime,
  getMostListenedArtists,
  getOverallListeningStats,
  type TrackFilters,
} from "./track-filters";

export const filterTracksTool = tool({
  description:
    "Filter and analyze Spotify listening history by various criteria like artist, album, time period, country, or platform. Returns tracks with listening statistics including play count, total time played, and dates. Use this to answer questions about listening habits, top songs, favorite artists, or listening patterns over time. Can also filter within a specific list of track IDs (e.g., from a semantic search result).",
  inputSchema: z.object({
    trackIds: z
      .array(z.string())
      .describe(
        "Optional list of track IDs to filter within. Use this when you want to filter or order tracks from a previous search result (e.g., from searchTrackLyrics). Example: ['track-id-1', 'track-id-2']"
      )
      .optional(),
    artist: z
      .string()
      .describe(
        "Filter by artist name (partial match, case-insensitive). Example: 'Taylor Swift'"
      )
      .optional(),
    album: z
      .string()
      .describe(
        "Filter by album name (partial match, case-insensitive). Example: '1989'"
      )
      .optional(),
    year: z
      .number()
      .describe(
        "Filter by specific year. Example: 2024 for all tracks played in 2024"
      )
      .optional(),
    month: z
      .number()
      .min(1)
      .max(12)
      .describe(
        "Filter by specific month (1-12). Must be used with year parameter. Example: 12 for December"
      )
      .optional(),
    country: z
      .string()
      .describe(
        "Filter by country code where tracks were played. Example: 'US', 'GB', 'DE'"
      )
      .optional(),
    platform: z
      .string()
      .describe(
        "Filter by platform where tracks were played. Example: 'iOS', 'Android', 'Web Player'"
      )
      .optional(),
    startDate: z
      .string()
      .describe(
        "Filter tracks played after this ISO 8601 date. Example: '2024-01-01'"
      )
      .optional(),
    endDate: z
      .string()
      .describe(
        "Filter tracks played before this ISO 8601 date. Example: '2024-12-31'"
      )
      .optional(),
    orderBy: z
      .enum(["playCount", "totalTime"])
      .describe(
        "Order results by 'playCount' (most played) or 'totalTime' (most listening time)"
      )
      .default("playCount"),
    limit: z
      .number()
      .describe("Maximum number of results to return")
      .default(20)
      .optional(),
  }),
  execute: async ({
    trackIds,
    artist,
    album,
    year,
    month,
    country,
    platform,
    startDate,
    endDate,
    orderBy,
    limit = 20,
  }) => {
    console.log("Track filter params:", {
      trackIds: trackIds,
      artist,
      album,
      year,
      month,
      country,
      platform,
      startDate,
      endDate,
      orderBy,
      limit,
    });

    // Build filters object
    const filters: TrackFilters = {};

    if (trackIds) filters.trackIds = trackIds;
    if (artist) filters.artist = artist;
    if (album) filters.album = album;
    if (year) filters.year = year;
    if (month) filters.month = month;
    if (country) filters.country = country;
    if (platform) filters.platform = platform;

    if (startDate || endDate) {
      filters.dateRange = {};
      if (startDate) filters.dateRange.startDate = new Date(startDate);
      if (endDate) filters.dateRange.endDate = new Date(endDate);
    }

    // Execute the appropriate filter function based on orderBy
    const tracks =
      orderBy === "totalTime"
        ? await getMostListenedByTime(filters, limit)
        : await getMostListenedByPlayCount(filters, limit);

    console.log(`Filtered ${tracks.length} tracks`);

    // Format results for the agent
    return {
      tracks: tracks.map((track) => ({
        id: track.trackId,
        trackName: track.trackName,
        artistName: track.artistName,
        albumName: track.albumName,
        playCount: track.playCount,
        totalHoursPlayed: Math.round(track.totalHoursPlayed * 100) / 100, // Round to 2 decimals
        firstPlayed: track.firstPlayed.toISOString(),
        lastPlayed: track.lastPlayed.toISOString(),
      })),
      summary: {
        totalTracks: tracks.length,
        totalPlays: tracks.reduce((sum, t) => sum + t.playCount, 0),
        totalHours:
          Math.round(
            tracks.reduce((sum, t) => sum + t.totalHoursPlayed, 0) * 100
          ) / 100,
      },
    };
  },
});

export const getArtistStatsTool = tool({
  description:
    "Get listening statistics for artists. Returns top artists ranked by play count with total listening time. Use this to answer questions like 'who is my most listened artist' or 'what are my top artists'.",
  inputSchema: z.object({
    year: z
      .number()
      .describe("Filter by specific year. Example: 2024")
      .optional(),
    month: z
      .number()
      .min(1)
      .max(12)
      .describe("Filter by specific month (1-12). Must be used with year.")
      .optional(),
    country: z
      .string()
      .describe("Filter by country code. Example: 'US'")
      .optional(),
    platform: z
      .string()
      .describe("Filter by platform. Example: 'iOS'")
      .optional(),
    limit: z
      .number()
      .describe("Maximum number of artists to return")
      .default(20)
      .optional(),
  }),
  execute: async ({ year, month, country, platform, limit = 20 }) => {
    console.log("Artist stats params:", {
      year,
      month,
      country,
      platform,
      limit,
    });

    // Build filters object
    const filters: Omit<TrackFilters, "artist"> = {};
    if (year) filters.year = year;
    if (month) filters.month = month;
    if (country) filters.country = country;
    if (platform) filters.platform = platform;

    const artists = await getMostListenedArtists(filters, limit);

    console.log(`Found ${artists.length} artists`);

    return {
      artists: artists.map((artist) => ({
        artistName: artist.artistName,
        playCount: artist.playCount,
        totalHoursPlayed: Math.round(artist.totalHoursPlayed * 100) / 100,
      })),
      summary: {
        totalArtists: artists.length,
        totalPlays: artists.reduce((sum, a) => sum + a.playCount, 0),
        totalHours:
          Math.round(
            artists.reduce((sum, a) => sum + a.totalHoursPlayed, 0) * 100
          ) / 100,
      },
    };
  },
});

export const getListeningStatsTool = tool({
  description:
    "Get overall listening statistics including total plays, unique tracks, total listening time, and date range. Use this to answer questions about overall listening habits or to get a summary of listening activity.",
  inputSchema: z.object({
    year: z
      .number()
      .describe("Filter statistics by specific year. Example: 2024")
      .optional(),
    month: z
      .number()
      .min(1)
      .max(12)
      .describe("Filter by specific month (1-12). Must be used with year.")
      .optional(),
    artist: z.string().describe("Get stats for a specific artist").optional(),
    album: z.string().describe("Get stats for a specific album").optional(),
  }),
  execute: async ({ year, month, artist, album }) => {
    console.log("Overall stats params:", { year, month, artist, album });

    // Build filters object
    const filters: TrackFilters = {};
    if (year) filters.year = year;
    if (month) filters.month = month;
    if (artist) filters.artist = artist;
    if (album) filters.album = album;

    const stats = await getOverallListeningStats(filters);

    console.log("Listening stats:", stats);

    return {
      totalPlays: stats.totalPlays,
      uniqueTracks: stats.uniqueTracks,
      totalHoursPlayed: Math.round(stats.totalHoursPlayed * 100) / 100,
      totalDaysPlayed: Math.round(stats.totalDaysPlayed * 100) / 100,
      firstPlay: stats.firstPlay?.toISOString(),
      lastPlay: stats.lastPlay?.toISOString(),
      averagePlaysPerTrack:
        stats.uniqueTracks > 0
          ? Math.round((stats.totalPlays / stats.uniqueTracks) * 100) / 100
          : 0,
    };
  },
});
