// ReportPage.jsx — Clustering, Mobile, Realtime-safe, Viewport-fit
import React, {
    useEffect,
    useState,
    useCallback,
    useMemo,
    useRef,
} from "react";
import {
    ComposedChart,
    Line,
    Area,
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
} from "antd";
import {
    ReloadOutlined,
    FilterOutlined,
    CloseOutlined,
    RiseOutlined,
    FallOutlined,
    LoadingOutlined,
    FilePdfOutlined,
    BarChartOutlined,
} from "@ant-design/icons";
import { supabase } from "@/globals";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { THEME, cardStyleAdaptive } from "@/utils/theme";
import { showError, showWarning } from "@/utils/notifications";
import { useResponsive } from "@/utils/useResponsive";
import { ReportGeneratorModal } from "@/utils/ReportGeneratorModal";
import { ForecastPanel } from "@/utils/Forecastpanel";

dayjs.extend(isoWeek);

const { Title, Text } = Typography;
const { Option } = Select;

const ACCENT_COLOR = THEME.ACCENT_YELLOW;
const HOURLY_COLORS = {
    Max: "#f43f5e",
    Avg: THEME.ACCENT_YELLOW,
    Min: "#38bdf8",
};
const GRADIENT_COLORS = [
    { start: "#667eea" },
    { start: "#f093fb" },
    { start: "#4facfe" },
    { start: "#43e97b" },
    { start: "#fa709a" },
    { start: "#30cfd0" },
    { start: "#a8edea" },
    { start: "#ff9a9e" },
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

// If more than this many points are visible, cluster them automatically.
const CLUSTER_THRESHOLD = 80;

const getStatusColor = (n) =>
    ({
        L0: THEME.GREEN_SAFE,
        L1: THEME.YELLOW_NORMAL,
        L2: THEME.ORANGE_ALERT,
        L3: THEME.RED_CRITICAL,
    })[n] || THEME.BLUE_AUTHORITY;

// ─── Data helpers ─────────────────────────────────────────────────────────────
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
const averageByDay = (r) =>
    averageBy(r, (x) => dayjs(x.created_at).format("ddd"));
const averageByDayOfMonth = (r) => {
    const res = averageBy(r, (x) => dayjs(x.created_at).format("DD"));
    return res.sort((a, b) => parseInt(a.date) - parseInt(b.date));
};
const averageByWeek = (r) =>
    averageBy(r, (x) => `Week ${Math.ceil(dayjs(x.created_at).date() / 7)}`);
const averageByHour = (readings) => {
    const g = readings.reduce((acc, r) => {
        const h = dayjs(r.created_at).format("HH:00");
        acc[h] ??= [];
        acc[h].push(parseFloat(r.converted_water_level));
        return acc;
    }, {});
    return Object.entries(g)
        .map(([h, vals]) => ({
            date: h,
            Max: +Math.max(...vals).toFixed(2),
            Min: +Math.min(...vals).toFixed(2),
            Avg: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
};

const clusterData = (points, buckets) => {
    if (points.length <= buckets) return points;
    const size = Math.ceil(points.length / buckets);
    const result = [];
    for (let i = 0; i < points.length; i += size) {
        const chunk = points.slice(i, i + size);
        const numKeys = Object.keys(chunk[0]).filter(
            (k) => k !== "date" && k !== "_clustered",
        );
        const entry = {
            date: chunk[Math.floor(chunk.length / 2)].date,
            _clustered: true,
        };
        numKeys.forEach((k) => {
            const vals = chunk
                .map((p) => p[k])
                .filter((v) => v !== null && !isNaN(v));
            entry[k] =
                vals.length ?
                    +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)
                :   null;
        });
        result.push(entry);
    }
    return result;
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = React.memo(({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const seen = new Set();
    const lines = payload.filter((e) => {
        if (e.stroke === "none" || e.value == null || seen.has(e.dataKey))
            return false;
        seen.add(e.dataKey);
        return true;
    });
    if (!lines.length) return null;
    return (
        <div
            style={{
                background: "rgba(10,15,30,0.96)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 12,
                padding: "10px 14px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                minWidth: 140,
                pointerEvents: "none",
            }}>
            <div
                style={{
                    color: "rgba(255,255,255,0.45)",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.07em",
                    textTransform: "uppercase",
                    marginBottom: 7,
                }}>
                {label}
            </div>
            {lines.map((entry, i) => (
                <div
                    key={entry.dataKey}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: i < lines.length - 1 ? 5 : 0,
                    }}>
                    <div
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: entry.color,
                            flexShrink: 0,
                            boxShadow: `0 0 4px ${entry.color}`,
                        }}
                    />
                    <span
                        style={{
                            color: "rgba(255,255,255,0.65)",
                            fontSize: 12,
                            flex: 1,
                        }}>
                        {entry.name}:
                    </span>
                    <span
                        style={{
                            color: entry.color,
                            fontSize: 13,
                            fontWeight: 700,
                        }}>
                        {entry.value}m
                    </span>
                </div>
            ))}
        </div>
    );
});
CustomTooltip.displayName = "CustomTooltip";

// ─── Custom Cursor ────────────────────────────────────────────────────────────
const CustomCursor = React.memo(({ points, height }) => {
    if (!points?.length) return null;
    return (
        <line
            x1={points[0].x}
            y1={0}
            x2={points[0].x}
            y2={height}
            stroke="rgba(255,255,255,0.22)"
            strokeWidth={1}
            strokeDasharray="4 3"
            style={{ willChange: "transform" }}
        />
    );
});

// ─── Pulsing live dot ─────────────────────────────────────────────────────────
const PulsingDot = ({ cx, cy, color }) => {
    if (cx == null || cy == null || isNaN(cy)) return null;
    return (
        <g>
            <circle cx={cx} cy={cy} r={10} fill={color} opacity={0.2}>
                <animate
                    attributeName="r"
                    values="6;14;6"
                    dur="2s"
                    repeatCount="indefinite"
                />
                <animate
                    attributeName="opacity"
                    values="0.3;0;0.3"
                    dur="2s"
                    repeatCount="indefinite"
                />
            </circle>
            <circle
                cx={cx}
                cy={cy}
                r={5}
                fill={color}
                stroke="#fff"
                strokeWidth={2}
            />
        </g>
    );
};

// ─── Stats bar ────────────────────────────────────────────────────────────────
const StatsBar = React.memo(({ dataStats }) => (
    <div
        style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "center",
            marginTop: 12,
            padding: "10px 16px",
            background: "rgba(0,0,0,0.025)",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.06)",
        }}>
        {[
            { label: "Latest", value: dataStats.recent, color: ACCENT_COLOR },
            { label: "Peak", value: dataStats.max, color: "#f43f5e" },
            { label: "Low", value: dataStats.min, color: "#38bdf8" },
            { label: "Avg", value: dataStats.avg, color: "#a78bfa" },
            {
                label: "Trend",
                value:
                    (dataStats.trend >= 0 ? "+" : "") +
                    dataStats.trend.toFixed(2) +
                    "m",
                color: dataStats.trend >= 0 ? "#f43f5e" : "#38bdf8",
                raw: true,
            },
            {
                label: "Forecast",
                value: dataStats.prediction,
                color: "#34d399",
            },
        ].map(({ label, value, color, raw }) => (
            <div
                key={label}
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 1,
                    minWidth: 56,
                }}>
                <Text
                    style={{
                        fontSize: 10,
                        color: "rgba(0,0,0,0.38)",
                        fontWeight: 600,
                        letterSpacing: "0.07em",
                        textTransform: "uppercase",
                    }}>
                    {label}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: 700, color }}>
                    {raw ? value : (+value).toFixed(2) + "m"}
                </Text>
            </div>
        ))}
    </div>
));
StatsBar.displayName = "StatsBar";

// ─── Badge display ────────────────────────────────────────────────────────────
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
                <span>Forecast: {dataStats.prediction.toFixed(2)}m</span>
            </Space>
        );
    },
);
BadgeDisplay.displayName = "BadgeDisplay";

// ─── Refresh button ───────────────────────────────────────────────────────────
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

const LIVE_WINDOWS = [
    { label: "Last 10 min", minutes: 10 },
    { label: "Last 30 min", minutes: 30 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════
const ReportPage = () => {
    const [reportType, setReportType] = useState("today");
    const [dailyView, setDailyView] = useState("live");
    const [liveWindow, setLiveWindow] = useState(10); // minutes
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
    const [pdfModalOpen, setPdfModalOpen] = useState(false);
    const [showForecast, setShowForecast] = useState(false);
    const [forecastScrolled, setForecastScrolled] = useState(false);

    const forecastRef = useRef(null);
    const { isMobile } = useResponsive();
    const isRealtimeUpdate = useRef(false);
    const realtimeTimer = useRef(null);
    const fetchAbortRef = useRef(null);

    // ── Badge rotation ────────────────────────────────────────────────────────
    useEffect(() => {
        const t = setInterval(() => setBadgeIndex((p) => (p + 1) % 3), 3000);
        return () => clearInterval(t);
    }, []);

    // ── Forecast scroll listener ──────────────────────────────────────────────
    useEffect(() => {
        if (!showForecast) {
            setForecastScrolled(false);
            return;
        }
        const check = () => {
            if (!forecastRef.current) return;
            const r = forecastRef.current.getBoundingClientRect();
            setForecastScrolled(r.top < window.innerHeight && r.bottom > 0);
        };
        setTimeout(check, 100);
        window.addEventListener("scroll", check, { passive: true });
        window.addEventListener("resize", check, { passive: true });
        return () => {
            window.removeEventListener("scroll", check);
            window.removeEventListener("resize", check);
        };
    }, [showForecast]);

    // ── Clustering ────────────────────────────────────────────────────────────
    const displayData = useMemo(() => {
        if (data.length <= CLUSTER_THRESHOLD) return data;
        const buckets = Math.min(
            CLUSTER_THRESHOLD,
            Math.floor(data.length / 2),
        );
        return clusterData(data, buckets);
    }, [data]);

    const isClustered = displayData.length < data.length;

    // ── Fetch helpers ─────────────────────────────────────────────────────────
    const fetchCurrentLevel = useCallback(async () => {
        try {
            const { data: row, error } = await supabase
                .from("sensor_readings")
                .select("converted_water_level")
                .order("created_at", { ascending: false })
                .limit(1)
                .single();
            if (!error && row)
                setCurrentLevel(parseFloat(row.converted_water_level));
        } catch {
            /* silent */
        }
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
        if (fetchAbortRef.current) fetchAbortRef.current.abort();
        const controller = new AbortController();
        fetchAbortRef.current = controller;
        let all = [],
            from = 0;
        const step = 1000;
        let hasMore = true;
        while (hasMore) {
            if (controller.signal.aborted) return null;
            const { data: rows, error } = await supabase
                .from("sensor_readings")
                .select("converted_water_level, created_at")
                .gte("created_at", start.toISOString())
                .lt("created_at", end.toISOString())
                .order("created_at", { ascending: true })
                .range(from, from + step - 1);
            if (error) throw error;
            if (rows?.length) {
                all = [...all, ...rows];
                hasMore = rows.length === step;
                from += step;
            } else hasMore = false;
        }
        return all;
    }, []);

    // ── Titles ────────────────────────────────────────────────────────────────
    const chartTitle = useMemo(() => {
        switch (reportType) {
            case "today":
                return dailyView === "live" ? "Live Water Level" : (
                        "Hourly Overview"
                    );
            case "weekly":
                return "This Week's Average";
            case "monthly":
                return selectedMonth.format("MMMM YYYY");
            case "annually":
                return `Annual Comparison (${[...selectedYears].sort((a, b) => b - a).join(", ")})`;
            default:
                return "Water Level Report";
        }
    }, [reportType, dailyView, selectedMonth, selectedYears]);

    const chartSubtitle = useMemo(() => {
        const t = dayjs();
        const winLabel =
            liveWindow < 60 ? `${liveWindow} min` : `${liveWindow / 60}h`;
        switch (reportType) {
            case "today":
                return dailyView === "live" ?
                        `Last ${winLabel} · ${t.format("MMM DD, YYYY")}`
                    :   `Hourly summary · ${t.format("MMM DD, YYYY")}`;
            case "weekly":
                return `${t.startOf("isoWeek").format("MMM DD")} – ${t.endOf("isoWeek").format("MMM DD, YYYY")}`;
            case "monthly":
                return monthView === "week" ? "Weekly averages" : (
                        "Daily averages"
                    );
            case "annually":
                return "Monthly averages comparison";
            default:
                return "";
        }
    }, [reportType, dailyView, liveWindow, selectedMonth, monthView]);

    // ── Main fetch ────────────────────────────────────────────────────────────
    const fetchSensorData = useCallback(
        async (isRefresh = false) => {
            const isRealtime = isRealtimeUpdate.current;
            if (isRefresh && !isRealtime) setRefreshing(true);
            else if (!isRefresh) setLoading(true);

            if (!isRealtime) {
                setData([]);
                setLineKeys([]);
            }
            setIsFetchingData(true);

            const today = dayjs();
            let chartData = [],
                keys = [];
            let thr = thresholds;
            if (!thr.length) thr = await fetchThresholds();

            try {
                switch (reportType) {
                    case "today": {
                        if (dailyView === "live") {
                            const rows = await fetchReadings(
                                today.subtract(liveWindow, "minute"),
                                today.add(1, "minute"),
                            );
                            if (!rows) return;
                            const incoming = rows.map((r) => ({
                                date: dayjs(r.created_at).format("HH:mm"),
                                "Water Level": +parseFloat(
                                    r.converted_water_level,
                                ).toFixed(2),
                            }));
                            if (isRealtime) {
                                // Smooth scroll: keep existing points, append new tail, trim to window
                                setData((prev) => {
                                    const merged = [...prev];
                                    for (const pt of incoming) {
                                        if (
                                            !merged.find(
                                                (p) => p.date === pt.date,
                                            )
                                        )
                                            merged.push(pt);
                                    }
                                    return merged.slice(-liveWindow); // max 1 pt/min
                                });
                                setLineKeys(["Water Level"]);
                                return; // skip the setData below
                            }
                            chartData = incoming;
                            keys = ["Water Level"];
                        } else {
                            const rows = await fetchReadings(
                                today.startOf("day"),
                                today.add(1, "day").startOf("day"),
                            );
                            if (!rows) return;
                            chartData = averageByHour(rows);
                            keys = ["Max", "Min", "Avg"];
                        }
                        break;
                    }
                    case "weekly": {
                        const rows = await fetchReadings(
                            today.startOf("isoWeek"),
                            today.endOf("isoWeek"),
                        );
                        if (!rows) return;
                        chartData = averageByDay(rows);
                        keys = ["Water Level"];
                        break;
                    }
                    case "monthly": {
                        const rows = await fetchReadings(
                            selectedMonth.startOf("month"),
                            selectedMonth.endOf("month"),
                        );
                        if (!rows) return;
                        chartData =
                            monthView === "week" ?
                                averageByWeek(rows)
                            :   averageByDayOfMonth(rows);
                        keys = ["Water Level"];
                        break;
                    }
                    case "annually": {
                        if (!selectedYears.length) {
                            showWarning("Please select at least one year");
                            break;
                        }
                        const merged = [],
                            currentKeys = [];
                        await Promise.all(
                            selectedYears.map(async (year) => {
                                const { data: rpcData, error } =
                                    await supabase.rpc(
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
                                    showError(`Failed to load ${year}`);
                                    return;
                                }
                                currentKeys.push(year);
                                (rpcData || []).forEach((row) => {
                                    const [yr, mon] =
                                        row.month_label.split("-");
                                    const month = dayjs(
                                        `${yr}-${mon}-01`,
                                    ).format("MMM");
                                    const value = +parseFloat(
                                        maxRange - row.avg_level,
                                    ).toFixed(2);
                                    const ex = merged.find(
                                        (m) => m.date === month,
                                    );
                                    if (ex) ex[year] = value;
                                    else
                                        merged.push({
                                            date: month,
                                            [year]: value,
                                        });
                                });
                            }),
                        );
                        chartData = merged
                            .sort(
                                (a, b) =>
                                    MONTH_ORDER.indexOf(a.date) -
                                    MONTH_ORDER.indexOf(b.date),
                            )
                            .map((entry) => {
                                currentKeys.forEach((k) => {
                                    if (entry[k] === undefined) entry[k] = null;
                                });
                                return entry;
                            });
                        keys = currentKeys;
                        break;
                    }
                }
                setData(chartData);
                setLineKeys(keys);
            } catch (e) {
                if (!fetchAbortRef.current?.signal.aborted)
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
            dailyView,
            liveWindow,
            selectedMonth,
            monthView,
            selectedYears,
            fetchReadings,
            thresholds,
            fetchThresholds,
            maxRange,
        ],
    );

    // ── Bootstrap ─────────────────────────────────────────────────────────────
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        fetchThresholds();
        fetchCurrentLevel();
    }, []);
    useEffect(() => {
        if (thresholds.length > 0) fetchSensorData();
    }, [fetchSensorData, thresholds]);

    // ── Realtime subscription ─────────────────────────────────────────────────
    useEffect(() => {
        const channel = supabase
            .channel("sensor_readings_changes")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "sensor_readings" },
                () => {
                    fetchCurrentLevel();
                    if (reportType !== "today" && reportType !== "weekly")
                        return;
                    clearTimeout(realtimeTimer.current);
                    realtimeTimer.current = setTimeout(() => {
                        isRealtimeUpdate.current = true;
                        fetchSensorData(true);
                    }, 3000);
                },
            )
            .subscribe();
        return () => {
            clearTimeout(realtimeTimer.current);
            supabase.removeChannel(channel);
        };
    }, [fetchSensorData, reportType, fetchCurrentLevel]);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleReportTypeChange = useCallback((e) => {
        setReportType(e.target.value);
        if (e.target.value !== "today") setDailyView("live");
    }, []);
    const handleDailyViewChange = useCallback((v) => setDailyView(v), []);
    const handleLiveWindowChange = useCallback(
        (mins) => setLiveWindow(mins),
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
    const handleOpenPdfModal = useCallback(() => setPdfModalOpen(true), []);
    const handleClosePdfModal = useCallback(() => setPdfModalOpen(false), []);
    const resetMonthly = useCallback(() => {
        setMonthView("day");
        setSelectedMonth(dayjs());
    }, []);
    const resetAnnual = useCallback(
        () => setSelectedYears([dayjs().year().toString()]),
        [],
    );

    const handleToggleForecast = useCallback(() => {
        setShowForecast((prev) => {
            if (!prev)
                setTimeout(
                    () =>
                        forecastRef.current?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                        }),
                    80,
                );
            else setForecastScrolled(false);
            return !prev;
        });
    }, []);
    const handleCloseForecast = useCallback(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        setTimeout(() => {
            setShowForecast(false);
            setForecastScrolled(false);
        }, 600);
    }, []);

    // ── Y-axis domain ─────────────────────────────────────────────────────────
    const getYAxisDomain = useMemo(() => {
        if (!displayData.length) return [0, maxRange];
        const vals = displayData.flatMap((d) =>
            Object.entries(d)
                .filter(([k]) => k !== "date" && k !== "_clustered")
                .map(([, v]) => v)
                .filter((v) => v !== null && !isNaN(v)),
        );
        if (!vals.length) return [0, maxRange];
        return [Math.max(0, Math.floor(Math.min(...vals) * 0.95)), maxRange];
    }, [displayData, maxRange]);

    const yAxisTicks = useMemo(() => {
        if (!thresholds.length) return undefined;
        const set = new Set();
        const ticks = [];
        thresholds.forEach((t) => {
            const v = Number(t.converted_min_level.toFixed(2));
            if (!set.has(v)) {
                set.add(v);
                ticks.push(v);
            }
        });
        const mx = Number(maxRange.toFixed(2));
        if (!set.has(mx)) ticks.push(mx);
        return ticks.sort((a, b) => a - b);
    }, [thresholds, maxRange]);

    // ── Stats ─────────────────────────────────────────────────────────────────
    const dataStats = useMemo(() => {
        if (!data.length) return null;
        const vals = data.flatMap((d) =>
            Object.entries(d)
                .filter(([k]) => k !== "date" && k !== "_clustered")
                .map(([, v]) => v)
                .filter((v) => v !== null && !isNaN(v)),
        );
        if (!vals.length) return null;
        const max = Math.max(...vals);
        const min = Math.min(...vals);
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        const getV = (pt) =>
            pt["Water Level"] ??
            pt["Avg"] ??
            Object.values(pt).find((v) => typeof v === "number" && !isNaN(v)) ??
            0;
        const recent = getV(data[data.length - 1]);
        const trend = data.length > 1 ? recent - getV(data[0]) : 0;
        let prediction = avg;
        if (data.length > 3) {
            const alpha = 0.3;
            let ewma = vals[0];
            for (let i = 1; i < vals.length; i++)
                ewma = alpha * vals[i] + (1 - alpha) * ewma;
            const rv = vals.slice(-Math.min(5, vals.length));
            const mom =
                rv.length > 1 ? (rv[rv.length - 1] - rv[0]) / rv.length : 0;
            const chg = vals.slice(1).map((v, i) => v - vals[i]);
            const vol =
                chg.length ?
                    Math.sqrt(chg.reduce((s, c) => s + c * c, 0) / chg.length)
                :   0;
            prediction =
                0.4 * ewma +
                0.3 * (recent + mom * 2) +
                0.2 * (recent + (trend / data.length) * 3) +
                0.1 * avg;
            if (vol > 0.1) prediction = 0.7 * prediction + 0.3 * recent;
            if (reportType === "weekly" || reportType === "monthly")
                prediction = 0.6 * prediction + 0.4 * ewma;
        } else prediction = recent + trend * 0.5;
        prediction = Math.max(0, Math.min(maxRange * 0.95, prediction));
        return { max, min, avg, trend, prediction, recent };
    }, [data, maxRange, reportType]);

    // ── Chart rendering ───────────────────────────────────────────────────────
    const isLive = reportType === "today" && dailyView === "live";
    const isHourly = reportType === "today" && dailyView === "hourly";
    const isAnnual = reportType === "annually";
    const showLegend = isAnnual && displayData.length > 0;
    const canInteract = data.length > 0 && !!dataStats;

    const renderDefs = () => (
        <defs>
            <linearGradient id="grad-main" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT_COLOR} stopOpacity={0.22} />
                <stop
                    offset="100%"
                    stopColor={ACCENT_COLOR}
                    stopOpacity={0.01}
                />
            </linearGradient>
            <linearGradient id="grad-max" x1="0" y1="0" x2="0" y2="1">
                <stop
                    offset="0%"
                    stopColor={HOURLY_COLORS.Max}
                    stopOpacity={0.18}
                />
                <stop
                    offset="100%"
                    stopColor={HOURLY_COLORS.Max}
                    stopOpacity={0.01}
                />
            </linearGradient>
            <linearGradient id="grad-min" x1="0" y1="0" x2="0" y2="1">
                <stop
                    offset="0%"
                    stopColor={HOURLY_COLORS.Min}
                    stopOpacity={0.18}
                />
                <stop
                    offset="100%"
                    stopColor={HOURLY_COLORS.Min}
                    stopOpacity={0.01}
                />
            </linearGradient>
            {GRADIENT_COLORS.map((g, i) => (
                <linearGradient
                    key={i}
                    id={`grad-a-${i}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1">
                    <stop offset="0%" stopColor={g.start} stopOpacity={0.15} />
                    <stop
                        offset="100%"
                        stopColor={g.start}
                        stopOpacity={0.01}
                    />
                </linearGradient>
            ))}
        </defs>
    );

    const renderThresholdBands = useCallback(() => {
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
                            fillOpacity={0.05}
                            stroke="none"
                        />
                        {i > 0 && (
                            <ReferenceLine
                                y={t.converted_min_level}
                                stroke={color}
                                strokeDasharray="5 4"
                                strokeWidth={1}
                                strokeOpacity={0.4}
                            />
                        )}
                    </React.Fragment>
                );
            });
    }, [thresholds]);

    const renderLines = useCallback(() => {
        const currentYear = dayjs().year().toString();
        let annualIdx = 0;
        const keys =
            lineKeys.length > 0 ?
                lineKeys
            :   Object.keys(displayData[0] || {}).filter(
                    (k) => k !== "date" && k !== "_clustered",
                );

        return keys.map((key) => {
            let color = ACCENT_COLOR,
                gradId = "grad-main";
            if (isHourly) {
                color = HOURLY_COLORS[key] ?? ACCENT_COLOR;
                gradId =
                    key === "Max" ? "grad-max"
                    : key === "Min" ? "grad-min"
                    : "grad-main";
            } else if (isAnnual) {
                const gc = GRADIENT_COLORS[annualIdx % GRADIENT_COLORS.length];
                color = key === currentYear ? ACCENT_COLOR : gc.start;
                gradId =
                    key === currentYear ? "grad-main" : (
                        `grad-a-${annualIdx % GRADIENT_COLORS.length}`
                    );
                annualIdx++;
            }

            const sw = isLive ? 1.5 : 2.5;

            const dotRenderer = (props) => {
                if (props.cy == null || isNaN(props.cy) || props.value == null)
                    return null;
                if (isLive && props.index === displayData.length - 1)
                    return (
                        <PulsingDot
                            key="pulse"
                            cx={props.cx}
                            cy={props.cy}
                            color={color}
                        />
                    );
                if (isLive || isClustered) return null;
                const isLast = props.index === displayData.length - 1;
                return (
                    <circle
                        key={`d-${key}-${props.index}`}
                        cx={props.cx}
                        cy={props.cy}
                        r={isLast ? 5 : 3.5}
                        fill={isLast ? color : "#fff"}
                        stroke={color}
                        strokeWidth={2}
                    />
                );
            };

            return (
                <React.Fragment key={key}>
                    {/* tooltipType="none" prevents Area from contributing to the tooltip payload */}
                    <Area
                        type="monotoneX"
                        dataKey={key}
                        stroke="none"
                        fill={`url(#${gradId})`}
                        fillOpacity={1}
                        dot={false}
                        activeDot={false}
                        isAnimationActive={false}
                        connectNulls={false}
                        legendType="none"
                        tooltipType="none"
                    />
                    <Line
                        type="monotoneX"
                        dataKey={key}
                        stroke={color}
                        strokeWidth={sw}
                        dot={dotRenderer}
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
                                    r={6}
                                    fill={color}
                                    stroke="#fff"
                                    strokeWidth={2}
                                    style={{
                                        filter: `drop-shadow(0 0 5px ${color})`,
                                    }}
                                />
                            );
                        }}
                        connectNulls={false}
                        isAnimationActive={false}
                    />
                </React.Fragment>
            );
        });
    }, [
        reportType,
        dailyView,
        lineKeys,
        displayData,
        isLive,
        isHourly,
        isAnnual,
        isClustered,
    ]);

    const yearOptions = useMemo(
        () =>
            Array.from({ length: 10 }, (_, i) => {
                const y = (dayjs().year() - i).toString();
                return (
                    <Option key={y} value={y}>
                        {y}
                    </Option>
                );
            }),
        [],
    );

    const chartHeight =
        isMobile ? "calc(100svh - 300px)" : "calc(100vh - 360px)";
    const chartMinHeight = isMobile ? 200 : 260;

    if (!initialLoadDone) {
        return (
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "#fff",
                    zIndex: 100,
                }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <Space
            direction="vertical"
            style={{ width: "100%", padding: isMobile ? 10 : 20 }}
            size={isMobile ? 8 : 14}>
            {/* ── Header ───────────────────────────────────────────────────── */}
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
                        <Text style={{ color: "rgba(255,255,255,0.72)" }}>
                            Real-time monitoring and historical data
                        </Text>
                    </div>
                    {!isMobile && (
                        <Space size={8}>
                            <Button
                                type="default"
                                ghost
                                icon={<BarChartOutlined />}
                                onClick={handleToggleForecast}
                                disabled={!canInteract}
                                style={{
                                    color:
                                        canInteract ? "white" : (
                                            "rgba(255,255,255,0.3)"
                                        ),
                                    borderColor:
                                        canInteract ? "white" : (
                                            "rgba(255,255,255,0.2)"
                                        ),
                                }}>
                                Forecast
                            </Button>
                            <Button
                                type="default"
                                ghost
                                icon={<FilePdfOutlined />}
                                onClick={handleOpenPdfModal}
                                disabled={!canInteract}
                                style={{
                                    color:
                                        canInteract ? "white" : (
                                            "rgba(255,255,255,0.3)"
                                        ),
                                    borderColor:
                                        canInteract ? "white" : (
                                            "rgba(255,255,255,0.2)"
                                        ),
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

            {/* ── Chart Card ───────────────────────────────────────────────── */}
            <Card
                style={{ ...cardStyleAdaptive }}
                styles={{ body: { padding: isMobile ? 8 : 18 } }}
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
                                <Space size={4}>
                                    <Button
                                        type="text"
                                        icon={<BarChartOutlined />}
                                        onClick={handleToggleForecast}
                                        disabled={!canInteract}
                                        style={{
                                            color:
                                                canInteract ?
                                                    THEME.BLUE_PRIMARY
                                                :   "#ccc",
                                        }}
                                    />
                                    <Button
                                        type="text"
                                        icon={<FilePdfOutlined />}
                                        onClick={handleOpenPdfModal}
                                        disabled={!canInteract}
                                        style={{
                                            color:
                                                canInteract ?
                                                    THEME.BLUE_PRIMARY
                                                :   "#ccc",
                                        }}
                                    />
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
                {/* Report type picker */}
                {!isMobile && (
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            marginBottom: 14,
                        }}>
                        <Radio.Group
                            value={reportType}
                            onChange={handleReportTypeChange}
                            buttonStyle="solid"
                            size="large"
                            style={{
                                display: "flex",
                                gap: 6,
                                boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
                                borderRadius: 8,
                                padding: 4,
                                background: "white",
                            }}>
                            <Radio.Button
                                value="today"
                                style={{ borderRadius: 6 }}>
                                Today
                            </Radio.Button>
                            <Radio.Button
                                value="weekly"
                                style={{ borderRadius: 6 }}>
                                Weekly
                            </Radio.Button>
                            <Radio.Button
                                value="monthly"
                                style={{ borderRadius: 6 }}>
                                Monthly
                            </Radio.Button>
                            <Radio.Button
                                value="annually"
                                style={{ borderRadius: 6 }}>
                                Annual
                            </Radio.Button>
                        </Radio.Group>
                    </div>
                )}

                {/* Daily sub-mode */}
                {!isMobile && reportType === "today" && (
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            marginBottom: 14,
                        }}>
                        <Space size={8}>
                            <Text strong>View:</Text>
                            <Select
                                value={
                                    dailyView === "live" ?
                                        `live_${liveWindow}`
                                    :   "hourly"
                                }
                                onChange={(v) => {
                                    if (v === "hourly") {
                                        handleDailyViewChange("hourly");
                                    } else {
                                        handleDailyViewChange("live");
                                        handleLiveWindowChange(
                                            parseInt(v.split("_")[1]),
                                        );
                                    }
                                }}
                                size="large"
                                style={{ width: 180 }}>
                                {LIVE_WINDOWS.map(({ label, minutes }) => (
                                    <Option
                                        key={minutes}
                                        value={`live_${minutes}`}>
                                        {label}
                                    </Option>
                                ))}
                                <Option value="hourly">Hourly (today)</Option>
                            </Select>
                        </Space>
                    </div>
                )}

                {/* Monthly controls */}
                {!isMobile && reportType === "monthly" && (
                    <Space
                        size="middle"
                        style={{
                            width: "100%",
                            justifyContent: "center",
                            marginBottom: 14,
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
                            />
                        </Space>
                        <Space size="small">
                            <Text strong>View:</Text>
                            <Select
                                value={monthView}
                                onChange={handleMonthViewChange}
                                size="large"
                                style={{ width: 120 }}>
                                <Option value="day">Daily</Option>
                                <Option value="week">Weekly</Option>
                            </Select>
                        </Space>
                        <Button
                            onClick={resetMonthly}
                            icon={<ReloadOutlined />}
                            size="large">
                            Reset
                        </Button>
                    </Space>
                )}

                {/* Annual controls */}
                {!isMobile && reportType === "annually" && (
                    <Space
                        size="middle"
                        style={{
                            width: "100%",
                            justifyContent: "center",
                            marginBottom: 14,
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
                                style={{ minWidth: 220 }}
                                maxTagCount={3}>
                                {yearOptions}
                            </Select>
                        </Space>
                        <Button
                            onClick={resetAnnual}
                            icon={<ReloadOutlined />}
                            size="large">
                            Reset
                        </Button>
                    </Space>
                )}

                {/* Chart title */}
                <div style={{ textAlign: "center", marginBottom: 8 }}>
                    <Title
                        level={isMobile ? 5 : 3}
                        style={{
                            margin: 0,
                            background: `linear-gradient(135deg, ${THEME.BLUE_AUTHORITY} 0%, ${THEME.BLUE_PRIMARY} 100%)`,
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            fontWeight: 800,
                        }}>
                        {chartTitle}
                    </Title>
                    <Text
                        type="secondary"
                        style={{
                            fontSize: isMobile ? 11 : 12,
                            display: "block",
                            marginTop: 2,
                            fontWeight: 500,
                        }}>
                        {chartSubtitle}
                    </Text>
                </div>

                {/* Chart */}
                {loading || (isFetchingData && !isRealtimeUpdate.current) ?
                    <div
                        style={{
                            height: chartHeight,
                            minHeight: chartMinHeight,
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                        }}>
                        <Spin size="large" />
                    </div>
                : displayData.length === 0 ?
                    <div
                        style={{
                            height: chartHeight,
                            minHeight: chartMinHeight,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}>
                        <Empty
                            description={
                                <>
                                    <Text type="secondary">No data found</Text>
                                    <br />
                                    <Text
                                        type="secondary"
                                        style={{ fontSize: 12 }}>
                                        Try a different time period
                                    </Text>
                                </>
                            }
                        />
                    </div>
                :   <div
                        style={{
                            width: "100%",
                            height: chartHeight,
                            minHeight: chartMinHeight,
                        }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={displayData}
                                margin={{
                                    top: isMobile ? 4 : 16,
                                    right: isMobile ? 18 : 44,
                                    left: isMobile ? -30 : 0,
                                    bottom: 0,
                                }}>
                                {renderDefs()}
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="rgba(0,0,0,0.06)"
                                    vertical={false}
                                />
                                {renderThresholdBands()}
                                <XAxis
                                    dataKey="date"
                                    angle={-38}
                                    textAnchor="end"
                                    height={isMobile ? 48 : 58}
                                    interval="preserveStartEnd"
                                    tick={
                                        isLive ? false : (
                                            {
                                                fontSize: isMobile ? 9 : 11,
                                                fill: "#9ca3af",
                                            }
                                        )
                                    }
                                    axisLine={{ stroke: "rgba(0,0,0,0.07)" }}
                                    tickLine={
                                        isLive ? false : (
                                            { stroke: "rgba(0,0,0,0.07)" }
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
                                            fontSize: isMobile ? 10 : 12,
                                            fontWeight: 600,
                                            fill: THEME.BLUE_AUTHORITY,
                                            textAnchor: "middle",
                                        },
                                    }}
                                    tick={{
                                        fontSize: isMobile ? 9 : 11,
                                        fill: "#9ca3af",
                                    }}
                                    axisLine={{ stroke: "rgba(0,0,0,0.07)" }}
                                    tickLine={{ stroke: "rgba(0,0,0,0.07)" }}
                                />
                                <Tooltip
                                    content={<CustomTooltip />}
                                    cursor={<CustomCursor />}
                                />
                                {showLegend && (
                                    <Legend
                                        verticalAlign="top"
                                        height={38}
                                        wrapperStyle={{
                                            fontSize: 12,
                                            fontWeight: 500,
                                            paddingTop: 4,
                                        }}
                                    />
                                )}
                                {renderLines()}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                }

                {/* Hourly legend */}
                {isHourly && displayData.length > 0 && (
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            gap: 20,
                            marginTop: 8,
                        }}>
                        {Object.entries(HOURLY_COLORS).map(([k, c]) => (
                            <Space key={k} size={6}>
                                <div
                                    style={{
                                        width: 18,
                                        height: 3,
                                        borderRadius: 2,
                                        background: c,
                                    }}
                                />
                                <Text
                                    style={{
                                        fontSize: 12,
                                        color: "rgba(0,0,0,0.5)",
                                        fontWeight: 500,
                                    }}>
                                    {k}
                                </Text>
                            </Space>
                        ))}
                    </div>
                )}

                {/* Stats bar */}
                {thresholds.length > 0 && dataStats && (
                    <StatsBar dataStats={dataStats} />
                )}

                {/* Forecast panel */}
                {showForecast && data.length > 0 && dataStats && (
                    <div ref={forecastRef}>
                        <ForecastPanel
                            data={data}
                            dataStats={dataStats}
                            thresholds={thresholds}
                            reportType={reportType}
                            isMobile={isMobile}
                        />
                    </div>
                )}

                {/* Floating close forecast */}
                {showForecast && forecastScrolled && (
                    <div
                        style={{
                            position: "fixed",
                            ...(isMobile ? { bottom: 28 } : { top: 80 }),
                            left: "50%",
                            transform: "translateX(-50%)",
                            zIndex: 1000,
                            filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.18))",
                        }}>
                        <Button
                            type="primary"
                            danger
                            icon={<CloseOutlined />}
                            onClick={handleCloseForecast}
                            size="large"
                            style={{
                                borderRadius: 24,
                                paddingInline: 24,
                                height: 44,
                                fontWeight: 600,
                            }}>
                            Close Forecast
                        </Button>
                    </div>
                )}
            </Card>

            {/* ── Mobile Filter Drawer ──────────────────────────────────────── */}
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
                    body: { padding: 16 },
                    mask: { backdropFilter: "blur(4px)" },
                }}
                closable={false}
                maskClosable>
                <Card
                    variant={false}
                    style={{
                        ...cardStyleAdaptive,
                        borderTop: `4px solid ${THEME.BLUE_PRIMARY}`,
                        backgroundColor: "rgba(255,255,255,0.9)",
                        borderRadius: "0 0 10vw 10vw",
                    }}>
                    <Space
                        direction="vertical"
                        size={14}
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
                                <Radio.Button
                                    value="today"
                                    style={{ flex: 1, textAlign: "center" }}>
                                    Today
                                </Radio.Button>
                                <Radio.Button
                                    value="weekly"
                                    style={{ flex: 1, textAlign: "center" }}>
                                    Week
                                </Radio.Button>
                                <Radio.Button
                                    value="monthly"
                                    style={{ flex: 1, textAlign: "center" }}>
                                    Month
                                </Radio.Button>
                                <Radio.Button
                                    value="annually"
                                    style={{ flex: 1, textAlign: "center" }}>
                                    Year
                                </Radio.Button>
                            </Radio.Group>
                        </div>
                        {reportType === "today" && (
                            <div>
                                <Text
                                    strong
                                    style={{
                                        display: "block",
                                        marginBottom: 8,
                                        fontSize: 13,
                                        textAlign: "center",
                                    }}>
                                    Daily View
                                </Text>
                                <Select
                                    value={
                                        dailyView === "live" ?
                                            `live_${liveWindow}`
                                        :   "hourly"
                                    }
                                    onChange={(v) => {
                                        if (v === "hourly") {
                                            handleDailyViewChange("hourly");
                                        } else {
                                            handleDailyViewChange("live");
                                            handleLiveWindowChange(
                                                parseInt(v.split("_")[1]),
                                            );
                                        }
                                    }}
                                    style={{ width: "100%", height: 36 }}>
                                    {LIVE_WINDOWS.map(({ label, minutes }) => (
                                        <Option
                                            key={minutes}
                                            value={`live_${minutes}`}>
                                            {label}
                                        </Option>
                                    ))}
                                    <Option value="hourly">
                                        Hourly (today)
                                    </Option>
                                </Select>
                            </div>
                        )}
                        {reportType === "monthly" && (
                            <Space
                                direction="vertical"
                                style={{ width: "100%" }}
                                size={10}>
                                <div>
                                    <Text
                                        strong
                                        style={{
                                            display: "block",
                                            marginBottom: 6,
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
                                            marginBottom: 6,
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
                                        style={{ width: "45%", height: 32 }}>
                                        Reset Month
                                    </Button>
                                </Flex>
                            </Space>
                        )}
                        {reportType === "annually" && (
                            <Space
                                direction="vertical"
                                style={{ width: "100%" }}
                                size={10}>
                                <div>
                                    <Text
                                        strong
                                        style={{
                                            display: "block",
                                            marginBottom: 6,
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
                                        style={{ width: "45%", height: 32 }}>
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
                        transform: "translate(-50%, -50%)",
                        zIndex: 10000,
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
                            fontSize: 22,
                        }}
                    />
                </div>
            </Drawer>

            {/* ── PDF Modal ─────────────────────────────────────────────────── */}
            <ReportGeneratorModal
                open={pdfModalOpen}
                onClose={handleClosePdfModal}
                chartTitle={chartTitle}
                chartSubtitle={chartSubtitle}
                reportType={reportType}
                data={data}
                dataStats={dataStats}
                thresholds={thresholds}
                lineKeys={lineKeys}
                yDomain={getYAxisDomain}
                yTicks={yAxisTicks}
                selectedMonth={selectedMonth}
                selectedYears={selectedYears}
            />
        </Space>
    );
};

export default ReportPage;
