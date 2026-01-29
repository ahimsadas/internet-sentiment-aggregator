/**
 * Connector health registry
 *
 * Provides health check functionality for web search connectors
 */

/**
 * Check if OpenRouter web search is available
 */
async function checkOpenRouterAvailable(): Promise<{
  available: boolean;
  message: string;
}> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return {
      available: false,
      message: 'OPENROUTER_API_KEY not configured',
    };
  }
  return {
    available: true,
    message: 'OpenRouter API key configured',
  };
}

/**
 * Get all connector health statuses
 */
export async function getAllConnectorHealth(): Promise<Record<string, {
  available: boolean;
  message: string;
}>> {
  const results: Record<string, { available: boolean; message: string }> = {};

  results['openrouter_web_search'] = await checkOpenRouterAvailable();

  return results;
}
