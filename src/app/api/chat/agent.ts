import {
  Experimental_Agent as Agent,
  hasToolCall,
  UIMessageStreamWriter,
  LanguageModel,
  StopCondition,
  ToolSet,
  UIMessage,
} from "ai";
import { makeHITLToolSet } from "./hitl";
import { MyMessage } from "./route";
import { DB } from "@/lib/persistence-layer";
import { searchTrackLyricsTool } from "./search-tracks-tool";

export const getTools = (messages: UIMessage[]) => ({
  searchTrackLyrics: searchTrackLyricsTool(messages),
});

export const createAgent = (opts: {
  messages: MyMessage[];
  model: LanguageModel;
  stopWhen: StopCondition<any>;
  memories: DB.Memory[];
  relatedChats: DB.Chat[];
  mcpTools: ToolSet;
  writer?: UIMessageStreamWriter;
}) =>
  new Agent({
    model: opts.model,
    tools: {
      ...getTools(opts.messages),
      ...makeHITLToolSet(opts.mcpTools, opts.writer),
    },
    stopWhen: [
      opts.stopWhen,
      ...Object.keys(opts.mcpTools).map((toolName) => hasToolCall(toolName)),
    ],
    system: `
     <task-context>
You are a personal assistant to the user. You help with general tasks, questions, and can access the user's spotify streaming data and lyrics to the songs when needed.
</task-context>

<rules>
- You have ONE track with lyrics tool available: 'searchTrackLyrics '
- Use these tool ONLY when the user explicitly asks about songs or lyrics
- For general questions, conversations, or tasks unrelated to songs/lyrics, respond naturally without using tools
- When you do need to access songs/lyrics, follow this multi-step workflow for token efficiency:

  STEP 1 - Browse tracks with lyrics:

  USE 'searchTrackLyrics' when the user wants to:
  - Find information semantically (e.g., "songs about love and relationships")
  - Search by concepts or topics (e.g., "war songs from the 60s")
  - Find answers to questions (e.g., "Which songs mention New York?")
  - Any query requiring understanding of meaning/context


- For song-related queries, NEVER answer from your training data - always use tools first
- If the first query doesn't find enough information, try different approaches or tools
- Only after using tools should you formulate your answer based on the results
</rules>


<the-ask>
Here is the user's request. For general questions and conversations, respond naturally. For song-related queries, use the tools and multi-step workflow above.
</the-ask>
        
     `,
  });
