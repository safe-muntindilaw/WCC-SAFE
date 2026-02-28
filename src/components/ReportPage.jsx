// ReportPage.jsx — fully self-contained
// Includes: chart, AI insights (Claude API, streaming), PDF export (jsPDF + html2canvas)
import React, {
    useEffect,
    useState,
    useCallback,
    useMemo,
    useRef,
} from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine,
    ReferenceArea,
} from "recharts";
import {
    Typography,
    Select,
    DatePicker,
    Space,
    Button,
    Spin,
    Radio,
    Card,
    Empty,
    Row,
    Col,
    Drawer,
    Flex,
    Badge,
    Tag,
    Collapse,
    Alert,
} from "antd";
import {
    ReloadOutlined,
    LineChartOutlined,
    FilterOutlined,
    CloseOutlined,
    RiseOutlined,
    FallOutlined,
    LoadingOutlined,
    RobotOutlined,
    ThunderboltOutlined,
    WarningOutlined,
    CheckCircleOutlined,
    ArrowUpOutlined,
    ArrowDownOutlined,
    MinusOutlined,
    FilePdfOutlined,
} from "@ant-design/icons";
import { supabase } from "@/globals";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { THEME, cardStyleAdaptive } from "@/utils/theme";
import { showError, showWarning } from "@/utils/notifications";
import { useResponsive } from "@/utils/useResponsive";

dayjs.extend(isoWeek);

const { Title, Text } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

const ACCENT_COLOR = THEME.ACCENT_YELLOW;
const GRADIENT_COLORS = [
    { start: "#667eea", end: "#764ba2" },
    { start: "#f093fb", end: "#f5576c" },
    { start: "#4facfe", end: "#00f2fe" },
    { start: "#43e97b", end: "#38f9d7" },
    { start: "#fa709a", end: "#fee140" },
    { start: "#30cfd0", end: "#330867" },
    { start: "#a8edea", end: "#fed6e3" },
    { start: "#ff9a9e", end: "#fecfef" },
];

const MONTH_ORDER = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

const getStatusColor = (statusName) => {
    const colors = {
        L0: THEME.GREEN_SAFE,
        L1: THEME.YELLOW_NORMAL,
        L2: THEME.ORANGE_ALERT,
        L3: THEME.RED_CRITICAL,
    };
    return colors[statusName] || THEME.BLUE_AUTHORITY;
};

// ─── averaging helpers ────────────────────────────────────────────────────────

const averageBy = (readings, keyFn) => {
    const grouped = readings.reduce((acc, r) => {
        const key = keyFn(r);
        acc[key] ??= { sum: 0, count: 0 };
        acc[key].sum += parseFloat(r.converted_water_level);
        acc[key].count++;
        return acc;
    }, {});
    return Object.entries(grouped).map(([key, val]) => ({
        date: key,
        "Water Level": +(val.sum / val.count).toFixed(2),
    }));
};
const averageByDay = (readings) =>
    averageBy(readings, (r) => dayjs(r.created_at).format("ddd"));
const averageByDayOfMonth = (readings) =>
    averageBy(readings, (r) => dayjs(r.created_at).format("MMM DD"));
const averageByWeek = (readings) =>
    averageBy(
        readings,
        (r) => `Week ${Math.ceil(dayjs(r.created_at).date() / 7)}`,
    );

// ─── PDF colour helpers ───────────────────────────────────────────────────────

const PDF_COLORS = {
    primary: [15, 60, 120],
    accent: [251, 188, 5],
    success: [16, 185, 129],
    warning: [245, 158, 11],
    danger: [239, 68, 68],
    info: [59, 130, 246],
    muted: [107, 114, 128],
    light: [249, 250, 251],
    white: [255, 255, 255],
    border: [229, 231, 235],
};

const severityRgb = (s) =>
    ({
        critical: PDF_COLORS.danger,
        warning: PDF_COLORS.warning,
        normal: PDF_COLORS.success,
        info: PDF_COLORS.info,
    })[s] ?? PDF_COLORS.muted;

async function generatePDF({
    chartRef,
    data,
    dataStats,
    insights,
    thresholds,
    reportType,
    chartTitle,
    chartSubtitle,
    currentLevel,
}) {
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
    ]);

    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    });
    const PAGE_W = 210,
        PAGE_H = 297,
        MARGIN = 14;
    const CONTENT_W = PAGE_W - MARGIN * 2;
    let cy = 0;

    const pRect = (x, y, w, h, rgb, style = "F") => {
        doc.setFillColor(...rgb);
        doc.rect(x, y, w, h, style);
    };
    const pRRect = (x, y, w, h, r, rgb, style = "F") => {
        doc.setFillColor(...rgb);
        doc.setDrawColor(...rgb);
        doc.roundedRect(x, y, w, h, r, r, style);
    };
    const pHLine = (x1, x2, y, rgb, lw = 0.3) => {
        doc.setLineWidth(lw);
        doc.setDrawColor(...rgb);
        doc.line(x1, y, x2, y);
    };
    const pText = (str, x, y, opts = {}) => doc.text(String(str), x, y, opts);
    const pFont = (rgb) => doc.setTextColor(...rgb);

    // ── cover header ──
    pRect(0, 0, PAGE_W, 52, PDF_COLORS.primary);
    pRect(0, 52, PAGE_W, 2, PDF_COLORS.accent);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    pFont(PDF_COLORS.white);
    pText("Water Level Monitoring Report", MARGIN, 22);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    pFont([200, 220, 255]);
    pText(chartTitle, MARGIN, 32);
    doc.setFontSize(9);
    pFont([160, 190, 230]);
    pText(chartSubtitle, MARGIN, 39);
    pText(
        `Generated: ${dayjs().format("MMMM D, YYYY [at] h:mm A")}`,
        PAGE_W - MARGIN,
        46,
        { align: "right" },
    );

    cy = 62;

    // ── KPI cards ──
    const stats = [
        {
            label: "Current",
            value: currentLevel != null ? `${currentLevel.toFixed(2)} m` : "—",
            color: PDF_COLORS.primary,
        },
        {
            label: "Peak",
            value: dataStats ? `${dataStats.max.toFixed(2)} m` : "—",
            color: PDF_COLORS.danger,
        },
        {
            label: "Average",
            value: dataStats ? `${dataStats.avg.toFixed(2)} m` : "—",
            color: PDF_COLORS.info,
        },
        {
            label: "Lowest",
            value: dataStats ? `${dataStats.min.toFixed(2)} m` : "—",
            color: PDF_COLORS.success,
        },
        {
            label: "Trend",
            value:
                dataStats ?
                    `${dataStats.trend >= 0 ? "+" : ""}${dataStats.trend.toFixed(2)} m`
                :   "—",
            color:
                dataStats?.trend >= 0 ? PDF_COLORS.danger : PDF_COLORS.success,
        },
        {
            label: "Forecast",
            value: dataStats ? `${dataStats.prediction.toFixed(2)} m` : "—",
            color: [124, 58, 237],
        },
    ];
    const cw = (CONTENT_W - 5 * 3) / 6;
    stats.forEach((s, i) => {
        const cx = MARGIN + i * (cw + 3);
        pRRect(cx, cy, cw, 20, 2, PDF_COLORS.light);
        pRRect(cx, cy, cw, 3, 0, s.color);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        pFont(s.color);
        pText(s.label.toUpperCase(), cx + cw / 2, cy + 9, { align: "center" });
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        pFont(PDF_COLORS.primary);
        pText(s.value, cx + cw / 2, cy + 17, { align: "center" });
    });
    cy += 28;

    // ── threshold legend ──
    if (thresholds.length) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        pFont(PDF_COLORS.primary);
        pText("Alert Thresholds", MARGIN, cy);
        cy += 5;
        const thC = {
            L0: PDF_COLORS.success,
            L1: PDF_COLORS.warning,
            L2: [251, 146, 60],
            L3: PDF_COLORS.danger,
        };
        thresholds.forEach((t, i) => {
            const tx = MARGIN + i * 46,
                tc = thC[t.name] ?? PDF_COLORS.muted;
            pRRect(tx, cy, 43, 10, 2, [...tc, 20]);
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            pFont(tc);
            pText(t.name, tx + 4, cy + 4.5);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            pFont(PDF_COLORS.muted);
            pText(
                `${t.converted_min_level}m – ${t.converted_max_level}m`,
                tx + 4,
                cy + 8.5,
            );
        });
        cy += 17;
    }

    // ── chart image ──
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    pFont(PDF_COLORS.primary);
    pText("Water Level Chart", MARGIN, cy);
    cy += 3;
    if (chartRef?.current) {
        try {
            const canvas = await html2canvas(chartRef.current, {
                scale: 2,
                backgroundColor: "#ffffff",
                logging: false,
                useCORS: true,
            });
            const imgData = canvas.toDataURL("image/png");
            const imgH = Math.min(
                (canvas.height / canvas.width) * CONTENT_W,
                70,
            );
            doc.setDrawColor(...PDF_COLORS.border);
            doc.setLineWidth(0.3);
            doc.roundedRect(MARGIN - 1, cy, CONTENT_W + 2, imgH + 2, 3, 3, "D");
            doc.addImage(imgData, "PNG", MARGIN, cy + 1, CONTENT_W, imgH - 2);
            cy += imgH + 8;
        } catch {
            cy += 4;
        }
    }

    // ── data table ──
    if (data.length > 0 && reportType !== "today") {
        const tableData = data.slice(-20);
        const colKey = Object.keys(tableData[0]).filter((k) => k !== "date");
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        pFont(PDF_COLORS.primary);
        pText("Data Summary", MARGIN, cy);
        cy += 4;
        const colW = CONTENT_W / (colKey.length + 1);
        pRect(MARGIN, cy, CONTENT_W, 6, PDF_COLORS.primary);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        pFont(PDF_COLORS.white);
        pText("Period", MARGIN + 2, cy + 4);
        colKey.forEach((k, i) => pText(k, MARGIN + colW * (i + 1) + 2, cy + 4));
        cy += 6;
        tableData.forEach((row, ri) => {
            pRect(
                MARGIN,
                cy,
                CONTENT_W,
                5.5,
                ri % 2 === 0 ? PDF_COLORS.white : PDF_COLORS.light,
            );
            doc.setFontSize(7);
            doc.setFont("helvetica", "normal");
            pFont(PDF_COLORS.primary);
            pText(String(row.date), MARGIN + 2, cy + 3.8);
            colKey.forEach((k, i) => {
                const v = row[k],
                    d =
                        v != null && !isNaN(v) ?
                            `${Number(v).toFixed(2)} m`
                        :   "—";
                pText(d, MARGIN + colW * (i + 1) + 2, cy + 3.8);
            });
            cy += 5.5;
        });
        if (data.length > 20) {
            doc.setFontSize(7);
            pFont(PDF_COLORS.muted);
            pText(`… and ${data.length - 20} more data points`, MARGIN, cy + 4);
            cy += 8;
        } else cy += 4;
    }

    // ── AI insights page ──
    if (insights) {
        doc.addPage();
        cy = MARGIN;
        pRect(0, 0, PAGE_W, 16, PDF_COLORS.primary);
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        pFont(PDF_COLORS.white);
        pText("AI-Powered Analysis", MARGIN, 10.5);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        pFont([160, 190, 230]);
        pText(
            "Generated by Claude · For informational purposes only",
            PAGE_W - MARGIN,
            10.5,
            { align: "right" },
        );
        cy = 24;

        // summary card
        const sr = severityRgb(insights.severity);
        pRRect(MARGIN, cy, CONTENT_W, 22, 3, [...sr, 15]);
        doc.setLineWidth(0.5);
        doc.setDrawColor(...sr, 80);
        doc.roundedRect(MARGIN, cy, CONTENT_W, 22, 3, 3, "D");
        // severity badge
        const bw = doc.getStringUnitWidth(insights.severity) * 7 * 0.352 + 6;
        pRRect(MARGIN + 4, cy + 3, bw, 6, 1.5, [...sr, 30]);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        pFont(sr);
        pText(insights.severity.toUpperCase(), MARGIN + 7, cy + 7.5);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        pFont(PDF_COLORS.primary);
        const sl = doc.splitTextToSize(insights.summary, CONTENT_W - 8);
        pText(sl, MARGIN + 4, cy + 14);
        cy += 28;

        // findings
        if (insights.findings?.length) {
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            pFont(PDF_COLORS.primary);
            pText("Key Findings", MARGIN, cy);
            cy += 5;
            insights.findings.forEach((f) => {
                const fr = severityRgb(f.severity);
                doc.setFillColor(...fr);
                doc.rect(MARGIN, cy, 2, 14, "F");
                pRRect(MARGIN + 3, cy, CONTENT_W - 3, 14, 2, PDF_COLORS.light);
                doc.setFontSize(8.5);
                doc.setFont("helvetica", "bold");
                pFont(PDF_COLORS.primary);
                pText(f.title, MARGIN + 7, cy + 5.5);
                doc.setFontSize(7.5);
                doc.setFont("helvetica", "normal");
                pFont(PDF_COLORS.muted);
                const fl = doc.splitTextToSize(f.detail, CONTENT_W - 12);
                pText(fl[0] ?? "", MARGIN + 7, cy + 10.5);
                cy += 16;
            });
            cy += 2;
        }

        // trend + prediction
        const hw = (CONTENT_W - 4) / 2;
        pRRect(MARGIN, cy, hw, 28, 3, [240, 249, 255]);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        pFont(PDF_COLORS.info);
        pText("TREND ANALYSIS", MARGIN + 4, cy + 6);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        pFont(PDF_COLORS.primary);
        pText(
            doc.splitTextToSize(insights.trend_analysis, hw - 8),
            MARGIN + 4,
            cy + 12,
        );

        pRRect(MARGIN + hw + 4, cy, hw, 28, 3, [250, 245, 255]);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        pFont([124, 58, 237]);
        pText("PREDICTION", MARGIN + hw + 8, cy + 6);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        pFont(PDF_COLORS.primary);
        pText(
            doc.splitTextToSize(insights.prediction_note, hw - 8),
            MARGIN + hw + 8,
            cy + 12,
        );
        cy += 34;

        // recommendations
        if (insights.recommendations?.length) {
            const rh = 8 + insights.recommendations.length * 8;
            pRRect(MARGIN, cy, CONTENT_W, rh, 3, [240, 253, 244]);
            doc.setLineWidth(0.5);
            doc.setDrawColor(...[187, 247, 208]);
            doc.roundedRect(MARGIN, cy, CONTENT_W, rh, 3, 3, "D");
            doc.setFontSize(8.5);
            doc.setFont("helvetica", "bold");
            pFont([21, 128, 61]);
            pText("Recommended Actions", MARGIN + 4, cy + 6);
            cy += 10;
            insights.recommendations.forEach((r, i) => {
                doc.setFillColor(21, 128, 61);
                doc.circle(MARGIN + 6, cy + 1.5, 2, "F");
                doc.setFontSize(7);
                pFont(PDF_COLORS.white);
                doc.setFont("helvetica", "bold");
                pText(String(i + 1), MARGIN + 6, cy + 2.5, { align: "center" });
                doc.setFontSize(7.5);
                doc.setFont("helvetica", "normal");
                pFont([22, 101, 52]);
                pText(
                    doc.splitTextToSize(r, CONTENT_W - 16)[0] ?? "",
                    MARGIN + 12,
                    cy + 2.5,
                );
                cy += 8;
            });
            cy += 6;
        }

        doc.setFontSize(7.5);
        pFont(PDF_COLORS.muted);
        doc.setFont("helvetica", "normal");
        pText(
            `Data Quality: ${insights.data_quality}   ·   AI Confidence: ${Math.round((insights.confidence ?? 0) * 100)}%   ·   Report: ${reportType}`,
            MARGIN,
            cy + 4,
        );
    }

    // ── footer every page ──
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        pRect(0, PAGE_H - 10, PAGE_W, 10, PDF_COLORS.primary);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        pFont([160, 190, 230]);
        pText(
            "Water Level Monitoring System · Confidential",
            MARGIN,
            PAGE_H - 3.5,
        );
        pText(`Page ${p} of ${total}`, PAGE_W - MARGIN, PAGE_H - 3.5, {
            align: "right",
        });
    }

    doc.save(`water-level-report-${dayjs().format("YYYY-MM-DD-HHmm")}.pdf`);
}

// ─── AI severity helpers ──────────────────────────────────────────────────────

const getSeverityColor = (s) =>
    ({
        critical: "#ef4444",
        warning: "#f59e0b",
        normal: "#10b981",
        info: "#3b82f6",
    })[s] ?? "#6b7280";

const getSeverityIcon = (s) =>
    ({
        critical: <WarningOutlined style={{ color: "#ef4444" }} />,
        warning: <WarningOutlined style={{ color: "#f59e0b" }} />,
        normal: <CheckCircleOutlined style={{ color: "#10b981" }} />,
        info: <ThunderboltOutlined style={{ color: "#3b82f6" }} />,
    })[s] ?? <MinusOutlined />;

const getTrendIcon = (trend) =>
    trend > 0.05 ?
        <ArrowUpOutlined style={{ color: "#ef4444", fontSize: 12 }} />
    : trend < -0.05 ?
        <ArrowDownOutlined style={{ color: "#10b981", fontSize: 12 }} />
    :   <MinusOutlined style={{ color: "#6b7280", fontSize: 12 }} />;

// ─── StreamingCursor ──────────────────────────────────────────────────────────

const StreamingText = React.memo(({ text, isStreaming }) => {
    const lines = text.split("\n").filter(Boolean);
    return (
        <div style={{ lineHeight: 1.7 }}>
            {lines.map((line, i) => {
                const parts = line.split(/(\*\*[^*]+\*\*)/g);
                return (
                    <p key={i} style={{ margin: "4px 0" }}>
                        {parts.map((part, j) =>
                            part.startsWith("**") && part.endsWith("**") ?
                                <strong key={j}>{part.slice(2, -2)}</strong>
                            :   <span key={j}>{part}</span>,
                        )}
                        {isStreaming && i === lines.length - 1 && (
                            <span
                                style={{
                                    display: "inline-block",
                                    width: 8,
                                    height: 14,
                                    background: THEME.BLUE_PRIMARY,
                                    marginLeft: 2,
                                    borderRadius: 2,
                                    animation: "blink 1s step-end infinite",
                                }}
                            />
                        )}
                    </p>
                );
            })}
            <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
        </div>
    );
});
StreamingText.displayName = "StreamingText";

// ─── AIInsightsPanel ─────────────────────────────────────────────────────────

const AIInsightsPanel = React.memo(
    ({
        data,
        dataStats,
        thresholds,
        reportType,
        currentLevel,
        chartTitle,
        onInsightsReady,
    }) => {
        const [insights, setInsights] = useState(null);
        const [rawText, setRawText] = useState("");
        const [isStreaming, setIsStreaming] = useState(false);
        const [error, setError] = useState(null);
        const [hasAnalyzed, setHasAnalyzed] = useState(false);
        const abortRef = useRef(null);

        const runAnalysis = useCallback(async () => {
            if (!data?.length || !dataStats) return;
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            setIsStreaming(true);
            setError(null);
            setRawText("");
            setInsights(null);

            const step = Math.max(1, Math.floor(data.length / 30));
            const sample = data
                .filter((_, i) => i % step === 0)
                .map((d) => {
                    const v =
                        d["Water Level"] ??
                        Object.values(d).find((v) => typeof v === "number");
                    return `${d.date}:${v}m`;
                });

            const thSummary = (thresholds || [])
                .map(
                    (t) =>
                        `${t.name}(${t.converted_min_level}m–${t.converted_max_level}m)`,
                )
                .join(", ");

            const prompt = `You are an expert flood monitoring analyst. Analyze the following water level data and return ONLY valid JSON.

Context:
- Report: ${reportType} | Chart: ${chartTitle}
- Current: ${currentLevel?.toFixed(2) ?? "N/A"}m
- Stats: max=${dataStats.max.toFixed(2)}m min=${dataStats.min.toFixed(2)}m avg=${dataStats.avg.toFixed(2)}m trend=${dataStats.trend >= 0 ? "+" : ""}${dataStats.trend.toFixed(2)}m prediction=${dataStats.prediction.toFixed(2)}m
- Thresholds: ${thSummary || "None"}
- Data (${sample.length}/${data.length} pts): ${sample.join(" | ")}

Return ONLY this JSON shape (no markdown, no extra text):
{"summary":"...","severity":"normal|info|warning|critical","findings":[{"title":"...","detail":"...","severity":"..."}],"recommendations":["..."],"trend_analysis":"...","prediction_note":"...","data_quality":"good|fair|poor","confidence":0.0}`;

            try {
                const response = await fetch(
                    "https://api.anthropic.com/v1/messages",
                    {
                        method: "POST",
                        signal: controller.signal,
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            model: "claude-sonnet-4-20250514",
                            max_tokens: 1000,
                            stream: true,
                            messages: [{ role: "user", content: prompt }],
                        }),
                    },
                );

                if (!response.ok) throw new Error(`API ${response.status}`);
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    for (const line of decoder
                        .decode(value, { stream: true })
                        .split("\n")) {
                        if (!line.startsWith("data: ")) continue;
                        const d = line.slice(6).trim();
                        if (d === "[DONE]") continue;
                        try {
                            const ev = JSON.parse(d);
                            if (
                                ev.type === "content_block_delta" &&
                                ev.delta?.text
                            ) {
                                buffer += ev.delta.text;
                                setRawText(buffer);
                            }
                        } catch {}
                    }
                }

                try {
                    const clean = buffer
                        .replace(/^```json\s*/i, "")
                        .replace(/```$/, "")
                        .trim();
                    const parsed = JSON.parse(clean);
                    setInsights(parsed);
                    onInsightsReady?.(parsed);
                } catch {
                    setError("AI returned an unexpected format. Please retry.");
                }
            } catch (err) {
                if (err.name !== "AbortError")
                    setError("Failed to reach AI service.");
            } finally {
                setIsStreaming(false);
                setHasAnalyzed(true);
            }
        }, [
            data,
            dataStats,
            thresholds,
            reportType,
            currentLevel,
            chartTitle,
            onInsightsReady,
        ]);

        return (
            <Card
                style={{
                    borderRadius: 16,
                    border: `1.5px solid ${THEME.BLUE_PRIMARY}22`,
                    boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
                    overflow: "hidden",
                }}
                styles={{ body: { padding: 0 } }}>
                {/* header */}
                <div
                    style={{
                        background: `linear-gradient(135deg,${THEME.BLUE_PRIMARY} 0%,#1e3a5f 100%)`,
                        padding: "16px 20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}>
                    <Space size={10}>
                        <RobotOutlined
                            style={{ color: "#fff", fontSize: 20 }}
                        />
                        <div>
                            <Title
                                level={5}
                                style={{
                                    color: "#fff",
                                    margin: 0,
                                    lineHeight: 1.2,
                                }}>
                                AI Insights
                            </Title>
                            <Text
                                style={{
                                    color: "rgba(255,255,255,0.65)",
                                    fontSize: 11,
                                }}>
                                Powered by Claude
                            </Text>
                        </div>
                    </Space>
                    <Button
                        size="small"
                        icon={
                            isStreaming ?
                                <Spin size="small" />
                            :   <ReloadOutlined />
                        }
                        onClick={runAnalysis}
                        disabled={!data?.length || !dataStats || isStreaming}
                        style={{
                            background: "rgba(255,255,255,0.15)",
                            border: "1px solid rgba(255,255,255,0.3)",
                            color: "#fff",
                            borderRadius: 8,
                        }}>
                        {hasAnalyzed ? "Re-analyze" : "Analyze"}
                    </Button>
                </div>

                <div style={{ padding: "16px 20px" }}>
                    {/* empty state */}
                    {!hasAnalyzed && !isStreaming && (
                        <div
                            style={{
                                textAlign: "center",
                                padding: "24px 0",
                                color: "#9ca3af",
                            }}>
                            <RobotOutlined
                                style={{
                                    fontSize: 36,
                                    marginBottom: 8,
                                    display: "block",
                                }}
                            />
                            <Text type="secondary">
                                Click <strong>Analyze</strong> for AI-powered
                                insights on <em>{chartTitle}</em>
                            </Text>
                        </div>
                    )}

                    {/* streaming */}
                    {isStreaming && !insights && (
                        <div style={{ fontSize: 13, color: "#374151" }}>
                            <StreamingText
                                text={rawText || "Analyzing data…"}
                                isStreaming
                            />
                        </div>
                    )}

                    {/* error */}
                    {error && (
                        <Alert
                            type="error"
                            message={error}
                            showIcon
                            style={{ borderRadius: 10, marginBottom: 12 }}
                        />
                    )}

                    {/* results */}
                    {insights && (
                        <Space
                            direction="vertical"
                            size={14}
                            style={{ width: "100%" }}>
                            {/* summary */}
                            <div
                                style={{
                                    background: `${getSeverityColor(insights.severity)}11`,
                                    border: `1px solid ${getSeverityColor(insights.severity)}33`,
                                    borderRadius: 10,
                                    padding: "12px 14px",
                                }}>
                                <Space size={8} align="start">
                                    <span style={{ fontSize: 18 }}>
                                        {getSeverityIcon(insights.severity)}
                                    </span>
                                    <div>
                                        <Tag
                                            color={getSeverityColor(
                                                insights.severity,
                                            )}
                                            style={{
                                                borderRadius: 6,
                                                fontWeight: 700,
                                                textTransform: "uppercase",
                                                fontSize: 10,
                                                marginBottom: 6,
                                            }}>
                                            {insights.severity}
                                        </Tag>
                                        <Text
                                            style={{
                                                fontSize: 13,
                                                display: "block",
                                                color: "#1f2937",
                                            }}>
                                            {insights.summary}
                                        </Text>
                                    </div>
                                </Space>
                            </div>

                            {/* findings */}
                            {insights.findings?.length > 0 && (
                                <Collapse ghost defaultActiveKey={["findings"]}>
                                    <Panel
                                        header={
                                            <Text
                                                strong
                                                style={{ fontSize: 13 }}>
                                                Key Findings (
                                                {insights.findings.length})
                                            </Text>
                                        }
                                        key="findings">
                                        <Space
                                            direction="vertical"
                                            size={8}
                                            style={{ width: "100%" }}>
                                            {insights.findings.map((f, i) => (
                                                <div
                                                    key={i}
                                                    style={{
                                                        display: "flex",
                                                        gap: 10,
                                                        alignItems:
                                                            "flex-start",
                                                        padding: "8px 10px",
                                                        background: "#f9fafb",
                                                        borderRadius: 8,
                                                        borderLeft: `3px solid ${getSeverityColor(f.severity)}`,
                                                    }}>
                                                    <span
                                                        style={{
                                                            marginTop: 1,
                                                        }}>
                                                        {getSeverityIcon(
                                                            f.severity,
                                                        )}
                                                    </span>
                                                    <div>
                                                        <Text
                                                            strong
                                                            style={{
                                                                fontSize: 12,
                                                            }}>
                                                            {f.title}
                                                        </Text>
                                                        <br />
                                                        <Text
                                                            type="secondary"
                                                            style={{
                                                                fontSize: 12,
                                                            }}>
                                                            {f.detail}
                                                        </Text>
                                                    </div>
                                                </div>
                                            ))}
                                        </Space>
                                    </Panel>
                                </Collapse>
                            )}

                            <div
                                style={{
                                    borderTop: "1px solid #e5e7eb",
                                    margin: "4px 0",
                                }}
                            />

                            {/* trend + prediction */}
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr",
                                    gap: 10,
                                }}>
                                <div
                                    style={{
                                        background: "#f0f9ff",
                                        borderRadius: 10,
                                        padding: "10px 12px",
                                    }}>
                                    <Space size={4}>
                                        {getTrendIcon(dataStats?.trend ?? 0)}
                                        <Text
                                            strong
                                            style={{
                                                fontSize: 11,
                                                color: "#0369a1",
                                            }}>
                                            TREND
                                        </Text>
                                    </Space>
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            display: "block",
                                            marginTop: 4,
                                            color: "#1f2937",
                                        }}>
                                        {insights.trend_analysis}
                                    </Text>
                                </div>
                                <div
                                    style={{
                                        background: "#faf5ff",
                                        borderRadius: 10,
                                        padding: "10px 12px",
                                    }}>
                                    <Space size={4}>
                                        <ThunderboltOutlined
                                            style={{
                                                color: "#7c3aed",
                                                fontSize: 12,
                                            }}
                                        />
                                        <Text
                                            strong
                                            style={{
                                                fontSize: 11,
                                                color: "#7c3aed",
                                            }}>
                                            PREDICTION
                                        </Text>
                                    </Space>
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            display: "block",
                                            marginTop: 4,
                                            color: "#1f2937",
                                        }}>
                                        {insights.prediction_note}
                                    </Text>
                                </div>
                            </div>

                            {/* recommendations */}
                            {insights.recommendations?.length > 0 && (
                                <div
                                    style={{
                                        background: "#f0fdf4",
                                        border: "1px solid #bbf7d0",
                                        borderRadius: 10,
                                        padding: "12px 14px",
                                    }}>
                                    <Text
                                        strong
                                        style={{
                                            fontSize: 12,
                                            color: "#15803d",
                                            display: "block",
                                            marginBottom: 6,
                                        }}>
                                        RECOMMENDED ACTIONS
                                    </Text>
                                    {insights.recommendations.map((r, i) => (
                                        <div
                                            key={i}
                                            style={{
                                                display: "flex",
                                                gap: 8,
                                                marginBottom: 4,
                                            }}>
                                            <Text
                                                style={{
                                                    color: "#15803d",
                                                    fontWeight: 700,
                                                }}>
                                                {i + 1}.
                                            </Text>
                                            <Text
                                                style={{
                                                    fontSize: 12,
                                                    color: "#166534",
                                                }}>
                                                {r}
                                            </Text>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* meta */}
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    paddingTop: 4,
                                }}>
                                <Tag style={{ borderRadius: 6, fontSize: 11 }}>
                                    Data Quality: {insights.data_quality}
                                </Tag>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    Confidence:{" "}
                                    {Math.round(
                                        (insights.confidence ?? 0) * 100,
                                    )}
                                    %
                                </Text>
                            </div>
                        </Space>
                    )}
                </div>
            </Card>
        );
    },
);
AIInsightsPanel.displayName = "AIInsightsPanel";

// ─── small memoised sub-components ───────────────────────────────────────────

const RefreshButton = React.memo(({ refreshing, onRefresh }) => (
    <Button
        type="default"
        ghost
        icon={<ReloadOutlined spin={refreshing} />}
        onClick={onRefresh}
        loading={refreshing}
        style={{ color: "white", borderColor: "white" }}
    />
));
RefreshButton.displayName = "RefreshButton";

const CustomTooltip = React.memo(({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    return (
        <div
            style={{
                backgroundColor: "rgba(255,255,255,0.98)",
                border: "none",
                borderRadius: 12,
                padding: "12px 16px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            }}>
            <Text
                strong
                style={{
                    display: "block",
                    marginBottom: 8,
                    fontSize: 13,
                    color: "#1f2937",
                }}>
                {label}
            </Text>
            {payload
                .filter((e) => e.value != null)
                .map((entry, i) => (
                    <div
                        key={i}
                        style={{
                            marginBottom: i < payload.length - 1 ? 4 : 0,
                        }}>
                        <Space size={8}>
                            <div
                                style={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: 3,
                                    backgroundColor: entry.color,
                                }}
                            />
                            <Text
                                style={{
                                    color: "#4b5563",
                                    fontSize: 12,
                                    fontWeight: 500,
                                }}>
                                {entry.name}:{" "}
                                <span
                                    style={{
                                        color: entry.color,
                                        fontWeight: 700,
                                    }}>
                                    {entry.value}m
                                </span>
                            </Text>
                        </Space>
                    </div>
                ))}
        </div>
    );
});
CustomTooltip.displayName = "CustomTooltip";

const BadgeDisplay = React.memo(
    ({ isFetchingData, currentLevel, dataStats, badgeIndex }) => {
        if (isFetchingData)
            return (
                <Space size={4}>
                    <LoadingOutlined spin />
                    <span>Loading...</span>
                </Space>
            );
        if (currentLevel === null || !dataStats) return null;
        if (badgeIndex === 0)
            return (
                <Space size={4}>
                    <span>Current: {currentLevel.toFixed(2)}m</span>
                </Space>
            );
        if (badgeIndex === 1)
            return (
                <Space size={4}>
                    {dataStats.trend >= 0 ?
                        <RiseOutlined />
                    :   <FallOutlined />}
                    <span>
                        Trend: {dataStats.trend >= 0 ? "+" : ""}
                        {dataStats.trend.toFixed(2)}m
                    </span>
                </Space>
            );
        return (
            <Space size={4}>
                <span>Prediction: {dataStats.prediction.toFixed(2)}m</span>
            </Space>
        );
    },
);
BadgeDisplay.displayName = "BadgeDisplay";

const StatsLegend = React.memo(({ dataStats }) => (
    <div style={{ marginTop: 20 }}>
        <Space
            size={[16, 8]}
            wrap
            style={{
                width: "100%",
                justifyContent: "center",
                display: "flex",
            }}>
            <Badge
                color={ACCENT_COLOR}
                text={
                    <Text style={{ fontSize: 12, fontWeight: 500 }}>
                        Recent: {dataStats.recent.toFixed(2)}m
                    </Text>
                }
            />
            <Badge
                color="#667eea"
                text={
                    <Text style={{ fontSize: 12, fontWeight: 500 }}>
                        Peak: {dataStats.max.toFixed(2)}m
                    </Text>
                }
            />
            <Badge
                color="#4facfe"
                text={
                    <Text style={{ fontSize: 12, fontWeight: 500 }}>
                        Lowest: {dataStats.min.toFixed(2)}m
                    </Text>
                }
            />
            <Badge
                color="#43e97b"
                text={
                    <Text style={{ fontSize: 12, fontWeight: 500 }}>
                        Average: {dataStats.avg.toFixed(2)}m
                    </Text>
                }
            />
            <Badge
                color={dataStats.trend >= 0 ? "#fa709a" : "#330867"}
                text={
                    <Text style={{ fontSize: 12, fontWeight: 500 }}>
                        Trend: {dataStats.trend >= 0 ? "+" : ""}
                        {dataStats.trend.toFixed(2)}m
                    </Text>
                }
            />
            <Badge
                color="#8b5cf6"
                text={
                    <Text style={{ fontSize: 12, fontWeight: 500 }}>
                        Prediction: {dataStats.prediction.toFixed(2)}m
                    </Text>
                }
            />
        </Space>
    </div>
));
StatsLegend.displayName = "StatsLegend";

// ─── ReportPage ───────────────────────────────────────────────────────────────

const ReportPage = () => {
    const [reportType, setReportType] = useState("today");
    const [monthView, setMonthView] = useState("day");
    const [selectedMonth, setSelectedMonth] = useState(dayjs());
    const [selectedYears, setSelectedYears] = useState([
        dayjs().year().toString(),
    ]);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [initialLoadDone, setInitialLoadDone] = useState(false);
    const [lineKeys, setLineKeys] = useState([]);
    const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);
    const [thresholds, setThresholds] = useState([]);
    const [maxRange, setMaxRange] = useState(4.5);
    const [isFetchingData, setIsFetchingData] = useState(false);
    const [currentLevel, setCurrentLevel] = useState(null);
    const [badgeIndex, setBadgeIndex] = useState(0);
    const [aiInsights, setAiInsights] = useState(null);
    const [exporting, setExporting] = useState(false);
    const { isMobile } = useResponsive();

    const isRealtimeUpdate = useRef(false);
    const chartWrapperRef = useRef(null);

    useEffect(() => {
        const id = setInterval(() => setBadgeIndex((p) => (p + 1) % 3), 3000);
        return () => clearInterval(id);
    }, []);

    const fetchCurrentLevel = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from("sensor_readings")
                .select("converted_water_level,created_at")
                .order("created_at", { ascending: false })
                .limit(1)
                .single();
            if (error) throw error;
            if (data) setCurrentLevel(parseFloat(data.converted_water_level));
        } catch {}
    }, []);

    const fetchThresholds = useCallback(async () => {
        try {
            const { data: td, error } = await supabase
                .from("water_thresholds")
                .select("*")
                .order("converted_min_level", { ascending: true });
            if (error) throw error;
            if (td?.[0]?.max_range) setMaxRange(parseFloat(td[0].max_range));
            const sorted = (td || []).map((t) => ({
                ...t,
                converted_min_level: parseFloat(t.converted_min_level),
                converted_max_level: parseFloat(t.converted_max_level),
            }));
            setThresholds(sorted);
            return sorted;
        } catch {
            showWarning("Failed to load thresholds");
            return [];
        }
    }, []);

    const fetchReadings = useCallback(async (start, end) => {
        try {
            setIsFetchingData(true);
            let allReadings = [],
                from = 0,
                step = 500,
                to = step - 1,
                hasMore = true;
            while (hasMore) {
                const { data: readings, error } = await supabase
                    .from("sensor_readings")
                    .select("converted_water_level,created_at")
                    .gte("created_at", start.toISOString())
                    .lt("created_at", end.toISOString())
                    .order("created_at", { ascending: true })
                    .range(from, to);
                if (error) throw error;
                if (readings?.length) {
                    allReadings = [...allReadings, ...readings];
                    readings.length === step ?
                        ((from += step), (to += step))
                    :   (hasMore = false);
                } else hasMore = false;
            }
            return allReadings;
        } catch {
            showError("Failed to fetch sensor data");
            return [];
        } finally {
            setIsFetchingData(false);
        }
    }, []);

    const chartTitle = useMemo(() => {
        switch (reportType) {
            case "today":
                return `Today's Water Level`;
            case "weekly":
                return `This Week's Average`;
            case "monthly":
                return `${selectedMonth.format("MMMM YYYY")}`;
            case "annually":
                return `Annual Comparison (${[...selectedYears].sort((a, b) => b - a).join(", ")})`;
            default:
                return "Water Level Report";
        }
    }, [reportType, selectedMonth, selectedYears]);

    const chartSubtitle = useMemo(() => {
        const today = dayjs();
        switch (reportType) {
            case "today":
                return today.format("MM DD, YYYY");
            case "weekly":
                return `${today.startOf("isoWeek").format("MMM DD")} - ${today.endOf("isoWeek").format("MMM DD, YYYY")}`;
            case "monthly":
                return monthView === "week" ? "Weekly Averages" : (
                        "Daily Averages"
                    );
            case "annually":
                return "Monthly Averages Comparison";
            default:
                return "";
        }
    }, [reportType, selectedMonth, monthView]);

    const fetchSensorData = useCallback(
        async (isRefresh = false) => {
            if (isRefresh && !isRealtimeUpdate.current) setRefreshing(true);
            else if (!isRefresh) setLoading(true);
            setData([]);
            setLineKeys([]);
            setIsFetchingData(true);

            const today = dayjs();
            let chartData = [],
                keys = [];
            let currentThresholds = thresholds;
            if (!currentThresholds.length)
                currentThresholds = await fetchThresholds();

            try {
                switch (reportType) {
                    case "today": {
                        const readings = await fetchReadings(
                            today.startOf("day"),
                            today.add(1, "day").startOf("day"),
                        );
                        chartData = readings.map((r) => ({
                            date: dayjs(r.created_at).format("HH:mm"),
                            "Water Level": +parseFloat(
                                r.converted_water_level,
                            ).toFixed(2),
                        }));
                        keys = ["Water Level"];
                        break;
                    }
                    case "weekly": {
                        const readings = await fetchReadings(
                            today.startOf("isoWeek"),
                            today.endOf("isoWeek"),
                        );
                        chartData = averageByDay(readings);
                        keys = ["Water Level"];
                        break;
                    }
                    case "monthly": {
                        const readings = await fetchReadings(
                            selectedMonth.startOf("month"),
                            selectedMonth.endOf("month"),
                        );
                        chartData =
                            monthView === "week" ?
                                averageByWeek(readings)
                            :   averageByDayOfMonth(readings);
                        keys = ["Water Level"];
                        break;
                    }
                    case "annually": {
                        if (!selectedYears.length) {
                            showWarning("Please select at least one year");
                            break;
                        }
                        const merged = [];
                        const currentKeys = [];
                        for (const year of selectedYears) {
                            const { data: rpcData, error } = await supabase.rpc(
                                "get_monthly_averages_in_range",
                                {
                                    start_date: dayjs(
                                        `${year}-01-01T00:00:00Z`,
                                    ).toISOString(),
                                    end_date: dayjs(
                                        `${year}-12-31T23:59:59Z`,
                                    ).toISOString(),
                                },
                            );
                            if (error) {
                                showError(`Failed to load data for ${year}`);
                                continue;
                            }
                            const lk = `${year}`;
                            currentKeys.push(lk);
                            (rpcData || []).forEach((row) => {
                                const [yr, mon] = row.month_label.split("-");
                                const month = dayjs(`${yr}-${mon}-01`).format(
                                    "MMM",
                                );
                                const value = +parseFloat(
                                    row.avg_converted_level ?? row.avg_level,
                                ).toFixed(2);
                                const existing = merged.find(
                                    (m) => m.date === month,
                                );
                                existing ?
                                    (existing[lk] = value)
                                :   merged.push({ date: month, [lk]: value });
                            });
                        }
                        chartData = merged
                            .sort(
                                (a, b) =>
                                    MONTH_ORDER.indexOf(a.date) -
                                    MONTH_ORDER.indexOf(b.date),
                            )
                            .map((entry) => {
                                const f = { ...entry };
                                currentKeys.forEach((k) => {
                                    if (f[k] === undefined) f[k] = null;
                                });
                                return f;
                            });
                        keys = currentKeys;
                        break;
                    }
                }
                setData(chartData);
                setLineKeys(keys);
            } catch {
                showError("Failed to load report data");
            } finally {
                setLoading(false);
                setRefreshing(false);
                setIsFetchingData(false);
                setInitialLoadDone(true);
                isRealtimeUpdate.current = false;
            }
        },
        [
            reportType,
            selectedMonth,
            monthView,
            selectedYears,
            fetchReadings,
            thresholds,
            fetchThresholds,
        ],
    );

    useEffect(() => {
        fetchThresholds();
        fetchCurrentLevel();
    }, [fetchThresholds, fetchCurrentLevel]);
    useEffect(() => {
        if (thresholds.length > 0) fetchSensorData();
    }, [fetchSensorData, thresholds]);

    useEffect(() => {
        const channel = supabase
            .channel("sensor_readings_changes")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "sensor_readings" },
                () => {
                    fetchCurrentLevel();
                    if (reportType === "today" || reportType === "weekly") {
                        isRealtimeUpdate.current = true;
                        fetchSensorData(true);
                    }
                },
            )
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, [fetchSensorData, reportType, fetchCurrentLevel]);

    const handleExportPDF = useCallback(async () => {
        setExporting(true);
        try {
            await generatePDF({
                chartRef: chartWrapperRef,
                data,
                dataStats: dataStats ?? null,
                insights: aiInsights,
                thresholds,
                reportType,
                chartTitle,
                chartSubtitle,
                currentLevel,
            });
        } finally {
            setExporting(false);
        }
    }, [
        data,
        aiInsights,
        thresholds,
        reportType,
        chartTitle,
        chartSubtitle,
        currentLevel,
    ]);

    const resetMonthly = useCallback(() => {
        setMonthView("day");
        setSelectedMonth(dayjs());
    }, []);
    const resetAnnual = useCallback(
        () => setSelectedYears([dayjs().year().toString()]),
        [],
    );

    const handleReportTypeChange = useCallback(
        (e) => setReportType(e.target.value),
        [],
    );
    const handleMonthViewChange = useCallback((v) => setMonthView(v), []);
    const handleSelectedMonthChange = useCallback(
        (v) => setSelectedMonth(v),
        [],
    );
    const handleSelectedYearsChange = useCallback(
        (v) => setSelectedYears(v),
        [],
    );
    const handleFilterDrawerClose = useCallback(
        () => setFilterDrawerVisible(false),
        [],
    );
    const handleFilterDrawerOpen = useCallback(
        () => setFilterDrawerVisible(true),
        [],
    );
    const handleRefresh = useCallback(
        () => fetchSensorData(true),
        [fetchSensorData],
    );

    const getYAxisDomain = useMemo(() => {
        if (!data.length) return [0, maxRange];
        const values = data.flatMap((d) =>
            Object.entries(d)
                .filter(([k]) => k !== "date")
                .map(([, v]) => v)
                .filter((v) => v !== null && !isNaN(v)),
        );
        return [
            Math.max(0, Math.floor(Math.min(...values, 0) * 0.9)),
            maxRange,
        ];
    }, [data, maxRange]);

    const yAxisTicks = useMemo(() => {
        if (!thresholds.length) return undefined;
        const set = new Set(),
            ticks = [];
        thresholds.forEach((t) => {
            const v = Number(t.converted_min_level.toFixed(2));
            if (!set.has(v)) {
                set.add(v);
                ticks.push(v);
            }
        });
        const mx = Number(maxRange.toFixed(2));
        if (!set.has(mx)) {
            set.add(mx);
            ticks.push(mx);
        }
        return ticks.sort((a, b) => a - b);
    }, [thresholds, maxRange]);

    const dataStats = useMemo(() => {
        if (!data.length) return null;
        const values = data.flatMap((d) =>
            Object.entries(d)
                .filter(([k]) => k !== "date")
                .map(([, v]) => v)
                .filter((v) => v !== null && !isNaN(v)),
        );
        if (!values.length) return null;
        const max = Math.max(...values),
            min = Math.min(...values),
            avg = values.reduce((a, b) => a + b, 0) / values.length;
        const getPointValue = (p) => {
            if (p["Water Level"] != null && !isNaN(p["Water Level"]))
                return p["Water Level"];
            const vals = Object.entries(p)
                .filter(([k]) => k !== "date")
                .map(([, v]) => v)
                .filter(
                    (v) => v !== null && typeof v === "number" && !isNaN(v),
                );
            return vals.length ? vals[vals.length - 1] : 0;
        };
        const recent = getPointValue(data[data.length - 1]);
        const trend = data.length > 1 ? recent - getPointValue(data[0]) : 0;
        let prediction = avg;
        if (data.length > 3) {
            const alpha = 0.3;
            let ewma = values[0];
            for (let i = 1; i < values.length; i++)
                ewma = alpha * values[i] + (1 - alpha) * ewma;
            const rv = values.slice(-Math.min(5, values.length));
            const momentum =
                rv.length > 1 ? (rv[rv.length - 1] - rv[0]) / rv.length : 0;
            const changes = [];
            for (let i = 1; i < values.length; i++)
                changes.push(values[i] - values[i - 1]);
            const vol =
                changes.length ?
                    Math.sqrt(
                        changes.reduce((s, c) => s + c * c, 0) / changes.length,
                    )
                :   0;
            prediction =
                0.4 * ewma +
                0.3 * (recent + momentum * 2) +
                0.2 * (recent + (trend / data.length) * 3) +
                0.1 * avg;
            if (vol > 0.1) prediction = 0.7 * prediction + 0.3 * recent;
            if (reportType === "today" && data.length > 10) {
                const now = dayjs(),
                    ch = now.hour();
                const similar = data
                    .filter(
                        (d) =>
                            Math.abs(parseInt(d.date.split(":")[0]) - ch) <= 1,
                    )
                    .map((d) => d["Water Level"])
                    .filter((v) => v !== null && !isNaN(v));
                if (similar.length)
                    prediction =
                        0.7 * prediction +
                        0.3 *
                            (similar.reduce((a, b) => a + b, 0) /
                                similar.length);
            }
            if (reportType === "weekly" || reportType === "monthly")
                prediction = 0.6 * prediction + 0.4 * ewma;
        } else prediction = recent + trend * 0.5;
        prediction = Math.max(0, Math.min(maxRange * 0.95, prediction));
        return { max, min, avg, trend, prediction, recent };
    }, [data, maxRange, reportType]);

    const renderChartLines = useCallback(() => {
        const isAnnual = reportType === "annually";
        const currentYear = dayjs().year().toString();
        let colorIndex = 0;
        const keys =
            lineKeys.length > 0 ?
                lineKeys
            :   Object.keys(data[0] || {}).filter((k) => k !== "date");
        return keys.map((key, idx) => {
            let color = ACCENT_COLOR,
                gradient = { start: ACCENT_COLOR, end: ACCENT_COLOR },
                gradientId = `gradient-${idx}`;
            if (isAnnual) {
                gradient =
                    key === currentYear ?
                        { start: ACCENT_COLOR, end: ACCENT_COLOR }
                    :   GRADIENT_COLORS[colorIndex % GRADIENT_COLORS.length];
                color = gradient.start;
                colorIndex++;
            }
            return (
                <React.Fragment key={key}>
                    {isAnnual && (
                        <defs>
                            <linearGradient
                                id={gradientId}
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1">
                                <stop
                                    offset="5%"
                                    stopColor={gradient.start}
                                    stopOpacity={0.8}
                                />
                                <stop
                                    offset="95%"
                                    stopColor={gradient.end}
                                    stopOpacity={0.1}
                                />
                            </linearGradient>
                        </defs>
                    )}
                    <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stroke={color}
                        connectNulls={false}
                        strokeWidth={
                            isAnnual ? 3
                            : reportType === "today" ?
                                2
                            :   3
                        }
                        dot={(props) => {
                            if (reportType === "today") return null;
                            if (
                                props.cy == null ||
                                isNaN(props.cy) ||
                                props.value == null
                            )
                                return null;
                            const isLast = props.index === data.length - 1;
                            return (
                                <circle
                                    key={`dot-${key}-${props.index}`}
                                    cx={props.cx}
                                    cy={props.cy}
                                    r={isAnnual ? 6 : 5}
                                    fill={isLast ? ACCENT_COLOR : color}
                                    strokeWidth={2}
                                    stroke="#fff"
                                />
                            );
                        }}
                        activeDot={(props) => {
                            if (
                                props.cy == null ||
                                isNaN(props.cy) ||
                                props.value == null
                            )
                                return null;
                            return (
                                <circle
                                    key={`ad-${key}-${props.index}`}
                                    cx={props.cx}
                                    cy={props.cy}
                                    r={8}
                                    fill={color}
                                    strokeWidth={3}
                                    stroke="#fff"
                                    style={{
                                        filter: "drop-shadow(0px 2px 4px rgba(0,0,0,0.2))",
                                    }}
                                />
                            );
                        }}
                        isAnimationActive={false}
                    />
                </React.Fragment>
            );
        });
    }, [reportType, lineKeys, data]);

    const renderThresholdReferences = useCallback(() => {
        if (!thresholds.length) return null;
        return [...thresholds]
            .sort((a, b) => a.converted_min_level - b.converted_min_level)
            .map((t, i) => {
                const color = getStatusColor(t.name);
                return (
                    <React.Fragment key={t.id}>
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
                                strokeWidth={1.5}
                                strokeOpacity={0.7}
                            />
                        )}
                    </React.Fragment>
                );
            });
    }, [thresholds]);

    const showLegend = useMemo(
        () => reportType === "annually" && data.length > 0,
        [reportType, data.length],
    );

    const yearOptions = useMemo(
        () =>
            Array.from({ length: 10 }, (_, i) => {
                const year = (dayjs().year() - i).toString();
                return (
                    <Option key={year} value={year}>
                        {year}
                    </Option>
                );
            }),
        [],
    );

    if (!initialLoadDone)
        return (
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "rgba(255,255,255)",
                    zIndex: 100,
                }}>
                <Spin size="large" />
            </div>
        );

    return (
        <Space
            direction="vertical"
            style={{ width: "100%", padding: isMobile ? 16 : 32 }}
            size="large">
            {/* ── HEADER ── */}
            <Card
                style={{
                    ...cardStyleAdaptive,
                    background: THEME.BLUE_PRIMARY,
                    border: "none",
                }}>
                <Flex justify="space-between" align="center" wrap="nowrap">
                    <div>
                        <Title
                            level={isMobile ? 4 : 2}
                            style={{ color: "#fff", margin: 0 }}>
                            Water Level Reports
                        </Title>
                        <Text style={{ color: "rgba(255,255,255,0.85)" }}>
                            Real-time monitoring and historical data
                        </Text>
                    </div>
                    {!isMobile && (
                        <Space size={8}>
                            <Button
                                type="default"
                                ghost
                                icon={<FilePdfOutlined />}
                                onClick={handleExportPDF}
                                loading={exporting}
                                style={{
                                    color: "white",
                                    borderColor: "white",
                                }}>
                                Export PDF
                            </Button>
                            <RefreshButton
                                refreshing={refreshing}
                                onRefresh={handleRefresh}
                            />
                        </Space>
                    )}
                </Flex>
            </Card>

            {/* ── CHART CARD ── */}
            <Card
                style={{ ...cardStyleAdaptive }}
                styles={{ body: { padding: isMobile ? 8 : 20 } }}
                title={
                    isMobile && (
                        <Row justify="space-between" align="middle">
                            <Col>
                                <BadgeDisplay
                                    isFetchingData={isFetchingData}
                                    currentLevel={currentLevel}
                                    dataStats={dataStats}
                                    badgeIndex={badgeIndex}
                                />
                            </Col>
                            <Col>
                                <Space size={8}>
                                    <Button
                                        type="text"
                                        icon={<FilterOutlined />}
                                        onClick={handleFilterDrawerOpen}
                                        style={{ color: THEME.BLUE_PRIMARY }}
                                    />
                                    <Button
                                        type="text"
                                        icon={
                                            <ReloadOutlined
                                                spin={
                                                    refreshing || isFetchingData
                                                }
                                            />
                                        }
                                        onClick={handleRefresh}
                                        loading={refreshing || isFetchingData}
                                        style={{ color: THEME.BLUE_PRIMARY }}
                                    />
                                </Space>
                            </Col>
                        </Row>
                    )
                }>
                {/* Report type selector — desktop */}
                {!isMobile && (
                    <div
                        style={{
                            width: "100%",
                            display: "flex",
                            justifyContent: "center",
                            marginBottom: 24,
                        }}>
                        <Radio.Group
                            value={reportType}
                            onChange={handleReportTypeChange}
                            buttonStyle="solid"
                            size="large"
                            style={{
                                display: "flex",
                                gap: 8,
                                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                                borderRadius: 8,
                                padding: 4,
                                background: "white",
                            }}>
                            {["today", "weekly", "monthly", "annually"].map(
                                (v) => (
                                    <Radio.Button
                                        key={v}
                                        value={v}
                                        style={{ borderRadius: 6 }}>
                                        {v.charAt(0).toUpperCase() + v.slice(1)}
                                    </Radio.Button>
                                ),
                            )}
                        </Radio.Group>
                    </div>
                )}

                {/* Monthly controls — desktop */}
                {!isMobile && reportType === "monthly" && (
                    <Space
                        size="middle"
                        style={{
                            width: "100%",
                            justifyContent: "center",
                            marginBottom: 24,
                            flexWrap: "wrap",
                        }}>
                        <Space size="small">
                            <Text strong>Month:</Text>
                            <DatePicker
                                picker="month"
                                value={selectedMonth}
                                onChange={handleSelectedMonthChange}
                                allowClear={false}
                                size="large"
                                style={{ borderRadius: 8 }}
                            />
                        </Space>
                        <Space size="small">
                            <Text strong>View:</Text>
                            <Select
                                value={monthView}
                                onChange={handleMonthViewChange}
                                size="large"
                                style={{ width: 120, borderRadius: 8 }}>
                                <Option value="day">Daily</Option>
                                <Option value="week">Weekly</Option>
                            </Select>
                        </Space>
                        <Button
                            onClick={resetMonthly}
                            icon={<ReloadOutlined />}
                            size="large"
                            style={{ borderRadius: 8 }}>
                            Reset
                        </Button>
                    </Space>
                )}

                {/* Annual controls — desktop */}
                {!isMobile && reportType === "annually" && (
                    <Space
                        size="middle"
                        style={{
                            width: "100%",
                            justifyContent: "center",
                            marginBottom: 24,
                            flexWrap: "wrap",
                        }}>
                        <Space size="small">
                            <Text strong>Compare:</Text>
                            <Select
                                mode="multiple"
                                value={selectedYears}
                                onChange={handleSelectedYearsChange}
                                placeholder="Select years"
                                size="large"
                                style={{ minWidth: 220, borderRadius: 8 }}
                                maxTagCount={3}>
                                {yearOptions}
                            </Select>
                        </Space>
                        <Button
                            onClick={resetAnnual}
                            icon={<ReloadOutlined />}
                            size="large"
                            style={{ borderRadius: 8 }}>
                            Reset
                        </Button>
                    </Space>
                )}

                {/* Chart title */}
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                    <Title
                        level={isMobile ? 5 : 3}
                        style={{
                            margin: 0,
                            background: `linear-gradient(135deg,${THEME.BLUE_AUTHORITY} 0%,${THEME.BLUE_PRIMARY} 100%)`,
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            fontWeight: 800,
                        }}>
                        {chartTitle}
                    </Title>
                    <Text
                        type="secondary"
                        style={{
                            fontSize: isMobile ? 12 : 14,
                            display: "block",
                            marginTop: 4,
                            fontWeight: 500,
                        }}>
                        {chartSubtitle}
                    </Text>
                </div>

                {/* Chart */}
                {loading || isFetchingData ?
                    <div
                        style={{
                            height: isMobile ? 310 : 400,
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            flexDirection: "column",
                            gap: 12,
                        }}>
                        <Spin size="large" />
                    </div>
                : data.length === 0 ?
                    <div
                        style={{
                            height: isMobile ? 310 : 400,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}>
                        <Empty
                            description={
                                <Space direction="vertical" size={2}>
                                    <Text type="secondary">No data found</Text>
                                    <Text
                                        type="secondary"
                                        style={{ fontSize: 12 }}>
                                        Try a different time period
                                    </Text>
                                </Space>
                            }
                        />
                    </div>
                :   <div
                        ref={chartWrapperRef}
                        style={{ width: "100%", height: isMobile ? 310 : 400 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                                data={data}
                                margin={{
                                    top: isMobile ? 0 : 30,
                                    right: isMobile ? 25 : 60,
                                    left: isMobile ? -30 : 0,
                                    bottom: 0,
                                }}>
                                <defs>
                                    <linearGradient
                                        id="colorGradient"
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1">
                                        <stop
                                            offset="5%"
                                            stopColor={ACCENT_COLOR}
                                            stopOpacity={0.3}
                                        />
                                        <stop
                                            offset="95%"
                                            stopColor={ACCENT_COLOR}
                                            stopOpacity={0.05}
                                        />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="#e5e7eb"
                                    vertical={false}
                                />
                                {renderThresholdReferences()}
                                <XAxis
                                    dataKey="date"
                                    angle={-45}
                                    textAnchor="end"
                                    height={isMobile ? 60 : 70}
                                    interval="preserveStartEnd"
                                    tick={
                                        reportType === "today" ? false : (
                                            {
                                                fontSize: isMobile ? 10 : 12,
                                                fill: "#6b7280",
                                            }
                                        )
                                    }
                                    axisLine={{ stroke: "#d1d5db" }}
                                    tickLine={
                                        reportType === "today" ? false : (
                                            { stroke: "#d1d5db" }
                                        )
                                    }
                                />
                                <YAxis
                                    domain={getYAxisDomain}
                                    ticks={yAxisTicks}
                                    label={{
                                        value: "Water Level (m)",
                                        angle: -90,
                                        position: "insideLeft",
                                        offset: isMobile ? -50 : 10,
                                        style: {
                                            fontSize: isMobile ? 11 : 13,
                                            fontWeight: 600,
                                            fill: THEME.BLUE_AUTHORITY,
                                            textAnchor: "middle",
                                        },
                                    }}
                                    tick={{
                                        fontSize: isMobile ? 10 : 12,
                                        fill: "#6b7280",
                                    }}
                                    axisLine={{ stroke: "#d1d5db" }}
                                    tickLine={{ stroke: "#d1d5db" }}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                {showLegend && (
                                    <Legend
                                        verticalAlign="top"
                                        height={50}
                                        wrapperStyle={{
                                            fontSize: 13,
                                            fontWeight: 500,
                                            paddingTop: 10,
                                        }}
                                    />
                                )}
                                {renderChartLines()}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                }

                {/* Stats legend — desktop */}
                {!isMobile && thresholds.length > 0 && dataStats && (
                    <StatsLegend dataStats={dataStats} />
                )}
            </Card>

            {/* ── AI INSIGHTS ── */}
            <AIInsightsPanel
                data={data}
                dataStats={dataStats}
                thresholds={thresholds}
                reportType={reportType}
                currentLevel={currentLevel}
                chartTitle={chartTitle}
                onInsightsReady={setAiInsights}
            />

            {/* Mobile export button */}
            {isMobile && (
                <Button
                    block
                    size="large"
                    icon={<FilePdfOutlined />}
                    onClick={handleExportPDF}
                    loading={exporting}
                    style={{
                        borderRadius: 10,
                        background: THEME.BLUE_PRIMARY,
                        color: "#fff",
                        border: "none",
                        fontWeight: 600,
                    }}>
                    Export PDF Report
                </Button>
            )}

            {/* ── MOBILE FILTER DRAWER ── */}
            <Drawer
                style={{
                    borderRadius: "0 0 10vw 10vw",
                    borderBottom: `4px solid ${THEME.BLUE_PRIMARY}`,
                }}
                placement="top"
                onClose={handleFilterDrawerClose}
                open={filterDrawerVisible}
                height="auto"
                styles={{
                    body: { padding: isMobile ? 16 : 24 },
                    mask: { backdropFilter: "blur(4px)" },
                }}
                closable={false}
                maskClosable>
                <Card
                    variant={false}
                    style={{
                        ...cardStyleAdaptive,
                        height: "100%",
                        borderTop: `4px solid ${THEME.BLUE_PRIMARY}`,
                        backgroundColor: "rgba(255,255,255,0.9)",
                        borderRadius: "0 0 10vw 10vw",
                    }}>
                    <Space
                        direction="vertical"
                        size={16}
                        style={{ width: "100%" }}>
                        <div>
                            <Text
                                strong
                                style={{
                                    display: "block",
                                    marginBottom: 8,
                                    fontSize: 13,
                                    textAlign: "center",
                                }}>
                                Report Type
                            </Text>
                            <Radio.Group
                                value={reportType}
                                onChange={handleReportTypeChange}
                                buttonStyle="solid"
                                size="middle"
                                style={{ width: "100%", display: "flex" }}>
                                {[
                                    ["today", "Today"],
                                    ["weekly", "Week"],
                                    ["monthly", "Month"],
                                    ["annually", "Year"],
                                ].map(([v, l]) => (
                                    <Radio.Button
                                        key={v}
                                        value={v}
                                        style={{
                                            flex: 1,
                                            textAlign: "center",
                                        }}>
                                        {l}
                                    </Radio.Button>
                                ))}
                            </Radio.Group>
                        </div>

                        {reportType === "monthly" && (
                            <Space
                                direction="vertical"
                                style={{ width: "100%" }}
                                size={12}>
                                <div>
                                    <Text
                                        strong
                                        style={{
                                            display: "block",
                                            marginBottom: 8,
                                            fontSize: 13,
                                        }}>
                                        Select Month
                                    </Text>
                                    <DatePicker
                                        picker="month"
                                        value={selectedMonth}
                                        onChange={handleSelectedMonthChange}
                                        allowClear={false}
                                        style={{ width: "100%", height: 32 }}
                                    />
                                </div>
                                <div>
                                    <Text
                                        strong
                                        style={{
                                            display: "block",
                                            marginBottom: 8,
                                            fontSize: 13,
                                        }}>
                                        View By
                                    </Text>
                                    <Select
                                        value={monthView}
                                        onChange={handleMonthViewChange}
                                        style={{ width: "100%", height: 32 }}>
                                        <Option value="day">Daily</Option>
                                        <Option value="week">Weekly</Option>
                                    </Select>
                                </div>
                                <Flex justify="center">
                                    <Button
                                        onClick={resetMonthly}
                                        icon={<ReloadOutlined />}
                                        style={{
                                            borderRadius: 6,
                                            width: "45%",
                                            height: 32,
                                        }}>
                                        Reset Month
                                    </Button>
                                </Flex>
                            </Space>
                        )}

                        {reportType === "annually" && (
                            <Space
                                direction="vertical"
                                style={{ width: "100%" }}
                                size={12}>
                                <div>
                                    <Text
                                        strong
                                        style={{
                                            display: "block",
                                            marginBottom: 8,
                                            fontSize: 13,
                                        }}>
                                        Compare Years
                                    </Text>
                                    <Select
                                        mode="multiple"
                                        value={selectedYears}
                                        onChange={handleSelectedYearsChange}
                                        placeholder="Select years"
                                        style={{ width: "100%", minHeight: 40 }}
                                        maxTagCount={2}>
                                        {yearOptions}
                                    </Select>
                                </div>
                                <Flex justify="center">
                                    <Button
                                        onClick={resetAnnual}
                                        icon={<ReloadOutlined />}
                                        style={{
                                            borderRadius: 6,
                                            width: "45%",
                                            height: 32,
                                        }}>
                                        Reset Years
                                    </Button>
                                </Flex>
                            </Space>
                        )}
                    </Space>
                </Card>
                <div
                    style={{
                        position: "fixed",
                        left: "50%",
                        top: "75vh",
                        transform: "translate(-50%,-50%)",
                        zIndex: 10000,
                        filter: "drop-shadow(0px 4px 12px rgba(0,0,0,0.2))",
                        pointerEvents: "auto",
                    }}>
                    <Button
                        shape="circle"
                        icon={<CloseOutlined />}
                        onClick={handleFilterDrawerClose}
                        style={{
                            width: 50,
                            height: 50,
                            backgroundColor: "#fff",
                            border: `2px solid ${THEME.BLUE_PRIMARY}`,
                            color: THEME.BLUE_PRIMARY,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "22px",
                        }}
                    />
                </div>
            </Drawer>
        </Space>
    );
};

export default ReportPage;
