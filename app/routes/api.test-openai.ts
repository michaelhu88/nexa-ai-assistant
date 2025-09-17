import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.test-openai');

export async function action({ context, request }: ActionFunctionArgs) {
  try {
    logger.info('Testing OpenAI API connection');

    // Get the test message from request body
    const body = await request.json();
    const { message = 'help me make a succinct plan for this project: help me make a bunny nanny app' } = body;

    // Get OpenAI API key from environment
    const apiKey = process.env.OPENAI_API_KEY || context.cloudflare?.env?.OPENAI_API_KEY;

    logger.info('API Key check', {
      hasApiKey: !!apiKey,
      keyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'none',
    });

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: 'OpenAI API key not found',
          details: 'OPENAI_API_KEY not set in environment variables',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // Make direct OpenAI API call
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: message,
          },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    logger.info('OpenAI API response', {
      status: openaiResponse.status,
      statusText: openaiResponse.statusText,
      headers: Object.fromEntries(openaiResponse.headers.entries()),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      logger.error('OpenAI API error', { status: openaiResponse.status, error: errorData });

      return new Response(
        JSON.stringify({
          error: 'OpenAI API request failed',
          status: openaiResponse.status,
          details: errorData,
        }),
        {
          status: openaiResponse.status,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const responseData = await openaiResponse.json();
    const aiMessage = responseData.choices?.[0]?.message?.content || 'No response content';

    logger.info('OpenAI API success', {
      responseLength: aiMessage.length,
      model: responseData.model,
      usage: responseData.usage,
    });

    return new Response(
      JSON.stringify({
        success: true,
        model: responseData.model,
        message: aiMessage,
        usage: responseData.usage,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    logger.error('Test OpenAI API failed', error);
    return new Response(
      JSON.stringify({
        error: 'Test failed with exception',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
