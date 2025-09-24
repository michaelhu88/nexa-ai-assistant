import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';

// Template detection test API route disabled for simplified deployment
export async function action({ request: _request }: ActionFunctionArgs) {
  return json({ error: 'Template detection test service temporarily disabled for deployment' }, { status: 503 });
}

/*
 * Original template detection test implementation commented out for simplified deployment
 * import { templateDetection } from '~/lib/services/templateDetection';
 * import { templateService } from '~/lib/services/templateService';
 * import { createScopedLogger } from '~/utils/logger';
 *
 * const logger = createScopedLogger('api.test-template-detection');
 *
 * interface TestMessage {
 * id: string;
 * role: 'user' | 'assistant';
 * content: string;
 * }
 *
 * export async function originalAction({ request }: ActionFunctionArgs) {
 * if (request.method !== 'POST') {
 *  return json({ error: 'Method not allowed' }, { status: 405 });
 * }
 *
 * try {
 *  const body = (await request.json()) as {
 *    message?: string;
 *    messages?: TestMessage[];
 *  };
 *
 *  const { message, messages: providedMessages } = body;
 *
 *  logger.info('🧪 Starting template detection test');
 *
 *  const testMessages: TestMessage[] = providedMessages || [
 *    {
 *      id: 'test-1',
 *      role: 'user',
 *      content: message || 'build me a platform that can automate my business. my business is ecommerce'
 *    }
 *  ];
 *
 *  logger.info(`📝 Testing with ${testMessages.length} messages`);
 *
 *  logger.info('🔌 Testing template service connection...');
 *  const connectionTest = await templateService.testConnection();
 *  logger.info(`🔌 Connection test result: ${connectionTest}`);
 *
 *  logger.info('📋 Loading templates directly...');
 *  const templates = await templateService.listTemplates();
 *  logger.info(`📋 Loaded ${templates.length} templates directly`);
 *
 *  logger.info('🔍 Running template detection...');
 *  const detectedTemplate = await templateDetection.detectTemplateFromConversation(testMessages as any);
 *
 *  logger.info('🎯 Getting all template matches...');
 *  const allMatches = await templateDetection.getAllMatches(testMessages as any);
 *
 *  const result = {
 *    success: true,
 *    test: {
 *      connectionWorking: connectionTest,
 *      templatesLoaded: templates.length,
 *      templates: templates.map(t => ({
 *        id: t.id,
 *        name: t.name,
 *        keywords: t.keywords || []
 *      })),
 *      testMessages: testMessages,
 *      detectedTemplate: detectedTemplate ? {
 *        id: detectedTemplate.id,
 *        name: detectedTemplate.name,
 *        keywords: detectedTemplate.keywords || []
 *      } : null,
 *      allMatches: allMatches.map(match => ({
 *        templateName: match.template.name,
 *        score: match.score,
 *        matchedKeywords: match.matchedKeywords,
 *        templateKeywords: match.template.keywords || []
 *      }))
 *    }
 *  };
 *
 *  logger.info('✅ Template detection test completed');
 *
 *  return json(result);
 * } catch (error) {
 *  logger.error('💥 Template detection test failed:', error);
 *
 *  return json({
 *    success: false,
 *    error: error instanceof Error ? error.message : 'Unknown error',
 *    stack: error instanceof Error ? error.stack : undefined
 *  }, { status: 500 });
 * }
 * }
 *
 */ // End of commented template detection test API
