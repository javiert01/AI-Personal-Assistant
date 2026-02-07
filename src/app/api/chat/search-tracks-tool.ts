import {
  reciprocalRankFusion,
  searchWithBM25,
  searchWithEmbeddings,
  toTrackType,
} from "@/app/search-db";
import { tool, UIMessage } from "ai";
import { z } from "zod";
import { getAllEmbeddings } from "@/app/generated/prisma/sql/getAllEmbeddings";
import prisma from "../../../../lib/prisma";
import { TrackWithLyrics } from "@/app/track-search/page";

export const searchTrackLyricsTool = (messages: UIMessage[]) =>
  tool({
    name: "search_track_lyrics",
    description: "Search track lyrics using both keyword and semantic search",
    inputSchema: z.object({
      keywords: z
        .array(z.string())
        .optional()
        .describe(
          "Exact keywords for BM25 search (names, amounts, specific terms)"
        ),
      searchQuery: z
        .string()
        .optional()
        .describe(
          "Natural language query for semantic search (broader concepts)"
        ),
    }),
    execute: async ({ keywords = [], searchQuery = "" }) => {
      console.log("Keywords:", keywords);
      console.log("Search Query:", searchQuery);

      const tracksWithEmbeddings =
        await prisma.$queryRawTyped(getAllEmbeddings());

      const bm25Results = keywords.length
        ? await searchWithBM25<TrackWithLyrics, getAllEmbeddings.Result>(
            keywords,
            tracksWithEmbeddings,
            toTrackType,
            (track) =>
              `${track.trackName} ${track.artistName} ${track.albumName}: \n${track.lyrics?.lyricsBody || ""}`
          )
        : [];
      const embeddingResults = searchQuery
        ? await searchWithEmbeddings<TrackWithLyrics, getAllEmbeddings.Result>(
            searchQuery,
            tracksWithEmbeddings,
            toTrackType
          )
        : [];

      const rrfResults = reciprocalRankFusion(
        [bm25Results.slice(0, 30), embeddingResults.slice(0, 30)],
        (track) => track.id
      );
      /* const conversationHistory = convertToModelMessages(messages).filter(
        (m) => m.role == "user" || m.role == "assistant"
      );
      const query = [keywords?.join(" "), searchQuery]
        .filter(Boolean)
        .join(" "); */
      /* const rerankedResults = await rerankEmails(
        rrfResults.slice(0, NUMBER_PASSED_TO_RERANKER).map((r) => ({
          email: r.item,
          score: r.score,
        })),
        query,
        conversationHistory
      ); */
      const topTracks = rrfResults
        .slice(0, 10)
        .filter((r) => r.score > 0)
        .map((r) => ({
          id: r.item.id,
          trackName: r.item.trackName,
          artistName: r.item.artistName,
          albumName: r.item.albumName,
          lyricsBody: r.item.lyrics?.lyricsBody || "",
          score: r.score,
        }));

      console.log("Top Tracks:", topTracks.length);

      return {
        tracks: topTracks,
      };
    },
  });
