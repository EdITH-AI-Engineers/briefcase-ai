import { useEffect, useState } from "react";
import { AlertTriangle, BriefcaseBusiness, CheckCircle2, ExternalLink, FileText, PlayCircle } from "lucide-react";
import { fetchDashboard, fetchRuns, fetchStudentDashboard, fetchStudents, type RunSummary, type StudentSummary } from "./lib/api";
import type { StudentDashboardDto } from "./types/dashboard";
import { ScoreCharts } from "./components/ScoreCharts";
import { Roadmap } from "./components/Roadmap";

function Progress({ value }: { value: number }) {
  return <div className="progress"><span style={{ width: `${value}%` }} /></div>;
}

function ProfilePicker({
  runs,
  students,
  data,
  selectedRunId,
  selectedStudentId,
  onRunChange,
  onStudentChange,
}: {
  runs: RunSummary[];
  students: StudentSummary[];
  data: StudentDashboardDto;
  selectedRunId: string;
  selectedStudentId: string;
  onRunChange: (runId: string) => void;
  onStudentChange: (studentId: string) => void;
}) {
  return (
    <div className="profile-picker">
      <label>
        <span>Run</span>
        <select value={selectedRunId} onChange={(event) => onRunChange(event.target.value)}>
          {runs.map((run) => <option key={run.id} value={run.id}>{run.id} · {run.status}</option>)}
        </select>
      </label>
      <label>
        <span>Fake profile</span>
        <select value={selectedStudentId} onChange={(event) => onStudentChange(event.target.value)}>
          {students.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.program} Y{student.yearLevel ?? "?"}</option>)}
        </select>
      </label>
      <small>{students.length} analyzed profiles · viewing {data.student.id}</small>
    </div>
  );
}

function Dashboard({
  data,
  runs,
  students,
  selectedRunId,
  selectedStudentId,
  onRunChange,
  onStudentChange,
}: {
  data: StudentDashboardDto;
  runs: RunSummary[];
  students: StudentSummary[];
  selectedRunId: string;
  selectedStudentId: string;
  onRunChange: (runId: string) => void;
  onStudentChange: (studentId: string) => void;
}) {
  return (
    <main className="shell">
      <section className="hero">
        <div>
          <ProfilePicker
            runs={runs}
            students={students}
            data={data}
            selectedRunId={selectedRunId}
            selectedStudentId={selectedStudentId}
            onRunChange={onRunChange}
            onStudentChange={onStudentChange}
          />
          <div className="eyebrow"><BriefcaseBusiness size={16} /> Briefcase AI</div>
          <h1>{data.student.name}</h1>
          <p>{data.overview.summary}</p>
        </div>
        <div className="hero-card">
          <span>Profile sparsity</span>
          <strong>{data.student.sparsity}</strong>
          <small>{data.student.program} · Year {data.student.yearLevel ?? "unknown"} · Framework {data.run.frameworkVersion}</small>
        </div>
      </section>

      <section className="overview-grid">
        <div className="score-dial">
          <span>Overall score</span>
          <strong>{data.overview.overallScore}</strong>
          <em>{data.overview.ratingLabel}</em>
          <Progress value={data.overview.overallScore} />
          <small>Compared with ideal year-level score of {data.overview.idealScore}</small>
        </div>
        <div className="panel issues-panel">
          <div>
            <h2>Top issues</h2>
            {data.overview.topIssues.length > 0
              ? data.overview.topIssues.map((issue) => <p key={issue}><AlertTriangle size={15} />{issue}</p>)
              : <p><CheckCircle2 size={15} />No top issues available for this profile.</p>}
          </div>
          <div>
            <h2>Quick fixes</h2>
            {data.overview.quickFixes.length > 0
              ? data.overview.quickFixes.map((fix) => <p key={fix}><CheckCircle2 size={15} />{fix}</p>)
              : <p><CheckCircle2 size={15} />No quick fixes generated yet.</p>}
          </div>
        </div>
      </section>

      <ScoreCharts data={data} />

      <section className="panel competency-list">
        <div className="section-kicker">Diagnosis per competency</div>
        {data.competencies.map((competency) => (
          <article key={competency.name}>
            <div>
              <h3>{competency.name}</h3>
              <p>{competency.diagnosis}</p>
            </div>
            <strong>{competency.level}</strong>
            <Progress value={competency.score} />
          </article>
        ))}
      </section>

      <section className="panel skills-panel">
        <div className="section-kicker">Skills and red flags</div>
        <div className="skill-columns">
          {Object.entries({ Hard: data.skills.hard, Soft: data.skills.soft, Tools: data.skills.tools, Domains: data.skills.domains }).map(([label, skills]) => (
            <div key={label}><h3>{label}</h3>{skills.map((skill) => <span className="tag" key={skill.name}>{skill.name}<b>{skill.rating}</b></span>)}</div>
          ))}
        </div>
        <div className="missing-tags">{data.skills.missing.map((item) => <span key={item}>{item}</span>)}</div>
        <div className="red-flags">{data.skills.redFlags.map((flag) => <p key={flag}><AlertTriangle size={15} />{flag}</p>)}</div>
      </section>

      <Roadmap data={data} />

      <section className="recommendation-grid">
        {data.recommendations.map((rec) => (
          <a className="course-card" href={rec.url} key={rec.title} target="_blank" rel="noreferrer">
            <span>{rec.provider}</span>
            <h3>{rec.title}</h3>
            <p>{rec.reason}</p>
            <small>{rec.relatedCompetency} <ExternalLink size={13} /></small>
          </a>
        ))}
      </section>

      <section className="panel references-panel">
        <div className="section-kicker"><FileText size={15} /> Framework references</div>
        {data.references.map((ref) => <a key={ref.id} href={ref.url} target="_blank" rel="noreferrer">{ref.id}<span>{ref.title}</span></a>)}
      </section>
    </main>
  );
}

function EmptyState() {
  return (
    <main className="shell">
      <section className="empty-state panel">
        <div className="empty-icon"><PlayCircle size={28} /></div>
        <p className="eyebrow">No analysis run found</p>
        <h1>Run the pipeline to populate the dashboard.</h1>
        <p>The API is pointed at real analysis output. Once developers generate synthetic users and analyze them, the latest run appears here automatically.</p>
        <pre>make pipeline</pre>
      </section>
    </main>
  );
}

export function App() {
  const [data, setData] = useState<StudentDashboardDto | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchRuns(), fetchDashboard()])
      .then(async ([nextRuns, latestDashboard]) => {
        setRuns(nextRuns);
        setData(latestDashboard);
        const runId = latestDashboard?.run.id ?? nextRuns[0]?.id ?? "";
        setSelectedRunId(runId);
        setSelectedStudentId(latestDashboard?.student.id ?? "");
        if (runId) setStudents(await fetchStudents(runId));
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  const handleRunChange = (runId: string) => {
    setSelectedRunId(runId);
    setLoading(true);
    fetchStudents(runId)
      .then(async (nextStudents) => {
        setStudents(nextStudents);
        const firstStudent = nextStudents[0];
        setSelectedStudentId(firstStudent?.id ?? "");
        setData(firstStudent ? await fetchStudentDashboard(runId, firstStudent.id) : null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  };

  const handleStudentChange = (studentId: string) => {
    setSelectedStudentId(studentId);
    setLoading(true);
    fetchStudentDashboard(selectedRunId, studentId)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  };

  if (error) return <main className="shell"><div className="panel error">{error}</div></main>;
  if (loading && !data) return <main className="shell"><div className="skeleton hero-skeleton" /><div className="skeleton block-skeleton" /></main>;
  if (!data) return <EmptyState />;
  return (
    <Dashboard
      data={data}
      runs={runs}
      students={students}
      selectedRunId={selectedRunId}
      selectedStudentId={selectedStudentId || data.student.id}
      onRunChange={handleRunChange}
      onStudentChange={handleStudentChange}
    />
  );
}
