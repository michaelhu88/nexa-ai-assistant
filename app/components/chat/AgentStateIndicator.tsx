import React from 'react';
import { useStore } from '@nanostores/react';
import { agentStateStore, type AgentState } from '~/lib/stores/agentState';
import { classNames } from '~/utils/classNames';

interface AgentStateIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

const STATE_CONFIGS: Record<
  AgentState,
  {
    label: string;
    icon: string;
    color: string;
    animation?: string;
    description: string;
  }
> = {
  IDLE: {
    label: 'Ready',
    icon: 'i-ph:circle',
    color: 'text-gray-500',
    description: 'Waiting for your input',
  },
  ANALYZING: {
    label: 'Analyzing',
    icon: 'i-ph:magnifying-glass',
    color: 'text-blue-500',
    animation: 'animate-pulse',
    description: 'Analyzing message complexity',
  },
  PLANNING: {
    label: 'Planning',
    icon: 'i-ph:clipboard-text',
    color: 'text-purple-500',
    animation: 'animate-pulse',
    description: 'Creating execution plan',
  },
  AWAITING_APPROVAL: {
    label: 'Review Plan',
    icon: 'i-ph:check-circle',
    color: 'text-yellow-500',
    description: 'Waiting for plan approval',
  },
  EXECUTING: {
    label: 'Building',
    icon: 'i-ph:hammer',
    color: 'text-green-500',
    animation: 'animate-spin',
    description: 'Executing plan',
  },
  DEBUGGING: {
    label: 'Debugging',
    icon: 'i-ph:bug',
    color: 'text-red-500',
    animation: 'animate-pulse',
    description: 'Resolving issues',
  },
  COMPLETED: {
    label: 'Complete',
    icon: 'i-ph:check-circle-fill',
    color: 'text-green-600',
    description: 'Task completed',
  },
};

export const AgentStateIndicator: React.FC<AgentStateIndicatorProps> = ({ className = '', showDetails = false }) => {
  const agentState = useStore(agentStateStore);
  const config = STATE_CONFIGS[agentState.currentState];

  return (
    <div className={classNames('flex items-center gap-2', className)}>
      {/* State Icon */}
      <div
        className={classNames(
          'flex items-center gap-1.5 px-2 py-1 rounded-full',
          'bg-bolt-elements-item-backgroundDefault',
          'border border-bolt-elements-borderColor',
          'text-xs font-medium',
        )}
      >
        <div className={classNames(config.icon, config.color, config.animation || '', 'text-base')} />
        <span className={config.color}>{config.label}</span>
      </div>

      {/* Progress Indicator */}
      {agentState.executionProgress.totalSteps > 0 && (
        <div className="flex items-center gap-2">
          <div className="text-xs text-bolt-elements-textTertiary">
            Step {agentState.executionProgress.currentStepIndex + 1} of {agentState.executionProgress.totalSteps}
          </div>
          <div className="w-20 h-1.5 bg-bolt-elements-background-depth-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-bolt-elements-button-primary-background transition-all duration-300"
              style={{ width: `${agentState.executionProgress.percentComplete}%` }}
            />
          </div>
        </div>
      )}

      {/* Complexity Indicator */}
      {agentState.messageComplexity !== null && showDetails && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-bolt-elements-textTertiary">Complexity:</span>
          <ComplexityBadge complexity={agentState.messageComplexity} />
        </div>
      )}

      {/* Description */}
      {showDetails && <span className="text-xs text-bolt-elements-textSecondary">{config.description}</span>}
    </div>
  );
};

const ComplexityBadge: React.FC<{ complexity: number }> = ({ complexity }) => {
  const getComplexityColor = () => {
    if (complexity <= 3) {
      return 'bg-green-500';
    }

    if (complexity <= 6) {
      return 'bg-yellow-500';
    }

    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-0.5">
      {[...Array(10)].map((_, i) => (
        <div
          key={i}
          className={classNames(
            'w-1 h-3 rounded-sm',
            i < complexity ? getComplexityColor() : 'bg-bolt-elements-background-depth-2',
          )}
        />
      ))}
      <span className="ml-1 text-xs text-bolt-elements-textTertiary">{complexity}/10</span>
    </div>
  );
};

export default AgentStateIndicator;
