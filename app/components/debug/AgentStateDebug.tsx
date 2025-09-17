import React from 'react';
import { useStore } from '@nanostores/react';
import { agentStateStore, processEvent, updateSettings } from '~/lib/stores/agentState';
import { analyzeMessageComplexity, getAnalysisSummary } from '~/lib/services/messageAnalyzer';
import { classNames } from '~/utils/classNames';

/**
 * Debug component for testing agent state machine
 * Only visible in development mode
 */
export const AgentStateDebug: React.FC = () => {
  const agentState = useStore(agentStateStore);
  const [testMessage, setTestMessage] = React.useState('');
  const [analysisResult, setAnalysisResult] = React.useState<any>(null);

  const testMessages = [
    'Fix the typo in the header',
    'Add a new user authentication system with login, signup, and password reset',
    'Create a full e-commerce platform with product catalog, shopping cart, payment processing, and user accounts',
    'How does React state management work?',
    'What is the difference between let and const?',
  ];

  const analyzeMessage = () => {
    if (!testMessage.trim()) {
      return;
    }

    const result = analyzeMessageComplexity(testMessage);
    setAnalysisResult(result);
  };

  const simulateUserMessage = () => {
    processEvent({ type: 'USER_MESSAGE' });
    setTimeout(() => {
      if (analysisResult) {
        processEvent({
          type: 'COMPLEXITY_ANALYZED',
          complexity: analysisResult.complexity,
          requiresPlanning: analysisResult.requiresPlanning,
        });
      }
    }, 1000);
  };

  const simulatePlanGenerated = () => {
    processEvent({
      type: 'PLAN_GENERATED',
      plan: {
        id: 'test-plan',
        title: 'Test Implementation Plan',
        description: 'A test plan for debugging',
        steps: [
          { id: 'step1', description: 'First step', status: 'pending' },
          { id: 'step2', description: 'Second step', status: 'pending' },
          { id: 'step3', description: 'Third step', status: 'pending' },
        ],
        estimatedComplexity: analysisResult?.complexity || 5,
        createdAt: new Date(),
      },
    });
  };

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 z-50">
      <h3 className="text-lg font-semibold mb-4">Agent State Debug</h3>

      {/* Current State */}
      <div className="mb-4">
        <div className="text-sm font-medium">Current State:</div>
        <div
          className={classNames(
            'px-2 py-1 rounded text-sm font-mono',
            agentState.currentState === 'IDLE'
              ? 'bg-gray-100 text-gray-800'
              : agentState.currentState === 'ANALYZING'
                ? 'bg-blue-100 text-blue-800'
                : agentState.currentState === 'PLANNING'
                  ? 'bg-purple-100 text-purple-800'
                  : agentState.currentState === 'AWAITING_APPROVAL'
                    ? 'bg-yellow-100 text-yellow-800'
                    : agentState.currentState === 'EXECUTING'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800',
          )}
        >
          {agentState.currentState}
        </div>
      </div>

      {/* Test Message */}
      <div className="mb-4">
        <div className="text-sm font-medium mb-2">Test Message:</div>
        <textarea
          value={testMessage}
          onChange={(e) => setTestMessage(e.target.value)}
          className="w-full p-2 border rounded text-sm"
          rows={3}
          placeholder="Enter a test message..."
        />
        <div className="flex gap-2 mt-2">
          <button onClick={analyzeMessage} className="px-3 py-1 bg-blue-500 text-white rounded text-sm">
            Analyze
          </button>
          <button onClick={simulateUserMessage} className="px-3 py-1 bg-green-500 text-white rounded text-sm">
            Simulate Message
          </button>
        </div>
      </div>

      {/* Quick Test Messages */}
      <div className="mb-4">
        <div className="text-sm font-medium mb-2">Quick Tests:</div>
        <div className="space-y-1">
          {testMessages.map((msg, i) => (
            <button
              key={i}
              onClick={() => setTestMessage(msg)}
              className="block w-full text-left px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs"
            >
              {msg.substring(0, 50)}...
            </button>
          ))}
        </div>
      </div>

      {/* Analysis Result */}
      {analysisResult && (
        <div className="mb-4">
          <div className="text-sm font-medium mb-2">Analysis Result:</div>
          <div className="text-xs bg-gray-50 p-2 rounded">
            <div>Complexity: {analysisResult.complexity}/10</div>
            <div>Planning Required: {analysisResult.requiresPlanning ? 'Yes' : 'No'}</div>
            <div>Tasks: {analysisResult.taskCount}</div>
            <div>Steps: {analysisResult.estimatedSteps}</div>
            <div>Summary: {getAnalysisSummary(analysisResult)}</div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={simulatePlanGenerated}
          className="w-full px-3 py-1 bg-purple-500 text-white rounded text-sm"
          disabled={agentState.currentState !== 'PLANNING'}
        >
          Simulate Plan Generated
        </button>
        <button
          onClick={() => processEvent({ type: 'PLAN_APPROVED' })}
          className="w-full px-3 py-1 bg-green-500 text-white rounded text-sm"
          disabled={agentState.currentState !== 'AWAITING_APPROVAL'}
        >
          Approve Plan
        </button>
        <button
          onClick={() => processEvent({ type: 'EXECUTION_COMPLETED' })}
          className="w-full px-3 py-1 bg-blue-500 text-white rounded text-sm"
          disabled={agentState.currentState !== 'EXECUTING'}
        >
          Complete Execution
        </button>
        <button
          onClick={() => processEvent({ type: 'RESET' })}
          className="w-full px-3 py-1 bg-red-500 text-white rounded text-sm"
        >
          Reset
        </button>
      </div>

      {/* Settings */}
      <div className="mt-4 pt-4 border-t">
        <div className="text-sm font-medium mb-2">Settings:</div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={agentState.settings.autoPlanning}
            onChange={(e) => updateSettings({ autoPlanning: e.target.checked })}
          />
          Auto Planning
        </label>
        <div className="flex items-center gap-2 mt-2 text-sm">
          <span>Complexity Threshold:</span>
          <input
            type="range"
            min="1"
            max="10"
            value={agentState.settings.complexityThreshold}
            onChange={(e) => updateSettings({ complexityThreshold: Number(e.target.value) })}
            className="flex-1"
          />
          <span>{agentState.settings.complexityThreshold}</span>
        </div>
      </div>
    </div>
  );
};

export default AgentStateDebug;
