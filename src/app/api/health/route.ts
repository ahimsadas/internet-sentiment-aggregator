import { NextResponse } from 'next/server';
import { getAllConnectorHealth } from '@/lib/connectors/registry';
import { checkLLMAvailability } from '@/lib/llm/client';
import { getDatabase } from '@/lib/db/client';
import { getDatabaseStats } from '@/lib/db/schema';

/**
 * GET /api/health
 *
 * Health check endpoint for all services
 */
export async function GET() {
  const health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, {
      available: boolean;
      message: string;
    }>;
    database?: {
      connected: boolean;
      stats?: {
        contentCacheCount: number;
        analysisCount: number;
        dedupeCacheCount: number;
      };
    };
    timestamp: string;
  } = {
    status: 'healthy',
    services: {},
    timestamp: new Date().toISOString(),
  };

  // Check LLM availability
  try {
    const llmHealth = await checkLLMAvailability();
    health.services.llm = llmHealth;
    if (!llmHealth.available) {
      health.status = 'degraded';
    }
  } catch (error) {
    health.services.llm = {
      available: false,
      message: `Error checking LLM: ${error}`,
    };
    health.status = 'degraded';
  }

  // Check connector availability
  try {
    const connectorHealth = await getAllConnectorHealth();
    for (const [name, status] of Object.entries(connectorHealth)) {
      health.services[`connector_${name}`] = status;
    }

    // Check if at least one connector is available
    const hasAvailableConnector = Object.values(connectorHealth).some(c => c.available);
    if (!hasAvailableConnector) {
      health.status = 'unhealthy';
    }
  } catch (error) {
    health.services.connectors = {
      available: false,
      message: `Error checking connectors: ${error}`,
    };
    health.status = 'degraded';
  }

  // Check database
  try {
    const db = getDatabase();
    const stats = getDatabaseStats(db);
    health.database = {
      connected: true,
      stats: {
        contentCacheCount: stats.contentCacheCount,
        analysisCount: stats.analysisCount,
        dedupeCacheCount: stats.dedupeCacheCount,
      },
    };
    health.services.database = {
      available: true,
      message: 'SQLite database connected',
    };
  } catch (error) {
    health.database = { connected: false };
    health.services.database = {
      available: false,
      message: `Database error: ${error}`,
    };
    health.status = 'unhealthy';
  }

  // Determine HTTP status code
  const statusCode = health.status === 'unhealthy' ? 503 :
                    health.status === 'degraded' ? 200 : 200;

  return NextResponse.json(health, { status: statusCode });
}
