import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { onboardingStore, saveResponse, nextStep } from '~/lib/stores/onboarding';
import type { OnboardingStep } from '~/lib/data/onboardingSteps';

interface OnboardingChatProps {
  currentStep: OnboardingStep;
  onNext?: () => void;
}

export const OnboardingChat: React.FC<OnboardingChatProps> = ({ currentStep, onNext }) => {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showQuestion, setShowQuestion] = useState(false);
  const [savedAnswer, setSavedAnswer] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const state = useStore(onboardingStore);

  useEffect(() => {
    // Check if we already have a response for this step
    const existingResponse = state.responses.find((r) => r.stepId === currentStep.id);

    if (existingResponse) {
      setSavedAnswer(existingResponse.answer);
    } else {
      setSavedAnswer(null);
    }

    // Animate question appearance
    setShowQuestion(false);

    const timer = setTimeout(() => {
      setShowQuestion(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [currentStep, state.responses]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim()) {
      return;
    }

    // Save the response
    saveResponse(currentStep.id, currentStep.question, input.trim());
    setSavedAnswer(input.trim());

    // Clear input
    setInput('');

    // Simulate typing delay before moving to next step
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);

      if (onNext) {
        onNext();
      } else {
        nextStep();
      }
    }, 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;

    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Bot Message */}
          <div
            className={`flex gap-3 transition-all duration-500 ${showQuestion ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <span className="text-white font-semibold text-sm">N</span>
            </div>
            <div className="flex-1">
              <div className="font-medium text-white mb-1">Nexa</div>
              <div className="bg-gray-900 border border-white rounded-lg p-4">
                <p className="text-white">{currentStep.question}</p>

                {currentStep.helperText && <p className="text-sm text-gray-300 mt-2">{currentStep.helperText}</p>}

                {currentStep.examples && currentStep.examples.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-400 mb-2">Examples:</p>
                    <ul className="space-y-1">
                      {currentStep.examples.map((example, index) => (
                        <li key={index} className="text-xs text-gray-300 flex items-start">
                          <span className="mr-1">•</span>
                          <span>{example}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* User's Saved Answer */}
          {savedAnswer && (
            <div className="flex gap-3 justify-end">
              <div className="max-w-[80%]">
                <div className="font-medium text-white mb-1 text-right">You</div>
                <div className="bg-gray-800 border border-white rounded-lg p-4">
                  <p className="text-white whitespace-pre-wrap">{savedAnswer}</p>
                </div>
              </div>
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-800 border border-white flex items-center justify-center">
                <span className="i-ph:user text-white text-lg" />
              </div>
            </div>
          )}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <span className="text-white font-semibold text-sm">N</span>
              </div>
              <div className="bg-gray-900 border border-white rounded-lg px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-white px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-gray-900 rounded-lg border border-white">
            {/* Example Text */}
            {!savedAnswer && currentStep.placeholder && (
              <div className="px-4 pt-3">
                <p className="text-xs text-gray-400">💡 Tip: {currentStep.placeholder}</p>
              </div>
            )}

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="flex items-end p-4 pt-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={savedAnswer ? 'Update your answer...' : 'Type your answer here...'}
                className="flex-1 bg-transparent text-white placeholder-gray-400 resize-none outline-none min-h-[24px] max-h-[200px]"
                rows={1}
                disabled={isTyping}
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className={`ml-3 px-4 py-2 rounded-lg font-medium border transition-all ${
                  input.trim() && !isTyping
                    ? 'bg-white text-black border-white hover:bg-gray-200'
                    : 'bg-gray-800 text-gray-500 border-gray-600 cursor-not-allowed'
                }`}
              >
                {savedAnswer ? 'Update' : 'Send'}
              </button>
            </form>
          </div>

          {/* Skip Button */}
          {!savedAnswer && (
            <div className="mt-3 text-center">
              <button
                onClick={() => {
                  if (onNext) {
                    onNext();
                  } else {
                    nextStep();
                  }
                }}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Skip this step →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
