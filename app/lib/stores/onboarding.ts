import { map } from 'nanostores';

export interface OnboardingResponse {
  stepId: string;
  question: string;
  answer: string;
  timestamp: Date;
}

export interface OnboardingState {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  responses: OnboardingResponse[];
  progress: number;
  isComplete: boolean;
}

const initialState: OnboardingState = {
  isActive: false,
  currentStep: 0,
  totalSteps: 8,
  responses: [],
  progress: 0,
  isComplete: false,
};

export const onboardingStore = map<OnboardingState>(initialState);

export const startOnboarding = () => {
  onboardingStore.set({
    ...initialState,
    isActive: true,
    currentStep: 1,
  });
};

export const nextStep = () => {
  const state = onboardingStore.get();

  if (state.currentStep < state.totalSteps) {
    const newStep = state.currentStep + 1;
    const progress = ((newStep - 1) / state.totalSteps) * 100;
    onboardingStore.set({
      ...state,
      currentStep: newStep,
      progress,
    });
  }
};

export const previousStep = () => {
  const state = onboardingStore.get();

  if (state.currentStep > 1) {
    const newStep = state.currentStep - 1;
    const progress = ((newStep - 1) / state.totalSteps) * 100;
    onboardingStore.set({
      ...state,
      currentStep: newStep,
      progress,
    });
  }
};

export const saveResponse = (stepId: string, question: string, answer: string) => {
  const state = onboardingStore.get();
  const existingResponseIndex = state.responses.findIndex((r) => r.stepId === stepId);

  const newResponse: OnboardingResponse = {
    stepId,
    question,
    answer,
    timestamp: new Date(),
  };

  let updatedResponses: OnboardingResponse[];

  if (existingResponseIndex >= 0) {
    updatedResponses = [...state.responses];
    updatedResponses[existingResponseIndex] = newResponse;
  } else {
    updatedResponses = [...state.responses, newResponse];
  }

  onboardingStore.set({
    ...state,
    responses: updatedResponses,
  });
};

export const completeOnboarding = () => {
  const state = onboardingStore.get();
  onboardingStore.set({
    ...state,
    isComplete: true,
    isActive: false,
    progress: 100,
  });

  // Store responses in localStorage for persistence
  localStorage.setItem('onboardingResponses', JSON.stringify(state.responses));
};

export const resetOnboarding = () => {
  onboardingStore.set(initialState);
  localStorage.removeItem('onboardingResponses');
};

export const getOnboardingResponses = (): OnboardingResponse[] => {
  const stored = localStorage.getItem('onboardingResponses');

  if (stored) {
    return JSON.parse(stored);
  }

  return onboardingStore.get().responses;
};

// Helper to generate a project context from onboarding responses
export const generateProjectContext = (): string => {
  const responses = onboardingStore.get().responses;

  if (responses.length === 0) {
    return '';
  }

  const context = responses.map((r) => `${r.question}\n${r.answer}`).join('\n\n');

  return `Project Context from Onboarding:\n\n${context}`;
};
