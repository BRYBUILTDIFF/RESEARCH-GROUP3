import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  LogOut,
  Monitor,
  ShieldAlert,
  ShieldCheck,
  AppWindow,
  HardDrive,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

type ModuleTheme = 'cyan' | 'rose';

interface Module {
  id: string;
  title: string;
  description: string;
  level: string;
  lessonsCount: number;
  duration: string;
  theme: ModuleTheme;
  category: 'Hardware' | 'Software' | 'Security';
}

const MODULES: Module[] = [
  {
    id: '1',
    title: 'Hardware Troubleshooting',
    description:
      'Simulate real-world hardware failures including POST errors, RAM diagnostics, peripheral malfunctions, and hardware replacement workflows encountered in enterprise helpdesk environments.',
    level: 'Beginner -> Advanced',
    lessonsCount: 4,
    duration: '90 min',
    theme: 'cyan',
    category: 'Hardware',
  },
  {
    id: '2',
    title: 'Application Software',
    description:
      'Diagnose and resolve Microsoft Office, OS-level, and productivity software issues encountered in enterprise helpdesk environments.',
    level: 'Beginner -> Intermediate',
    lessonsCount: 4,
    duration: '80 min',
    theme: 'cyan',
    category: 'Software',
  },
  {
    id: '3',
    title: 'Security & Incident Response',
    description:
      'Identify security threats, respond to incidents, and protect organisational assets through guided simulation scenarios.',
    level: 'Intermediate -> Advanced',
    lessonsCount: 4,
    duration: '100 min',
    theme: 'rose',
    category: 'Security',
  },
];

const FEATURES = [
  {
    title: 'Scenario-Based Simulations',
    desc: "Interactive modules replicate real helpdesk incidents, learners make decisions and immediately see the outcome, following Kolb's Experiential Learning Theory.",
    icon: Monitor,
  },
  {
    title: 'Knowledge Assessments',
    desc: 'Pre-test and post-test assessments measure improvements in troubleshooting speed and accuracy before and after completing each simulation module.',
    icon: CheckCircle2,
  },
  {
    title: 'Progress & Performance Analytics',
    desc: 'Visual dashboards track module completion, quiz scores, and simulation performance, giving both learners and administrators clear insights.',
    icon: BarChart3,
  },
  {
    title: 'Module Completion Tracking',
    desc: 'Learners complete full modules by finishing lessons, quizzes, and final tests with transparent progress records for administrators.',
    icon: ShieldCheck,
  },
  {
    title: 'Scaffolded Learning Design',
    desc: "Modules are structured using Sweller's Cognitive Load Theory, progressively increasing complexity to prevent cognitive overload and maximize retention.",
    icon: LayoutDashboard,
  },
  {
    title: 'Retake & Feedback Loop',
    desc: "Learners can retake simulations and quizzes anytime. Feedback loops feed back into module improvements through the IPO model's feedback mechanism.",
    icon: Clock,
  },
];

function ModuleCard({ module }: { module: Module }) {
  const Icon = module.category === 'Hardware' ? HardDrive : module.category === 'Software' ? AppWindow : ShieldAlert;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[2rem] border transition-all group',
        'bg-[#0B1120] shadow-2xl',
        module.theme === 'rose' ? 'border-rose-500/10 hover:border-rose-500/30' : 'border-cyan-500/10 hover:border-cyan-500/30'
      )}
    >
      <div className="p-10">
        <div className="mb-8 flex items-start gap-6">
          <div
            className={cn(
              'flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl shadow-inner',
              module.theme === 'rose' ? 'bg-rose-500/10 text-rose-500' : 'bg-cyan-500/10 text-cyan-400'
            )}
          >
            <Icon size={32} />
          </div>
          <div className="space-y-1 pt-1">
            <span
              className={cn(
                'text-[11px] font-black uppercase tracking-[0.25em]',
                module.theme === 'rose' ? 'text-rose-500' : 'text-cyan-400'
              )}
            >
              Module {module.id}
            </span>
            <h4 className="text-3xl font-black leading-tight tracking-tight text-white">{module.title}</h4>
          </div>
        </div>

        <p className="mb-8 text-base leading-relaxed text-slate-400">{module.description}</p>

        <div className="mb-8 flex items-center gap-8">
          <div className="flex items-center gap-3 text-slate-500">
            <BookOpen size={18} className="opacity-50" />
            <span className="text-sm font-bold">{module.lessonsCount} lessons</span>
          </div>
          <div className="flex items-center gap-3 text-slate-500">
            <Clock size={18} className="opacity-50" />
            <span className="text-sm font-bold">{module.duration}</span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/5 pt-8">
          <div
            className={cn(
              'rounded-xl border px-4 py-2 text-[11px] font-black uppercase tracking-wider',
              module.theme === 'rose'
                ? 'border-rose-500/20 bg-rose-500/5 text-rose-500'
                : 'border-cyan-500/20 bg-cyan-500/5 text-cyan-400'
            )}
          >
            {module.level}
          </div>
          <Link
            to="/login"
            className="group/btn flex items-center gap-3 rounded-2xl bg-brand-600 px-7 py-3.5 text-sm font-black text-white shadow-xl shadow-brand-600/30 transition-all hover:bg-brand-500"
          >
            Start Learning
            <ArrowRight size={18} className="transition-transform group-hover/btn:translate-x-1" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-dark-bg font-sans text-white selection:bg-brand-500/30">
      <div className="landing-gradient pointer-events-none fixed inset-0" />

      <nav className="sticky top-0 z-50 flex h-20 items-center justify-between border-b border-white/5 bg-dark-bg/80 px-8 backdrop-blur-lg lg:px-24">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-500/20">
            <ShieldCheck size={24} />
          </div>
          <span className="text-xl font-bold tracking-tight">
            HelpDesk <span className="text-brand-400">Academy</span>
          </span>
        </div>

        <div className="hidden items-center gap-8 text-sm font-medium text-slate-400 md:flex">
          <a href="#features" className="transition-colors hover:text-white">
            Features
          </a>
          <a href="#courses" className="transition-colors hover:text-white">
            Courses
          </a>
          <a href="#why-us" className="transition-colors hover:text-white">
            Why Us
          </a>
        </div>

        <Link
          to="/login"
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-500/20 transition-all hover:bg-brand-700"
        >
          <LogOut size={18} className="rotate-180" />
          Sign In
        </Link>
      </nav>

      <section className="relative z-10 grid items-center gap-16 px-8 py-20 lg:grid-cols-2 lg:px-24 lg:py-32">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-400">
            <Monitor size={12} />
            Simulated E-Learning Module
          </div>

          <h1 className="text-5xl font-black leading-[1.1] tracking-tight lg:text-7xl">
            IT Support Skills for <span className="text-brand-400">Helpdesk Personnel</span>
          </h1>

          <p className="max-w-xl text-lg leading-relaxed text-slate-400">
            A simulation-based e-learning platform designed to bridge the{' '}
            <span className="font-medium text-white">"readiness gap"</span> where helpdesk staff practice hardware
            troubleshooting, software support, and security response in a risk-free digital environment before working
            on live systems.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-4">
            <Link
              to="/login"
              className="group flex items-center gap-2 rounded-2xl bg-brand-600 px-8 py-4 font-bold text-white shadow-xl shadow-brand-500/20 transition-all hover:bg-brand-700"
            >
              Sign In
              <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#courses"
              className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-8 py-4 font-bold text-white transition-all hover:bg-white/10"
            >
              <BookOpen size={20} />
              View Modules
            </a>
          </div>

          <div className="grid grid-cols-2 gap-8 border-t border-white/5 pt-8">
            <div>
              <p className="text-3xl font-black text-white">3 Modules</p>
              <p className="text-sm font-medium text-slate-500">Hardware • Software • Security</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-brand-500/20 bg-brand-500/10 text-brand-400">
                <ShieldCheck size={24} />
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-white">ISO/IEC 25010</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Certified Quality</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 rounded-full bg-brand-500/20 opacity-20 blur-3xl" />
          <div className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
            <img
              src="https://picsum.photos/seed/it-support/1200/800"
              alt="IT Support Training"
              className="h-full w-full object-cover grayscale transition-all duration-700 hover:grayscale-0"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-dark-bg via-transparent to-transparent" />

            <div className="dark-glass-card absolute bottom-8 left-8 right-8 p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg shadow-brand-500/40">
                  <LayoutDashboard size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Interactive Dashboard</p>
                  <p className="text-xs text-slate-400">Real-time performance tracking & analytics</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="relative z-10 bg-slate-950/50 px-8 py-32 lg:px-24">
        <div className="mx-auto mb-20 max-w-3xl space-y-4 text-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-400">Platform Features</p>
          <h2 className="text-4xl font-black tracking-tight lg:text-5xl">Designed Around Real Helpdesk Needs</h2>
          <p className="leading-relaxed text-slate-400">
            Built on Constructivist Learning Theory, learners are active problem-solvers, not passive consumers,
            practicing real IT support tasks in a safe simulation environment.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="dark-glass-card group border-white/5 p-8 transition-all hover:-translate-y-1 hover:border-brand-500/30"
            >
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-brand-500/20 bg-brand-500/10 text-brand-400 transition-transform group-hover:scale-110">
                <feature.icon size={24} />
              </div>
              <h3 className="mb-4 text-xl font-bold text-white">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-slate-400">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="why-us" className="relative z-10 border-y border-white/5 bg-dark-bg px-8 py-24 lg:px-24">
        <div className="grid grid-cols-2 gap-12 text-center lg:grid-cols-4">
          <div className="space-y-2">
            <p className="text-5xl font-black tracking-tighter text-white">3</p>
            <p className="text-sm font-bold uppercase tracking-wide text-brand-500">Core Modules</p>
            <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500">Hardware • Software • Security</p>
          </div>
          <div className="space-y-2">
            <p className="text-5xl font-black tracking-tighter text-white">12+</p>
            <p className="text-sm font-bold uppercase tracking-wide text-brand-500">Sim Scenarios</p>
            <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500">Mapped to real helpdesk tasks</p>
          </div>
          <div className="space-y-2">
            <p className="text-5xl font-black tracking-tighter text-white">ISO/IEC</p>
            <p className="text-sm font-bold uppercase tracking-wide text-brand-500">25010 Evaluated</p>
            <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500">Functional, Usability & Reliability</p>
          </div>
          <div className="space-y-2">
            <p className="text-5xl font-black tracking-tighter text-white">Pre/Post</p>
            <p className="text-sm font-bold uppercase tracking-wide text-brand-500">Test Design</p>
            <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500">Quasi-experimental assessment</p>
          </div>
        </div>
      </section>

      <section id="courses" className="relative z-10 px-8 py-32 lg:px-24">
        <div className="mx-auto mb-20 max-w-3xl space-y-4 text-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-400">Simulation Modules</p>
          <h2 className="text-4xl font-black tracking-tight lg:text-5xl">Three Core Training Modules</h2>
          <p className="leading-relaxed text-slate-400">
            Each module replicates the exact scenarios helpdesk personnel face daily - from hardware failures to
            security incidents - in a risk-free simulated environment.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {MODULES.map((module) => (
            <div key={module.id}>
              <ModuleCard module={module} />
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-xs font-medium text-slate-500">
            All modules are evaluated using the <span className="text-slate-300">ISO/IEC 25010</span> software quality
            model to ensure functional suitability, usability, and reliability.
          </p>
        </div>
      </section>

      <section className="relative z-10 px-8 py-32 lg:px-24">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[3rem]">
          <div className="absolute inset-0 bg-brand-600" />
          <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/tech-pattern/1920/1080')] opacity-10 mix-blend-overlay" />

          <div className="relative space-y-8 p-12 text-center lg:p-24">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-white shadow-xl backdrop-blur-md">
              <ShieldCheck size={32} />
            </div>
            <h2 className="text-4xl font-black tracking-tight text-white lg:text-6xl">Start Your Simulation Training Today</h2>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-brand-100">
              Bridge the readiness gap. Practice hardware troubleshooting, software support, and security response in a
              safe, risk-free environment before working on live organizational systems.
            </p>
            <Link
              to="/login"
              className="group mx-auto flex w-fit items-center gap-3 rounded-2xl bg-white px-10 py-5 text-lg font-black text-brand-600 shadow-2xl shadow-black/20 transition-all hover:bg-brand-50"
            >
              <LogOut size={24} className="rotate-180" />
              Sign In
            </Link>
          </div>
        </div>
      </section>

      <footer className="relative z-10 flex flex-col items-center justify-between gap-8 border-t border-white/5 bg-dark-bg px-8 py-12 md:flex-row lg:px-24">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-500/20">
            <Monitor size={20} />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            HelpDesk <span className="text-brand-400">Academy</span>
          </span>
        </div>

        <p className="text-sm font-medium text-slate-500">© 2026 HelpDesk Academy. All rights reserved.</p>

        <div className="flex items-center gap-8 text-sm font-medium text-slate-400">
          <a href="#features" className="transition-colors hover:text-white">
            Features
          </a>
          <a href="#courses" className="transition-colors hover:text-white">
            Courses
          </a>
          <a href="#why-us" className="transition-colors hover:text-white">
            Why Us
          </a>
        </div>
      </footer>
    </div>
  );
}
