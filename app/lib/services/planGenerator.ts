import { createScopedLogger } from '~/utils/logger';
import type { ExecutionPlan, PlanStep } from '~/lib/stores/agentState';
import { extractPotentialSteps, type AnalysisResult } from './messageAnalyzer';

const logger = createScopedLogger('planGenerator');

/**
 * Generate a structured execution plan based on user message and analysis
 */
export async function generateExecutionPlan(
  message: string,
  analysis: AnalysisResult,
  useAI: boolean = false,
  provider?: any,
  model?: string,
): Promise<ExecutionPlan> {
  logger.info('Starting execution plan generation', {
    messageLength: message.length,
    complexity: analysis.complexity,
    requiresPlanning: analysis.requiresPlanning,
    useAI,
    provider: provider?.name,
    model,
  });

  let steps: PlanStep[] = [];
  let title = 'Execution Plan';
  let description = '';

  if (useAI && provider && model) {
    try {
      logger.info('Attempting AI-powered plan generation', {
        message: message.slice(0, 100) + (message.length > 100 ? '...' : ''),
        complexity: analysis.complexity,
        provider: provider?.name || 'unknown',
        model,
        timestamp: new Date().toISOString(),
      });

      const requestBody = {
        message,
        complexity: analysis.complexity,
        provider,
        model,
      };

      logger.debug('Plan API request body', {
        bodySize: JSON.stringify(requestBody).length,
        hasMessage: !!message,
        hasProvider: !!provider,
        hasModel: !!model,
      });

      // Call our AI plan generation API
      const response = await fetch('/api/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      logger.info('Plan API response received', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
      });

      if (response.ok) {
        const result = (await response.json()) as { plan?: ExecutionPlan; error?: string };
        logger.info('Plan API result parsed', {
          hasPlan: !!result.plan,
          hasError: !!result.error,
          error: result.error,
          planTitle: result.plan?.title,
          stepCount: result.plan?.steps?.length,
        });

        if (result.plan) {
          logger.info('Successfully generated AI plan', {
            planId: result.plan.id,
            stepCount: result.plan.steps?.length,
            title: result.plan.title,
            estimatedComplexity: result.plan.estimatedComplexity,
            hasMetadata: !!result.plan.metadata,
          });
          return result.plan;
        } else if (result.error) {
          logger.error('AI plan generation API returned error', {
            error: result.error,
            fallbackRequired: true,
          });
        }
      } else {
        const errorText = await response.text();
        logger.error('AI plan generation API failed with HTTP error', {
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText.slice(0, 500),
          fallbackRequired: true,
        });
      }
    } catch (error) {
      logger.error('AI plan generation failed with exception', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        fallbackRequired: true,
      });
    }
  } else {
    logger.info('Skipping AI plan generation', {
      useAI,
      hasProvider: !!provider,
      hasModel: !!model,
      reason: !useAI ? 'useAI=false' : !provider ? 'no provider' : 'no model',
    });
  }

  // Fallback to basic plan generation
  logger.info('Falling back to basic plan generation', {
    reason: 'AI generation failed or skipped',
    complexity: analysis.complexity,
  });

  // Extract potential steps from the message
  const extractedSteps = extractPotentialSteps(message);
  logger.debug('Extracted potential steps from message', {
    stepCount: extractedSteps.length,
    steps: extractedSteps,
  });

  if (extractedSteps.length > 0) {
    steps = extractedSteps.map((step, index) => ({
      id: `step-${Date.now()}-${index}`,
      description: step,
      status: 'pending' as const,
      estimatedTime: estimateStepTime(step, analysis.complexity),
    }));
    logger.info('Using extracted steps from message', { stepCount: steps.length });
  } else {
    // Generate default steps based on analysis
    steps = generateDefaultSteps(message, analysis);
    logger.info('Generated default steps based on analysis', {
      stepCount: steps.length,
      categories: analysis.categories,
    });
  }

  // Generate title based on message content
  title = generatePlanTitle(message, analysis);

  // Generate description
  description = generatePlanDescription(message, analysis, steps.length);

  const plan: ExecutionPlan = {
    id: `fallback-plan-${Date.now()}`,
    title,
    description,
    steps,
    estimatedComplexity: analysis.complexity,
    createdAt: new Date(),
    metadata: {
      aiGenerated: false,
      fallback: true,
      analysisCategories: analysis.categories,
      confidence: analysis.confidence,
    },
  };

  logger.info('Generated fallback execution plan', {
    planId: plan.id,
    title: plan.title,
    stepCount: plan.steps.length,
    estimatedComplexity: plan.estimatedComplexity,
    metadata: plan.metadata,
  });

  return plan;
}

/**
 * Generate default steps based on message and complexity
 */
function generateDefaultSteps(message: string, analysis: AnalysisResult): PlanStep[] {
  const steps: PlanStep[] = [];
  const lowerMessage = message.toLowerCase();

  // Analyze requirements
  steps.push({
    id: `step-${Date.now()}-0`,
    description: 'Analyze requirements and define project scope',
    status: 'pending',
    estimatedTime: 300, // 5 minutes
  });

  // Check for specific patterns and add relevant steps
  if (lowerMessage.includes('database') || lowerMessage.includes('data')) {
    steps.push({
      id: `step-${Date.now()}-${steps.length}`,
      description: 'Design and set up database schema',
      status: 'pending',
      estimatedTime: 600,
    });
  }

  if (lowerMessage.includes('api') || lowerMessage.includes('backend')) {
    steps.push({
      id: `step-${Date.now()}-${steps.length}`,
      description: 'Create API endpoints and backend logic',
      status: 'pending',
      estimatedTime: 900,
    });
  }

  if (lowerMessage.includes('ui') || lowerMessage.includes('interface') || lowerMessage.includes('dashboard')) {
    steps.push({
      id: `step-${Date.now()}-${steps.length}`,
      description: 'Design and implement user interface',
      status: 'pending',
      estimatedTime: 1200,
    });
  }

  if (lowerMessage.includes('authentication') || lowerMessage.includes('auth')) {
    steps.push({
      id: `step-${Date.now()}-${steps.length}`,
      description: 'Implement authentication and authorization',
      status: 'pending',
      estimatedTime: 600,
    });
  }

  if (lowerMessage.includes('test') || analysis.complexity >= 7) {
    steps.push({
      id: `step-${Date.now()}-${steps.length}`,
      description: 'Write tests and perform quality assurance',
      status: 'pending',
      estimatedTime: 600,
    });
  }

  // Add implementation step if no specific steps were added
  if (steps.length === 1) {
    steps.push({
      id: `step-${Date.now()}-${steps.length}`,
      description: 'Implement core functionality',
      status: 'pending',
      estimatedTime: estimateStepTime('', analysis.complexity) * 2,
    });
  }

  // Always add a final review step
  steps.push({
    id: `step-${Date.now()}-${steps.length}`,
    description: 'Review implementation and optimize code',
    status: 'pending',
    estimatedTime: 300,
  });

  return steps;
}

/**
 * Generate a descriptive plan title
 */
function generatePlanTitle(message: string, analysis: AnalysisResult): string {
  const lowerMessage = message.toLowerCase();

  // Extract key action and object
  if (lowerMessage.includes('ecommerce')) {
    return 'E-commerce Platform Development Plan';
  } else if (lowerMessage.includes('dashboard')) {
    return 'Dashboard Implementation Plan';
  } else if (lowerMessage.includes('api')) {
    return 'API Development Plan';
  } else if (lowerMessage.includes('app') || lowerMessage.includes('application')) {
    return 'Application Development Plan';
  } else if (lowerMessage.includes('website')) {
    return 'Website Development Plan';
  } else if (lowerMessage.includes('system')) {
    return 'System Implementation Plan';
  } else if (lowerMessage.includes('platform')) {
    return 'Platform Development Plan';
  } else if (lowerMessage.includes('feature')) {
    return 'Feature Implementation Plan';
  }

  // Default based on complexity
  if (analysis.complexity >= 7) {
    return 'Complex Project Implementation Plan';
  } else if (analysis.complexity >= 4) {
    return 'Project Implementation Plan';
  } else {
    return 'Task Execution Plan';
  }
}

/**
 * Generate a plan description
 */
function generatePlanDescription(message: string, analysis: AnalysisResult, stepCount: number): string {
  const complexityLevel = analysis.complexity <= 3 ? 'simple' : analysis.complexity <= 6 ? 'moderate' : 'complex';

  const timeEstimate = Math.ceil(stepCount * 10); // Rough estimate in minutes

  return (
    `This ${complexityLevel} task requires ${stepCount} steps to complete, ` +
    `with an estimated time of ${timeEstimate} minutes. ` +
    `The plan addresses the requirements for: "${message.slice(0, 100)}${message.length > 100 ? '...' : ''}"`
  );
}

/**
 * Estimate time for a step based on its description and complexity
 */
function estimateStepTime(stepDescription: string, complexity: number): number {
  // Base time in seconds
  let baseTime = 300; // 5 minutes

  // Adjust based on complexity
  baseTime *= 1 + (complexity - 1) * 0.2;

  // Adjust based on step keywords
  const lowerStep = stepDescription.toLowerCase();

  if (lowerStep.includes('implement') || lowerStep.includes('create') || lowerStep.includes('build')) {
    baseTime *= 1.5;
  } else if (lowerStep.includes('test') || lowerStep.includes('debug')) {
    baseTime *= 1.2;
  } else if (lowerStep.includes('design') || lowerStep.includes('plan')) {
    baseTime *= 0.8;
  }

  return Math.round(baseTime);
}

/**
 * Regenerate a plan with different approach or more detail
 */
export async function regeneratePlan(
  message: string,
  analysis: AnalysisResult,
  previousPlan: ExecutionPlan,
  feedback?: string,
): Promise<ExecutionPlan> {
  logger.info('Regenerating plan with feedback', { message, feedback });

  // Adjust analysis based on feedback
  const adjustedAnalysis = { ...analysis };

  if (feedback?.toLowerCase().includes('simpl')) {
    adjustedAnalysis.complexity = Math.max(1, analysis.complexity - 2);
  } else if (feedback?.toLowerCase().includes('detail') || feedback?.toLowerCase().includes('more')) {
    adjustedAnalysis.complexity = Math.min(10, analysis.complexity + 2);
  }

  // Generate new plan with adjusted parameters
  const newPlan = await generateExecutionPlan(message, adjustedAnalysis, false);

  // Add more granular steps if requested
  if (feedback?.toLowerCase().includes('more step') || feedback?.toLowerCase().includes('detail')) {
    const expandedSteps: PlanStep[] = [];

    for (const step of newPlan.steps) {
      expandedSteps.push(step);

      // Add sub-steps for complex items
      if (step.description.includes('implement') || step.description.includes('create')) {
        expandedSteps.push({
          id: `${step.id}-sub`,
          description: `  → Prepare environment and dependencies for ${step.description.toLowerCase()}`,
          status: 'pending',
          estimatedTime: step.estimatedTime ? step.estimatedTime * 0.3 : 180,
        });
      }
    }

    newPlan.steps = expandedSteps;
  }

  return newPlan;
}
