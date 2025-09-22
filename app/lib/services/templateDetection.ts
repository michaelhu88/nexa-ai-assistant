import type { Message } from 'ai';
import { templateService, type Template } from './templateService';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('templateDetection');

export interface TemplateMatch {
  template: Template;
  score: number;
  matchedKeywords: string[];
}

export class TemplateDetectionService {
  private readonly _MINIMUM_KEYWORD_MATCHES = 3;
  private _templateCache: Template[] = [];
  private _lastCacheUpdate = 0;
  private readonly _CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get all templates with caching
   */
  private async getTemplates(): Promise<Template[]> {
    const now = Date.now();

    if (this._templateCache.length === 0 || now - this._lastCacheUpdate > this._CACHE_TTL) {
      try {
        this._templateCache = await templateService.listTemplates();
        this._lastCacheUpdate = now;
        logger.info(`Loaded ${this._templateCache.length} templates into cache`);
      } catch (error) {
        logger.error('Failed to load templates:', error);
        return [];
      }
    }

    return this._templateCache;
  }

  /**
   * Extract all text content from conversation messages
   */
  private extractConversationText(messages: Message[]): string {
    return messages
      .map((message) => {
        if (typeof message.content === 'string') {
          return message.content;
        }

        // Handle multipart content if needed
        return '';
      })
      .join(' ')
      .toLowerCase();
  }

  /**
   * Score how well a template matches the conversation text
   */
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

      // Check for exact keyword matches in the text
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

  /**
   * Analyze conversation messages to detect matching templates using server-side API
   * Returns the best matching template if it meets the minimum threshold
   */
  async detectTemplateFromConversation(messages: Message[]): Promise<Template | null> {
    try {
      logger.info('🔍 Starting client-side template detection API call...');

      if (!messages || messages.length === 0) {
        logger.debug('❌ No messages provided for template detection');
        return null;
      }

      // Convert messages to simple format for API
      const apiMessages = messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : ''
      }));

      logger.info(`📨 Sending ${apiMessages.length} messages to template detection API`);

      // Call server-side template detection API
      const response = await fetch('/api/template-detection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: apiMessages
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(`Template detection API failed: ${response.status} ${response.statusText}. ${errorData.error || ''}`);
      }

      const result = await response.json() as { success: boolean; template?: Template; error?: string };

      if (!result.success) {
        throw new Error(`Template detection failed: ${result.error}`);
      }

      if (result.template) {
        logger.info(`✅ Template detected via API: "${result.template.name}"`);
        return result.template;
      } else {
        logger.info('❌ No template detected via API');
        return null;
      }
    } catch (error) {
      logger.error('💥 Error in client-side template detection API call:', error);

      // Fallback to local detection if API fails
      logger.info('🔄 Falling back to local template detection...');
      return this.detectTemplateFromConversationLocal(messages);
    }
  }

  /**
   * Local fallback template detection (original implementation)
   */
  private async detectTemplateFromConversationLocal(messages: Message[]): Promise<Template | null> {
    try {
      logger.info('🔍 Starting local template detection fallback...');

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

      logger.debug('🔄 Loading templates from database...');
      const templates = await this.getTemplates();
      logger.info(`📋 Loaded ${templates.length} templates from database`);

      if (templates.length === 0) {
        logger.warn('❌ No templates available for detection');
        return null;
      }

      // Log each template for debugging
      templates.forEach((template, index) => {
        logger.debug(`Template ${index + 1}: "${template.name}" with keywords: [${template.keywords?.join(', ') || 'none'}]`);
      });

      // Score all templates
      logger.debug('🎯 Scoring templates against conversation...');
      const matches: TemplateMatch[] = templates
        .map((template) => {
          const match = this.scoreTemplateMatch(conversationText, template);
          logger.debug(`🏆 Template "${template.name}" scored ${match.score} points with keywords: [${match.matchedKeywords.join(', ')}]`);
          return match;
        })
        .filter((match) => {
          const passed = match.score >= this._MINIMUM_KEYWORD_MATCHES;
          if (!passed) {
            logger.debug(`❌ Template "${match.template.name}" filtered out (score ${match.score} < minimum ${this._MINIMUM_KEYWORD_MATCHES})`);
          }
          return passed;
        })
        .sort((a, b) => b.score - a.score); // Sort by highest score first

      logger.info(`🎯 Found ${matches.length} templates meeting minimum threshold of ${this._MINIMUM_KEYWORD_MATCHES} keywords`);

      if (matches.length === 0) {
        logger.warn('❌ No templates found with minimum keyword matches');
        return null;
      }

      const bestMatch = matches[0];

      logger.info(
        `✅ Template detected via fallback: "${bestMatch.template.name}" (score: ${bestMatch.score}, keywords: [${bestMatch.matchedKeywords.join(', ')}])`,
      );

      return bestMatch.template;
    } catch (error) {
      logger.error('💥 Error in local template detection fallback:', error);
      return null;
    }
  }

  /**
   * Get all templates that match the conversation with their scores
   */
  async getAllMatches(messages: Message[]): Promise<TemplateMatch[]> {
    try {
      if (!messages || messages.length === 0) {
        return [];
      }

      const conversationText = this.extractConversationText(messages);
      const templates = await this.getTemplates();

      return templates
        .map((template) => this.scoreTemplateMatch(conversationText, template))
        .filter((match) => match.score >= this._MINIMUM_KEYWORD_MATCHES)
        .sort((a, b) => b.score - a.score);
    } catch (error) {
      logger.error('Error getting all matches:', error);
      return [];
    }
  }

  /**
   * Clear the template cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this._templateCache = [];
    this._lastCacheUpdate = 0;
    logger.info('Template cache cleared');
  }
}

// Export singleton instance
export const templateDetection = new TemplateDetectionService();
