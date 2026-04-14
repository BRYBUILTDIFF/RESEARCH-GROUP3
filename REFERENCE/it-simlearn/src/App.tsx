/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  Users, 
  BarChart3, 
  LogOut, 
  ChevronRight, 
  Search, 
  Bell, 
  User as UserIcon,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  MoreVertical,
  Settings,
  ShieldCheck,
  Monitor,
  Cpu,
  Network,
  Mail,
  ArrowRight,
  HardDrive,
  AppWindow,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { cn } from './lib/utils';

// --- Types ---

type Role = 'admin' | 'user';

interface Module {
  id: string;
  title: string;
  description: string;
  category: 'Hardware' | 'Software' | 'Security';
  level: string;
  status: 'Published' | 'Draft';
  scenariosCount: number;
  lessonsCount: number;
  duration: string;
  theme: 'cyan' | 'rose';
}

interface Scenario {
  id: string;
  moduleId: string;
  title: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

interface PerformanceData {
  module: string;
  score: number;
}

// --- Mock Data ---

const MOCK_MODULES: Module[] = [
  {
    id: '1',
    title: 'Hardware Troubleshooting',
    description: 'Simulate real-world hardware failures including POST errors, RAM diagnostics, peripheral malfunctions, and hardware replacement workflows encountered in enterprise helpdesk environments.',
    category: 'Hardware',
    level: 'Beginner → Advanced',
    status: 'Published',
    scenariosCount: 2,
    lessonsCount: 4,
    duration: '90 min',
    theme: 'cyan'
  },
  {
    id: '2',
    title: 'Application Software',
    description: 'Diagnose and resolve Microsoft Office, OS-level, and productivity software issues encountered in enterprise helpdesk environments.',
    category: 'Software',
    level: 'Beginner → Intermediate',
    status: 'Published',
    scenariosCount: 3,
    lessonsCount: 4,
    duration: '80 min',
    theme: 'cyan'
  },
  {
    id: '3',
    title: 'Security & Incident Response',
    description: 'Identify security threats, respond to incidents, and protect organisational assets through guided simulation scenarios.',
    category: 'Security',
    level: 'Intermediate → Advanced',
    status: 'Published',
    scenariosCount: 5,
    lessonsCount: 4,
    duration: '100 min',
    theme: 'rose'
  }
];

const MOCK_PERFORMANCE: PerformanceData[] = [
  { module: 'Hardware', score: 85 },
  { module: 'Software', score: 92 },
  { module: 'Security', score: 78 },
];

const PIE_DATA = [
  { name: 'Passed', value: 75, color: '#0ea5e9' },
  { name: 'Failed', value: 25, color: '#f43f5e' },
];

// --- Components ---

interface SidebarItemProps {
  key?: React.Key;
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick: () => void;
}

const SidebarItem = ({ 
  icon: Icon, 
  label, 
  active, 
  onClick 
}: SidebarItemProps) => (
  <button 
    onClick={onClick}
    className={cn(
      "sidebar-item w-full",
      active && "sidebar-item-active"
    )}
  >
    <Icon size={20} />
    <span>{label}</span>
  </button>
);

const StatCard = ({ label, value, icon: Icon, subtext }: { label: string, value: string | number, icon: any, subtext?: string }) => (
  <div className="glass-card p-6 flex items-start justify-between">
    <div>
      <p className="text-sm font-medium text-slate-500 mb-1">{label}</p>
      <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
      {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
    </div>
    <div className="p-3 bg-brand-50 rounded-lg text-brand-600">
      <Icon size={24} />
    </div>
  </div>
);

const ModuleCard = ({ module, role }: { module: Module, role: Role }) => {
  const Icon = module.category === 'Hardware' ? HardDrive : 
               module.category === 'Software' ? AppWindow : 
               ShieldAlert;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-[2rem] border transition-all group",
        "bg-[#0B1120] shadow-2xl",
        module.theme === 'rose' ? "border-rose-500/10 hover:border-rose-500/30" : "border-cyan-500/10 hover:border-cyan-500/30"
      )}
    >
      <div className="p-10">
        <div className="flex items-start gap-6 mb-10">
          <div className={cn(
            "w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-inner",
            module.theme === 'rose' ? "bg-rose-500/10 text-rose-500" : "bg-cyan-500/10 text-cyan-400"
          )}>
            <Icon size={32} />
          </div>
          <div className="space-y-1 pt-1">
            <span className={cn(
              "text-[11px] font-black uppercase tracking-[0.25em]",
              module.theme === 'rose' ? "text-rose-500" : "text-cyan-400"
            )}>
              Module {module.id}
            </span>
            <h4 className="text-3xl font-black text-white leading-tight tracking-tight">
              {module.title}
            </h4>
          </div>
        </div>

        <p className="text-slate-400 text-base leading-relaxed mb-10 line-clamp-4">
          {module.description}
        </p>
        
        <div className="flex items-center gap-8 mb-10">
          <div className="flex items-center gap-3 text-slate-500">
            <BookOpen size={18} className="opacity-50" />
            <span className="text-sm font-bold">{module.lessonsCount} lessons</span>
          </div>
          <div className="flex items-center gap-3 text-slate-500">
            <Clock size={18} className="opacity-50" />
            <span className="text-sm font-bold">{module.duration}</span>
          </div>
        </div>

        <div className="pt-10 border-t border-white/5 flex items-center justify-between">
          <div className={cn(
            "px-4 py-2 rounded-xl border text-[11px] font-black tracking-wider uppercase",
            module.theme === 'rose' 
              ? "bg-rose-500/5 border-rose-500/20 text-rose-500" 
              : "bg-cyan-500/5 border-cyan-500/20 text-cyan-400"
          )}>
            {module.level}
          </div>
          
          <button className="px-7 py-3.5 bg-brand-600 hover:bg-brand-500 text-white rounded-2xl text-sm font-black transition-all flex items-center gap-3 shadow-xl shadow-brand-600/30 group/btn">
            {role === 'admin' ? 'Edit Module' : 'Start Learning'}
            <ChevronRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// --- Simulation View ---

const SimulationView = ({ onExit }: { onExit: () => void }) => {
  const [step, setStep] = useState(0);
  const [logs, setLogs] = useState<string[]>(["System initialized...", "Waiting for user input..."]);
  const [isFixed, setIsFixed] = useState(false);

  const steps = [
    {
      title: "Initial Diagnosis",
      description: "The user reports the PC won't boot. There are no lights on the front panel.",
      options: [
        { label: "Check Power Cable", action: () => addLog("Power cable is securely plugged in.") },
        { label: "Check PSU Switch", action: () => { addLog("PSU switch was OFF. Flipped to ON."); setStep(1); } },
        { label: "Replace Motherboard", action: () => addLog("Replacing motherboard without diagnosis is not recommended.") },
      ]
    },
    {
      title: "Power Restored",
      description: "The PC now has power, but it's making a series of long beeps and nothing appears on the screen.",
      options: [
        { label: "Reseat RAM", action: () => { addLog("Reseated RAM modules. Beeping stopped."); setStep(2); } },
        { label: "Check Monitor Cable", action: () => addLog("Monitor cable is fine. Beeping persists.") },
        { label: "Reset BIOS", action: () => addLog("BIOS reset. Beeping persists.") },
      ]
    },
    {
      title: "POST Success",
      description: "The system POSTs successfully, but stops at 'No Boot Device Found'.",
      options: [
        { label: "Check SATA Connection", action: () => { addLog("SATA cable was loose. Reconnected."); setIsFixed(true); } },
        { label: "Reinstall OS", action: () => addLog("OS reinstallation failed: No drive detected.") },
        { label: "Check Boot Order", action: () => addLog("Boot order is correct, but drive is missing from list.") },
      ]
    }
  ];

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `> ${msg}`]);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-8">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-5xl h-full max-h-[800px] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <Monitor size={20} className="text-brand-400" />
            <h2 className="font-bold">Hardware Simulation: PC Won't Boot</h2>
          </div>
          <button onClick={onExit} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <LogOut size={20} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left: Interactive Area */}
          <div className="flex-1 p-8 overflow-y-auto space-y-8">
            {!isFixed ? (
              <>
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-brand-600 uppercase tracking-widest">Step {step + 1} of {steps.length}</span>
                  <h3 className="text-2xl font-bold text-slate-900">{steps[step].title}</h3>
                  <p className="text-slate-500">{steps[step].description}</p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {steps[step].options.map((opt, i) => (
                    <button 
                      key={i}
                      onClick={opt.action}
                      className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-brand-500 hover:bg-brand-50 transition-all group text-left"
                    >
                      <span className="font-medium text-slate-700 group-hover:text-brand-700">{opt.label}</span>
                      <ChevronRight size={18} className="text-slate-300 group-hover:text-brand-500" />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="h-full flex flex-col items-center justify-center text-center space-y-6"
              >
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                  <CheckCircle2 size={48} />
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-slate-900">Issue Resolved!</h3>
                  <p className="text-slate-500 mt-2">You have successfully diagnosed and fixed the hardware failure.</p>
                </div>
                <div className="grid grid-cols-3 gap-8 w-full max-w-md">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-900">100%</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Accuracy</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-900">4:25</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Time</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-900">+50</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">XP</p>
                  </div>
                </div>
                <button 
                  onClick={onExit}
                  className="bg-brand-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-200"
                >
                  Finish Simulation
                </button>
              </motion.div>
            )}
          </div>

          {/* Right: Diagnostic Logs */}
          <div className="w-80 bg-slate-950 p-6 font-mono text-xs flex flex-col">
            <div className="flex items-center gap-2 text-slate-500 mb-4 pb-4 border-b border-white/10">
              <Cpu size={14} />
              <span className="uppercase tracking-widest">Diagnostic Logs</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 text-slate-300">
              {logs.map((log, i) => (
                <motion.p 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={i}
                >
                  {log}
                </motion.p>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// --- Landing Page ---

const LandingPage = ({ onSignIn }: { onSignIn: () => void }) => {
  return (
    <div className="min-h-screen bg-dark-bg text-white font-sans selection:bg-brand-500/30">
      <div className="landing-gradient fixed inset-0 pointer-events-none"></div>
      
      {/* Navbar */}
      <nav className="sticky top-0 z-50 h-20 px-8 lg:px-24 flex items-center justify-between border-b border-white/5 bg-dark-bg/80 backdrop-blur-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
            <ShieldCheck size={24} />
          </div>
          <span className="text-xl font-bold tracking-tight">HelpDesk <span className="text-brand-400">Academy</span></span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#courses" className="hover:text-white transition-colors">Courses</a>
          <a href="#why-us" className="hover:text-white transition-colors">Why Us</a>
        </div>

        <button 
          onClick={onSignIn}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-brand-500/20"
        >
          <LogOut size={18} className="rotate-180" />
          Sign In
        </button>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-8 lg:px-24 py-20 lg:py-32 grid lg:grid-cols-2 gap-16 items-center">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-8"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-[10px] font-bold uppercase tracking-widest">
            <Monitor size={12} />
            Simulated E-Learning Module
          </div>
          
          <h1 className="text-5xl lg:text-7xl font-black leading-[1.1] tracking-tight">
            IT Support Skills for <span className="text-brand-400">Helpdesk Personnel</span>
          </h1>
          
          <p className="text-lg text-slate-400 leading-relaxed max-w-xl">
            A simulation-based e-learning platform designed to bridge the <span className="text-white font-medium">"readiness gap"</span> where helpdesk staff practice hardware troubleshooting, software support, and security response in a risk-free digital environment before working on live systems.
          </p>
          
          <div className="flex flex-wrap items-center gap-4 pt-4">
            <button 
              onClick={onSignIn}
              className="px-8 py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-bold transition-all shadow-xl shadow-brand-500/20 flex items-center gap-2 group"
            >
              Sign In
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <a 
              href="#courses"
              className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold transition-all border border-white/10 flex items-center gap-2"
            >
              <BookOpen size={20} />
              View Modules
            </a>
          </div>

          <div className="grid grid-cols-2 gap-8 pt-8 border-t border-white/5">
            <div>
              <p className="text-3xl font-black text-white">3 Modules</p>
              <p className="text-sm text-slate-500 font-medium">Hardware • Software • Security</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
                <ShieldCheck size={24} />
              </div>
              <div>
                <p className="text-sm font-bold text-white uppercase tracking-wider">ISO/IEC 25010</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Certified Quality</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative"
        >
          <div className="absolute -inset-4 bg-brand-500/20 blur-3xl rounded-full opacity-20"></div>
          <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
            <img 
              src="https://picsum.photos/seed/it-support/1200/800" 
              alt="IT Support Training" 
              className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-dark-bg via-transparent to-transparent"></div>
            
            <div className="absolute bottom-8 left-8 right-8 p-6 dark-glass-card">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-brand-500 flex items-center justify-center text-white shadow-lg shadow-brand-500/40">
                  <LayoutDashboard size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Interactive Dashboard</p>
                  <p className="text-xs text-slate-400">Real-time performance tracking & analytics</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 px-8 lg:px-24 py-32 bg-slate-950/50">
        <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
          <p className="text-brand-400 text-xs font-black uppercase tracking-[0.2em]">Platform Features</p>
          <h2 className="text-4xl lg:text-5xl font-black tracking-tight">Designed Around Real Helpdesk Needs</h2>
          <p className="text-slate-400 leading-relaxed">
            Built on Constructivist Learning Theory, learners are active problem-solvers, not passive consumers, practicing real IT support tasks in a safe simulation environment.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            { 
              title: "Scenario-Based Simulations", 
              desc: "Interactive modules replicate real helpdesk incidents, learners make decisions and immediately see the outcome, following Kolb's Experiential Learning Theory.",
              icon: Monitor
            },
            { 
              title: "Knowledge Assessments", 
              desc: "Pre-test and post-test assessments measure improvements in troubleshooting speed and accuracy before and after completing each simulation module.",
              icon: CheckCircle2
            },
            { 
              title: "Progress & Performance Analytics", 
              desc: "Visual dashboards track module completion, quiz scores, and simulation performance, giving both learners and administrators clear insights.",
              icon: BarChart3
            },
            { 
              title: "Completion Certificates", 
              desc: "Earn certificates upon completing course modules, a shareable proof of professional development aligned with IT support competency frameworks.",
              icon: ShieldCheck
            },
            { 
              title: "Scaffolded Learning Design", 
              desc: "Modules are structured using Sweller's Cognitive Load Theory, progressively increasing complexity to prevent cognitive overload and maximize retention.",
              icon: LayoutDashboard
            },
            { 
              title: "Retake & Feedback Loop", 
              desc: "Learners can retake simulations and quizzes anytime. Feedback loops feed back into module improvements through the IPO model's feedback mechanism.",
              icon: Clock
            }
          ].map((feature, i) => (
            <motion.div 
              key={i}
              whileHover={{ y: -5 }}
              className="p-8 dark-glass-card border-white/5 hover:border-brand-500/30 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 mb-6 group-hover:scale-110 transition-transform">
                <feature.icon size={24} />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">{feature.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Why Us Section (Stats) */}
      <section id="why-us" className="relative z-10 px-8 lg:px-24 py-24 border-y border-white/5 bg-dark-bg">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 text-center">
          <div className="space-y-2">
            <p className="text-5xl font-black text-white tracking-tighter">3</p>
            <p className="text-sm font-bold text-brand-500 uppercase tracking-wide">Core Modules</p>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">Hardware • Software • Security</p>
          </div>
          <div className="space-y-2">
            <p className="text-5xl font-black text-white tracking-tighter">12+</p>
            <p className="text-sm font-bold text-brand-500 uppercase tracking-wide">Sim Scenarios</p>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">Mapped to real helpdesk tasks</p>
          </div>
          <div className="space-y-2">
            <p className="text-5xl font-black text-white tracking-tighter">ISO/IEC</p>
            <p className="text-sm font-bold text-brand-500 uppercase tracking-wide">25010 Evaluated</p>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">Functional, Usability & Reliability</p>
          </div>
          <div className="space-y-2">
            <p className="text-5xl font-black text-white tracking-tighter">Pre/Post</p>
            <p className="text-sm font-bold text-brand-500 uppercase tracking-wide">Test Design</p>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">Quasi-experimental assessment</p>
          </div>
        </div>
      </section>

      {/* Modules Section */}
      <section id="courses" className="relative z-10 px-8 lg:px-24 py-32">
        <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
          <p className="text-brand-400 text-xs font-black uppercase tracking-[0.2em]">Simulation Modules</p>
          <h2 className="text-4xl lg:text-5xl font-black tracking-tight">Three Core Training Modules</h2>
          <p className="text-slate-400 leading-relaxed">
            Each module replicates the exact scenarios helpdesk personnel face daily — from hardware failures to security incidents — in a risk-free simulated environment.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {MOCK_MODULES.map((module) => (
            <div key={module.id}>
              <ModuleCard module={module} role="user" />
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-xs text-slate-500 font-medium">
            All modules are evaluated using the <span className="text-slate-300">ISO/IEC 25010</span> software quality model to ensure functional suitability, usability, and reliability.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 px-8 lg:px-24 py-32">
        <div className="max-w-5xl mx-auto rounded-[3rem] overflow-hidden relative">
          <div className="absolute inset-0 bg-brand-600"></div>
          <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/tech-pattern/1920/1080')] opacity-10 mix-blend-overlay"></div>
          
          <div className="relative p-12 lg:p-24 text-center space-y-8">
            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-white mx-auto shadow-xl">
              <ShieldCheck size={32} />
            </div>
            <h2 className="text-4xl lg:text-6xl font-black text-white tracking-tight">Start Your Simulation Training Today</h2>
            <p className="text-brand-100 text-lg max-w-2xl mx-auto leading-relaxed">
              Bridge the readiness gap. Practice hardware troubleshooting, software support, and security response in a safe, risk-free environment before working on live organizational systems.
            </p>
            <button 
              onClick={onSignIn}
              className="px-10 py-5 bg-white text-brand-600 rounded-2xl font-black text-lg hover:bg-brand-50 transition-all shadow-2xl shadow-black/20 flex items-center gap-3 mx-auto group"
            >
              <LogOut size={24} className="rotate-180" />
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-8 lg:px-24 py-12 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-8 bg-dark-bg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
            <Monitor size={20} />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">HelpDesk <span className="text-brand-400">Academy</span></span>
        </div>
        
        <p className="text-sm text-slate-500 font-medium">
          © 2026 HelpDesk Academy. All rights reserved.
        </p>
        
        <div className="flex items-center gap-8 text-sm font-medium text-slate-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#courses" className="hover:text-white transition-colors">Courses</a>
          <a href="#why-us" className="hover:text-white transition-colors">Why Us</a>
        </div>
      </footer>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [view, setView] = useState<'landing' | 'app'>('landing');
  const [role, setRole] = useState<Role>('admin');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);

  const navItems = role === 'admin' ? [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'modules', label: 'Modules', icon: BookOpen },
    { id: 'trainees', label: 'Trainees', icon: Users },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ] : [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'modules', label: 'Modules', icon: BookOpen },
    { id: 'progress', label: 'My Progress', icon: CheckCircle2 },
  ];

  if (view === 'landing') {
    return <LandingPage onSignIn={() => setView('app')} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {isSimulating && <SimulationView onExit={() => setIsSimulating(false)} />}
      
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-200">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 leading-tight">IT SimLearn</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {role === 'admin' ? 'Admin Panel' : 'User Panel'}
              </p>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => (
              <SidebarItem 
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={activeTab === item.id}
                onClick={() => setActiveTab(item.id)}
              />
            ))}
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-6 p-2 rounded-lg bg-slate-50">
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xs">
              LV
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">Lorenzo Villamiel</p>
              <p className="text-[10px] text-slate-500 truncate">lorenzo@example.com</p>
            </div>
            <button 
              onClick={() => setRole(role === 'admin' ? 'user' : 'admin')}
              className="text-slate-400 hover:text-brand-600 transition-colors"
              title="Switch Role"
            >
              <Settings size={16} />
            </button>
          </div>
          <button 
            onClick={() => setView('landing')}
            className="sidebar-item w-full text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search modules, trainees, or reports..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-brand-600 hover:bg-slate-50 rounded-lg transition-all relative">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-8 w-[1px] bg-slate-200"></div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs font-bold text-slate-900">Lorenzo Villamiel</p>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{role}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                <UserIcon size={20} />
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex justify-between items-end">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Welcome back, Lorenzo</h2>
                    <p className="text-slate-500">Here's what's happening with the training platform today.</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-500 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
                    <Clock size={16} />
                    {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {role === 'admin' ? (
                    <>
                      <StatCard label="Total Modules" value={3} icon={BookOpen} subtext="3 published" />
                      <StatCard label="Active Trainees" value={12} icon={Users} subtext="+2 this week" />
                      <StatCard label="Completions" value={48} icon={CheckCircle2} subtext="85% success rate" />
                      <StatCard label="Avg. Score" value="92%" icon={BarChart3} subtext="Across all attempts" />
                    </>
                  ) : (
                    <>
                      <StatCard label="Available Modules" value={3} icon={BookOpen} />
                      <StatCard label="Scenarios Passed" value={1} icon={CheckCircle2} />
                      <StatCard label="Average Score" value="100%" icon={BarChart3} />
                      <StatCard label="Time Spent" value="2.5h" icon={Clock} />
                    </>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-6">
                    <div className="glass-card p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-slate-900">Recent Activity</h3>
                        <button className="text-xs font-bold text-brand-600 hover:underline">View All</button>
                      </div>
                      <div className="space-y-4">
                        {[
                          { user: 'villamiel231327@ceu.edu.ph', action: 'Completed Hardware Module', time: 'Mar 17, 2026', status: '100%' },
                          { user: 'barrozo231328@ceu.edu.ph', action: 'Started Security Simulation', time: 'Mar 16, 2026', status: 'In Progress' },
                          { user: 'ramos231329@ceu.edu.ph', action: 'Failed Software Assessment', time: 'Mar 15, 2026', status: '65%' },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                <UserIcon size={16} />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-900">{item.user}</p>
                                <p className="text-xs text-slate-500">{item.action} • {item.time}</p>
                              </div>
                            </div>
                            <div className={cn(
                              "px-2 py-1 rounded text-[10px] font-bold",
                              item.status === '100%' ? "bg-green-100 text-green-700" :
                              item.status === 'In Progress' ? "bg-blue-100 text-blue-700" :
                              "bg-rose-100 text-rose-700"
                            )}>
                              {item.status}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="glass-card p-6">
                      <h3 className="font-bold text-slate-900 mb-6">Modules Overview</h3>
                      <div className="space-y-4">
                        {MOCK_MODULES.map((m) => (
                          <div key={m.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                m.category === 'Hardware' ? "bg-orange-500" :
                                m.category === 'Software' ? "bg-blue-500" :
                                "bg-purple-500"
                              )}></div>
                              <span className="text-sm font-medium text-slate-700">{m.title}</span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">{m.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'modules' && (
              <motion.div 
                key="modules"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Training Modules</h2>
                    <p className="text-slate-500">Create and manage simulation modules.</p>
                  </div>
                  {role === 'admin' && (
                    <button className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-brand-700 transition-all shadow-lg shadow-brand-200">
                      <Plus size={18} />
                      Create Module
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {MOCK_MODULES.map((module) => (
                    <div key={module.id} onClick={() => role === 'user' && setIsSimulating(true)} className={role === 'user' ? 'cursor-pointer' : ''}>
                      <ModuleCard module={module} role={role} />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'analytics' && role === 'admin' && (
              <motion.div 
                key="analytics"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Performance Analytics</h2>
                  <p className="text-slate-500">View trainee performance and assessment results.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="glass-card p-6">
                    <h3 className="font-bold text-slate-900 mb-6">Score by Module</h3>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={MOCK_PERFORMANCE}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="module" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            cursor={{ fill: '#f8fafc' }}
                          />
                          <Bar dataKey="score" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={40} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="glass-card p-6">
                    <h3 className="font-bold text-slate-900 mb-6">Completion Status</h3>
                    <div className="h-80 w-full flex items-center justify-center relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={PIE_DATA}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {PIE_DATA.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-3xl font-bold text-slate-900">75%</span>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pass Rate</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'progress' && role === 'user' && (
              <motion.div 
                key="progress"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">My Progress</h2>
                  <p className="text-slate-500">Track your simulation results and performance.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="glass-card p-6 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">1</p>
                      <p className="text-xs font-bold text-slate-400 uppercase">Passed</p>
                    </div>
                  </div>
                  <div className="glass-card p-6 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                      <AlertCircle size={24} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">0</p>
                      <p className="text-xs font-bold text-slate-400 uppercase">Failed</p>
                    </div>
                  </div>
                  <div className="glass-card p-6 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center text-brand-600">
                      <BarChart3 size={24} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">100%</p>
                      <p className="text-xs font-bold text-slate-400 uppercase">Avg. Score</p>
                    </div>
                  </div>
                </div>

                <div className="glass-card overflow-hidden">
                  <div className="p-6 border-b border-slate-100">
                    <h3 className="font-bold text-slate-900">Simulation History</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <th className="px-6 py-4">Module</th>
                          <th className="px-6 py-4">Scenario</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Score</th>
                          <th className="px-6 py-4">Time</th>
                          <th className="px-6 py-4">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr>
                          <td className="px-6 py-4 text-sm font-medium text-slate-900">IT Security Incident Response</td>
                          <td className="px-6 py-4 text-sm text-slate-500">Suspected Phishing Email</td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 rounded bg-green-100 text-green-700 text-[10px] font-bold">Passed</span>
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-900">100%</td>
                          <td className="px-6 py-4 text-sm text-slate-500">8m</td>
                          <td className="px-6 py-4 text-sm text-slate-500">Mar 17, 2026</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
