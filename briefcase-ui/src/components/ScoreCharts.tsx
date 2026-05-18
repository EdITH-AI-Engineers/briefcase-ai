import { Area, AreaChart, CartesianGrid, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { StudentDashboardDto } from "../types/dashboard";

export function ScoreCharts({ data }: { data: StudentDashboardDto }) {
  const chart = data.competencies.map((item) => ({
    name: item.name.replace(" & ", "\n& "),
    score: item.score,
    ideal: item.idealScore,
  }));
  const area = chart.map((item, index) => ({ index: index + 1, score: item.score, ideal: item.ideal }));

  return (
    <section className="panel score-grid">
      <div className="section-kicker">Score Distribution</div>
      <div className="chart-card wide">
        <h3>Competency shape</h3>
        <ResponsiveContainer width="100%" height={320}>
          <RadarChart data={chart}>
            <PolarGrid stroke="rgba(15,23,42,.12)" />
            <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: "#475569" }} />
            <Tooltip formatter={(value, name) => [`${value}/100`, String(name)]} />
            <Radar dataKey="ideal" name="Ideal score" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.08} />
            <Radar dataKey="score" name="Student score" stroke="#0f766e" fill="#0f766e" fillOpacity={0.32} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-card">
        <h3>Score path</h3>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={area} margin={{ left: -18, right: 12, top: 12 }}>
            <defs>
              <linearGradient id="scoreFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#0f766e" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#0f766e" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(15,23,42,.08)" />
            <XAxis dataKey="index" tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
            <Tooltip formatter={(value, name) => [`${value}/100`, name === "score" ? "Student score" : "Ideal score"]} />
            <Area type="monotone" dataKey="ideal" stroke="#94a3b8" fill="transparent" strokeDasharray="4 4" />
            <Area type="monotone" dataKey="score" stroke="#0f766e" fill="url(#scoreFill)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
