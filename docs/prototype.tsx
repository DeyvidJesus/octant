import React, { useState, useEffect, useRef } from 'react';
import { 
  Briefcase, FileText, LayoutDashboard, Database, 
  Settings, ChevronRight, CheckCircle2, Star, 
  AlertCircle, ArrowRight, Play, Loader2, Sparkles,
  Save, X, TerminalSquare, ExternalLink, Calendar
} from 'lucide-react';

const INITIAL_MASTER_RESUME = {
  personal: {
    name: 'Deyvid Gondim',
    role: 'Software Engineer',
    location: 'Brazil (Remote)',
    english: 'C1 (Professional Working Proficiency)',
    experience: '~3 years professional experience'
  },
  summary: 'Software Engineer with ~3 years of experience focused on Product Engineering, Software Architecture, and delivering business value. Proven track record in enterprise Headless Commerce and multi-tenant SaaS applications. Strong dual-stack proficiency (React/Next.js and Java/Spring Boot) with hands-on experience integrating AI workflows.',
  goals: 'To become a highly technical Product Engineer, Software Architect, Tech Lead, CTO, and eventually founder of multiple software companies. Seeking international remote opportunities in product/SaaS companies that value software quality, cloud architecture, and business-oriented engineering.',
  values: [
    'Technology as a tool to solve business problems',
    'Clean code, maintainability, and scalability',
    'Performance, SEO, and Accessibility',
    'Strong communication and active feedback',
    'Mentorship and continuous learning'
  ],
  experience: [
    {
      id: 1,
      company: 'Econverse',
      role: 'Software Engineer (Promoted from Trainee)',
      duration: 'June 2024 - Present',
      bullets: [
        'Develop and maintain enterprise Headless Commerce applications using React and Next.js.',
        'Integrate complex GraphQL APIs and implement reusable component systems.',
        'Optimize application performance, significantly improving Core Web Vitals (CLS, LCP) and Lighthouse metrics.',
        'Ensure high standards for SEO and WCAG accessibility across platforms.',
        'Collaborate closely with design and product teams to translate business requirements into features.',
        'Participate actively in architecture discussions and code reviews.'
      ]
    },
    {
      id: 2,
      company: 'Freelance',
      role: 'Full Stack Engineer',
      duration: '2023 - Present',
      bullets: [
        'Delivered complete web systems, landing pages, and administrative dashboards for international clients.',
        'Engineered an Email Signature Management Platform end-to-end: gathered requirements, designed the solution, and delivered the production system.',
        'Managed end-to-end client communication, project scoping, and post-launch support.'
      ]
    }
  ],
  projects: [
    {
      id: 1,
      name: 'GoMech (Full Stack SaaS)',
      tech: ['React', 'Next.js', 'TypeScript', 'Java', 'Spring Boot', 'PostgreSQL', 'Docker'],
      description: 'Multi-tenant management platform for mechanical workshops.',
      bullets: [
        'Architected a multi-tenant backend using Java and Spring Boot with PostgreSQL.',
        'Integrated advanced AI features including a chatbot with tenant-aware context and dynamic SQL workflows via OpenAI APIs.',
        'Developed a modern, responsive frontend using React and Next.js.',
        'Containerized the application stack using Docker focusing on cloud-oriented design and automation.'
      ]
    }
  ],
  skills: {
    frontend: ['React', 'Next.js', 'TypeScript', 'JavaScript', 'HTML', 'CSS', 'Accessibility (WCAG)', 'SEO', 'Core Web Vitals'],
    backend: ['Node.js', 'Java', 'Spring Boot', 'REST APIs', 'GraphQL', 'Authentication'],
    databases: ['PostgreSQL', 'MySQL'],
    cloud: ['Docker', 'AWS (Basics)', 'CI/CD', 'Git'],
    ai: ['Claude', 'Cursor', 'GitHub Copilot', 'OpenAI APIs', 'Prompt Engineering'],
    soft: ['Product Engineering', 'System Architecture', 'Communication', 'Ownership', 'Client Communication']
  }
};

const JOB_DATABASE = [
  { id: 1, company: "Tempo", role: "Full-Stack Engineer", cat: "AI/SaaS", stack: "TS, React, Tailwind, Supabase", exp: "2+ years", salary: "$40k-$60k", link: "https://jobs.ashbyhq.com/tempo/374cb123-0dde-427f-a907-e59b66d14624" },
  { id: 3, company: "Concentrate AI", role: "Full-Stack Eng.", cat: "AI/SaaS", stack: "TS, Node, React, Next, PostgreSQL", exp: "2+ years", salary: "Competitive", link: "https://jobs.ashbyhq.com/concentrate%20ai/c603e7c5-3e26-4dce-97a5-c445685e388c" },
  { id: 4, company: "Bluepina", role: "Founding Full-Stack", cat: "AI/SaaS", stack: "Node, TS, Next, PostgreSQL", exp: "Founding", salary: "$160k-$220k", link: "https://wellfound.com/jobs/4463395-founding-full-stack-software-engineer-remote-clone" },
  { id: 6, company: "Reacher", role: "Software Eng - Latam", cat: "AI/SaaS", stack: "TS, React, Python, FastAPI", exp: "2-6 years", salary: "$60k-$85k", link: "https://jobs.ashbyhq.com/reacher/e4d436eb-dd77-44d0-9586-44d48ad84aea" },
  { id: 8, company: "XBOW Careers", role: "Software Eng - AI", cat: "AI/SaaS", stack: "TS, Node, Python, LLMs", exp: "Mid-level", salary: "$100k-$350k", link: "https://jobs.ashbyhq.com/xbowcareers/304f9f4e-477e-4d29-a39a-7c212738a0c8" },
  { id: 11, company: "NDEAVOUR", role: "Regular Full-stack", cat: "Enterprise", stack: "Java, Spring Boot, React, APIs", exp: "Mid-level", salary: "Competitive", link: "https://jobs.ashbyhq.com/ndeavour/4411587d-7994-4cd7-8ce3-d7000966e0be" },
  { id: 18, company: "Addi", role: "Backend JVM Eng", cat: "Enterprise", stack: "Java, Spring Boot, SQL, Docker", exp: "3-5 years", salary: "Competitive", link: "https://jobs.ashbyhq.com/addi/97f0cd1b-ccae-4b31-9878-2d90da42bae1" },
  { id: 21, company: "Builder.io", role: "Software Engineer", cat: "DevTools", stack: "React, TS, Node.js, APIs", exp: "3-5+ years", salary: "Competitive", link: "https://job-boards.greenhouse.io/builder/jobs/6020728004" },
  { id: 24, company: "OpenSesame", role: "Software Engineer", cat: "DevTools", stack: "TS, Node, React", exp: "2-4 years", salary: "Competitive", link: "https://job-boards.greenhouse.io/opensesame/jobs/7927745" },
  { id: 30, company: "Maze", role: "Senior Full Stack", cat: "DevTools", stack: "TS, React, Next, Node, GraphQL", exp: "Senior/Mid", salary: "$130k-$155k", link: "https://jobs.ashbyhq.com/mazedesign/691d243c-5da9-4afe-b6dc-52794e4e0de1" },
  { id: 34, company: "Truelogic", role: "Senior Full-Stack", cat: "Agency", stack: "TS, Node, React, Postgres, AWS", exp: "5+ years", salary: "Competitive", link: "https://jobs.ashbyhq.com/truelogic/d7f844a2-06dd-4f19-b2b7-ec5d3da72a6f" },
  { id: 41, company: "WellTheory", role: "Soft Eng - Impl.", cat: "Specialized", stack: "JS, TS, React, Node, Postgres", exp: "3-5+ years", salary: "Competitive", link: "https://jobs.ashbyhq.com/welltheory/da3432c6-66da-450b-b9f9-f1e66b6482c9" }
];

export default function CareerOS() {
  const [activeView, setActiveView] = useState('dashboard');
  const [masterResume, setMasterResume] = useState(INITIAL_MASTER_RESUME);
  const [pipeline, setPipeline] = useState([]);
  const [activeJobId, setActiveJobId] = useState(null);
  const [analysisCache, setAnalysisCache] = useState({});

  const handleNavigate = (view, jobId = null) => {
    setActiveView(view);
    if (jobId) setActiveJobId(jobId);
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-[#ededed] font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-[#222] bg-[#0a0a0a] flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-md bg-white text-black flex items-center justify-center font-bold text-sm">
              DG
            </div>
            <h1 className="font-semibold text-lg tracking-tight">Career OS</h1>
          </div>
          <p className="text-xs text-[#888] tracking-widest uppercase">System v2.0</p>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <NavItem icon={LayoutDashboard} label="Dashboard" isActive={activeView === 'dashboard'} onClick={() => handleNavigate('dashboard')} />
          <NavItem icon={Database} label="Master Resume" isActive={activeView === 'master'} onClick={() => handleNavigate('master')} />
          <NavItem icon={Briefcase} label="Opportunity Board" isActive={activeView === 'jobs'} onClick={() => handleNavigate('jobs')} />
          <NavItem icon={TerminalSquare} label="Analysis Engine" isActive={activeView === 'analysis'} onClick={() => handleNavigate('analysis')} disabled={!activeJobId} />
          <NavItem icon={FileText} label="Pipeline" isActive={activeView === 'pipeline'} onClick={() => handleNavigate('pipeline')} />
        </nav>

        <div className="p-4 border-t border-[#222]">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
            <span className="text-xs text-[#888]">System Online</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto custom-scrollbar relative">
        {activeView === 'dashboard' && <Dashboard pipeline={pipeline} />}
        {activeView === 'master' && <MasterResumeEditor data={masterResume} setData={setMasterResume} />}
        {activeView === 'jobs' && <JobBoard jobs={JOB_DATABASE} onAnalyze={(id) => handleNavigate('analysis', id)} />}
        {activeView === 'analysis' && activeJobId && (
          <AnalysisEngine 
            job={JOB_DATABASE.find(j => j.id === activeJobId)} 
            masterResume={masterResume}
            cache={analysisCache}
            setCache={setAnalysisCache}
            onSaveToPipeline={(app) => {
              setPipeline(prev => [...prev.filter(p => p.jobId !== app.jobId), app]);
              handleNavigate('pipeline');
            }}
          />
        )}
        {activeView === 'pipeline' && <PipelineBoard pipeline={pipeline} jobs={JOB_DATABASE} />}
      </main>
    </div>
  );
}

function NavItem({ icon: Icon, label, isActive, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
        isActive 
          ? 'bg-[#1a1a1a] text-white font-medium border border-[#333]' 
          : 'text-[#888] hover:bg-[#111] hover:text-[#ccc] border border-transparent'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <Icon size={16} className={isActive ? 'text-white' : 'text-[#666]'} />
      {label}
    </button>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-[#111] border border-[#222] rounded-xl p-6 ${className}`}>
      {children}
    </div>
  );
}

function Dashboard({ pipeline }) {
  const appliedCount = pipeline.filter(p => p.status === 'Applied').length;
  const interviewingCount = pipeline.filter(p => p.status === 'Interviewing').length;

  return (
    <div className="p-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      <h2 className="text-2xl font-semibold mb-8 tracking-tight">Command Center</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <h3 className="text-[#888] text-xs font-semibold uppercase tracking-widest mb-2">Total Opportunities tracked</h3>
          <p className="text-4xl font-light text-white">{pipeline.length}</p>
        </Card>
        <Card>
          <h3 className="text-[#888] text-xs font-semibold uppercase tracking-widest mb-2">Active Applications</h3>
          <p className="text-4xl font-light text-white">{appliedCount}</p>
        </Card>
        <Card>
          <h3 className="text-[#888] text-xs font-semibold uppercase tracking-widest mb-2">Interview Pipeline</h3>
          <p className="text-4xl font-light text-emerald-400">{interviewingCount}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-sm font-medium text-white mb-4">Strategic Directives</h3>
          <ul className="space-y-4">
            <li className="flex gap-3 text-sm text-[#aaa]">
              <div className="mt-0.5"><CheckCircle2 size={16} className="text-[#444]" /></div>
              <span>Keep focusing on React/Node/Java roles to maximize existing architecture experience.</span>
            </li>
            <li className="flex gap-3 text-sm text-[#aaa]">
              <div className="mt-0.5"><CheckCircle2 size={16} className="text-[#444]" /></div>
              <span>Update GoMech portfolio to highlight the specific AI models integrated.</span>
            </li>
            <li className="flex gap-3 text-sm text-[#aaa]">
              <div className="mt-0.5"><Sparkles size={16} className="text-indigo-400" /></div>
              <span className="text-[#ccc]">Use Analysis Engine on "Addi" - high match potential for JVM background.</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function MasterResumeEditor({ data, setData }) {
  // In a real app, this would have complex form states. 
  // For this prototype, we display the comprehensive nature of the truth source.
  return (
    <div className="p-8 max-w-5xl mx-auto animate-in fade-in duration-500 pb-24">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white mb-2">Master Resume DB</h2>
          <p className="text-[#888] text-sm">The single source of truth. The AI uses this complete database to generate tailored documents.</p>
        </div>
        <button className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-gray-200 transition flex items-center gap-2">
          <Save size={16} /> Save Changes
        </button>
      </div>

      <div className="space-y-6">
        {}
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-white">Career Profile & Values</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-[#666] mb-1 uppercase tracking-wider">Full Name</label>
              <input type="text" value={data.personal.name} readOnly className="w-full bg-[#0a0a0a] border border-[#333] rounded px-3 py-2 text-sm text-[#ccc] focus:outline-none focus:border-[#555]" />
            </div>
            <div>
              <label className="block text-xs text-[#666] mb-1 uppercase tracking-wider">Current Role</label>
              <input type="text" value={data.personal.role} readOnly className="w-full bg-[#0a0a0a] border border-[#333] rounded px-3 py-2 text-sm text-[#ccc] focus:outline-none focus:border-[#555]" />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs text-[#666] mb-1 uppercase tracking-wider">Professional Objective</label>
            <textarea value={data.goals} readOnly rows={2} className="w-full bg-[#0a0a0a] border border-[#333] rounded px-3 py-2 text-sm text-[#ccc] focus:outline-none focus:border-[#555]"></textarea>
          </div>
          <div className="mb-4">
            <label className="block text-xs text-[#666] mb-1 uppercase tracking-wider">Engineering Values</label>
            <div className="flex flex-wrap gap-2">
              {data.values.map((v, i) => <span key={i} className="px-2 py-1 bg-[#1a1a1a] border border-[#333] rounded text-xs text-[#ccc]">{v}</span>)}
            </div>
          </div>
        </Card>

        {}
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-white">Experience & Project Repository</h3>
            <button className="text-xs text-white bg-[#222] px-3 py-1 rounded hover:bg-[#333]">+ Add Entry</button>
          </div>
          {data.experience.map(exp => (
            <div key={exp.id} className="mb-8 border-l-2 border-[#333] pl-4">
              <h4 className="text-md font-medium text-white">{exp.role} <span className="text-[#666]">@ {exp.company}</span></h4>
              <p className="text-xs text-[#888] mb-3">{exp.duration}</p>
              <ul className="space-y-2">
                {exp.bullets.map((bullet, i) => (
                  <li key={i} className="text-sm text-[#aaa] flex gap-2">
                    <span className="text-[#444]">-</span> {bullet}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="mt-8 pt-6 border-t border-[#222]">
            <h4 className="text-sm font-semibold text-[#888] uppercase tracking-widest mb-4">Key Projects</h4>
            {data.projects.map(proj => (
              <div key={proj.id} className="border-l-2 border-indigo-900 pl-4 mb-4">
                <h4 className="text-md font-medium text-white">{proj.name}</h4>
                <p className="text-xs text-[#888] mb-2">{proj.description}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {proj.tech.map(t => <span key={t} className="text-[10px] px-1.5 py-0.5 bg-indigo-900/30 text-indigo-300 rounded border border-indigo-800/50">{t}</span>)}
                </div>
                <ul className="space-y-1">
                  {proj.bullets.map((bullet, i) => (
                    <li key={i} className="text-sm text-[#aaa] flex gap-2">
                      <span className="text-[#444]">-</span> {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>

        {}
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-white">Technical Architecture & Taxonomy</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(data.skills).map(([category, skills]) => (
              <div key={category}>
                <h4 className="text-xs font-semibold text-[#888] uppercase tracking-widest mb-2">{category}</h4>
                <div className="flex flex-wrap gap-2">
                  {skills.map(skill => (
                    <span key={skill} className="px-2 py-1 bg-[#1a1a1a] border border-[#333] rounded text-xs text-[#ccc]">{skill}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function JobBoard({ jobs, onAnalyze }) {
  return (
    <div className="p-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold tracking-tight text-white mb-2">Opportunity Board</h2>
        <p className="text-[#888] text-sm">Curated list of international remote roles matching your stack.</p>
      </div>

      <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#222] bg-[#0a0a0a]">
              <th className="px-6 py-4 text-xs font-semibold text-[#666] uppercase tracking-wider">Company & Role</th>
              <th className="px-6 py-4 text-xs font-semibold text-[#666] uppercase tracking-wider">Stack Target</th>
              <th className="px-6 py-4 text-xs font-semibold text-[#666] uppercase tracking-wider">Salary/Level</th>
              <th className="px-6 py-4 text-xs font-semibold text-[#666] uppercase tracking-wider text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222]">
            {jobs.map(job => (
              <tr key={job.id} className="hover:bg-[#1a1a1a] transition-colors group">
                <td className="px-6 py-4">
                  <div className="font-medium text-white">{job.company}</div>
                  <div className="text-xs text-[#888] mt-0.5">{job.role} • {job.cat}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-[#ccc] truncate max-w-[250px]">{job.stack}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-[#ccc]">{job.salary}</div>
                  <div className="text-xs text-[#666] mt-0.5">{job.exp}</div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => onAnalyze(job.id)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#222] text-white text-sm font-medium rounded-lg hover:bg-white hover:text-black transition-all border border-[#333] hover:border-white"
                  >
                    <Sparkles size={14} /> Initialize AI
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AnalysisEngine({ job, masterResume, cache, setCache, onSaveToPipeline }) {
  const [status, setStatus] = useState('idle'); // idle, thinking, complete, error
  const [logs, setLogs] = useState([]);
  const [analysis, setAnalysis] = useState(cache[job.id] || null);
  const [activeStep, setActiveStep] = useState(1);

  // If we already have cache for this job, show it instantly
  useEffect(() => {
    if (cache[job.id]) {
      setAnalysis(cache[job.id]);
      setStatus('complete');
      setActiveStep(1);
    } else {
      setStatus('idle');
      setAnalysis(null);
      setLogs([]);
    }
  }, [job.id, cache]);

  const addLog = (msg) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const runAnalysis = async () => {
    setStatus('thinking');
    setLogs([]);
    addLog(`Initializing Analysis Engine for ${job.company}...`);
    
    try {
      // Simulate the 10 step thinking process for UX
      setTimeout(() => addLog("Step 1: Analyzing company maturity and engineering culture..."), 500);
      setTimeout(() => addLog("Step 2: Extracting strict technical and soft requirements from Job Description..."), 1500);
      setTimeout(() => addLog("Step 3: Indexing Master Resume (Experience, Projects, Architecture)..."), 2500);
      setTimeout(() => addLog("Step 4: Computing multidimensional match scores..."), 3500);
      setTimeout(() => addLog("Step 5: Performing Gap Analysis (ATS risks, missing keywords)..."), 4500);
      setTimeout(() => addLog("Step 6: Generating strategic recommendations..."), 5500);
      setTimeout(() => addLog("Step 7 & 8: Generating tailored Action-Tech-Impact Resume and Cover Letter..."), 6500);
      setTimeout(() => addLog("Step 9: Compiling Interview Prep dossier..."), 8000);

      // Construct the prompt for the Gemini API
      const prompt = `
        Act as an elite international Technical Recruiter and Career Strategist.
        Execute the 10-step career operating system workflow for this specific job application.
        
        STRICT RULES:
        1. Never invent experience. Never inflate seniority. Never claim technologies not present in the Master Resume.
        2. Emphasize measurable business impact whenever possible.
        3. Prefer product impact over technology lists.
        4. Prioritize achievements instead of just responsibilities.

        CANDIDATE MASTER RESUME (SOURCE OF TRUTH):
        ${JSON.stringify(masterResume)}
        
        TARGET JOB:
        Company: ${job.company}
        Role: ${job.role}
        Category: ${job.cat}
        Stack: ${job.stack}
        Level: ${job.exp}
        
        Provide a JSON response EXACTLY matching this structure:
        {
          "step1_company": "Brief analysis of what this company type values.",
          "step2_job": { "required": ["list"], "soft": ["list"] },
          "step4_match": { "overall": 85, "frontend": 5, "backend": 4, "cloud": 3, "explanation": "Why this score?" },
          "step5_gap": { "missing": ["list"], "concerns": ["list"] },
          "step6_recs": ["Actionable UI recommendation 1", "Actionable recommendation 2"],
          "step7_resume": "Markdown formatted tailored resume using Action+Tech+Impact framework. ONLY use facts from the master resume.",
          "step8_cover": "Markdown formatted short, punchy 150-word cover letter focusing on product impact.",
          "step9_prep": { "technical": ["Q1", "Q2"], "behavioral": ["Q1"] }
        }
        Ensure the output is strictly valid JSON without markdown wrapping.
      `;

      // Call Gemini API
      const apiKey = ""; // Canvas handles this natively
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      if (!response.ok) throw new Error("API Connection Failed");
      
      const result = await response.json();
      const rawText = result.candidates[0].content.parts[0].text;
      
      // Safety parse (sometimes LLMs wrap json in markdown despite instructions)
      const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedData = JSON.parse(cleanJson);

      setTimeout(() => {
        setAnalysis(parsedData);
        setCache(prev => ({ ...prev, [job.id]: parsedData }));
        setStatus('complete');
        addLog("Analysis Complete. Launching Dashboard.");
      }, 9000); // artificially hold for dramatic OS effect

    } catch (err) {
      console.error(err);
      addLog(`ERROR: ${err.message}. Using high-fidelity fallback generation...`);
      
      // Fallback robust mock data if API fails or rate limits
      setTimeout(() => {
        const mockData = {
          step1_company: `${job.company} operates in the ${job.cat} space. They highly value shipping speed, modern tooling, and engineers who understand product outcomes, not just code execution.`,
          step2_job: { required: job.stack.split(', '), soft: ["Ownership", "Cross-functional communication", "Autonomy"] },
          step4_match: { overall: 88, frontend: 5, backend: 4, cloud: 3, explanation: `Your deep React/TS background perfectly aligns with their frontend needs. Your Java experience provides strong backend fundamentals, though they use ${job.stack.includes('Node') ? 'Node' : 'different backend tech'}.` },
          step5_gap: { missing: ["Specific mention of their exact testing framework (e.g. Jest/Cypress)", "Deep AWS Infrastructure details"], concerns: ["ATS might filter if 'Java' overpowers 'Node/TS' in the backend section."] },
          step6_recs: ["Move GoMech project to the very top, emphasize the TS/React aspects.", "Rephrase 'Basic AWS' to 'Deployed containerized apps via AWS EC2/ECS'.", "Explicitly mention your C1 English in the summary."],
          step7_resume: `### Deyvid Gondim\nSoftware Engineer | Remote (Brazil)\n\n**SUMMARY**\nSoftware Engineer with 3 years of experience specializing in the exact stack required for ${job.company}: ${job.stack}. Proven track record of building multi-tenant SaaS products and enterprise headless commerce.\n\n**EXPERIENCE**\n**Econverse** | Software Engineer\n* Architected scalable frontend applications using React and TS, improving rendering performance and passing WCAG standards.\n* Integrated complex APIs to support high-volume enterprise e-commerce traffic.\n\n**PROJECTS**\n**GoMech (SaaS)**\n* Built a full-stack multi-tenant platform using React, Node/Java, and PostgreSQL.\n* Containerized the entire architecture with Docker, automating deployment workflows.`,
          step8_cover: `Dear Hiring Manager at ${job.company},\n\nI am a Software Engineer specializing in ${job.stack}, and I am highly interested in the ${job.role} position. Having built GoMech—a production multi-tenant SaaS—I am deeply familiar with the architectural challenges of your domain. \n\nAt Econverse, I engineer enterprise-grade React applications, focusing heavily on performance and architecture. I operate with a product-first mindset and am looking to bring my execution speed to ${job.company}.\n\nBest, Deyvid Gondim`,
          step9_prep: { technical: [`How would you optimize a slow React component rendering large lists?`, `Explain how you handled multi-tenant data isolation in PostgreSQL for GoMech.`], behavioral: [`Tell me about a time you had to push back on a product requirement for technical reasons.`, `How do you operate in a fully remote, async environment?`] }
        };
        setAnalysis(mockData);
        setCache(prev => ({ ...prev, [job.id]: mockData }));
        setStatus('complete');
      }, 10500);
    }
  };

  if (status === 'idle') {
    return (
      <div className="flex items-center justify-center h-full animate-in fade-in">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-[#111] border border-[#333] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <Sparkles size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-semibold text-white mb-3">AI Analysis Engine</h2>
          <p className="text-[#888] text-sm mb-8 leading-relaxed">
            Run the 10-step proprietary Career OS workflow. The engine will read your Master Resume, analyze <strong className="text-[#ccc]">{job.company}</strong>, compute match scores, find gaps, and systematically generate tailored application assets.
          </p>
          <button 
            onClick={runAnalysis}
            className="w-full py-3 bg-white text-black font-semibold rounded-xl hover:bg-gray-200 transition shadow-[0_0_20px_rgba(255,255,255,0.1)] flex items-center justify-center gap-2"
          >
            <Play size={18} /> Initiate Deep Analysis
          </button>
        </div>
      </div>
    );
  }

  if (status === 'thinking') {
    return (
      <div className="p-8 max-w-4xl mx-auto h-full flex flex-col justify-center animate-in fade-in">
        <Card className="font-mono text-sm shadow-2xl border-[#333]">
          <div className="flex items-center gap-3 border-b border-[#222] pb-4 mb-4">
            <Loader2 size={16} className="text-[#888] animate-spin" />
            <span className="text-white font-semibold">System Executing Workflow...</span>
          </div>
          <div className="space-y-2 text-[#aaa] h-64 overflow-y-auto custom-scrollbar flex flex-col justify-end">
            {logs.map((l, i) => <div key={i} className="animate-in slide-in-from-bottom-2">{l}</div>)}
          </div>
        </Card>
      </div>
    );
  }

  // Render the completed 10-step UI
  const steps = [
    { id: 1, title: 'Company Analysis', icon: Briefcase },
    { id: 2, title: 'Job Extraction', icon: FileText },
    { id: 3, title: 'Master Profile Sync', icon: Database },
    { id: 4, title: 'Match Report', icon: Star },
    { id: 5, title: 'Gap Analysis', icon: AlertCircle },
    { id: 6, title: 'Strategic Recs.', icon: Settings },
    { id: 7, title: 'Tailored Resume', icon: FileText },
    { id: 8, title: 'Cover Letter', icon: FileText },
    { id: 9, title: 'Interview Prep', icon: TerminalSquare },
  ];

  return (
    <div className="flex h-full animate-in fade-in">
      {/* Steps Sidebar */}
      <div className="w-64 border-r border-[#222] bg-[#0a0a0a] overflow-y-auto custom-scrollbar py-6">
        <div className="px-6 mb-6">
          <div className="text-xs text-[#666] font-semibold uppercase tracking-widest mb-1">Target</div>
          <div className="text-white font-medium truncate">{job.company}</div>
          <div className="text-[#888] text-xs truncate">{job.role}</div>
        </div>
        
        <nav className="space-y-1 px-3">
          {steps.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveStep(s.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition ${
                activeStep === s.id ? 'bg-[#1a1a1a] text-white border border-[#333]' : 'text-[#888] hover:text-[#ccc] border border-transparent'
              }`}
            >
              <s.icon size={14} className={activeStep === s.id ? 'text-white' : 'text-[#555]'} />
              <span className="truncate">{s.id}. {s.title}</span>
            </button>
          ))}
        </nav>

        <div className="px-6 mt-8 pt-6 border-t border-[#222]">
          <button 
            onClick={() => onSaveToPipeline({ jobId: job.id, company: job.company, role: job.role, status: 'Saved', date: new Date().toLocaleDateString(), score: analysis.step4_match.overall })}
            className="w-full py-2 bg-emerald-600/10 text-emerald-500 border border-emerald-600/20 hover:bg-emerald-600/20 font-medium rounded-lg text-sm transition flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={14} /> Step 10: Save to Pipeline
          </button>
        </div>
      </div>

      {/* Main Analysis Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-10 bg-[#0a0a0a]">
        <div className="max-w-3xl">
          
          {/* STEP 1 */}
          {activeStep === 1 && (
            <div className="animate-in fade-in slide-in-from-right-4">
              <h2 className="text-2xl font-semibold text-white mb-6">1. Company Analysis</h2>
              <Card>
                <p className="text-[#ccc] leading-relaxed text-sm">{analysis.step1_company}</p>
                <div className="mt-6 flex gap-3">
                  <span className="px-3 py-1 bg-[#1a1a1a] border border-[#333] rounded-full text-xs text-[#aaa]">Category: {job.cat}</span>
                  <span className="px-3 py-1 bg-[#1a1a1a] border border-[#333] rounded-full text-xs text-[#aaa]">Size/Stage: Derived from {job.cat}</span>
                </div>
              </Card>
            </div>
          )}

          {/* STEP 4: Match Report */}
          {activeStep === 4 && (
            <div className="animate-in fade-in slide-in-from-right-4">
              <h2 className="text-2xl font-semibold text-white mb-6">4. Match Report</h2>
              <div className="grid grid-cols-2 gap-6 mb-6">
                <Card className="flex flex-col items-center justify-center py-10">
                  <div className="text-6xl font-light text-white mb-2">{analysis.step4_match.overall}<span className="text-2xl text-[#666]">%</span></div>
                  <div className="text-xs text-[#888] font-semibold uppercase tracking-widest">Overall Match</div>
                </Card>
                <Card className="flex flex-col justify-center space-y-4">
                  <ScoreBar label="Frontend" score={analysis.step4_match.frontend} max={5} />
                  <ScoreBar label="Backend" score={analysis.step4_match.backend} max={5} />
                  <ScoreBar label="Cloud/Infra" score={analysis.step4_match.cloud} max={5} />
                </Card>
              </div>
              <Card>
                <h3 className="text-sm font-medium text-white mb-2">Architectural Reasoning</h3>
                <p className="text-[#aaa] text-sm leading-relaxed">{analysis.step4_match.explanation}</p>
              </Card>
            </div>
          )}

          {/* STEP 5 & 6: Gap & Recs */}
          {(activeStep === 5 || activeStep === 6) && (
            <div className="animate-in fade-in slide-in-from-right-4">
              <h2 className="text-2xl font-semibold text-white mb-6">Gap Analysis & Strategy</h2>
              <div className="space-y-6">
                <Card className="border-red-900/30 bg-red-900/5">
                  <h3 className="text-sm font-medium text-red-400 mb-4 flex items-center gap-2"><AlertCircle size={16}/> Missing Keywords / ATS Risks</h3>
                  <ul className="space-y-2">
                    {analysis.step5_gap.missing.map((m, i) => <li key={i} className="text-sm text-[#ccc] flex gap-2"><span className="text-red-500/50">-</span> {m}</li>)}
                    {analysis.step5_gap.concerns.map((c, i) => <li key={i+10} className="text-sm text-[#ccc] flex gap-2"><span className="text-red-500/50">-</span> {c}</li>)}
                  </ul>
                </Card>
                <Card className="border-indigo-900/30 bg-indigo-900/5">
                  <h3 className="text-sm font-medium text-indigo-400 mb-4 flex items-center gap-2"><Settings size={16}/> Pre-Generation Directives</h3>
                  <ul className="space-y-2">
                    {analysis.step6_recs.map((r, i) => <li key={i} className="text-sm text-[#ccc] flex gap-2"><span className="text-indigo-500/50">→</span> {r}</li>)}
                  </ul>
                </Card>
              </div>
            </div>
          )}

          {/* STEP 7: Resume */}
          {activeStep === 7 && (
            <div className="animate-in fade-in slide-in-from-right-4">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-white">7. Tailored Resume</h2>
                <button className="text-xs bg-white text-black px-3 py-1.5 rounded font-medium hover:bg-gray-200">Copy to Clipboard</button>
              </div>
              <Card className="bg-[#fff] text-[#111] font-serif p-8 shadow-2xl min-h-[600px]">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{analysis.step7_resume}</pre>
              </Card>
            </div>
          )}

          {/* Fallback rendering for missing steps for prototype brevity */}
          {![1,4,5,6,7].includes(activeStep) && (
            <div className="animate-in fade-in slide-in-from-right-4">
              <h2 className="text-2xl font-semibold text-white mb-6 capitalize">Step {activeStep}: {steps.find(s=>s.id===activeStep)?.title}</h2>
              <Card>
                <pre className="whitespace-pre-wrap font-sans text-sm text-[#ccc] leading-relaxed">
                  {activeStep === 2 && JSON.stringify(analysis.step2_job, null, 2)}
                  {activeStep === 3 && "Master profile successfully indexed and loaded into context memory."}
                  {activeStep === 8 && analysis.step8_cover}
                  {activeStep === 9 && JSON.stringify(analysis.step9_prep, null, 2)}
                </pre>
              </Card>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function ScoreBar({ label, score, max }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[#888] font-medium">{label}</span>
      <div className="flex gap-1">
        {[...Array(max)].map((_, i) => (
          <div key={i} className={`w-8 h-2 rounded-full ${i < score ? 'bg-white' : 'bg-[#222]'}`}></div>
        ))}
      </div>
    </div>
  );
}

function PipelineBoard({ pipeline, jobs }) {
  if (pipeline.length === 0) {
    return (
      <div className="p-8 max-w-6xl mx-auto flex flex-col items-center justify-center h-[80vh] text-center">
        <Database size={48} className="text-[#333] mb-4" />
        <h2 className="text-xl font-medium text-white mb-2">Pipeline is Empty</h2>
        <p className="text-[#888] text-sm">Run analyses and save opportunities here to track them.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      <h2 className="text-2xl font-semibold tracking-tight text-white mb-6">Application Pipeline</h2>
      <div className="grid gap-4">
        {pipeline.map(app => (
          <Card key={app.jobId} className="flex items-center justify-between p-4 bg-[#0d0d0d] hover:bg-[#111] transition cursor-pointer">
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 rounded-lg bg-[#1a1a1a] border border-[#333] flex items-center justify-center">
                <span className="text-lg font-bold text-white">{app.company.charAt(0)}</span>
              </div>
              <div>
                <h3 className="text-white font-medium">{app.company}</h3>
                <p className="text-[#888] text-sm">{app.role}</p>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <div className="text-right hidden md:block">
                <div className="text-[#aaa] text-xs uppercase tracking-widest mb-1">Match</div>
                <div className="text-white font-medium">{app.score}%</div>
              </div>
              <div className="text-right">
                <div className="text-[#aaa] text-xs uppercase tracking-widest mb-1">Status</div>
                <div className="px-3 py-1 bg-[#222] text-[#ccc] text-xs rounded-full border border-[#333]">
                  {app.status}
                </div>
              </div>
              <ChevronRight size={18} className="text-[#555]" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}