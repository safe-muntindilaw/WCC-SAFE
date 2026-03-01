// ForecastPanel.jsx
import React, { useMemo } from "react";
import { Flex, Typography, Tag, Divider, Table } from "antd";
import {
    computeForecast,
    getThresholdStatus,
    getForecastLabels,
} from "./ForecastEngine";

const { Text } = Typography;

const TH_COLORS = { L0: "green", L1: "gold", L2: "orange", L3: "red" };
const TH_LABELS = {
    L0: "Normal",
    L1: "Advisory",
    L2: "Warning",
    L3: "Critical",
};

function StatCard({ label, value, accent = false }) {
    return (
        <div
            style={{
                flex: "1 1 80px",
                minWidth: 80,
                background: accent ? "#f0f5ff" : "#fafafa",
                border: `1px solid ${accent ? "#d0e0ff" : "#eee"}`,
                borderRadius: 8,
                padding: "10px 12px",
            }}>
            <Text
                style={{
                    fontSize: 10,
                    color: "#aaa",
                    display: "block",
                    marginBottom: 3,
                }}>
                {label}
            </Text>
            <Text
                strong
                style={{ fontSize: 16, color: accent ? "#1e4078" : "#222" }}>
                {value}
            </Text>
        </div>
    );
}

// Produces a single plain-English sentence summarising what the data shows.
function buildSummary({ stats, dataStats, reportType, points }) {
    const period =
        {
            today: "today",
            weekly: "this week",
            monthly: "this month",
            annually: "this year",
        }[reportType] ?? "recently";
    const nextVal = points[0]?.value?.toFixed(2);

    const dirPhrase =
        stats.trendDir === "rising" ? "gradually increasing"
        : stats.trendDir === "falling" ? "gradually decreasing"
        : "relatively stable";

    const changeAbs = Math.abs(dataStats.trend).toFixed(2);
    const changePhrase =
        dataStats.trend >= 0 ?
            `risen by ${changeAbs} m`
        :   `dropped by ${changeAbs} m`;

    return (
        `Water levels ${period} have been ${dirPhrase}, having ${changePhrase} over the displayed period. ` +
        `Based on recent readings, the level for the next period is expected to be around ${nextVal} m.`
    );
}

export function ForecastPanel({
    data,
    dataStats,
    thresholds,
    reportType,
    isMobile,
}) {
    const STEPS = 5;

    const values = useMemo(
        () =>
            data
                .flatMap((d) =>
                    Object.entries(d)
                        .filter(([k]) => k !== "date")
                        .map(([, v]) => v),
                )
                .filter((v) => v !== null && !isNaN(v)),
        [data],
    );

    const forecast = useMemo(
        () => computeForecast(values, STEPS, reportType),
        [values, reportType],
    );
    const forecastLabels = useMemo(
        () => getForecastLabels(data, STEPS, reportType),
        [data, reportType],
    );
    const activeTh = useMemo(
        () => getThresholdStatus(dataStats?.recent, thresholds),
        [dataStats, thresholds],
    );

    if (!forecast.stats || !dataStats) return null;

    const { stats, points } = forecast;

    const summary = buildSummary({ stats, dataStats, reportType, points });

    const columns = [
        {
            title: "Time",
            dataIndex: "period",
            key: "period",
            render: (v) => <Text style={{ fontSize: 12 }}>{v}</Text>,
        },
        {
            title: "Forecast",
            dataIndex: "value",
            key: "value",
            render: (v) => (
                <Text strong style={{ fontSize: 12, color: "#1e4078" }}>
                    {v} m
                </Text>
            ),
        },
        {
            title: "Lowest",
            dataIndex: "lower",
            key: "lower",
            render: (v) => (
                <Text style={{ fontSize: 12, color: "#888" }}>{v} m</Text>
            ),
        },
        {
            title: "Highest",
            dataIndex: "upper",
            key: "upper",
            render: (v) => (
                <Text style={{ fontSize: 12, color: "#888" }}>{v} m</Text>
            ),
        },
    ];

    const tableData = points.map((pt, i) => ({
        key: i,
        period: forecastLabels[i] ?? `+${pt.step}`,
        value: pt.value.toFixed(2),
        lower: pt.lower.toFixed(2),
        upper: pt.upper.toFixed(2),
    }));

    return (
        <div
            style={{
                borderTop: "1px solid #eee",
                paddingTop: 16,
                marginTop: 8,
                animation: "fadeSlideIn 0.2s ease",
            }}>
            {/* ── Current Summary ──────────────────────────────────────────── */}
            <Flex
                align="center"
                justify="space-between"
                style={{ marginBottom: 10 }}>
                <Text
                    style={{
                        fontSize: 11,
                        color: "#aaa",
                        fontWeight: 600,
                        letterSpacing: 0.5,
                    }}>
                    CURRENT SUMMARY
                </Text>
                {activeTh && (
                    <Tag color={TH_COLORS[activeTh.name]} style={{ margin: 0 }}>
                        {TH_LABELS[activeTh.name] ?? activeTh.name} ·{" "}
                        {dataStats.recent.toFixed(2)} m
                    </Tag>
                )}
            </Flex>

            <Flex gap={6} wrap="wrap" style={{ marginBottom: 14 }}>
                <StatCard
                    label="Current Level"
                    value={`${dataStats.recent.toFixed(2)} m`}
                    accent
                />
                <StatCard
                    label="Highest"
                    value={`${dataStats.max.toFixed(2)} m`}
                />
                <StatCard
                    label="Lowest"
                    value={`${dataStats.min.toFixed(2)} m`}
                />
                <StatCard
                    label="Average"
                    value={`${dataStats.avg.toFixed(2)} m`}
                />
                <StatCard
                    label="Overall Change"
                    value={`${dataStats.trend >= 0 ? "+" : ""}${dataStats.trend.toFixed(2)} m`}
                />
            </Flex>

            <Divider style={{ margin: "0 0 14px" }} />

            {/* ── Plain-language summary ────────────────────────────────────── */}
            <Flex align="flex-start" gap={8} style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 13, color: "#444", lineHeight: 1.7 }}>
                    {summary}
                </Text>
            </Flex>

            <Divider style={{ margin: "0 0 14px" }} />

            {/* ── Forecast Table ────────────────────────────────────────────── */}
            <Text
                style={{
                    fontSize: 11,
                    color: "#aaa",
                    fontWeight: 600,
                    letterSpacing: 0.5,
                    display: "block",
                    marginBottom: 10,
                }}>
                UPCOMING FORECAST
            </Text>

            <Table
                columns={columns}
                dataSource={tableData}
                pagination={false}
                size="small"
            />

            <style>{`
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateY(-6px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
