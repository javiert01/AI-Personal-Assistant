# AI Personal Assistant - Spotify Data Analysis

A Next.js AI chat application that provides intelligent access to your Spotify listening history. Ask questions about your music habits, discover patterns in your listening behavior, and search through song lyrics using natural language.

## Overview

This AI assistant combines **semantic search**, **listening statistics**, and **conversational AI** to help you understand your music consumption. It processes your Spotify streaming history, fetches lyrics for all your tracks, generates embeddings for semantic search, and provides an intelligent agent that can answer complex queries about your listening habits.

## Core Features

### 🎵 Spotify Streaming Data Analysis

- **Complete History Processing**: Loads and processes your entire Spotify streaming history from JSON exports
- **Listening Statistics**: Track play counts, total listening time, first/last played dates
- **Multi-dimensional Filtering**: Filter by artist, album, year, month, country, platform
- **Time-based Analysis**: Discover patterns across years, months, and custom date ranges
- **Platform Insights**: Compare listening habits across iOS, Android, Web Player

### 🔍 Lyrics Search with Semantic Embeddings

- **Semantic Search**: Find songs by meaning and themes, not just keywords
- **Vector Similarity**: Uses pgvector with Google's text-embedding-004 model (768 dimensions)
- **Smart Indexing**: Combines track metadata (name, artist, album) with full lyrics for comprehensive search
- **Efficient Retrieval**: Cosine similarity search across thousands of tracks

### 🤖 Intelligent Agent Workflow

The assistant uses a **two-step workflow** to combine semantic understanding with listening statistics:

**Example**: "Tell me my most listened tracks that talk about love"

1. **Semantic Search**: Finds tracks with love-related lyrics using embeddings
2. **Statistical Filtering**: Orders those tracks by play count or listening time

This hybrid approach enables complex queries that traditional search can't handle.

### 🧠 Additional Capabilities

- **Memory System**: Semantic recall, working memory, and episodic learning
- **Hybrid Retrieval**: BM25 + semantic embeddings + rank fusion for email search
- **Evaluation Framework**: Tool call testing and LLM-as-judge scorers using Evalite
- **Human-in-the-loop**: Approval system for destructive actions
- **MCP Integration**: External tool access through Model Context Protocol

## How It Works

### Data Pipeline

The Spotify data processing pipeline consists of four phases:

#### Phase 1: Extract Unique Tracks

- Reads Spotify streaming history JSON files from `/data/spotify/`
- Extracts unique tracks (deduplicates by Spotify URI)
- Caches results to `extracted-tracks.json` for incremental processing
- Only new tracks are processed on subsequent runs

#### Phase 2: Fetch Lyrics

- Queries Musixmatch API for each track's lyrics
- Only fetches lyrics for newly discovered tracks (incremental)
- Caches results to `tracks-with-lyrics.json`
- Handles rate limiting and API errors gracefully

#### Phase 3: Seed Database

- Upserts tracks into PostgreSQL database
- Creates one-to-one relationship between tracks and lyrics
- Batch inserts streaming history (1000 records per batch)
- Fully idempotent - safe to re-run multiple times

#### Phase 4: Generate Embeddings

- Creates text representation: `{trackName} {artistName} {albumName}: \n{lyricsBody}`
- Generates 768-dimension vectors using Google's text-embedding-004
- Processes in batches of 99 tracks for efficiency
- Stores in `lyrics_embeddings` table with pgvector
- Only generates embeddings for lyrics that don't have them yet

### Database Schema

**Track**: Core track information (name, artist, album, Spotify URI)
**Lyrics**: Song lyrics with one-to-one relationship to tracks
**SpotifyStreamingHistory**: Individual play records with timestamps, duration, country, platform
**LyricsEmbedding**: Vector embeddings for semantic search (768-dimensional)

### Agent Tools

The assistant has access to two primary tools:

1. **`searchTrackLyrics`**: Semantic search through lyrics
   - Input: Natural language query
   - Process: Generates query embedding → cosine similarity search
   - Output: Array of matching track IDs

2. **`filterTracks`**: Filter and order by listening statistics
   - Input: Optional track IDs + filters (artist, album, year, month, etc.)
   - Process: Queries database with filters, aggregates statistics
   - Output: Tracks with play count, total time, first/last played dates

These tools work in sequence for complex queries combining lyric content with listening statistics.

## Getting Started

### Prerequisites

- Node.js (v20 or higher)
- pnpm package manager
- PostgreSQL database with pgvector extension
- API keys:
  - **Google AI** (for embeddings and LLM)
  - **Anthropic Claude** (for agent)
  - **Musixmatch** (for lyrics fetching)
- Spotify streaming history JSON files (export from Spotify)

### Installation

1. Install dependencies:

```bash
pnpm install
```

2. Set up environment variables (`.env.local`):

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# AI Providers
GOOGLE_GENERATIVE_AI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here

# Lyrics API
MUSIXMATCH_API_KEY=your_key_here
```

3. Set up database:

```bash
# Run migrations to create tables and enable pgvector
npx prisma migrate dev
```

4. Prepare Spotify data:

```bash
# Place your Spotify JSON files in /data/spotify/
# Files should be named like: Streaming_History_Audio_*.json
```

5. Run the data pipeline:

```bash
# Full pipeline (extract → fetch lyrics → seed DB → generate embeddings)
npx tsx prisma/seed.ts

# Only generate embeddings (if you've already seeded)
npx tsx prisma/seed.ts --embeddings-only

# Skip embeddings generation
npx tsx prisma/seed.ts --skip-embeddings
```

6. Start dev server:

```bash
pnpm run dev
```

7. Open [http://localhost:3000](http://localhost:3000)

## Usage Examples

### Semantic Search Queries

- "Find songs about heartbreak and loss"
- "Which tracks mention New York or cities?"
- "Songs with themes of hope and perseverance"

### Listening Statistics

- "What are my top 10 most played songs?"
- "Show me what I listened to in December 2024"
- "Which artists did I listen to most this year?"
- "Songs I played on iOS vs Android"

### Combined Queries

- "My most listened tracks that talk about love" ← **semantic search** + **play count ordering**
- "Songs about summer that I played in 2024" ← **lyric themes** + **year filter**
- "Top 5 sad songs by listening time" ← **emotional content** + **time-based ranking**

## Project Structure

### Spotify Data Pipeline

- `/prisma/schema.prisma` - Database schema (Track, Lyrics, SpotifyStreamingHistory, LyricsEmbedding)
- `/prisma/seed.ts` - Complete data pipeline (extract → fetch → seed → embeddings)
- `/prisma/sql/` - Typed SQL queries for vector operations
  - `semanticSearch.sql` - Cosine similarity search with pgvector
  - `getEmbedding.sql` - Retrieve embedding by lyrics ID
  - `upsertEmbedding.sql` - Insert/update embeddings

### Agent & Tools

- `/src/app/api/chat/route.ts` - Chat endpoint with streaming support
- `/src/app/api/chat/agent.ts` - Agent configuration with workflow instructions
- `/src/app/api/chat/search-tracks-tool.ts` - Semantic search tool for lyrics
- `/src/app/api/chat/track-filter-tool.ts` - Filter/order tracks by statistics
- `/src/app/api/chat/track-filters.ts` - Core filtering functions

### Retrieval & Embeddings

- `/src/app/embeddings.ts` - Embedding utilities (lyrics + email embeddings)
- `/src/app/song-search/page.tsx` - Song search UI page
- `/src/lib/db.ts` - Database query utilities

### UI Components

- `/src/components/ai-elements/` - Chat UI components
  - `conversation.tsx` - Message container with scroll management
  - `message.tsx` - Individual message bubbles
  - `response.tsx` - Markdown rendering with syntax highlighting
  - `reasoning.tsx` - Collapsible extended thinking blocks
  - `sources.tsx` - Source citations
  - `prompt-input.tsx` - Input with attachments and model selection

### Memory & Persistence

- `/src/lib/persistence-layer.ts` - Chat history + memory storage
- `/src/app/memory-search/` - Memory extraction and retrieval
- `/data/db.local.json` - Local storage for chats + memories

### Testing & Evaluation

- Evalite integration for tool call testing
- LLM-as-judge scorers for response quality
- Test cases for semantic search accuracy

### MCP & HITL

- `/src/app/api/chat/hitl.ts` - Human-in-the-loop approval system
- MCP server integration for external tools

## Advanced Features

### Testing with Evalite

The project uses **Evalite** for comprehensive testing of AI agent behavior:

- **Tool Call Testing**: Validates that the agent calls the correct tools with appropriate parameters
- **LLM-as-Judge Scorers**: Evaluates response quality, accuracy, and relevance
- **Semantic Search Accuracy**: Tests whether lyrics search returns expected results
- **End-to-End Scenarios**: Full workflow tests (search → filter → response generation)

Example test cases:

- "Find love songs" → Should call `searchTrackLyrics` with love-related query
- "Top 10 most played" → Should call `filterTracks` with `orderBy: "playCount"`
- "Most listened sad songs" → Should call BOTH tools in sequence

### Memory System

The assistant maintains context across conversations:

- **Semantic Recall**: Remembers previous discussions about music preferences
- **Working Memory**: Tracks ongoing conversation context
- **Episodic Learning**: Learns patterns from user interactions
- **Contextual Retrieval**: Surfaces relevant memories when answering questions

Memories are stored in the persistence layer and retrieved using semantic similarity.

### MCP (Model Context Protocol) Integration

Extends the assistant with external tools:

- **Dynamic Tool Loading**: MCP servers provide additional capabilities
- **HITL Approval**: Human-in-the-loop system for sensitive actions
- **Tool Composition**: Combine built-in tools with MCP-provided tools
- **Secure Execution**: Sandboxed tool execution with user approval

### Human-in-the-Loop System

Prevents destructive actions without user approval:

- **Tool Approval Flow**: User confirms before executing sensitive operations
- **Action Preview**: Shows what the tool will do before execution
- **Safety Rails**: Blocks potentially harmful commands automatically

## Tech Stack

### Core Framework

- **Next.js 15**: App Router with Turbopack for fast development
- **TypeScript**: Full type safety across frontend and backend
- **pnpm**: Fast, disk-space efficient package manager

### AI & ML

- **Vercel AI SDK v5**: Provider-agnostic AI integration with streaming support
- **Claude Sonnet 4.5**: Primary agent model (Anthropic)
- **Google Gemini 2.5 Flash**: Embeddings and alternative LLM
- **text-embedding-004**: 768-dimensional embeddings for semantic search

### Database & Vector Search

- **PostgreSQL**: Relational database for structured data
- **Prisma ORM**: Type-safe database access with migrations
- **pgvector**: Vector similarity search extension
- **Typed SQL**: `$queryRawTyped` for complex vector queries

### UI & Styling

- **Radix UI**: Accessible, unstyled component primitives
- **Tailwind CSS 4**: Utility-first styling with custom theme
- **Streamdown**: Markdown rendering with syntax highlighting
- **React 19**: Latest React features and concurrent rendering

### Testing & Quality

- **Evalite**: AI-native testing framework
- **LLM-as-Judge**: Automated response quality evaluation
- **TypeScript strict mode**: Maximum type safety

## Available Scripts

### Development

```bash
pnpm run dev          # Start dev server with Turbopack (http://localhost:3000)
pnpm run build        # Build for production
pnpm start            # Start production server
```

### Database

```bash
npx prisma migrate dev       # Run migrations and update Prisma client
npx prisma studio            # Open Prisma Studio (database GUI)
npx prisma generate          # Generate Prisma client and typed SQL queries
```

### Data Pipeline

```bash
npx tsx prisma/seed.ts                # Run full pipeline
npx tsx prisma/seed.ts --embeddings-only   # Only generate embeddings
npx tsx prisma/seed.ts --skip-embeddings   # Skip embeddings step
```

### Testing

```bash
pnpm test             # Run Evalite test suite
pnpm test:watch       # Watch mode for tests
```

## Performance Considerations

### Embeddings Generation

- Batch size: 99 tracks per API call (Google AI limit: 100)
- Time: ~1 minute per 1000 tracks
- Storage: ~3KB per embedding (768 floats)

### Vector Search

- Cosine similarity using pgvector index
- Sub-second search across 10,000+ tracks
- Returns top 10 most similar results

### Database

- Batch inserts: 1000 streaming history records per transaction
- Upsert operations for idempotent seeding
- Indexes on trackId, ts (timestamp) for fast filtering

## Contributing

This is a personal project, but suggestions and feedback are welcome! The architecture demonstrates best practices for:

- AI agent design with multi-step workflows
- Semantic search with embeddings
- Database design for time-series music data
- Type-safe AI tool development

## License

MIT
