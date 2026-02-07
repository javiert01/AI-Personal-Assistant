import { tool, UIMessage, generateObject } from "ai";
import { z } from "zod";
import { google } from "@ai-sdk/google";

export const generateLyricsSummaryTool = (messages: UIMessage[]) =>
  tool({
    name: "generate_lyrics_summary",
    description:
      "Generate a summary of track lyrics (including sentimental analysis) if needed",
    inputSchema: z.object({
      trackTitle: z.string().describe("The title of the track to summarize"),
      artistName: z
        .string()
        .describe("The name of the artist of the track to summarize"),
      lyricsBody: z
        .string()
        .describe("The full lyrics body of the track to summarize"),
    }),
    execute: async ({ trackTitle, artistName, lyricsBody }) => {
      console.log("Track Title:", trackTitle);
      console.log("Artist Name:", artistName);
      const summaryPrompt = `
      You are an expert music analyst. Your job is to read song lyrics and provide a concise summary along with a brief sentimental analysis.

      1. Read the provided song lyrics carefully.
      2. Summarize the main themes and messages conveyed in the lyrics.
      3. Provide a brief sentimental analysis, indicating the overall mood or emotional tone of the song (e.g., joyful, melancholic, hopeful, etc.).

      Format your response as follows:
      Summary: [Your concise summary here]. Should be about 3-4 sentences.
      Themes: [List of main themes]. For example: ["love", "heartbreak", "empowerment"]. Must be one word themes. Return at least 3 themes.
      Tone: [Brief sentimental analysis]. For example: ["melancholic", "uplifting"]. Must be one word. Return between 1 and 3 words.

      --------------- Lyrics ---------------

      Here are the lyrics to analyze:
      ${trackTitle} by ${artistName}:
      ${lyricsBody}
      ------------------------------
    `;

      const result = await generateObject({
        model: google("gemini-2.5-flash-lite"),
        prompt: summaryPrompt,
        schema: z.object({
          summary: z.string().describe("The summary of the lyrics"),
          themes: z.array(z.string()).describe("The main themes of the lyrics"),
          tone: z
            .array(z.string())
            .describe("The sentimental tone of the lyrics"),
        }),
      });

      

      return {
        lyricsSummary: result.object,
      };
    },
  });
