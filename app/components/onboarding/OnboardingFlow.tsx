import React, { useEffect } from 'react';
import { useStore } from '@nanostores/react';
import {
  onboardingStore,
  nextStep,
  previousStep,
  completeOnboarding,
  generateProjectContext,
} from '~/lib/stores/onboarding';
import { onboardingSteps, getStepByNumber } from '~/lib/data/onboardingSteps';
import { OnboardingStep } from './OnboardingStep';
import { OnboardingChat } from './OnboardingChat';

interface OnboardingFlowProps {
  onComplete?: (projectContext: string) => void;
  onCancel?: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete, onCancel }) => {
  const state = useStore(onboardingStore);
  const currentStep = getStepByNumber(state.currentStep);

  const handleStepClick = (stepNumber: number) => {
    onboardingStore.set({
      ...state,
      currentStep: stepNumber,
      progress: ((stepNumber - 1) / state.totalSteps) * 100,
    });
  };

  const handleNext = () => {
    if (state.currentStep === state.totalSteps) {
      // Complete onboarding
      completeOnboarding();

      const context = generateProjectContext();

      if (onComplete) {
        onComplete(context);
      }
    } else {
      nextStep();
    }
  };

  const handlePrevious = () => {
    previousStep();
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  useEffect(() => {
    // Auto-save to localStorage
    localStorage.setItem('onboardingState', JSON.stringify(state));
  }, [state]);

  if (!currentStep) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex h-full bg-black">
      {/* Progress Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gray-800 z-10">
        <div className="h-full bg-white transition-all duration-500" style={{ width: `${state.progress}%` }} />
      </div>

      {/* Sidebar */}
      <div className="w-80 bg-black border-r border-white flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white">
          <h2 className="text-lg font-semibold text-white">App Planning</h2>
          <p className="text-sm text-gray-300 mt-1">Let's build your automation together</p>
        </div>

        {/* Steps List */}
        <div className="flex-1 overflow-y-auto py-2">
          {onboardingSteps.map((step) => (
            <OnboardingStep
              key={step.id}
              id={step.id}
              number={step.number}
              title={step.title}
              isActive={state.currentStep === step.number}
              _isCompleted={state.currentStep > step.number}
              onClick={() => handleStepClick(step.number)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white space-y-3">
          <div className="text-xs text-gray-400">
            <div className="flex items-center justify-between mb-1">
              <span>Progress</span>
              <span>{Math.round(state.progress)}%</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1.5">
              <div
                className="bg-white h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${state.progress}%` }}
              />
            </div>
          </div>

          {/* Why Nexa Section */}
          <div className="bg-gray-900 border border-white rounded-lg p-3">
            <h3 className="text-xs font-semibold text-white mb-2">Why Nexa</h3>
            <div className="flex items-start gap-2">
              <img src="/logo-light-styled.png" alt="Assistant" className="w-8 h-8 rounded-full" />
              <p className="text-xs text-gray-300">
                Hi! I'll guide you through building your automation app. Can't wait to see what we create together!
              </p>
            </div>
          </div>

          {/* Support Section */}
          <div className="bg-gray-900 border border-white rounded-lg p-3">
            <h3 className="text-xs font-semibold text-white mb-1">Ongoing Support</h3>
            <p className="text-xs text-gray-300">
              Found a bug? Ready to add a whole new feature? I'll be here to help every step of the way!
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-white flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">{currentStep.title}</h1>
            <p className="text-sm text-gray-300">
              Step {state.currentStep} of {state.totalSteps}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrevious}
              disabled={state.currentStep === 1}
              className={`px-4 py-2 rounded-lg font-medium border transition-all ${
                state.currentStep === 1
                  ? 'bg-gray-800 text-gray-500 border-gray-600 cursor-not-allowed'
                  : 'bg-black text-white border-white hover:bg-gray-900'
              }`}
            >
              Previous
            </button>

            <button
              onClick={handleNext}
              className="px-4 py-2 rounded-lg font-medium bg-white text-black border border-white hover:bg-gray-200 transition-all"
            >
              {state.currentStep === state.totalSteps ? 'Complete' : 'Next'}
            </button>

            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded-lg font-medium text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Chat Content */}
        <div className="flex-1 overflow-hidden">
          <OnboardingChat currentStep={currentStep} onNext={handleNext} />
        </div>
      </div>
    </div>
  );
};
