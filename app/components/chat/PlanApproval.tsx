import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { processEvent, type ExecutionPlan } from '~/lib/stores/agentState';
import { classNames } from '~/utils/classNames';
import { regeneratePlan } from '~/lib/services/planGenerator';
import { analyzeMessageComplexity } from '~/lib/services/messageAnalyzer';

interface PlanApprovalProps {
  plan: ExecutionPlan;
  userMessage?: string;
  onApprove?: () => void;
  onReject?: () => void;
  onModify?: (modifiedPlan: ExecutionPlan) => void;
  onReplan?: (feedback: string) => void;
}

export const PlanApproval: React.FC<PlanApprovalProps> = ({
  plan,
  userMessage = '',
  onApprove,
  onReject,
  onModify,
  onReplan,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPlan, setEditedPlan] = useState(plan);
  const [showRejectOptions, setShowRejectOptions] = useState(false);
  const [customFeedback, setCustomFeedback] = useState('');

  const handleApprove = () => {
    processEvent({ type: 'PLAN_APPROVED' });
    onApprove?.();
  };

  const handleReject = () => {
    setShowRejectOptions(true);
  };

  const handleRejectWithFeedback = async (feedback: string) => {
    if (feedback === 'direct') {
      // Skip planning and go directly to execution
      processEvent({ type: 'PLAN_REJECTED' });
      processEvent({ type: 'EXECUTION_STARTED' });
      onReject?.();
    } else if (feedback && userMessage) {
      // Request a new plan with feedback
      try {
        const analysis = analyzeMessageComplexity(userMessage);
        const newPlan = await regeneratePlan(userMessage, analysis, plan, feedback);
        processEvent({ type: 'PLAN_REJECTED' });
        processEvent({ type: 'PLAN_GENERATED', plan: newPlan });
        onReplan?.(feedback);
      } catch (error) {
        console.error('Failed to regenerate plan:', error);

        // Fall back to direct execution
        processEvent({ type: 'PLAN_REJECTED' });
        processEvent({ type: 'EXECUTION_STARTED' });
        onReject?.();
      }
    } else {
      processEvent({ type: 'PLAN_REJECTED' });
      onReject?.();
    }

    setShowRejectOptions(false);
    setCustomFeedback('');
  };

  const handleSaveEdit = () => {
    setIsEditing(false);
    onModify?.(editedPlan);
    processEvent({ type: 'PLAN_APPROVED' });
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return 'i-ph:check-circle-fill text-green-500';
      case 'in_progress':
        return 'i-ph:circle-notch text-blue-500 animate-spin';
      case 'failed':
        return 'i-ph:x-circle-fill text-red-500';
      default:
        return 'i-ph:circle text-gray-400';
    }
  };

  return (
    <div
      className={classNames(
        'rounded-lg border border-bolt-elements-borderColor',
        'bg-bolt-elements-background-depth-1 p-4 mb-4',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="i-ph:clipboard-text text-purple-500 text-xl" />
          <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">{plan.title || 'Execution Plan'}</h3>
          <div
            className={classNames('px-2 py-0.5 rounded-full text-xs font-medium', 'bg-purple-500/10 text-purple-500')}
          >
            {plan.steps.length} steps
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={classNames(
            'transition-transform p-1 rounded hover:bg-bolt-elements-background-depth-2',
            isExpanded ? '' : '-rotate-90',
          )}
        >
          <div className="i-ph:caret-down text-lg" />
        </button>
      </div>

      {/* Description */}
      {plan.description && (
        <div className="text-sm text-bolt-elements-textSecondary mb-3 prose prose-sm prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="text-lg font-semibold text-bolt-elements-textPrimary mb-2">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-base font-semibold text-bolt-elements-textPrimary mb-2 mt-3">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-sm font-medium text-bolt-elements-textPrimary mb-1 mt-2">{children}</h3>
              ),
              p: ({ children }) => <p className="text-sm text-bolt-elements-textSecondary mb-2">{children}</p>,
              ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
              li: ({ children }) => <li className="text-sm text-bolt-elements-textSecondary">{children}</li>,
              strong: ({ children }) => (
                <strong className="font-medium text-bolt-elements-textPrimary">{children}</strong>
              ),
              code: ({ children }) => (
                <code className="bg-bolt-elements-background-depth-2 px-1 py-0.5 rounded text-xs">{children}</code>
              ),
            }}
          >
            {plan.description}
          </ReactMarkdown>
        </div>
      )}

      {/* AI-Generated Plan Metadata */}
      {plan.metadata?.aiGenerated && (
        <div className="mb-4 p-3 bg-bolt-elements-background-depth-2 rounded-md">
          <div className="flex items-center gap-2 mb-2">
            <div className="i-ph:robot text-purple-500" />
            <span className="text-xs font-medium text-purple-500">AI-Generated Plan</span>
          </div>

          {plan.metadata.architecture && (
            <div className="mb-2">
              <span className="text-xs font-medium text-bolt-elements-textPrimary">Architecture:</span>
              <p className="text-xs text-bolt-elements-textSecondary mt-1">{plan.metadata.architecture}</p>
            </div>
          )}

          {plan.metadata.technologies && plan.metadata.technologies.length > 0 && (
            <div className="mb-2">
              <span className="text-xs font-medium text-bolt-elements-textPrimary">Technologies:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {plan.metadata.technologies.map((tech, index) => (
                  <span key={index} className="px-2 py-0.5 text-xs bg-blue-500/10 text-blue-500 rounded">
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

          {plan.metadata.considerations && plan.metadata.considerations.length > 0 && (
            <div>
              <span className="text-xs font-medium text-bolt-elements-textPrimary">Key Considerations:</span>
              <ul className="text-xs text-bolt-elements-textSecondary mt-1 space-y-0.5">
                {plan.metadata.considerations.map((consideration, index) => (
                  <li key={index} className="flex items-start gap-1">
                    <span>•</span>
                    <span>{consideration}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {plan.metadata.totalEstimatedTime && (
            <div className="mt-2 text-xs text-bolt-elements-textTertiary">
              Total estimated time: {Math.ceil(plan.metadata.totalEstimatedTime / 60)} minutes
            </div>
          )}
        </div>
      )}

      {/* Complexity Indicator */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-bolt-elements-textTertiary">Complexity:</span>
          <div className="flex items-center gap-0.5">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className={classNames(
                  'w-1.5 h-3 rounded-sm',
                  i < plan.estimatedComplexity
                    ? plan.estimatedComplexity <= 3
                      ? 'bg-green-500'
                      : plan.estimatedComplexity <= 6
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    : 'bg-bolt-elements-background-depth-2',
                )}
              />
            ))}
          </div>
        </div>
        {plan.estimatedComplexity > 6 && (
          <div className="text-xs text-yellow-500 flex items-center gap-1">
            <div className="i-ph:warning" />
            This is a complex task
          </div>
        )}
      </div>

      {/* Steps */}
      {isExpanded && (
        <div className="space-y-2 mb-4">
          {isEditing ? (
            <EditableSteps steps={editedPlan.steps} onChange={(steps) => setEditedPlan({ ...editedPlan, steps })} />
          ) : (
            plan.steps.map((step, index) => (
              <div
                key={step.id}
                className={classNames(
                  'flex items-start gap-3 p-2 rounded-md',
                  'hover:bg-bolt-elements-background-depth-2 transition-colors',
                )}
              >
                <div className="flex-shrink-0 flex items-center justify-center w-6 h-6">
                  <div className={getStepIcon(step.status)} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-bolt-elements-textTertiary">Step {index + 1}</span>
                    {step.estimatedTime && (
                      <span className="text-xs text-bolt-elements-textTertiary">
                        ~{Math.ceil(step.estimatedTime / 60)}m
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-bolt-elements-textPrimary mt-0.5">{step.description}</p>
                  {step.details && <p className="text-xs text-bolt-elements-textTertiary mt-1">{step.details}</p>}
                  {step.error && <div className="mt-1 text-xs text-red-500">Error: {step.error}</div>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-bolt-elements-borderColor">
        <div className="flex items-center gap-2">
          {!isEditing && !showRejectOptions && (
            <button
              onClick={() => setIsEditing(true)}
              className={classNames(
                'px-3 py-1.5 text-xs font-medium rounded-md',
                'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary',
                'hover:bg-bolt-elements-background-depth-3 transition-colors',
              )}
            >
              <div className="i-ph:pencil inline-block mr-1" />
              Modify Plan
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showRejectOptions ? (
            <div className="flex flex-col gap-2 w-full">
              <div className="text-sm text-bolt-elements-textSecondary mb-1">
                Why would you like to reject this plan?
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleRejectWithFeedback('Too complex - simplify')}
                  className={classNames(
                    'px-2 py-1 text-xs rounded-md',
                    'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary',
                    'hover:bg-bolt-elements-background-depth-3 transition-colors',
                  )}
                >
                  Too complex
                </button>
                <button
                  onClick={() => handleRejectWithFeedback('Need more detail')}
                  className={classNames(
                    'px-2 py-1 text-xs rounded-md',
                    'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary',
                    'hover:bg-bolt-elements-background-depth-3 transition-colors',
                  )}
                >
                  Need more detail
                </button>
                <button
                  onClick={() => handleRejectWithFeedback('Wrong approach')}
                  className={classNames(
                    'px-2 py-1 text-xs rounded-md',
                    'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary',
                    'hover:bg-bolt-elements-background-depth-3 transition-colors',
                  )}
                >
                  Wrong approach
                </button>
                <button
                  onClick={() => handleRejectWithFeedback('direct')}
                  className={classNames(
                    'px-2 py-1 text-xs rounded-md',
                    'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary',
                    'hover:bg-bolt-elements-background-depth-3 transition-colors',
                  )}
                >
                  Skip planning
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  value={customFeedback}
                  onChange={(e) => setCustomFeedback(e.target.value)}
                  placeholder="Or provide custom feedback..."
                  className={classNames(
                    'flex-1 px-2 py-1 text-xs rounded-md',
                    'bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary',
                    'border border-bolt-elements-borderColor',
                    'focus:outline-none focus:border-bolt-elements-borderColorFocus',
                  )}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customFeedback) {
                      handleRejectWithFeedback(customFeedback);
                    }
                  }}
                />
                <button
                  onClick={() => handleRejectWithFeedback(customFeedback)}
                  disabled={!customFeedback}
                  className={classNames(
                    'px-3 py-1 text-xs font-medium rounded-md',
                    customFeedback
                      ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                      : 'bg-bolt-elements-background-depth-2 text-bolt-elements-textTertiary',
                    'transition-colors',
                  )}
                >
                  Replan
                </button>
                <button
                  onClick={() => {
                    setShowRejectOptions(false);
                    setCustomFeedback('');
                  }}
                  className={classNames(
                    'px-3 py-1 text-xs font-medium rounded-md',
                    'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary',
                    'hover:bg-bolt-elements-background-depth-3 transition-colors',
                  )}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : isEditing ? (
            <>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditedPlan(plan);
                }}
                className={classNames(
                  'px-3 py-1.5 text-xs font-medium rounded-md',
                  'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary',
                  'hover:bg-bolt-elements-background-depth-3 transition-colors',
                )}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className={classNames(
                  'px-3 py-1.5 text-xs font-medium rounded-md',
                  'bg-green-500 text-white',
                  'hover:bg-green-600 transition-colors',
                )}
              >
                Save & Approve
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleReject}
                className={classNames(
                  'px-3 py-1.5 text-xs font-medium rounded-md',
                  'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary',
                  'hover:bg-bolt-elements-background-depth-3 transition-colors',
                )}
              >
                <div className="i-ph:x inline-block mr-1" />
                Reject
              </button>
              <button
                onClick={handleApprove}
                className={classNames(
                  'px-3 py-1.5 text-xs font-medium rounded-md',
                  'bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text',
                  'hover:bg-bolt-elements-button-primary-backgroundHover transition-colors',
                )}
              >
                <div className="i-ph:check inline-block mr-1" />
                Approve & Execute
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Editable Steps Component
const EditableSteps: React.FC<{
  steps: ExecutionPlan['steps'];
  onChange: (steps: ExecutionPlan['steps']) => void;
}> = ({ steps, onChange }) => {
  const handleStepChange = (index: number, description: string) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], description };
    onChange(newSteps);
  };

  const handleAddStep = () => {
    const newStep = {
      id: `step-${Date.now()}`,
      description: '',
      status: 'pending' as const,
    };
    onChange([...steps, newStep]);
  };

  const handleRemoveStep = (index: number) => {
    onChange(steps.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-start gap-2">
          <span className="text-xs text-bolt-elements-textTertiary mt-2">{index + 1}.</span>
          <textarea
            value={step.description}
            onChange={(e) => handleStepChange(index, e.target.value)}
            className={classNames(
              'flex-1 p-2 text-sm rounded-md resize-none',
              'bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary',
              'border border-bolt-elements-borderColor',
              'focus:outline-none focus:border-bolt-elements-borderColorFocus',
            )}
            rows={2}
            placeholder="Describe this step..."
          />
          <button onClick={() => handleRemoveStep(index)} className="p-1 text-red-500 hover:text-red-600">
            <div className="i-ph:trash text-lg" />
          </button>
        </div>
      ))}
      <button
        onClick={handleAddStep}
        className={classNames(
          'w-full py-2 text-xs font-medium rounded-md',
          'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary',
          'hover:bg-bolt-elements-background-depth-3 transition-colors',
          'border-2 border-dashed border-bolt-elements-borderColor',
        )}
      >
        <div className="i-ph:plus inline-block mr-1" />
        Add Step
      </button>
    </div>
  );
};

export default PlanApproval;
