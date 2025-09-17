import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('messageAnalyzer');

/**
 * Message analysis result
 */
export interface AnalysisResult {
  complexity: number; // 1-10 scale
  requiresPlanning: boolean;
  taskCount: number;
  estimatedSteps: number;
  categories: string[];
  confidence: number; // 0-1 confidence in analysis
  reasoning: string;
}

/**
 * Keywords and patterns for complexity analysis
 */
const COMPLEXITY_PATTERNS = {
  // High complexity indicators (weight: 3)
  highComplexity: {
    weight: 3,
    patterns: [
      /\bcreate\s+(a\s+)?((full|complete|entire|complex)\s+)?app(lication)?\b/i,
      /\bbuild\s+(a\s+)?((full|complete|entire|complex)\s+)?(system|platform|portal|dashboard|application)\b/i,
      /\b(build|create|develop)\s+(an?\s+)?(enterprise|ecommerce|e-commerce|business)\s+(platform|system|solution|application)\b/i,
      /\bimplement\s+(a\s+)?((full|complete|entire)\s+)?feature\b/i,
      /\brefactor\s+(the\s+)?(entire|whole|complete)\b/i,
      /\bintegrate\s+with\b/i,
      /\bset\s*up\s+(a\s+)?((complete|full)\s+)?database\b/i,
      /\badd\s+authentication\b/i,
      /\bcreate\s+.*\s+with\s+.*\s+and\s+/i, // Multiple requirements
      /\bmigrate\s+(from|to)\b/i,
      /\bconvert\s+(the\s+)?project\b/i,
      /\bdeploy\s+to\s+production\b/i,
      /\b(automation|automated)\s+(platform|system|workflow)\b/i,
      /\b(customer|client)\s+(care|service|support|management)\b/i,
      /\bmanagement\s+system\b/i,
      /\bmultiple\s+(features|components|systems|modules)\b/i,
    ],
    keywords: [
      'architecture',
      'microservices',
      'authentication',
      'authorization',
      'real-time',
      'websocket',
      'database schema',
      'api integration',
      'deployment',
      'ci/cd',
      'testing suite',
      'e2e tests',
      'enterprise',
      'ecommerce',
      'e-commerce',
      'platform',
      'automation',
      'inventory',
      'shipping',
      'customer care',
      'crm',
      'erp',
      'workflow',
      'integration',
      'management system',
      'portal',
      'dashboard',
      'analytics',
      'reporting',
      'multi-tenant',
      'scalable',
      'distributed',
      'orchestration',
    ],
  },

  // Medium complexity indicators (weight: 2)
  mediumComplexity: {
    weight: 2,
    patterns: [
      /\badd\s+(a\s+)?feature\b/i,
      /\bfix\s+multiple\s+issues\b/i,
      /\bupdate\s+.*\s+to\s+support\b/i,
      /\bmodify\s+(the\s+)?component\b/i,
      /\bcreate\s+(a\s+)?form\b/i,
      /\bimplement\s+(a\s+)?validation\b/i,
      /\badd\s+tests?\b/i,
      /\bstyle\s+(the\s+)?page\b/i,
      /\bconnect\s+to\s+(an?\s+)?api\b/i,
    ],
    keywords: [
      'component',
      'validation',
      'form',
      'api call',
      'endpoint',
      'styling',
      'responsive',
      'modal',
      'navigation',
      'routing',
    ],
  },

  // Low complexity indicators (weight: 1)
  lowComplexity: {
    weight: 1,
    patterns: [
      /\bfix\s+(a\s+)?typo\b/i,
      /\bchange\s+(the\s+)?color\b/i,
      /\bupdate\s+(the\s+)?text\b/i,
      /\brename\s+(a\s+)?variable\b/i,
      /\badd\s+(a\s+)?comment\b/i,
      /\bremove\s+console\s*\.\s*log\b/i,
      /\bformat\s+(the\s+)?code\b/i,
      /\bclean\s*up\b/i,
    ],
    keywords: ['typo', 'comment', 'rename', 'format', 'cleanup', 'spacing', 'indentation', 'console.log'],
  },

  // Task multipliers (indicate multiple tasks)
  taskMultipliers: {
    patterns: [
      /\band\b/gi, // Simple "and" for multiple items
      /\band\s+also\b/i,
      /\badditionally\b/i,
      /\bfurthermore\b/i,
      /\bplus\b/i,
      /\bthen\b.*\bthen\b/i,
      /\bfirst\b.*\bsecond\b.*\bthird\b/i,
      /\bstep\s+\d+/gi,
      /^\s*\d+\.\s+/gm, // Numbered lists
      /^\s*[-*]\s+/gm, // Bullet points
      /,\s+(?:and\s+)?/g, // Comma-separated lists
      /\bwant\s+\w+.*,.*and\b/i, // "I want X, Y, and Z" pattern
    ],
  },

  // Scope indicators
  scopeIndicators: {
    large: [
      /\bentire\s+(app|application|project|codebase)\b/i,
      /\ball\s+(components|pages|files)\b/i,
      /\beverything\b/i,
      /\bfull[\s-]?stack\b/i,
      /\bend[\s-]?to[\s-]?end\b/i,
    ],
    medium: [/\bmultiple\s+(components|pages|files)\b/i, /\bseveral\s+changes\b/i, /\ba\s+few\s+things\b/i],
    small: [/\bsingle\s+(component|file|function)\b/i, /\bone\s+thing\b/i, /\bjust\s+this\b/i, /\bonly\b/i],
  },

  // Action verbs categorization
  actionVerbs: {
    create: ['create', 'build', 'make', 'generate', 'scaffold', 'initialize'],
    modify: ['update', 'change', 'modify', 'edit', 'refactor', 'improve'],
    fix: ['fix', 'repair', 'debug', 'solve', 'resolve', 'troubleshoot'],
    add: ['add', 'implement', 'include', 'integrate', 'append'],
    remove: ['remove', 'delete', 'clean', 'clear', 'eliminate'],
    analyze: ['analyze', 'review', 'check', 'audit', 'inspect', 'evaluate'],
  },
};

/**
 * Analyze message complexity
 */
export function analyzeMessageComplexity(message: string): AnalysisResult {
  const lowerMessage = message.toLowerCase();
  let complexityScore = 0;
  let taskCount = 0;
  const categories: Set<string> = new Set();
  const reasoningParts: string[] = [];

  // Check high complexity patterns
  let highMatches = 0;

  for (const pattern of COMPLEXITY_PATTERNS.highComplexity.patterns) {
    if (pattern.test(message)) {
      complexityScore += COMPLEXITY_PATTERNS.highComplexity.weight;
      highMatches++;
      reasoningParts.push(`Found high-complexity pattern: ${pattern.source.slice(0, 30)}...`);
    }
  }

  for (const keyword of COMPLEXITY_PATTERNS.highComplexity.keywords) {
    if (lowerMessage.includes(keyword)) {
      complexityScore += COMPLEXITY_PATTERNS.highComplexity.weight * 0.5;
      categories.add('complex');
      reasoningParts.push(`Contains high-complexity keyword: "${keyword}"`);
    }
  }

  // Check medium complexity patterns
  let mediumMatches = 0;

  for (const pattern of COMPLEXITY_PATTERNS.mediumComplexity.patterns) {
    if (pattern.test(message)) {
      complexityScore += COMPLEXITY_PATTERNS.mediumComplexity.weight;
      mediumMatches++;
    }
  }

  for (const keyword of COMPLEXITY_PATTERNS.mediumComplexity.keywords) {
    if (lowerMessage.includes(keyword)) {
      complexityScore += COMPLEXITY_PATTERNS.mediumComplexity.weight * 0.5;
      categories.add('moderate');
    }
  }

  // Check low complexity patterns
  let lowMatches = 0;

  for (const pattern of COMPLEXITY_PATTERNS.lowComplexity.patterns) {
    if (pattern.test(message)) {
      complexityScore += COMPLEXITY_PATTERNS.lowComplexity.weight;
      lowMatches++;
    }
  }

  // Count tasks
  for (const pattern of COMPLEXITY_PATTERNS.taskMultipliers.patterns) {
    const matches = message.match(pattern);

    if (matches) {
      taskCount += matches.length;
      complexityScore += matches.length * 0.5;
      reasoningParts.push(`Found ${matches.length} task indicator(s)`);
    }
  }

  // Check scope
  let scopeMultiplier = 1;

  for (const pattern of COMPLEXITY_PATTERNS.scopeIndicators.large) {
    if (pattern.test(message)) {
      scopeMultiplier = 1.5;
      categories.add('large-scope');
      reasoningParts.push('Large scope detected');
      break;
    }
  }

  for (const pattern of COMPLEXITY_PATTERNS.scopeIndicators.medium) {
    if (pattern.test(message) && scopeMultiplier === 1) {
      scopeMultiplier = 1.2;
      categories.add('medium-scope');
      reasoningParts.push('Medium scope detected');
      break;
    }
  }

  for (const pattern of COMPLEXITY_PATTERNS.scopeIndicators.small) {
    if (pattern.test(message) && scopeMultiplier === 1) {
      scopeMultiplier = 0.8;
      categories.add('small-scope');
      reasoningParts.push('Small scope detected');
      break;
    }
  }

  // Categorize by action verbs
  for (const [category, verbs] of Object.entries(COMPLEXITY_PATTERNS.actionVerbs)) {
    for (const verb of verbs) {
      if (lowerMessage.includes(verb)) {
        categories.add(category);
        break;
      }
    }
  }

  // Apply scope multiplier
  complexityScore *= scopeMultiplier;

  // Message length factor (longer messages often indicate more complex requests)
  const wordCount = message.split(/\s+/).length;

  if (wordCount > 100) {
    complexityScore += 2;
    reasoningParts.push(`Long message (${wordCount} words)`);
  } else if (wordCount > 50) {
    complexityScore += 1;
    reasoningParts.push(`Moderate message length (${wordCount} words)`);
  }

  // Business/Enterprise context boost
  const businessKeywords = [
    'enterprise',
    'business',
    'company',
    'organization',
    'corporate',
    'customer',
    'client',
    'user',
    'admin',
    'management',
    'inventory',
    'shipping',
    'payment',
    'billing',
    'invoice',
    'analytics',
    'reporting',
    'dashboard',
    'metrics',
  ];

  const businessKeywordCount = businessKeywords.filter((keyword) => lowerMessage.includes(keyword)).length;

  if (businessKeywordCount >= 3) {
    complexityScore += 3;
    categories.add('business-context');
    reasoningParts.push(`Multiple business/enterprise keywords detected (${businessKeywordCount})`);
  } else if (businessKeywordCount >= 2) {
    complexityScore += 1.5;
    categories.add('business-context');
    reasoningParts.push(`Business context detected (${businessKeywordCount} keywords)`);
  }

  // Multiple systems/modules detection
  const systemKeywords = ['system', 'module', 'component', 'service', 'platform', 'portal', 'dashboard'];
  const systemMatches = systemKeywords.filter((keyword) => lowerMessage.includes(keyword)).length;

  if (systemMatches >= 2) {
    complexityScore += 2;
    reasoningParts.push(`Multiple systems/modules mentioned (${systemMatches})`);
  }

  // Normalize complexity score to 1-10 scale
  const normalizedComplexity = Math.min(10, Math.max(1, Math.round(complexityScore)));

  // Determine if planning is required
  const requiresPlanning = normalizedComplexity >= 5 || taskCount > 3 || categories.has('complex');

  // Calculate estimated steps
  const estimatedSteps = Math.max(1, Math.ceil(normalizedComplexity / 2) + Math.max(0, taskCount - 1));

  // Calculate confidence based on pattern matches
  const totalMatches = highMatches + mediumMatches + lowMatches;
  const confidence = totalMatches > 0 ? Math.min(1, totalMatches * 0.2 + categories.size * 0.1) : 0.3; // Low confidence if no patterns matched

  const result: AnalysisResult = {
    complexity: normalizedComplexity,
    requiresPlanning,
    taskCount: Math.max(1, taskCount),
    estimatedSteps,
    categories: Array.from(categories),
    confidence,
    reasoning: reasoningParts.join('; ') || 'Basic analysis completed',
  };

  logger.debug('Message analysis result:', result);

  return result;
}

/**
 * Extract potential plan steps from a message
 */
export function extractPotentialSteps(message: string): string[] {
  const steps: string[] = [];

  // Check for numbered lists
  const numberedPattern = /^\s*\d+[\.)]\s+(.+)$/gm;
  let match;

  while ((match = numberedPattern.exec(message)) !== null) {
    steps.push(match[1].trim());
  }

  // Check for bullet points
  const bulletPattern = /^\s*[-*•]\s+(.+)$/gm;

  while ((match = bulletPattern.exec(message)) !== null) {
    steps.push(match[1].trim());
  }

  // If no explicit list, try to extract from "and" separated items
  if (steps.length === 0) {
    const andPattern = /\b(?:and|then|also|additionally)\b/gi;
    const parts = message
      .split(andPattern)
      .map((p) => p.trim())
      .filter((p) => p.length > 10);

    if (parts.length > 1) {
      steps.push(...parts);
    }
  }

  return steps;
}

/**
 * Analyze if a message is asking a question vs requesting implementation
 */
export function isQuestionOnly(message: string): boolean {
  const questionPatterns = [
    /^(what|how|why|when|where|which|who|can|could|should|would|is|are|do|does)\b/i,
    /\?$/,
    /\bexplain\b/i,
    /\btell\s+me\b/i,
    /\bshow\s+me\s+how\b/i,
    /\bhelp\s+me\s+understand\b/i,
  ];

  const implementationPatterns = [
    /\b(create|build|make|implement|add|fix|update|modify|change)\b/i,
    /\bcode\s+(this|that|it)\b/i,
    /\bwrite\s+(the\s+)?code\b/i,
  ];

  let questionScore = 0;
  let implementationScore = 0;

  for (const pattern of questionPatterns) {
    if (pattern.test(message)) {
      questionScore++;
    }
  }

  for (const pattern of implementationPatterns) {
    if (pattern.test(message)) {
      implementationScore++;
    }
  }

  return questionScore > implementationScore;
}

/**
 * Get a summary of the analysis for display
 */
export function getAnalysisSummary(result: AnalysisResult): string {
  const complexity = result.complexity <= 3 ? 'Low' : result.complexity <= 6 ? 'Medium' : 'High';
  const planning = result.requiresPlanning ? 'Planning recommended' : 'Direct execution';

  return (
    `${complexity} complexity (${result.complexity}/10). ${planning}. ` +
    `Estimated ${result.estimatedSteps} step(s). ` +
    `Categories: ${result.categories.join(', ') || 'general'}.`
  );
}
