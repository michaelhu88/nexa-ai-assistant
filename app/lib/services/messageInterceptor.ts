import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('MessageInterceptor');

export interface InterceptRule {
  id: string;
  pattern: string | RegExp;
  action: 'bypass' | 'transform' | 'route';
  response?: string;
  handler?: (message: string, matches?: RegExpMatchArray | null) => InterceptResult;
  enabled: boolean;
  description: string;
}

export interface InterceptResult {
  intercepted: boolean;
  response?: string;
  shouldBypassAI?: boolean;
  transformedMessage?: string;
  metadata?: Record<string, any>;
}

export class MessageInterceptorService {
  private static _instance: MessageInterceptorService;
  private _rules: InterceptRule[] = [];

  static getInstance(): MessageInterceptorService {
    if (!MessageInterceptorService._instance) {
      MessageInterceptorService._instance = new MessageInterceptorService();
    }

    return MessageInterceptorService._instance;
  }

  constructor() {
    this._initializeDefaultRules();
  }

  private _initializeDefaultRules(): void {
    // Default bypass rules
    const defaultRules: InterceptRule[] = [
      {
        id: 'help-command',
        pattern: /^\/help$/i,
        action: 'bypass',
        response: `# Nexa Help

Available commands:
- \`/help\` - Show this help message
- \`/status\` - Show system status
- \`/clear\` - Clear chat history
- \`/version\` - Show version information

You can also chat normally with AI or use build mode to create applications.`,
        enabled: true,
        description: 'Show help information',
      },
      {
        id: 'status-command',
        pattern: /^\/status$/i,
        action: 'bypass',
        handler: (_message) => {
          const status = {
            timestamp: new Date().toISOString(),
            uptime: Math.floor(performance.now() / 1000),
            memory: (performance as any).memory
              ? {
                  usedJSHeapSize: Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024),
                  totalJSHeapSize: Math.round((performance as any).memory.totalJSHeapSize / 1024 / 1024),
                }
              : 'N/A',
          };

          return {
            intercepted: true,
            shouldBypassAI: true,
            response: `# System Status

**Timestamp:** ${status.timestamp}
**Uptime:** ${status.uptime} seconds
**Memory Usage:** ${typeof status.memory === 'object' ? `${status.memory.usedJSHeapSize}MB / ${status.memory.totalJSHeapSize}MB` : status.memory}

System is running normally.`,
          };
        },
        enabled: true,
        description: 'Show system status',
      },
      {
        id: 'clear-command',
        pattern: /^\/clear$/i,
        action: 'bypass',
        response: 'Chat history cleared. You can start a fresh conversation.',
        handler: (_message) => ({
          intercepted: true,
          shouldBypassAI: true,
          response: 'Chat history will be cleared.',
          metadata: { clearHistory: true },
        }),
        enabled: true,
        description: 'Clear chat history',
      },
      {
        id: 'version-command',
        pattern: /^\/version$/i,
        action: 'bypass',
        response: `# Nexa Version Information

**Platform:** Nexa AI Development Environment
**Base:** WebContainer Runtime
**Features:**
- AI-powered development
- Real-time collaboration
- Multi-provider AI support
- Supabase integration

For more information, visit the documentation.`,
        enabled: true,
        description: 'Show version information',
      },
    ];

    this._rules = defaultRules;
    logger.debug(`Initialized ${this._rules.length} default intercept rules`);
  }

  /**
   * Check if a message should be intercepted
   */
  intercept(message: string): InterceptResult {
    if (!message || typeof message !== 'string') {
      return { intercepted: false };
    }

    const trimmedMessage = message.trim();

    for (const rule of this._rules) {
      if (!rule.enabled) {
        continue;
      }

      let matches: RegExpMatchArray | null = null;
      let isMatch = false;

      if (rule.pattern instanceof RegExp) {
        matches = trimmedMessage.match(rule.pattern);
        isMatch = matches !== null;
      } else {
        isMatch = trimmedMessage.toLowerCase().includes(rule.pattern.toLowerCase());
      }

      if (isMatch) {
        logger.debug(`Message intercepted by rule: ${rule.id}`);

        // Use custom handler if provided
        if (rule.handler) {
          return rule.handler(trimmedMessage, matches);
        }

        // Default response handling
        switch (rule.action) {
          case 'bypass':
            return {
              intercepted: true,
              shouldBypassAI: true,
              response: rule.response || 'Command executed.',
              metadata: { ruleId: rule.id, pattern: rule.pattern.toString() },
            };

          case 'transform':
            return {
              intercepted: true,
              shouldBypassAI: false,
              transformedMessage: rule.response || trimmedMessage,
              metadata: { ruleId: rule.id, originalMessage: trimmedMessage },
            };

          case 'route':
            return {
              intercepted: true,
              shouldBypassAI: true,
              response: rule.response || 'Routing command...',
              metadata: { ruleId: rule.id, action: 'route' },
            };

          default:
            logger.warn(`Unknown action type: ${rule.action}`);
            return { intercepted: false };
        }
      }
    }

    return { intercepted: false };
  }

  /**
   * Add a new intercept rule
   */
  addRule(rule: Omit<InterceptRule, 'id'>): string {
    const id = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newRule: InterceptRule = { ...rule, id };

    this._rules.push(newRule);
    logger.debug(`Added new intercept rule: ${id}`);

    return id;
  }

  /**
   * Remove an intercept rule by ID
   */
  removeRule(id: string): boolean {
    const initialLength = this._rules.length;
    this._rules = this._rules.filter((rule) => rule.id !== id);

    const removed = this._rules.length < initialLength;

    if (removed) {
      logger.debug(`Removed intercept rule: ${id}`);
    }

    return removed;
  }

  /**
   * Enable or disable a rule
   */
  toggleRule(id: string, enabled?: boolean): boolean {
    const rule = this._rules.find((r) => r.id === id);

    if (rule) {
      rule.enabled = enabled !== undefined ? enabled : !rule.enabled;
      logger.debug(`Toggled rule ${id}: ${rule.enabled ? 'enabled' : 'disabled'}`);

      return true;
    }

    return false;
  }

  /**
   * Get all rules
   */
  getRules(): InterceptRule[] {
    return [...this._rules];
  }

  /**
   * Get enabled rules only
   */
  getEnabledRules(): InterceptRule[] {
    return this._rules.filter((rule) => rule.enabled);
  }

  /**
   * Update a rule
   */
  updateRule(id: string, updates: Partial<InterceptRule>): boolean {
    const ruleIndex = this._rules.findIndex((r) => r.id === id);

    if (ruleIndex !== -1) {
      this._rules[ruleIndex] = { ...this._rules[ruleIndex], ...updates, id }; // Preserve ID
      logger.debug(`Updated rule: ${id}`);

      return true;
    }

    return false;
  }

  /**
   * Clear all custom rules (keeps default rules)
   */
  clearCustomRules(): void {
    const customRules = this._rules.filter((rule) => rule.id.startsWith('custom-'));
    this._rules = this._rules.filter((rule) => !rule.id.startsWith('custom-'));
    logger.debug(`Cleared ${customRules.length} custom rules`);
  }

  /**
   * Reset to default rules only
   */
  resetToDefaults(): void {
    this._rules = [];
    this._initializeDefaultRules();
    logger.debug('Reset to default intercept rules');
  }
}

// Export singleton instance
export const messageInterceptor = MessageInterceptorService.getInstance();
