// ReportPage.jsx  — with PDF Report Generation
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
    ConfigProvider,
    Flex,
    Badge,
    Skeleton,
    Tooltip as AntTooltip,
} from "antd";
import {
    ReloadOutlined,
    CalendarOutlined,
    LineChartOutlined,
    FilterOutlined,
    CloseOutlined,
    RiseOutlined,
    FallOutlined,
    DotChartOutlined,
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

// ─── Averaging helpers ─────────────────────────────────────────────
const averageBy = (readings, keyFn) => {
    const grouped = readings.reduce((acc, r) => {
        const key = keyFn(r);
        acc[key] ??= { sum: 0, count: 0 };
        const actualLevel = parseFloat(r.converted_water_level);
        acc[key].sum += actualLevel;
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

// ─── Sub-components ────────────────────────────────────────────────
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
                backgroundColor: "rgba(255, 255, 255, 0.98)",
                border: "none",
                borderRadius: 12,
                padding: "12px 16px",
                boxShadow:
                    "0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0,0,0,0.08)",
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
                .filter(
                    (entry) =>
                        entry.value !== null && entry.value !== undefined,
                )
                .map((entry, index) => (
                    <div
                        key={index}
                        style={{
                            marginBottom: index < payload.length - 1 ? 4 : 0,
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
        if (isFetchingData) {
            return (
                <Space size={4}>
                    <LoadingOutlined spin />
                    <span>Loading...</span>
                </Space>
            );
        }
        if (currentLevel === null || !dataStats) return null;
        if (badgeIndex === 0) {
            return (
                <Space size={4}>
                    <span>Current: {currentLevel.toFixed(2)}m</span>
                </Space>
            );
        }
        if (badgeIndex === 1) {
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
        }
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

// ─── Main Page ─────────────────────────────────────────────────────
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

    const [pdfModalOpen, setPdfModalOpen] = useState(false);
    const chartContainerRef = useRef(null);
    const forecastRef = useRef(null);
    const [showForecast, setShowForecast] = useState(false);
    // Tracks whether user has scrolled past the chart (to show persistent close btn)
    const [forecastScrolled, setForecastScrolled] = useState(false);

    const { isMobile } = useResponsive();
    const isRealtimeUpdate = useRef(false);

    useEffect(() => {
        const interval = setInterval(() => {
            setBadgeIndex((prev) => (prev + 1) % 3);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    // ── Scroll listener: show persistent close btn whenever forecast panel is visible
    useEffect(() => {
        if (!showForecast) {
            setForecastScrolled(false);
            return;
        }
        const checkVisibility = () => {
            if (!forecastRef.current) return;
            const rect = forecastRef.current.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            // Show button whenever any part of the forecast panel is visible in viewport
            const isVisible = rect.top < viewportHeight && rect.bottom > 0;
            setForecastScrolled(isVisible);
        };
        // Check immediately after render in case forecast is already visible
        setTimeout(checkVisibility, 100);
        window.addEventListener("scroll", checkVisibility, { passive: true });
        window.addEventListener("resize", checkVisibility, { passive: true });
        return () => {
            window.removeEventListener("scroll", checkVisibility);
            window.removeEventListener("resize", checkVisibility);
        };
    }, [showForecast]);

    const fetchCurrentLevel = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from("sensor_readings")
                .select("converted_water_level, created_at")
                .order("created_at", { ascending: false })
                .limit(1)
                .single();
            if (error) throw error;
            if (data) setCurrentLevel(parseFloat(data.converted_water_level));
        } catch (error) {
            console.error("Failed to fetch current level:", error);
        }
    }, []);

    const fetchThresholds = useCallback(async () => {
        try {
            const { data: thresholdData, error } = await supabase
                .from("water_thresholds")
                .select("*")
                .order("converted_min_level", { ascending: true });
            if (error) throw error;
            const firstThreshold = thresholdData?.[0];
            if (firstThreshold?.max_range)
                setMaxRange(parseFloat(firstThreshold.max_range));
            const sortedThresholds = (thresholdData || []).map((t) => ({
                ...t,
                converted_min_level: parseFloat(t.converted_min_level),
                converted_max_level: parseFloat(t.converted_max_level),
            }));
            setThresholds(sortedThresholds);
            return sortedThresholds;
        } catch (error) {
            showWarning("Failed to load thresholds");
            return [];
        }
    }, []);

    const fetchReadings = useCallback(async (start, end) => {
        try {
            setIsFetchingData(true);
            let allReadings = [];
            let from = 0;
            const step = 500;
            let to = step - 1;
            let hasMore = true;
            while (hasMore) {
                const { data: readings, error } = await supabase
                    .from("sensor_readings")
                    .select("converted_water_level, created_at")
                    .gte("created_at", start.toISOString())
                    .lt("created_at", end.toISOString())
                    .order("created_at", { ascending: true })
                    .range(from, to);
                if (error) throw error;
                if (readings && readings.length > 0) {
                    allReadings = [...allReadings, ...readings];
                    if (readings.length === step) {
                        from += step;
                        to += step;
                    } else hasMore = false;
                } else {
                    hasMore = false;
                }
            }
            return allReadings;
        } catch (error) {
            console.error(error);
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
            case "annually": {
                const years = [...selectedYears]
                    .sort((a, b) => b - a)
                    .join(", ");
                return `Annual Comparison (${years})`;
            }
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
            let chartData = [];
            let keys = [];
            let currentThresholds = thresholds;
            if (!currentThresholds.length)
                currentThresholds = await fetchThresholds();

            try {
                switch (reportType) {
                    case "today": {
                        const start = today.startOf("day");
                        const end = today.add(1, "day").startOf("day");
                        const readings = await fetchReadings(start, end);
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
                        if (selectedYears.length === 0) {
                            showWarning("Please select at least one year");
                            break;
                        }
                        const merged = [];
                        const currentKeys = [];
                        for (const year of selectedYears) {
                            const start = dayjs(`${year}-01-01T00:00:00Z`);
                            const end = dayjs(`${year}-12-31T23:59:59Z`);
                            const { data: rpcData, error } = await supabase.rpc(
                                "get_monthly_averages_in_range",
                                {
                                    start_date: start.toISOString(),
                                    end_date: end.toISOString(),
                                },
                            );
                            if (error) {
                                showError(`Failed to load data for ${year}`);
                                continue;
                            }
                            const lineKey = `${year}`;
                            currentKeys.push(lineKey);
                            (rpcData || []).forEach((row) => {
                                const [yr, mon] = row.month_label.split("-");
                                const month = dayjs(`${yr}-${mon}-01`).format(
                                    "MMM",
                                );
                                const value = +parseFloat(
                                    row.avg_converted_level || row.avg_level,
                                ).toFixed(2);
                                const existing = merged.find(
                                    (m) => m.date === month,
                                );
                                if (existing) existing[lineKey] = value;
                                else
                                    merged.push({
                                        date: month,
                                        [lineKey]: value,
                                    });
                            });
                        }
                        chartData = merged
                            .sort(
                                (a, b) =>
                                    MONTH_ORDER.indexOf(a.date) -
                                    MONTH_ORDER.indexOf(b.date),
                            )
                            .map((entry) => {
                                const filled = { ...entry };
                                currentKeys.forEach((k) => {
                                    if (filled[k] === undefined)
                                        filled[k] = null;
                                });
                                return filled;
                            });
                        keys = currentKeys;
                        break;
                    }
                    default:
                        chartData = [];
                        keys = [];
                }
                setData(chartData);
                setLineKeys(keys);
            } catch (err) {
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
        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchSensorData, reportType, fetchCurrentLevel]);

    const resetMonthly = useCallback(() => {
        setMonthView("day");
        setSelectedMonth(dayjs());
    }, []);
    const resetAnnual = useCallback(() => {
        setSelectedYears([dayjs().year().toString()]);
    }, []);
    const handleReportTypeChange = useCallback((e) => {
        setReportType(e.target.value);
    }, []);
    const handleMonthViewChange = useCallback((value) => {
        setMonthView(value);
    }, []);
    const handleSelectedMonthChange = useCallback((value) => {
        setSelectedMonth(value);
    }, []);
    const handleSelectedYearsChange = useCallback((value) => {
        setSelectedYears(value);
    }, []);
    const handleFilterDrawerClose = useCallback(() => {
        setFilterDrawerVisible(false);
    }, []);
    const handleFilterDrawerOpen = useCallback(() => {
        setFilterDrawerVisible(true);
    }, []);
    const handleRefresh = useCallback(() => {
        fetchSensorData(true);
    }, [fetchSensorData]);

    const handleOpenPdfModal = useCallback(() => {
        setPdfModalOpen(true);
    }, []);
    const handleClosePdfModal = useCallback(() => {
        setPdfModalOpen(false);
    }, []);

    // ── Open forecast and scroll to it
    const handleToggleForecast = useCallback(() => {
        setShowForecast((prev) => {
            const next = !prev;
            if (next) {
                // Wait for render then scroll
                setTimeout(() => {
                    forecastRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                    });
                }, 80);
            } else {
                setForecastScrolled(false);
            }
            return next;
        });
    }, []);

    // ── Close forecast and scroll back up
    const handleCloseForecast = useCallback(() => {
        // Scroll all the way to top first, then close after scroll animation completes
        window.scrollTo({ top: 0, behavior: "smooth" });
        setTimeout(() => {
            setShowForecast(false);
            setForecastScrolled(false);
        }, 600);
    }, []);

    const getYAxisDomain = useMemo(() => {
        const FIXED_MAX = maxRange;
        const MIN_DOMAIN = 0;
        if (!data.length) return [MIN_DOMAIN, FIXED_MAX];
        const values = data.flatMap((d) =>
            Object.entries(d)
                .filter(([k]) => k !== "date")
                .map(([, v]) => v)
                .filter((v) => v !== null && !isNaN(v)),
        );
        const actualMin = Math.min(...values, 0);
        return [Math.max(MIN_DOMAIN, Math.floor(actualMin * 0.9)), FIXED_MAX];
    }, [data, maxRange]);

    const yAxisTicks = useMemo(() => {
        if (!thresholds.length) return undefined;
        const tickSet = new Set();
        const ticks = [];
        thresholds.forEach((t) => {
            const value = Number(t.converted_min_level.toFixed(2));
            if (!tickSet.has(value)) {
                tickSet.add(value);
                ticks.push(value);
            }
        });
        const maxValue = Number(maxRange.toFixed(2));
        if (!tickSet.has(maxValue)) {
            tickSet.add(maxValue);
            ticks.push(maxValue);
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
        const max = Math.max(...values);
        const min = Math.min(...values);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const getPointValue = (point) => {
            if (
                point["Water Level"] !== undefined &&
                point["Water Level"] !== null &&
                !isNaN(point["Water Level"])
            )
                return point["Water Level"];
            const vals = Object.entries(point)
                .filter(([k]) => k !== "date")
                .map(([, v]) => v)
                .filter(
                    (v) => v !== null && typeof v === "number" && !isNaN(v),
                );
            return vals.length > 0 ? vals[vals.length - 1] : 0;
        };
        const recent = getPointValue(data[data.length - 1]);
        const trend = data.length > 1 ? recent - getPointValue(data[0]) : 0;
        let prediction = avg;
        if (data.length > 3) {
            const alpha = 0.3;
            let ewma = values[0];
            for (let i = 1; i < values.length; i++)
                ewma = alpha * values[i] + (1 - alpha) * ewma;
            const recentValues = values.slice(-Math.min(5, values.length));
            const momentum =
                recentValues.length > 1 ?
                    (recentValues[recentValues.length - 1] - recentValues[0]) /
                    recentValues.length
                :   0;
            const changes = [];
            for (let i = 1; i < values.length; i++)
                changes.push(values[i] - values[i - 1]);
            const volatility =
                changes.length > 0 ?
                    Math.sqrt(
                        changes.reduce(
                            (sum, change) => sum + change * change,
                            0,
                        ) / changes.length,
                    )
                :   0;
            prediction =
                0.4 * ewma +
                0.3 * (recent + momentum * 2) +
                0.2 * (recent + (trend / data.length) * 3) +
                0.1 * avg;
            if (volatility > 0.1) prediction = 0.7 * prediction + 0.3 * recent;
            if (reportType === "today" && data.length > 10) {
                const now = dayjs();
                const currentHour = now.hour();
                const similarTimeReadings = data
                    .filter((d) => {
                        const dataHour = parseInt(d.date.split(":")[0]);
                        return Math.abs(dataHour - currentHour) <= 1;
                    })
                    .map((d) => d["Water Level"])
                    .filter((v) => v !== null && !isNaN(v));
                if (similarTimeReadings.length > 0) {
                    const timeBasedAvg =
                        similarTimeReadings.reduce((a, b) => a + b, 0) /
                        similarTimeReadings.length;
                    prediction = 0.7 * prediction + 0.3 * timeBasedAvg;
                }
            }
            if (reportType === "weekly" || reportType === "monthly")
                prediction = 0.6 * prediction + 0.4 * ewma;
        } else {
            prediction = recent + trend * 0.5;
        }
        prediction = Math.max(0, Math.min(maxRange * 0.95, prediction));
        return { max, min, avg, trend, prediction, recent };
    }, [data, maxRange, reportType]);

    const renderChartLines = useCallback(() => {
        const isAnnual = reportType === "annually";
        const currentYear = dayjs().year().toString();
        let colorIndex = 0;
        const keysToRender =
            lineKeys.length > 0 ?
                lineKeys
            :   Object.keys(data[0] || {}).filter((k) => k !== "date");
        return keysToRender.map((key, idx) => {
            let color = ACCENT_COLOR;
            const gradientId = `gradient-${idx}`;
            let gradient = { start: ACCENT_COLOR, end: ACCENT_COLOR };
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
                            if (props.cy == null || isNaN(props.cy))
                                return null;
                            if (props.value == null) return null;
                            const isLastPoint = props.index === data.length - 1;
                            const dotColor = isLastPoint ? ACCENT_COLOR : color;
                            const dotRadius = isAnnual ? 6 : 5;
                            return (
                                <circle
                                    key={`dot-${key}-${props.index}`}
                                    cx={props.cx}
                                    cy={props.cy}
                                    r={dotRadius}
                                    fill={dotColor}
                                    strokeWidth={2}
                                    stroke="#fff"
                                />
                            );
                        }}
                        activeDot={(props) => {
                            if (props.cy == null || isNaN(props.cy))
                                return null;
                            if (props.value == null) return null;
                            return (
                                <circle
                                    key={`active-dot-${key}-${props.index}`}
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
        const sortedThresholds = [...thresholds].sort(
            (a, b) => a.converted_min_level - b.converted_min_level,
        );
        return sortedThresholds.map((threshold, index) => {
            const color = getStatusColor(threshold.name);
            const isBottomThreshold = index === 0;
            return (
                <React.Fragment key={threshold.id}>
                    <ReferenceArea
                        y1={threshold.converted_min_level}
                        y2={threshold.converted_max_level}
                        fill={color}
                        fillOpacity={0.06}
                        stroke="none"
                    />
                    {!isBottomThreshold && (
                        <ReferenceLine
                            y={threshold.converted_min_level}
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

    if (initialLoadDone === false) {
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
                    backgroundColor: "rgba(255, 255, 255)",
                    zIndex: 100,
                }}>
                <Spin size="large" />
            </div>
        );
    }

    const canInteract = data.length > 0 && !!dataStats;

    return (
        <Space
            direction="vertical"
            style={{ width: "100%", padding: isMobile ? 16 : 32 }}
            size="large">
            {/* HEADER */}
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
                            {/* ── Forecast toggle ── */}
                            <Button
                                type="default"
                                ghost
                                icon={<BarChartOutlined />}
                                onClick={handleToggleForecast}
                                disabled={!canInteract}
                                style={{
                                    color:
                                        canInteract ? "white" : (
                                            "rgba(255,255,255,0.35)"
                                        ),
                                    borderColor:
                                        canInteract ? "white" : (
                                            "rgba(255,255,255,0.2)"
                                        ),
                                    background: "transparent",
                                }}>
                                Forecast
                            </Button>

                            {/* ── Export PDF ── */}
                            <Button
                                type="default"
                                ghost
                                icon={<FilePdfOutlined />}
                                onClick={handleOpenPdfModal}
                                disabled={!canInteract}
                                style={{
                                    color:
                                        canInteract ? "white" : (
                                            "rgba(255,255,255,0.35)"
                                        ),
                                    borderColor:
                                        canInteract ? "white" : (
                                            "rgba(255,255,255,0.2)"
                                        ),
                                    background: "transparent",
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

            {/* Chart Section */}
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
                                    {/* ── Mobile: icon-only buttons ── */}
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
                                            background:
                                                showForecast ?
                                                    "rgba(0,0,0,0.06)"
                                                :   "transparent",
                                            borderRadius: 6,
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
                {/* Report Type Selector - Desktop */}
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

                {/* Monthly Controls - Desktop */}
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

                {/* Annual Controls - Desktop */}
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

                {/* Chart Title */}
                <div style={{ textAlign: "center", marginBottom: 20 }}>
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
                            fontSize: isMobile ? 12 : 14,
                            display: "block",
                            marginTop: 4,
                            fontWeight: 500,
                        }}>
                        {chartSubtitle}
                    </Text>
                </div>

                {/* Chart Container */}
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
                        ref={chartContainerRef}
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

                {/* Stats Legend - Desktop */}
                {!isMobile && thresholds.length > 0 && dataStats && (
                    <StatsLegend dataStats={dataStats} />
                )}

                {/* Toggleable Forecast Panel — ref for scroll target */}
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

                {/* ── Persistent floating "Close Forecast" button ──
                 Centered at bottom, visible on all screen sizes when
                 forecast is open and user has scrolled into it        */}
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
                                boxShadow: "0 4px 16px rgba(0,0,0,0.22)",
                            }}>
                            Close Forecast
                        </Button>
                    </div>
                )}
            </Card>

            {/* Mobile Filter Drawer */}
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
                maskClosable={true}>
                <Card
                    variant={false}
                    style={{
                        ...cardStyleAdaptive,
                        height: "100%",
                        borderTop: `4px solid ${THEME.BLUE_PRIMARY}`,
                        backgroundColor: "rgba(255, 255, 255, 0.9)",
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
                        transform: "translate(-50%, -50%)",
                        zIndex: 10000,
                        filter: "drop-shadow(0px 4px 12px rgba(0, 0, 0, 0.2))",
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

            {/* ── PDF Report Modal ── */}
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
