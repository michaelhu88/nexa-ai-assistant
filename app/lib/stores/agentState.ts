import { computed, map } from 'nanostores';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('agentState');

/**
 * Agent states representing different phases of task processing
 */
export type AgentState =
  | 'IDLE' // Waiting for user input
  | 'ANALYZING' // Analyzing message complexity
  | 'PLANNING' // Generating a plan for complex tasks
  | 'AWAITING_APPROVAL' // Waiting for user to approve the plan
  | 'EXECUTING' // Executing approved plan or simple task
  | 'DEBUGGING' // Handling errors and re-planning
  | 'COMPLETED'; // Task completed successfully

/**
 * State transition event types
 */
export type StateTransitionEvent =
  | { type: 'USER_MESSAGE'; complexity?: number }
  | { type: 'COMPLEXITY_ANALYZED'; complexity: number; requiresPlanning: boolean }
  | { type: 'PLAN_GENERATED'; plan: ExecutionPlan }
  | { type: 'PLAN_APPROVED' }
  | { type: 'PLAN_REJECTED' }
  | { type: 'EXECUTION_STARTED' }
  | { type: 'EXECUTION_ERROR'; error: Error }
  | { type: 'EXECUTION_COMPLETED' }
  | { type: 'RESET' };

/**
 * Execution plan structure
 */
export interface ExecutionPlan {
  id: string;
  title: string;
  description?: string;
  steps: PlanStep[];
  estimatedComplexity: number;
  createdAt: Date;
  metadata?: {
    aiGenerated?: boolean;
    architecture?: string;
    technologies?: string[];
    considerations?: string[];
    totalEstimatedTime?: number;
    fallback?: boolean;
    analysisCategories?: string[];
    confidence?: number;
    rawResponse?: boolean;
  };
}

export interface PlanStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  estimatedTime?: number; // in seconds
  actualTime?: number;
  error?: string;
  details?: string; // Additional details from AI generation
}

/**
 * Agent state store interface
 */
interface AgentStateStore {
  currentState: AgentState;
  previousState: AgentState | null;
  currentPlan: ExecutionPlan | null;
  executionProgress: {
    currentStepIndex: number;
    completedSteps: number;
    totalSteps: number;
    percentComplete: number;
  };
  messageComplexity: number | null;
  error: Error | null;
  stateHistory: Array<{
    state: AgentState;
    timestamp: Date;
    event?: StateTransitionEvent;
  }>;
  settings: {
    autoPlanning: boolean;
    complexityThreshold: number;
    debugMode: boolean;
  };
}

/**
 * Default state
 */
const DEFAULT_STATE: AgentStateStore = {
  currentState: 'IDLE',
  previousState: null,
  currentPlan: null,
  executionProgress: {
    currentStepIndex: 0,
    completedSteps: 0,
    totalSteps: 0,
    percentComplete: 0,
  },
  messageComplexity: null,
  error: null,
  stateHistory: [],
  settings: {
    autoPlanning: true,
    complexityThreshold: 5, // Scale of 1-10
    debugMode: false,
  },
};

/**
 * Load state from localStorage
 */
function loadStateFromStorage(): Partial<AgentStateStore> {
  try {
    const stored = localStorage.getItem('agentState');

    if (stored) {
      const parsed = JSON.parse(stored);

      // Convert date strings back to Date objects
      if (parsed.stateHistory) {
        parsed.stateHistory = parsed.stateHistory.map((h: any) => ({
          ...h,
          timestamp: new Date(h.timestamp),
        }));
      }

      if (parsed.currentPlan?.createdAt) {
        parsed.currentPlan.createdAt = new Date(parsed.currentPlan.createdAt);
      }

      return parsed;
    }
  } catch (error) {
    logger.error('Failed to load agent state from storage:', error);
  }
  return {};
}

/**
 * Save state to localStorage
 */
function saveStateToStorage(state: AgentStateStore) {
  try {
    // Only persist necessary data
    const toSave = {
      currentState: state.currentState,
      previousState: state.previousState,
      currentPlan: state.currentPlan,
      executionProgress: state.executionProgress,
      messageComplexity: state.messageComplexity,
      settings: state.settings,

      // Limit history to last 50 entries
      stateHistory: state.stateHistory.slice(-50),
    };
    localStorage.setItem('agentState', JSON.stringify(toSave));
  } catch (error) {
    logger.error('Failed to save agent state to storage:', error);
  }
}

/**
 * Main agent state store
 */
export const agentStateStore = map<AgentStateStore>({
  ...DEFAULT_STATE,
  ...loadStateFromStorage(),
});

/**
 * Computed store for checking if agent is busy
 */
export const isAgentBusy = computed(agentStateStore, (state) => {
  return ['ANALYZING', 'PLANNING', 'EXECUTING', 'DEBUGGING'].includes(state.currentState);
});

/**
 * Computed store for checking if plan approval is needed
 */
export const needsPlanApproval = computed(agentStateStore, (state) => {
  return state.currentState === 'AWAITING_APPROVAL' && state.currentPlan !== null;
});

/**
 * State transition logic with guards
 */
function canTransition(from: AgentState, to: AgentState): boolean {
  const validTransitions: Record<AgentState, AgentState[]> = {
    IDLE: ['ANALYZING'],
    ANALYZING: ['PLANNING', 'EXECUTING', 'IDLE'],
    PLANNING: ['AWAITING_APPROVAL', 'EXECUTING', 'IDLE'],
    AWAITING_APPROVAL: ['EXECUTING', 'PLANNING', 'IDLE'],
    EXECUTING: ['COMPLETED', 'DEBUGGING', 'IDLE'],
    DEBUGGING: ['PLANNING', 'EXECUTING', 'IDLE'],
    COMPLETED: ['IDLE'],
  };

  return validTransitions[from]?.includes(to) ?? false;
}

/**
 * Process state transition event
 */
export function processEvent(event: StateTransitionEvent) {
  const state = agentStateStore.get();
  let newState: AgentState = state.currentState;
  let updates: Partial<AgentStateStore> = {};

  switch (event.type) {
    case 'USER_MESSAGE':
      if (state.currentState === 'IDLE') {
        newState = 'ANALYZING';
        updates.messageComplexity = null;
        updates.error = null;
      }

      break;

    case 'COMPLEXITY_ANALYZED':
      if (state.currentState === 'ANALYZING') {
        updates.messageComplexity = event.complexity;

        if (event.requiresPlanning && state.settings.autoPlanning) {
          newState = 'PLANNING';
          logger.info('Transitioning to PLANNING state', {
            complexity: event.complexity,
            requiresPlanning: event.requiresPlanning,
            autoPlanning: state.settings.autoPlanning,
          });
        } else {
          newState = 'EXECUTING';
          logger.info('Transitioning to EXECUTING state (no planning required)', {
            complexity: event.complexity,
            requiresPlanning: event.requiresPlanning,
            autoPlanning: state.settings.autoPlanning,
          });
        }
      } else if (state.currentState === 'IDLE') {
        // Allow transition from IDLE directly to handle immediate analysis
        logger.info('COMPLEXITY_ANALYZED event received in IDLE state, transitioning through ANALYZING', {
          currentState: state.currentState,
          complexity: event.complexity,
        });
        updates.messageComplexity = event.complexity;

        if (event.requiresPlanning && state.settings.autoPlanning) {
          newState = 'PLANNING';
        } else {
          newState = 'EXECUTING';
        }
      } else {
        logger.warn('COMPLEXITY_ANALYZED event received in wrong state', {
          currentState: state.currentState,
          expected: 'ANALYZING or IDLE',
          complexity: event.complexity,
        });

        // Don't reject the event, just log and continue
        return;
      }

      break;

    case 'PLAN_GENERATED':
      if (state.currentState === 'PLANNING') {
        newState = 'AWAITING_APPROVAL';
        updates.currentPlan = event.plan;
        updates.executionProgress = {
          currentStepIndex: 0,
          completedSteps: 0,
          totalSteps: event.plan.steps.length,
          percentComplete: 0,
        };
      }

      break;

    case 'PLAN_APPROVED':
      if (state.currentState === 'AWAITING_APPROVAL') {
        newState = 'EXECUTING';
      }

      break;

    case 'PLAN_REJECTED':
      if (state.currentState === 'AWAITING_APPROVAL') {
        newState = 'IDLE';
        updates.currentPlan = null;
      }

      break;

    case 'EXECUTION_STARTED':
      if (state.currentState === 'PLANNING' || state.currentState === 'ANALYZING') {
        newState = 'EXECUTING';
      }

      break;

    case 'EXECUTION_ERROR':
      if (state.currentState === 'EXECUTING') {
        newState = 'DEBUGGING';
        updates.error = event.error;
      }

      break;

    case 'EXECUTION_COMPLETED':
      if (state.currentState === 'EXECUTING') {
        newState = 'COMPLETED';
        updates.executionProgress = {
          ...state.executionProgress,
          percentComplete: 100,
          completedSteps: state.executionProgress.totalSteps,
        };
      }

      break;

    case 'RESET':
      newState = 'IDLE';
      updates = {
        ...updates,
        currentPlan: null,
        messageComplexity: null,
        error: null,
        executionProgress: DEFAULT_STATE.executionProgress,
      };
      break;
  }

  // Apply transition if valid
  if (newState !== state.currentState) {
    if (canTransition(state.currentState, newState)) {
      const historyEntry = {
        state: newState,
        timestamp: new Date(),
        event,
      };

      const newStoreState = {
        ...state,
        ...updates,
        currentState: newState,
        previousState: state.currentState,
        stateHistory: [...state.stateHistory, historyEntry],
      };

      agentStateStore.set(newStoreState);
      saveStateToStorage(newStoreState);

      logger.info(`State transition: ${state.currentState} -> ${newState}`, { event });
    } else {
      logger.warn(`Invalid state transition attempted: ${state.currentState} -> ${newState}`, { event });
    }
  } else if (Object.keys(updates).length > 0) {
    // Apply updates without state change
    const newStoreState = { ...state, ...updates };
    agentStateStore.set(newStoreState);
    saveStateToStorage(newStoreState);
  }
}

/**
 * Update plan step status
 */
export function updatePlanStep(stepId: string, updates: Partial<PlanStep>) {
  const state = agentStateStore.get();

  if (!state.currentPlan) {
    return;
  }

  const stepIndex = state.currentPlan.steps.findIndex((s) => s.id === stepId);

  if (stepIndex === -1) {
    return;
  }

  const updatedSteps = [...state.currentPlan.steps];
  updatedSteps[stepIndex] = { ...updatedSteps[stepIndex], ...updates };

  const completedSteps = updatedSteps.filter((s) => s.status === 'completed').length;
  const percentComplete = Math.round((completedSteps / updatedSteps.length) * 100);

  const newState = {
    ...state,
    currentPlan: {
      ...state.currentPlan,
      steps: updatedSteps,
    },
    executionProgress: {
      ...state.executionProgress,
      currentStepIndex: stepIndex,
      completedSteps,
      percentComplete,
    },
  };

  agentStateStore.set(newState);
  saveStateToStorage(newState);
}

/**
 * Update settings
 */
export function updateSettings(settings: Partial<AgentStateStore['settings']>) {
  const state = agentStateStore.get();
  const newState = {
    ...state,
    settings: { ...state.settings, ...settings },
  };
  agentStateStore.set(newState);
  saveStateToStorage(newState);
}

/**
 * Clear state and reset to idle
 */
export function resetAgentState() {
  processEvent({ type: 'RESET' });
}

/**
 * Get current state for external use
 */
export function getCurrentState(): AgentState {
  return agentStateStore.get().currentState;
}

/**
 * Check if planning should be triggered based on complexity
 */
export function shouldTriggerPlanning(complexity: number): boolean {
  const { settings } = agentStateStore.get();
  return settings.autoPlanning && complexity >= settings.complexityThreshold;
}
