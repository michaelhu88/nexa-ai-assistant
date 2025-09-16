import { atom, computed } from 'nanostores';
import { messageInterceptor, type InterceptRule } from '~/lib/services/messageInterceptor';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('MessageInterceptorStore');

export interface MessageInterceptorState {
  enabled: boolean;
  rules: InterceptRule[];
  lastInterception?: {
    message: string;
    ruleId: string;
    timestamp: number;
  };
}

// Main state atom
export const messageInterceptorState = atom<MessageInterceptorState>({
  enabled: true,
  rules: [],
  lastInterception: undefined,
});

// Computed stores
export const interceptorEnabled = computed(messageInterceptorState, (state) => state.enabled);
export const interceptorRules = computed(messageInterceptorState, (state) => state.rules);
export const enabledRules = computed(messageInterceptorState, (state) => state.rules.filter((rule) => rule.enabled));

// Store management functions
export const messageInterceptorStore = {
  /**
   * Initialize the store with current rules from service
   */
  init() {
    const currentRules = messageInterceptor.getRules();
    messageInterceptorState.set({
      ...messageInterceptorState.get(),
      rules: currentRules,
    });
    this.loadFromStorage();
    logger.debug('MessageInterceptor store initialized');
  },

  /**
   * Toggle the entire interceptor system
   */
  toggle(enabled?: boolean) {
    const currentState = messageInterceptorState.get();
    const newEnabled = enabled !== undefined ? enabled : !currentState.enabled;

    messageInterceptorState.set({
      ...currentState,
      enabled: newEnabled,
    });

    this.saveToStorage();
    logger.debug(`MessageInterceptor ${newEnabled ? 'enabled' : 'disabled'}`);
  },

  /**
   * Refresh rules from the service
   */
  refreshRules() {
    const currentState = messageInterceptorState.get();
    const currentRules = messageInterceptor.getRules();

    messageInterceptorState.set({
      ...currentState,
      rules: currentRules,
    });
  },

  /**
   * Add a new rule
   */
  addRule(rule: Omit<InterceptRule, 'id'>) {
    const ruleId = messageInterceptor.addRule(rule);
    this.refreshRules();
    this.saveToStorage();

    return ruleId;
  },

  /**
   * Remove a rule
   */
  removeRule(id: string) {
    const success = messageInterceptor.removeRule(id);

    if (success) {
      this.refreshRules();
      this.saveToStorage();
    }

    return success;
  },

  /**
   * Toggle a specific rule
   */
  toggleRule(id: string, enabled?: boolean) {
    const success = messageInterceptor.toggleRule(id, enabled);

    if (success) {
      this.refreshRules();
      this.saveToStorage();
    }

    return success;
  },

  /**
   * Update a rule
   */
  updateRule(id: string, updates: Partial<InterceptRule>) {
    const success = messageInterceptor.updateRule(id, updates);

    if (success) {
      this.refreshRules();
      this.saveToStorage();
    }

    return success;
  },

  /**
   * Record when an interception occurs
   */
  recordInterception(message: string, ruleId: string) {
    const currentState = messageInterceptorState.get();
    messageInterceptorState.set({
      ...currentState,
      lastInterception: {
        message,
        ruleId,
        timestamp: Date.now(),
      },
    });
  },

  /**
   * Clear all custom rules
   */
  clearCustomRules() {
    messageInterceptor.clearCustomRules();
    this.refreshRules();
    this.saveToStorage();
  },

  /**
   * Reset to defaults
   */
  resetToDefaults() {
    messageInterceptor.resetToDefaults();
    this.refreshRules();
    this.saveToStorage();
  },

  /**
   * Save state to localStorage
   */
  saveToStorage() {
    try {
      const state = messageInterceptorState.get();
      const storageData = {
        enabled: state.enabled,
        customRules: state.rules.filter((rule) => rule.id.startsWith('custom-')),
        ruleStates: state.rules.reduce(
          (acc, rule) => {
            acc[rule.id] = rule.enabled;
            return acc;
          },
          {} as Record<string, boolean>,
        ),
      };

      localStorage.setItem('messageInterceptor', JSON.stringify(storageData));
      logger.debug('MessageInterceptor state saved to localStorage');
    } catch (error) {
      logger.error('Failed to save MessageInterceptor state:', error);
    }
  },

  /**
   * Load state from localStorage
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem('messageInterceptor');

      if (!stored) {
        return;
      }

      const storageData = JSON.parse(stored);
      const currentState = messageInterceptorState.get();

      // Restore enabled state
      if (typeof storageData.enabled === 'boolean') {
        messageInterceptorState.set({
          ...currentState,
          enabled: storageData.enabled,
        });
      }

      // Restore custom rules
      if (Array.isArray(storageData.customRules)) {
        storageData.customRules.forEach((rule: InterceptRule) => {
          messageInterceptor.addRule({
            pattern: rule.pattern,
            action: rule.action,
            response: rule.response,
            handler: rule.handler,
            enabled: rule.enabled,
            description: rule.description,
          });
        });
      }

      // Restore rule enabled states
      if (storageData.ruleStates && typeof storageData.ruleStates === 'object') {
        Object.entries(storageData.ruleStates).forEach(([ruleId, enabled]) => {
          if (typeof enabled === 'boolean') {
            messageInterceptor.toggleRule(ruleId, enabled);
          }
        });
      }

      this.refreshRules();
      logger.debug('MessageInterceptor state loaded from localStorage');
    } catch (error) {
      logger.error('Failed to load MessageInterceptor state:', error);
    }
  },

  /**
   * Get current state
   */
  getState() {
    return messageInterceptorState.get();
  },

  /**
   * Check if interceptor would intercept a message
   */
  wouldIntercept(message: string): boolean {
    const state = messageInterceptorState.get();

    if (!state.enabled) {
      return false;
    }

    const result = messageInterceptor.intercept(message);

    return result.intercepted;
  },

  /**
   * Get statistics
   */
  getStats() {
    const state = messageInterceptorState.get();
    return {
      totalRules: state.rules.length,
      enabledRules: state.rules.filter((r) => r.enabled).length,
      customRules: state.rules.filter((r) => r.id.startsWith('custom-')).length,
      systemEnabled: state.enabled,
      lastInterception: state.lastInterception,
    };
  },
};

// Initialize store
messageInterceptorStore.init();
