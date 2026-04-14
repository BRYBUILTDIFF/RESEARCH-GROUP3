export interface TrainingModule {
  id: string;
  title: string;
  description: string;
  category: 'Hardware' | 'Software' | 'Security';
  level: string;
  lessonsCount: number;
  duration: string;
  status: 'Published' | 'Draft';
}

export const trainingModules: TrainingModule[] = [
  {
    id: '1',
    title: 'Hardware Troubleshooting',
    description:
      'Simulate real-world hardware failures including POST errors, RAM diagnostics, peripheral malfunctions, and hardware replacement workflows.',
    category: 'Hardware',
    level: 'Beginner -> Advanced',
    lessonsCount: 4,
    duration: '90 min',
    status: 'Published',
  },
  {
    id: '2',
    title: 'Application Software',
    description:
      'Diagnose and resolve Microsoft Office, OS-level, and productivity software issues encountered in enterprise helpdesk environments.',
    category: 'Software',
    level: 'Beginner -> Intermediate',
    lessonsCount: 4,
    duration: '80 min',
    status: 'Published',
  },
  {
    id: '3',
    title: 'Security & Incident Response',
    description:
      'Identify security threats, respond to incidents, and protect organisational assets through guided simulation scenarios.',
    category: 'Security',
    level: 'Intermediate -> Advanced',
    lessonsCount: 4,
    duration: '100 min',
    status: 'Published',
  },
];

export const recentActivities = [
  {
    user: 'villamiel231327@ceu.edu.ph',
    action: 'Completed Hardware Module',
    date: 'Mar 17, 2026',
    status: '100%',
  },
  {
    user: 'barrozo231328@ceu.edu.ph',
    action: 'Started Security Simulation',
    date: 'Mar 16, 2026',
    status: 'In Progress',
  },
  {
    user: 'ramos231329@ceu.edu.ph',
    action: 'Failed Software Assessment',
    date: 'Mar 15, 2026',
    status: '65%',
  },
];

export const trainees = [
  { name: 'Lorenzo Villamiel', email: 'villamiel231327@ceu.edu.ph', progress: '100%', status: 'Active' },
  { name: 'Miguel Barrozo', email: 'barrozo231328@ceu.edu.ph', progress: '72%', status: 'Active' },
  { name: 'Sofia Ramos', email: 'ramos231329@ceu.edu.ph', progress: '45%', status: 'Needs Support' },
  { name: 'Nina Cruz', email: 'cruz231330@ceu.edu.ph', progress: '88%', status: 'Active' },
];

export const userHistory = [
  {
    module: 'IT Security Incident Response',
    scenario: 'Suspected Phishing Email',
    status: 'Passed',
    score: '100%',
    time: '8m',
    date: 'Mar 17, 2026',
  },
  {
    module: 'Hardware Troubleshooting',
    scenario: "PC Won't Boot",
    status: 'Passed',
    score: '95%',
    time: '11m',
    date: 'Mar 16, 2026',
  },
];
