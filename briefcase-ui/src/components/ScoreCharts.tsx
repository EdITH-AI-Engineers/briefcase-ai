import { Bar, BarChart, CartesianGrid, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { StudentDashboardDto } from "../types/dashboard";

const shortLabels: Record<string, string> = {
  "Computing Foundations": "Computing",
  "Systems & Infrastructure": "Systems",
  "Data & Information Management": "Data",
  "Security, Ethics & Professional Responsibility": "Security",
  "Professional Communication": "Comms",
  "Collaboration & Teamwork": "Collab",
  "Self-Directed Learning & Innovation": "Self-learn",
};

const shortLabel = (name: string): string =>
  shortLabels[name] ?? name.split(/[,&]/)[0].trim().split(" ").slice(0, 2).join(" ");

const wrapLabel = (name: string): string => name.replace(" & ", "\n& ");

export function ScoreCharts({ data }: { data: StudentDashboardDto }) {
  const chart = data.competencies.map((item) => ({
    name: item.name,
    score: item.score,
    ideal: item.idealScore,
  }));

  return (
    <section className="panel score-grid">
      <div className="section-kicker">Score Distribution</div>
      <div className="chart-card wide">
        <h3>Competency shape</h3>
        <ResponsiveContainer width="100%" height={320}>
          <RadarChart data={chart}>
            <PolarGrid stroke="rgba(15,23,42,.12)" />
            <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: "#475569" }} tickFormatter={wrapLabel} />
            <Tooltip formatter={(value, name) => [`${value}/100`, String(name)]} />
            <Radar dataKey="ideal" name="Ideal score" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.08} />
            <Radar dataKey="score" name="Student score" stroke="#0f766e" fill="#0f766e" fillOpacity={0.32} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-card">
        <h3>Per-competency score</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chart} margin={{ left: -12, right: 12, top: 12, bottom: 0 }} barGap={4}>
            <CartesianGrid vertical={false} stroke="rgba(15,23,42,.08)" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#475569" }}
              tickFormatter={shortLabel}
              tickLine={false}
              interval={0}
              angle={-32}
              textAnchor="end"
              height={64}
            />
            <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
            <Tooltip
              labelFormatter={(label) => String(label)}
              formatter={(value, name) => [`${value}/100`, name === "score" ? "Student score" : "Ideal score"]}
            />
            <Bar dataKey="ideal" name="Ideal score" fill="#94a3b8" fillOpacity={0.22} radius={[6, 6, 0, 0]} />
            <Bar dataKey="score" name="Student score" fill="#0f766e" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
