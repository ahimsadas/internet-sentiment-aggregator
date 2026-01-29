# Internet Sentiment Aggregator

A web application that aggregates and analyzes online sentiment on any topic, providing evidence-backed stance distributions with visualizations.

## Features

- **Web Search Analysis**: Searches the web for diverse opinions and perspectives
- **LLM-Powered Analysis**: Uses AI to identify opinion clusters and classify stances
- **Stance Classification**: Categorizes content as supporting, opposing, mixed, or unclear
- **Evidence-backed Results**: All claims are backed by actual excerpts and source URLs
- **Interactive Visualizations**: Stance distribution charts and cluster exploration
- **Transparent Methodology**: Shows sampling statistics, confidence scores, and limitations

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), React, Tailwind CSS, shadcn/ui, Recharts
- **Backend**: Next.js API routes, TypeScript
- **Database**: SQLite (via better-sqlite3) for caching
- **LLM & Web Search**: OpenRouter (xiaomi/mimo-v2-flash + web search plugin)

## How It Works

The application uses a simple 3-step pipeline:

1. **Search Phrase Generation**: An LLM generates diverse search phrases from your topic
2. **Web Search**: OpenRouter's web search plugin searches the web and retrieves content
3. **Analysis**: An LLM analyzes the content and returns structured results

This approach is simple, fast, and produces high-quality results.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- API keys (see Environment Variables below)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd internet-sentiment-aggregator

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local with your API keys
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in your API keys:

```env
# Required
OPENROUTER_API_KEY=your_key_here      # Get from https://openrouter.ai/keys
```

### Running the Application

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000) to access the application.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

## API Endpoints

### POST /api/analyze

Trigger a sentiment analysis for a topic.

**Request Body:**
```json
{
  "topic": "AI regulation",
  "timeframe": "last_week",
  "geo_scope": "global"
}
```

**Response:** Full analysis output with clusters, stance distribution, and evidence.

### GET /api/status/:id

Get the status of an analysis by ID (for background processing).

### GET /api/health

Health check endpoint showing service status.

## Manual Testing Checklist

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Test basic analysis:**
   - Open http://localhost:3000
   - Enter topic: "artificial intelligence regulation"
   - Click "Analyze Sentiment"
   - Verify loading state appears

3. **Verify results display:**
   - [ ] Stance distribution chart renders
   - [ ] Opinion clusters are listed
   - [ ] Each cluster has evidence links
   - [ ] Limitations panel is visible

4. **Test cluster exploration:**
   - [ ] Click on a cluster to expand
   - [ ] Verify evidence excerpts are shown
   - [ ] Click evidence links - they should open in new tab

## Limitations

- **Coverage**: Only analyzes publicly accessible online content
- **Social Media**: Twitter/X, Facebook, and Instagram are not available due to API restrictions
- **Language**: Primarily optimized for English content
- **Accuracy**: Results should be interpreted as indicative, not definitive
- **Representativeness**: Online discourse may not reflect general population views

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed technical documentation.

## License

MIT

## Contributing

Contributions are welcome. Please open an issue first to discuss proposed changes.
