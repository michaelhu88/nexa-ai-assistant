import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';

// Template service API route disabled for simplified deployment
export async function action({ request }: ActionFunctionArgs) {
  return json({ error: 'Template detection service temporarily disabled for deployment' }, { status: 503 });
}

/* Original template detection implementation commented out for simplified deployment
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.template-detection');

// Template interface matching database schema
interface Template {
  id: string;
  name: string;
  keywords?: string[];
  storage_path: string;
  created_at: string;
}

interface TestMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface TemplateMatch {
  template: Template;
  score: number;
  matchedKeywords: string[];
}

class ServerTemplateDetection {
  private readonly MINIMUM_KEYWORD_MATCHES = 3;

  private getServiceClient(context: any): SupabaseClient {
    const url = process.env.VITE_SUPABASE_TEMPLATE_URL || (context.cloudflare?.env as any)?.VITE_SUPABASE_TEMPLATE_URL;
    const serviceKey = process.env.SUPABASE_TEMPLATE_SERVICE_ROLE_KEY || (context.cloudflare?.env as any)?.SUPABASE_TEMPLATE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      throw new Error('Supabase service role credentials not configured');
    }

    return createClient(url, serviceKey);
  }

  private extractConversationText(messages: TestMessage[]): string {
    return messages
      .map((message) => {
        if (typeof message.content === 'string') {
          return message.content;
        }
        return '';
      })
      .join(' ')
      .toLowerCase();
  }

  private scoreTemplateMatch(conversationText: string, template: Template): TemplateMatch {
    if (!template.keywords || !Array.isArray(template.keywords)) {
      logger.debug(`⚠️ Template "${template.name}" has no keywords or invalid keywords array`);
      return {
        template,
        score: 0,
        matchedKeywords: [],
      };
    }

    const words = conversationText.split(/\s+/);
    const matchedKeywords: string[] = [];

    logger.debug(`🔍 Checking template "${template.name}" keywords: [${template.keywords.join(', ')}]`);
    logger.debug(`📝 Against words: [${words.join(', ')}]`);

    for (const keyword of template.keywords) {
      const keywordLower = keyword.toLowerCase();

      const matchingWords = words.filter((word) => word.includes(keywordLower));

      if (matchingWords.length > 0) {
        matchedKeywords.push(keyword);
        logger.debug(`✅ Keyword "${keyword}" matched by words: [${matchingWords.join(', ')}]`);
      } else {
        logger.debug(`❌ Keyword "${keyword}" not found in text`);
      }
    }

    const score = matchedKeywords.length;

    logger.debug(`📊 Template "${template.name}" final score: ${score} (matched: [${matchedKeywords.join(', ')}])`);

    return {
      template,
      score,
      matchedKeywords,
    };
  }

  async detectTemplateFromConversation(messages: TestMessage[], context: any): Promise<Template | null> {
    try {
      logger.info('🔍 Starting server-side template detection...');

      if (!messages || messages.length === 0) {
        logger.debug('❌ No messages provided for template detection');
        return null;
      }

      const conversationText = this.extractConversationText(messages);
      logger.info(`📝 Extracted conversation text (${conversationText.length} chars): "${conversationText.substring(0, 200)}${conversationText.length > 200 ? '...' : ''}"`);

      if (!conversationText.trim()) {
        logger.debug('❌ Conversation text is empty after extraction');
        return null;
      }

      logger.debug('🔄 Loading templates from database with service role...');
      const supabase = this.getServiceClient(context);

      const { data: templates, error } = await supabase
        .from('templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch templates:', error);
        throw new Error(`Failed to fetch templates: ${error.message}`);
      }

      logger.info(`📋 Loaded ${templates?.length || 0} templates from database`);

      if (!templates || templates.length === 0) {
        logger.warn('❌ No templates available for detection');
        return null;
      }

      templates.forEach((template, index) => {
        logger.debug(`Template ${index + 1}: "${template.name}" with keywords: [${template.keywords?.join(', ') || 'none'}]`);
      });

      logger.debug('🎯 Scoring templates against conversation...');
      const matches: TemplateMatch[] = templates
        .map((template) => {
          const match = this.scoreTemplateMatch(conversationText, template);
          logger.debug(`🏆 Template "${template.name}" scored ${match.score} points with keywords: [${match.matchedKeywords.join(', ')}]`);
          return match;
        })
        .filter((match) => {
          const passed = match.score >= this.MINIMUM_KEYWORD_MATCHES;
          if (!passed) {
            logger.debug(`❌ Template "${match.template.name}" filtered out (score ${match.score} < minimum ${this.MINIMUM_KEYWORD_MATCHES})`);
          }
          return passed;
        })
        .sort((a, b) => b.score - a.score);

      logger.info(`🎯 Found ${matches.length} templates meeting minimum threshold of ${this.MINIMUM_KEYWORD_MATCHES} keywords`);

      if (matches.length === 0) {
        logger.warn('❌ No templates found with minimum keyword matches');
        return null;
      }

      const bestMatch = matches[0];

      logger.info(
        `✅ Template detected: "${bestMatch.template.name}" (score: ${bestMatch.score}, keywords: [${bestMatch.matchedKeywords.join(', ')}])`,
      );

      return bestMatch.template;
    } catch (error) {
      logger.error('💥 Error in server-side template detection:', error);
      throw error;
    }
  }
}

export async function originalAction({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = (await request.json()) as {
      messages: TestMessage[];
    };

    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return json({ error: 'Messages array required' }, { status: 400 });
    }

    logger.info('🧪 Starting server-side template detection API call');

    const detector = new ServerTemplateDetection();
    const detectedTemplate = await detector.detectTemplateFromConversation(messages, context);

    const result = {
      success: true,
      template: detectedTemplate ? {
        id: detectedTemplate.id,
        name: detectedTemplate.name,
        keywords: detectedTemplate.keywords || [],
        storage_path: detectedTemplate.storage_path,
        created_at: detectedTemplate.created_at
      } : null
    };

    logger.info('✅ Server-side template detection completed');

    return json(result);
  } catch (error) {
    logger.error('💥 Server-side template detection failed:', error);

    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

*/ // End of commented template detection API