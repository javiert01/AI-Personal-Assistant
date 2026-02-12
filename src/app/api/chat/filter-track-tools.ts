// src/app/api/chat/filter-track-tools.ts
import { tool } from "ai";
import { z } from "zod";

import prisma from "../../../../lib/prisma";
import type { Prisma } from "../../generated/prisma/client";
import {
  getSkipRateByTrack,
  getTopAlbumsByMsPlayed,
  getTopArtistsByMsPlayed,
  getTopRepeatedTracks,
  getTopSkippedTracks,
  getTopTracksByMsPlayed,
  whereStreamingByAlbum,
  whereStreamingByArtist,
  whereStreamingByCountry,
  whereStreamingByDateRange,
  whereStreamingByGenre,
  whereStreamingByMinMsPlayed,
  whereStreamingByPlatform,
  whereStreamingByShuffle,
  whereStreamingBySkipped,
  whereStreamingByTrack,
  whereStreamingByYear,
} from "../../../lib/track-filters";

const modeEnum = z.enum([
  "records",
  "top_tracks_by_ms",
  "top_artists_by_ms",
  "top_albums_by_ms",
  "top_skipped_tracks",
  "top_repeated_tracks",
  "skip_rate_by_track",
]);

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function buildWhere({
  year,
  after,
  before,
  trackId,
  artist,
  album,
  genre,
  skipped,
  minMsPlayed,
  shuffle,
  country,
  platform,
}: {
  year?: number;
  after?: string;
  before?: string;
  trackId?: string;
  artist?: string;
  album?: string;
  genre?: string;
  skipped?: boolean;
  minMsPlayed?: number;
  shuffle?: boolean;
  country?: string;
  platform?: string;
}): Prisma.SpotifyStreamingHistoryWhereInput {
  const filters: Prisma.SpotifyStreamingHistoryWhereInput[] = [];

  if (typeof year === "number") {
    filters.push(whereStreamingByYear(year));
  }

  const afterDate = parseDate(after);
  const beforeDate = parseDate(before);
  if (afterDate || beforeDate) {
    const start = afterDate ?? new Date(0);
    const end = beforeDate ?? new Date();
    filters.push(whereStreamingByDateRange(start, end));
  }

  if (trackId) filters.push(whereStreamingByTrack(trackId));
  if (artist) filters.push(whereStreamingByArtist(artist));
  if (album) filters.push(whereStreamingByAlbum(album));
  if (genre) filters.push(whereStreamingByGenre(genre));
  if (typeof skipped === "boolean")
    filters.push(whereStreamingBySkipped(skipped));
  if (typeof minMsPlayed === "number")
    filters.push(whereStreamingByMinMsPlayed(minMsPlayed));
  if (typeof shuffle === "boolean")
    filters.push(whereStreamingByShuffle(shuffle));
  if (country) filters.push(whereStreamingByCountry(country));
  if (platform) filters.push(whereStreamingByPlatform(platform));

  if (filters.length === 0) return {};
  if (filters.length === 1) return filters[0];
  return { AND: filters };
}

export const filterTracksTool = tool({
  description:
    "Filter and aggregate Spotify streaming history records and tracks by time range, artist, album, genre, skip behavior, and more. Use top_* modes for rankings.",
  inputSchema: z.object({
    mode: modeEnum.default("records"),
    year: z.number().int().optional(),
    after: z
      .string()
      .describe("ISO timestamp, e.g. 2024-01-01T00:00:00Z")
      .optional(),
    before: z
      .string()
      .describe("ISO timestamp, e.g. 2024-12-31T23:59:59Z")
      .optional(),
    trackId: z.string().optional(),
    artist: z.string().optional(),
    album: z.string().optional(),
    genre: z.string().optional(),
    skipped: z.boolean().optional(),
    minMsPlayed: z.number().int().optional(),
    shuffle: z.boolean().optional(),
    country: z.string().optional(),
    platform: z.string().optional(),
    limit: z.number().int().default(10),
  }),
  execute: async ({
    mode,
    year,
    after,
    before,
    trackId,
    artist,
    album,
    genre,
    skipped,
    minMsPlayed,
    shuffle,
    country,
    platform,
    limit,
  }) => {
    console.log("Filter Tracks Tool called with:", {
      mode,
      year,
      after,
      before,
      trackId,
      artist,
      album,
      genre,
      skipped,
      minMsPlayed,
      shuffle,
      country,
      platform,
      limit,
    });
    if (mode === "top_tracks_by_ms") {
      return {
        results: await getTopTracksByMsPlayed(
          limit,
          rangeFrom(after, before, year),
          minMsPlayed ?? 0
        ),
      };
    }
    if (mode === "top_artists_by_ms") {
      return {
        results: await getTopArtistsByMsPlayed(
          limit,
          rangeFrom(after, before, year),
          minMsPlayed ?? 0
        ),
      };
    }
    if (mode === "top_albums_by_ms") {
      return {
        results: await getTopAlbumsByMsPlayed(
          limit,
          rangeFrom(after, before, year),
          minMsPlayed ?? 0
        ),
      };
    }
    if (mode === "top_skipped_tracks") {
      return {
        results: await getTopSkippedTracks(
          limit,
          rangeFrom(after, before, year)
        ),
      };
    }
    if (mode === "top_repeated_tracks") {
      return {
        results: await getTopRepeatedTracks(
          limit,
          rangeFrom(after, before, year)
        ),
      };
    }
    if (mode === "skip_rate_by_track") {
      return {
        results: await getSkipRateByTrack(rangeFrom(after, before, year)),
      };
    }

    const where = buildWhere({
      year,
      after,
      before,
      trackId,
      artist,
      album,
      genre,
      skipped,
      minMsPlayed,
      shuffle,
      country,
      platform,
    });

    const records = await prisma.spotifyStreamingHistory.findMany({
      where,
      include: {
        track: true,
      },
      orderBy: { ts: "desc" },
      take: limit,
    });

    return {
      count: records.length,
      records: records.map((record) => ({
        id: record.id,
        ts: record.ts,
        msPlayed: record.msPlayed,
        skipped: record.skipped,
        shuffle: record.shuffle,
        platform: record.platform,
        connCountry: record.connCountry,
        track: record.track
          ? {
              id: record.track.id,
              spotifyTrackUri: record.track.spotifyTrackUri,
              trackName: record.track.trackName,
              artistName: record.track.artistName,
              albumName: record.track.albumName,
              genre: record.track.genre,
            }
          : null,
      })),
    };
  },
});

function rangeFrom(after?: string, before?: string, year?: number) {
  if (typeof year === "number") {
    const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
    return { start, end };
  }
  const start = parseDate(after);
  const end = parseDate(before);
  if (!start && !end) return undefined;
  return {
    start: start ?? new Date(0),
    end: end ?? new Date(),
  };
}
