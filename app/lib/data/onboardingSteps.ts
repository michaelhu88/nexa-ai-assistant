export interface OnboardingStep {
  id: string;
  title: string;
  number: number;
  question: string;
  placeholder?: string;
  helperText?: string;
  examples?: string[];
}

export const onboardingSteps: OnboardingStep[] = [
  {
    id: 'quick-description',
    title: 'Quick Description',
    number: 1,
    question: 'Hi! I am Nexa, your app builder. Can you give me a quick description of your app idea?',
    placeholder: "I'd like to build an app that...",
    helperText: 'Describe what your business automation app will do in a few sentences.',
    examples: [
      'An inventory management system that tracks products and generates reports',
      'A customer support automation tool that handles tickets and FAQ responses',
      'A sales pipeline tracker that automates follow-ups and lead scoring',
    ],
  },
  {
    id: 'target-audience',
    title: 'Target Audience',
    number: 2,
    question: 'Who is your target audience? Who will be using this automation solution?',
    placeholder: 'This app is designed for...',
    helperText: 'Describe your ideal users and their roles.',
    examples: [
      'Small business owners who need to automate repetitive tasks',
      'Marketing teams in mid-size companies',
      'E-commerce store managers handling multiple platforms',
    ],
  },
  {
    id: 'user-needs',
    title: 'User Needs',
    number: 3,
    question: 'What specific problems or pain points will your automation solve for users?',
    placeholder: 'Users currently struggle with...',
    helperText: 'Identify the key challenges your automation will address.',
    examples: [
      'Manual data entry taking up hours each day',
      'Missed follow-ups with potential customers',
      'Inconsistent reporting across different departments',
    ],
  },
  {
    id: 'core-features',
    title: 'Core Features',
    number: 4,
    question: 'What are the must-have features for your automation app?',
    placeholder: 'The app must be able to...',
    helperText: 'List 3-5 essential features that your app needs.',
    examples: [
      'Automated data collection from multiple sources',
      'Real-time notifications and alerts',
      'Custom workflow builder with drag-and-drop interface',
      'Integration with existing tools (Slack, Email, CRM)',
    ],
  },
  {
    id: 'tone-style',
    title: 'Tone And Style',
    number: 5,
    question: 'What tone and style should the app convey? Professional, friendly, modern?',
    placeholder: 'The app should feel...',
    helperText: 'Describe the personality and feel of your application.',
    examples: [
      'Professional and trustworthy with a clean, minimal interface',
      'Friendly and approachable with helpful guidance',
      'Modern and innovative with cutting-edge design',
    ],
  },
  {
    id: 'visual-design',
    title: 'Visual Design',
    number: 6,
    question: 'Do you have any visual design preferences? Colors, layout style, or inspiration?',
    placeholder: 'I envision the design to be...',
    helperText: 'Share any design preferences or reference sites you like.',
    examples: [
      'Dark mode with purple accents like the current Nexa interface',
      'Clean white background with blue corporate colors',
      'Dashboard-style layout similar to Notion or Airtable',
    ],
  },
  {
    id: 'business-model',
    title: 'Business Model',
    number: 7,
    question:
      'How will this automation create value for your business? Will it be internal use, SaaS, or client-specific?',
    placeholder: 'This automation will be used for...',
    helperText: 'Describe how this fits into your business strategy.',
    examples: [
      'Internal tool to streamline our operations and reduce costs',
      'SaaS product with monthly subscriptions for other businesses',
      'Custom solution for specific enterprise clients',
    ],
  },
  {
    id: 'summary',
    title: 'Summary',
    number: 8,
    question: "Is there anything else you'd like to add about your automation project?",
    placeholder: 'Additionally, I would like...',
    helperText: 'Share any additional requirements, constraints, or ideas.',
    examples: [
      'Must comply with GDPR and data privacy regulations',
      'Need to handle at least 10,000 transactions per day',
      'Should work on mobile devices for field workers',
    ],
  },
];

export const getStepById = (id: string): OnboardingStep | undefined => {
  return onboardingSteps.find((step) => step.id === id);
};

export const getStepByNumber = (number: number): OnboardingStep | undefined => {
  return onboardingSteps.find((step) => step.number === number);
};
