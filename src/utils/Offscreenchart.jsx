// OffscreenChart.jsx
// Fixed-size chart for PDF capture — no ResponsiveContainer needed.

import React from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    ReferenceLine,
    ReferenceArea,
} from "recharts";

const ACCENT = "#FFC107";
const GRAD_COLORS = [
    "#667eea",
    "#f093fb",
    "#4facfe",
    "#43e97b",
    "#fa709a",
    "#30cfd0",
];
const TH_COLORS = {
    L0: "#4caf50",
    L1: "#ffb300",
    L2: "#e65100",
    L3: "#c62828",
};

export function OffscreenChart({
    data,
    lineKeys,
    thresholds,
    reportType,
    yDomain,
    yTicks,
}) {
    const W = 900;
    const H = 380;
    const isAnnual = reportType === "annually";
    const currentYear = new Date().getFullYear().toString();
    let colorIdx = 0;

    const keys =
        lineKeys?.length > 0 ?
            lineKeys
        :   Object.keys(data[0] || {}).filter((k) => k !== "date");

    const lines = keys.map((key) => {
        let color = ACCENT;
        if (isAnnual) {
            color =
                key === currentYear ? ACCENT : (
                    GRAD_COLORS[colorIdx % GRAD_COLORS.length]
                );
            colorIdx++;
        }
        return (
            <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={color}
                strokeWidth={2}
                dot={
                    reportType === "today" ? false : (
                        { r: 3, fill: color, stroke: "#fff", strokeWidth: 1 }
                    )
                }
                connectNulls={false}
                isAnimationActive={false}
            />
        );
    });

    const sorted = [...(thresholds || [])].sort(
        (a, b) => a.converted_min_level - b.converted_min_level,
    );
    const refs = sorted.map((t, i) => {
        const color = TH_COLORS[t.name] || "#999";
        return (
            <React.Fragment key={t.id ?? i}>
                <ReferenceArea
                    y1={t.converted_min_level}
                    y2={t.converted_max_level}
                    fill={color}
                    fillOpacity={0.06}
                    stroke="none"
                />
                {i > 0 && (
                    <ReferenceLine
                        y={t.converted_min_level}
                        stroke={color}
                        strokeDasharray="5 5"
                        strokeWidth={1}
                        strokeOpacity={0.6}
                    />
                )}
            </React.Fragment>
        );
    });

    return (
        <LineChart
            width={W}
            height={H}
            data={data}
            margin={{ top: 20, right: 40, left: 10, bottom: 50 }}>
            <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e5e7eb"
                vertical={false}
            />
            {refs}
            <XAxis
                dataKey="date"
                angle={-35}
                textAnchor="end"
                tick={{ fontSize: 11, fill: "#6b7280" }}
                interval="preserveStartEnd"
                axisLine={{ stroke: "#d1d5db" }}
                tickLine={{ stroke: "#d1d5db" }}
            />
            <YAxis
                domain={yDomain}
                ticks={yTicks}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                axisLine={{ stroke: "#d1d5db" }}
                tickLine={{ stroke: "#d1d5db" }}
                label={{
                    value: "Water Level (m)",
                    angle: -90,
                    position: "insideLeft",
                    offset: 15,
                    style: { fontSize: 12, fill: "#374151" },
                }}
            />
            {lines}
        </LineChart>
    );
}
