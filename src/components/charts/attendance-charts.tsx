"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Warna dipetakan konsisten per status; legenda selalu memuat teks sehingga tidak bergantung pada warna saja. */
export const STATUS_COLOR: Record<string, string> = {
  present: "#16865B",
  late: "#D99124",
  sick: "#3985C8",
  permission: "#3478D4",
  official_activity: "#64748B",
  unexcused: "#D64B4B",
  unverified: "#A8B3C2",
};

export type DonutDatum = { key: string; label: string; value: number };

export function DistributionDonut({ data }: { data: DonutDatum[] }) {
  const visible = data.filter((d) => d.value > 0);
  return (
    <div className="h-64 w-full" role="img" aria-label={`Distribusi kehadiran: ${visible.map((d) => `${d.label} ${d.value}`).join(", ")}`}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={visible} dataKey="value" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={2}>
            {visible.map((d) => (
              <Cell key={d.key} fill={STATUS_COLOR[d.key] ?? "#A8B3C2"} />
            ))}
          </Pie>
          <Tooltip />
          <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export type TrendDatum = { label: string; rate: number | null };

export function TrendLine({ data }: { data: TrendDatum[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Tren persentase kehadiran harian">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="#E5EAF0" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} axisLine={false} unit="%" />
          <Tooltip formatter={(v) => (v === null || v === undefined ? "-" : `${v}%`)} />
          <Line type="monotone" dataKey="rate" name="Kehadiran" stroke="#3478D4" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export type ClassBarDatum = { name: string; hadir: number; terlambat: number; tidak_hadir: number };

export function ClassBars({ data }: { data: ClassBarDatum[] }) {
  return (
    <div className="h-72 w-full" role="img" aria-label="Ringkasan kehadiran per kelas">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="#E5EAF0" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} axisLine={false} />
          <Tooltip />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="hadir" name="Hadir" stackId="a" fill={STATUS_COLOR.present} />
          <Bar dataKey="terlambat" name="Terlambat" stackId="a" fill={STATUS_COLOR.late} />
          <Bar dataKey="tidak_hadir" name="Tidak hadir / belum tercatat" stackId="a" fill="#CBD5E1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
