import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { streamText } from '~/lib/.server/llm/stream-text';
import { createScopedLogger } from '~/utils/logger';
import type { IProviderSetting, ProviderInfo } from '~/types/model';
import type { ExecutionPlan, PlanStep } from '~/lib/stores/agentState';

const logger = createScopedLogger('api.plan');

interface PlanRequest {
  message: string;
  complexity: number;
  provider: ProviderInfo;
  model: string;
}

export async function action({ context, request }: ActionFunctionArgs) {
  try {
    logger.info('Plan API called');

    const body = (await request.json()) as PlanRequest;
    const { message, complexity, provider, model } = body;

    // Debug environment and API key access
    const envApiKey = process.env.OPENAI_API_KEY || context.cloudflare?.env?.OPENAI_API_KEY;
    logger.info('Plan API environment check:', {
      hasMessage: !!message,
      hasProvider: !!provider,
      hasModel: !!model,
      complexity,
      messageLength: message?.length || 0,
      providerName: provider?.name,
      hasEnvApiKey: !!envApiKey,
      envApiKeyPrefix: envApiKey ? envApiKey.substring(0, 10) + '...' : 'none',
    });

    if (!message || !provider || !model) {
      logger.error('Missing required parameters', { message: !!message, provider: !!provider, model: !!model });
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    logger.info('Generating AI plan', { message: message.slice(0, 100), complexity, model });

    // Create simple prompt for plan generation with model and provider information
    const planPrompt = getPlanGenerationPrompt(message);
    const messageWithModelInfo = `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${planPrompt}`;

    const messages = [{ role: 'user' as const, content: messageWithModelInfo }];

    let aiResponse = '';

    // Parse provider settings from cookies (similar to chat API)
    const cookieHeader = request.headers.get('Cookie');
    const parseCookies = (cookieHeader: string): Record<string, string> => {
      const cookies: Record<string, string> = {};

      if (!cookieHeader) {
        return cookies;
      }

      const items = cookieHeader.split(';').map((cookie) => cookie.trim());
      items.forEach((item) => {
        const [name, ...rest] = item.split('=');

        if (name && rest.length > 0) {
          try {
            const decodedName = decodeURIComponent(name.trim());
            const decodedValue = decodeURIComponent(rest.join('=').trim());
            cookies[decodedName] = decodedValue;
          } catch (error) {
            logger.warn('Failed to decode cookie', { name, error });
          }
        }
      });

      return cookies;
    };

    let apiKeys = {};
    let providerSettings: Record<string, IProviderSetting> = {};

    try {
      const cookies = parseCookies(cookieHeader || '');
      apiKeys = JSON.parse(cookies.apiKeys || '{}');
      providerSettings = JSON.parse(cookies.providers || '{}');
      logger.debug('Parsed cookies successfully', {
        hasApiKeys: Object.keys(apiKeys).length > 0,
        hasProviderSettings: Object.keys(providerSettings).length > 0,
      });
    } catch (error) {
      logger.error('Failed to parse cookies, using empty settings', error);
    }

    // Ensure OpenAI API key is available for plan generation
    if (envApiKey && provider.name === 'OpenAI') {
      apiKeys = { ...apiKeys, OPENAI_API_KEY: envApiKey };
      logger.debug('Added OpenAI API key from environment', { hasKey: !!envApiKey });
    }

    // Generate plan using AI
    logger.info('Starting AI plan generation', { provider: provider.name, model });

    logger.debug('streamText parameters:', {
      messagesCount: messages.length,
      firstMessage: messages[0]?.content?.substring(0, 100),
      hasEnv: !!context.cloudflare?.env,
      hasApiKeys: !!apiKeys,
      apiKeysKeys: Object.keys(apiKeys || {}),
      hasProviderSettings: !!providerSettings,
      providerSettingsKeys: Object.keys(providerSettings || {}),
    });

    const result = await streamText({
      messages,
      env: context.cloudflare?.env,
      apiKeys,
      providerSettings,
      promptId: 'default', // Use default prompt instead of 'plan-generation'
      contextOptimization: false,
      chatMode: 'discuss',
    });

    logger.info('streamText result:', {
      hasResult: !!result,
      hasTextStream: !!result?.textStream,
      resultKeys: result ? Object.keys(result) : [],
    });

    if (!result || !result.textStream) {
      throw new Error('No response stream received from AI provider');
    }

    // Collect the streamed response with timeout
    const chunks: string[] = [];
    let totalLength = 0;
    const maxResponseLength = 50000; // 50KB limit
    const timeoutMs = 30000; // 30 second timeout

    const streamPromise = (async () => {
      for await (const chunk of result.textStream) {
        chunks.push(chunk);
        totalLength += chunk.length;

        if (totalLength > maxResponseLength) {
          logger.warn('AI response too long, truncating', { totalLength });
          break;
        }
      }
      return chunks.join('');
    })();

    const timeoutPromise = new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error('AI response timeout')), timeoutMs);
    });

    try {
      aiResponse = await Promise.race([streamPromise, timeoutPromise]);
      logger.debug('AI response received successfully', {
        responseLength: aiResponse.length,
        chunks: chunks.length,
      });
    } catch (error) {
      logger.error('Failed to collect AI response stream', error);
      throw new Error(`AI response collection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    if (!aiResponse.trim()) {
      throw new Error('Empty response received from AI provider');
    }

    // Parse the AI response into a structured plan
    const plan = parseAIPlanResponse(aiResponse, message, complexity);

    logger.info('Plan generated successfully', {
      planId: plan.id,
      stepCount: plan.steps.length,
      title: plan.title,
    });

    return new Response(JSON.stringify({ plan }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.error('Plan generation failed', error);
    return new Response(
      JSON.stringify({
        error: 'Plan generation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

function getPlanGenerationPrompt(userMessage: string): string {
  return `Create a succinct plan in markdown that is human readable for the following project: ${userMessage}

Please format your response as clean, readable markdown with the following structure:

## Overview
Brief 1-2 sentence description of what will be built.

## Key Features
- Feature 1
- Feature 2
- Feature 3

## Implementation Steps
1. **Step 1 Name** - Brief description of what this step involves
2. **Step 2 Name** - Brief description of what this step involves
3. **Step 3 Name** - Brief description of what this step involves

## Technologies & Tools
- Technology 1: Purpose
- Technology 2: Purpose
- Technology 3: Purpose

## Considerations
- Important consideration 1
- Important consideration 2
- Important consideration 3

Keep the plan concise but comprehensive. Use clear headings, bullet points, and numbered lists. Focus on actionable steps and practical implementation details.`;
}

interface ParsedMarkdownPlan {
  title: string;
  overview?: string;
  steps: PlanStep[];
  technologies?: string[];
  considerations?: string[];
}

function parseMarkdownPlan(markdownContent: string, originalMessage: string): ParsedMarkdownPlan {
  const lines = markdownContent.split('\n');
  let title = generateFallbackTitle(originalMessage);
  let overview = '';
  const steps: PlanStep[] = [];
  const technologies: string[] = [];
  const considerations: string[] = [];

  let currentSection = '';
  let stepCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect sections by headers
    if (line.startsWith('##')) {
      currentSection = line.replace('##', '').trim().toLowerCase();
      continue;
    }

    // Extract content based on current section
    switch (currentSection) {
      case 'overview':
        if (line && !line.startsWith('#') && !line.startsWith('-') && !line.match(/^\d+\./)) {
          overview += line + ' ';
        }

        break;

      case 'implementation steps': {
        // Look for numbered list items
        const stepMatch = line.match(/^\d+\.\s*\*\*(.*?)\*\*\s*-\s*(.*)/);

        if (stepMatch) {
          stepCounter++;
          steps.push({
            id: `ai-step-${Date.now()}-${stepCounter}`,
            description: `${stepMatch[1]}: ${stepMatch[2]}`,
            status: 'pending' as const,
            estimatedTime: estimateStepTimeFromDescription(stepMatch[2]),
          });
        } else if (line.match(/^\d+\.\s*(.*)/)) {
          // Handle simpler numbered lists
          const simpleStep = line.replace(/^\d+\.\s*/, '');

          if (simpleStep) {
            stepCounter++;
            steps.push({
              id: `ai-step-${Date.now()}-${stepCounter}`,
              description: simpleStep,
              status: 'pending' as const,
              estimatedTime: estimateStepTimeFromDescription(simpleStep),
            });
          }
        }

        break;
      }

      case 'technologies & tools':
      case 'technologies': {
        // Look for bullet points
        const techMatch = line.match(/^-\s*(.*?)(?::\s*(.*))?$/);

        if (techMatch) {
          technologies.push(techMatch[1]);
        }

        break;
      }

      case 'considerations': {
        // Look for bullet points
        const considerationMatch = line.match(/^-\s*(.*)$/);

        if (considerationMatch) {
          considerations.push(considerationMatch[1]);
        }

        break;
      }
    }
  }

  // If we couldn't extract steps, create a fallback
  if (steps.length === 0) {
    steps.push({
      id: `ai-step-${Date.now()}-fallback`,
      description: 'Review and implement the plan above',
      status: 'pending' as const,
      estimatedTime: 1800, // 30 minutes
    });
  }

  // Try to extract a better title from the content
  const titleMatch = markdownContent.match(/^#\s*(.+)$/m);

  if (titleMatch) {
    title = titleMatch[1];
  } else if (overview) {
    // Generate title from overview
    const words = overview.trim().split(' ').slice(0, 6);
    title = words.join(' ') + (words.length === 6 ? '...' : '');
  }

  return {
    title: title || generateFallbackTitle(originalMessage),
    overview: overview.trim() || undefined,
    steps,
    technologies: technologies.length > 0 ? technologies : undefined,
    considerations: considerations.length > 0 ? considerations : undefined,
  };
}

function estimateStepTimeFromDescription(description: string): number {
  const lowerDesc = description.toLowerCase();

  // Base time in seconds
  let baseTime = 600; // 10 minutes

  // Adjust based on keywords
  if (lowerDesc.includes('setup') || lowerDesc.includes('install') || lowerDesc.includes('configure')) {
    baseTime = 300; // 5 minutes
  } else if (lowerDesc.includes('implement') || lowerDesc.includes('build') || lowerDesc.includes('create')) {
    baseTime = 1200; // 20 minutes
  } else if (lowerDesc.includes('test') || lowerDesc.includes('deploy') || lowerDesc.includes('optimize')) {
    baseTime = 900; // 15 minutes
  } else if (lowerDesc.includes('design') || lowerDesc.includes('plan') || lowerDesc.includes('analyze')) {
    baseTime = 600; // 10 minutes
  }

  return baseTime;
}

function parseAIPlanResponse(aiResponse: string, originalMessage: string, complexity: number): ExecutionPlan {
  try {
    // Try to parse as JSON first (in case AI returns structured data)
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);

        // Convert to our ExecutionPlan format if JSON is valid
        const steps: PlanStep[] =
          parsed.steps?.map((step: any, index: number) => ({
            id: `ai-step-${Date.now()}-${index}`,
            description: step.description || `Step ${index + 1}`,
            status: 'pending' as const,
            estimatedTime: step.estimatedTime || 300,
            details: step.details,
          })) || [];

        const plan: ExecutionPlan = {
          id: `ai-plan-${Date.now()}`,
          title: parsed.title || generateFallbackTitle(originalMessage),
          description: parsed.description || `AI-generated plan for: ${originalMessage.slice(0, 100)}...`,
          steps,
          estimatedComplexity: complexity,
          createdAt: new Date(),
          metadata: {
            aiGenerated: true,
            architecture: parsed.architecture,
            technologies: parsed.technologies,
            considerations: parsed.considerations,
            totalEstimatedTime: parsed.totalEstimatedTime,
          },
        };

        logger.info('Successfully parsed structured AI plan', {
          stepCount: steps.length,
          title: plan.title,
        });

        return plan;
      } catch {
        // Fall through to plain text processing
      }
    }

    // Handle markdown response from AI
    const parsedMarkdown = parseMarkdownPlan(aiResponse, originalMessage);

    const plan: ExecutionPlan = {
      id: `ai-plan-${Date.now()}`,
      title: parsedMarkdown.title,
      description: aiResponse, // Keep the full markdown for display
      steps: parsedMarkdown.steps,
      estimatedComplexity: complexity,
      createdAt: new Date(),
      metadata: {
        aiGenerated: true,
        rawResponse: true,
        technologies: parsedMarkdown.technologies,
        considerations: parsedMarkdown.considerations,
        architecture: parsedMarkdown.overview,
      },
    };

    logger.info('Successfully created plan from AI text response', {
      responseLength: aiResponse.length,
      title: plan.title,
    });

    return plan;
  } catch (error) {
    logger.error('Failed to parse AI response, using fallback', error);

    // Fallback to basic plan if parsing fails
    return {
      id: `fallback-plan-${Date.now()}`,
      title: generateFallbackTitle(originalMessage),
      description: `Fallback plan (AI parsing failed): ${originalMessage}`,
      steps: [
        {
          id: `fallback-step-${Date.now()}`,
          description: 'Analyze requirements and create implementation strategy',
          status: 'pending',
          estimatedTime: 600,
        },
        {
          id: `fallback-step-${Date.now()}-2`,
          description: 'Implement core functionality',
          status: 'pending',
          estimatedTime: 1800,
        },
        {
          id: `fallback-step-${Date.now()}-3`,
          description: 'Test and optimize implementation',
          status: 'pending',
          estimatedTime: 600,
        },
      ],
      estimatedComplexity: complexity,
      createdAt: new Date(),
      metadata: {
        aiGenerated: false,
        fallback: true,
      },
    };
  }
}

function generateFallbackTitle(message: string): string {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('ecommerce')) {
    return 'E-commerce Platform Development';
  } else if (lowerMessage.includes('app')) {
    return 'Application Development Project';
  } else if (lowerMessage.includes('website')) {
    return 'Website Development Project';
  } else if (lowerMessage.includes('api')) {
    return 'API Development Project';
  } else if (lowerMessage.includes('dashboard')) {
    return 'Dashboard Development Project';
  }

  return 'Software Development Project';
}
