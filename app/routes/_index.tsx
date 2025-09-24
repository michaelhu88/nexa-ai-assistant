import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';
import BackgroundRays from '~/components/ui/BackgroundRays';
import { useState, useEffect } from 'react';
import { OnboardingFlow } from '~/components/onboarding/OnboardingFlow';
import { startOnboarding, resetOnboarding } from '~/lib/stores/onboarding';
import { chatStore } from '~/lib/stores/chat';

export const meta: MetaFunction = () => {
  return [{ title: 'Nexa' }, { name: 'description', content: 'Talk with Nexa, an AI-powered development assistant' }];
};

export const loader = () => json({});

/**
 * Landing page component for Nexa
 * Note: Settings functionality should ONLY be accessed through the sidebar menu.
 * Do not add settings button/panel to this landing page as it was intentionally removed
 * to keep the UI clean and consistent with the design system.
 */
// Wrapper component to inject project context into Chat
function ChatWithContext({ projectContext }: { projectContext: string }) {
  useEffect(() => {
    // If we have project context, pre-fill the chat with an initial message
    if (projectContext) {
      // Force chat to start with the project context
      chatStore.set({ ...chatStore.get(), showChat: true });
    }
  }, [projectContext]);

  return <Chat />;
}

export default function Index() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [projectContext, setProjectContext] = useState<string>('');

  const handleBeginClick = () => {
    startOnboarding();
    setShowOnboarding(true);
  };

  const handleOnboardingComplete = (context: string) => {
    // Store the project context and transition to chat
    setProjectContext(context);
    setShowOnboarding(false);
    setShowChat(true);

    // Store in localStorage for persistence
    localStorage.setItem('projectContext', context);

    // Trigger chat with project context as initial message
    setTimeout(() => {
      const event = new CustomEvent('startChatWithContext', {
        detail: { context },
      });
      window.dispatchEvent(event);
    }, 100);
  };

  const handleOnboardingCancel = () => {
    resetOnboarding();
    setShowOnboarding(false);
  };

  if (showOnboarding) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} onCancel={handleOnboardingCancel} />;
  }

  if (showChat) {
    return (
      <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1">
        <BackgroundRays />
        <Header />
        <ClientOnly fallback={<BaseChat />}>{() => <ChatWithContext projectContext={projectContext} />}</ClientOnly>
      </div>
    );
  }

  // Landing page
  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1">
      <BackgroundRays />
      <Header />
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold text-bolt-elements-textPrimary mb-6 animate-fade-in">
            Ready to Automate your Business?
          </h1>
          <button
            onClick={handleBeginClick}
            className="px-8 py-4 text-lg font-semibold bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transform transition-all hover:scale-105 shadow-xl animate-fade-in animation-delay-200"
          >
            Let's Begin
          </button>
          <div className="mt-8 animate-fade-in animation-delay-400">
            <p className="text-bolt-elements-textSecondary text-lg mb-4">Or jump straight into development:</p>
            <button
              onClick={() => setShowChat(true)}
              className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary underline transition-colors"
            >
              Skip onboarding →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
