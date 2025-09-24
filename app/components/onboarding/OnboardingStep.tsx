import React from 'react';
import { useStore } from '@nanostores/react';
import { onboardingStore } from '~/lib/stores/onboarding';
import { classNames } from '~/utils/classNames';

interface OnboardingStepProps {
  id: string;
  number: number;
  title: string;
  isActive: boolean;
  _isCompleted: boolean;
  onClick: () => void;
}

export const OnboardingStep: React.FC<OnboardingStepProps> = ({
  id,
  number,
  title,
  isActive,
  _isCompleted,
  onClick,
}) => {
  const state = useStore(onboardingStore);
  const hasResponse = state.responses.some((r) => r.stepId === id);

  return (
    <button
      onClick={onClick}
      className={classNames(
        'flex items-center w-full px-4 py-3 transition-all duration-200 group',
        'hover:bg-gray-900',
        isActive && 'bg-purple-600 border-l-2 border-white',
        !isActive && 'bg-black',
      )}
    >
      {/* Step Number Circle */}
      <div
        className={classNames(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all border',
          isActive && 'bg-purple-600 text-white border-white',
          !isActive && 'bg-black text-white border-white',
        )}
      >
        {hasResponse && !isActive ? <span className="i-ph:check-bold" /> : number}
      </div>

      {/* Step Title */}
      <span className={classNames('ml-3 text-sm transition-colors text-white', isActive && 'font-medium')}>
        {title}
      </span>

      {/* Active Indicator */}
      {isActive && (
        <div className="ml-auto">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
        </div>
      )}
    </button>
  );
};
