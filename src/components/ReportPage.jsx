import { useEffect, useState, useCallback, useMemo } from "react";
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
    Select,
    DatePicker,
    Space,
    Button,
    Spin,
    message,
    Radio,
    Card,
    Typography,
    Flex, // 👈 USING Ant Design Flex for responsive layout
} from "antd";
import { supabase } from "@/globals";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";

dayjs.extend(isoWeek);

const { Option } = Select;
const { Title, Text } = Typography;

// --- USER-PROVIDED THEME COLORS ---
const ACCENT_COLOR = "#f8b701";
const PRIMARY_COLOR = "#0a3b82";
const COMPARISON_LINE_COLORS = [
    "#FF0000",
    "#0000FF",
    "#008000",
    "#FFD700",
    "#800080",
    "#00FFFF",
    "#FF4500",
    "#00FF00",
    "#FF00FF",
    "#A52A2A",
];
// ----------------------------------

// 🏛️ Government Theme Colors (Official/Blue-centric palette)
const GOVERNMENT_THEME = {
    PRIMARY_BLUE: PRIMARY_COLOR, // Deep Official Blue (#0a3b82)
    ACCENT_RED: "#CC3333", // Clear Danger Red (for risk zone)
    ACCENT_GREEN: "#33854d", // Clear Safe Green (for safe zone)
    ACCENT_YELLOW: ACCENT_COLOR, // Gold/Official Accent (#f8b701)
    LIGHT_GRAY: "#f0f2f5", // Background
    TEXT_COLOR: "#333333",
    GRID_STROKE: "#cccccc",
    // --- NEW THRESHOLD COLORS ---
    LEVEL_1_COLOR: "#33854d", // Greenish/Yellowish (Adjusted original colors for visual hierarchy)
    LEVEL_2_COLOR: "#ffa600ff", // Orange
    LEVEL_3_COLOR: "#ff0000ff", // Red
};

// Colors for comparison lines (Annual View)
const COMPARISON_COLORS = COMPARISON_LINE_COLORS.slice(); // Use the array provided by the user
// Add a few more distinct colors if the list is short, ensuring the primary/accent are used intelligently later
COMPARISON_COLORS.unshift(GOVERNMENT_THEME.PRIMARY_BLUE);
COMPARISON_COLORS.unshift(GOVERNMENT_THEME.ACCENT_YELLOW);

// Utility: Array of months for guaranteed sort order in annual view
const MONTH_ORDER = [
    "Jan",
    "Feb",
    "Mar",
    "Max",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

// --- Utility Functions (Kept the same) ---
const averageBy = (readings, keyFn) => {
    const grouped = readings.reduce((acc, r) => {
        const key = keyFn(r);
        acc[key] ??= { sum: 0, count: 0 };
        acc[key].sum += r.water_level;
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
        (r) => `Week ${Math.ceil(dayjs(r.created_at).date() / 7)}`
    );
// --- End Utility Functions ---

const ReportPage = () => {
    // --- State Initialization (Kept the same) ---
    const [reportType, setReportType] = useState("today");
    const [monthView, setMonthView] = useState("day");
    const [selectedMonth, setSelectedMonth] = useState(dayjs());
    const [selectedYears, setSelectedYears] = useState([
        dayjs().year().toString(),
    ]);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [lineKeys, setLineKeys] = useState([]);

    // Reversed safety logic: Higher levels (6) are SAFE, lower levels (1) are RISK.
    // ADDED L1, L2, L3 THRESHOLDS
    const THRESHOLDS = useMemo(
        () => ({
            SAFE_LEVEL: 4, // Above this is considered SAFE
            RISK_LEVEL: 1,

            L1_LEVEL: 4, // L1 (Closest to Safe - Low Caution)
            L2_LEVEL: 2.5, // L2 (Middle - Moderate Caution)
            L3_LEVEL: 1, // L3 (Closest to Risk - High Caution)
        }),
        []
    );

    // --- Memoized Values (Kept the same logic, simplified for clarity) ---
    const getYAxisDomain = useMemo(() => {
        // Find the highest threshold level for the fixed max domain
        const maxThreshold = THRESHOLDS.SAFE_LEVEL;
        const FIXED_MAX = maxThreshold + 1;
        const MIN_DOMAIN = 0;

        if (!data.length) return [MIN_DOMAIN, FIXED_MAX];

        const values = data.flatMap((d) =>
            Object.entries(d)
                .filter(([k]) => k !== "date")
                .map(([, v]) => v)
        );

        // Ensure domain covers all data points and thresholds
        const actualMin = Math.min(...values, THRESHOLDS.RISK_LEVEL, 0);
        const calculatedMinDomain = Math.max(
            MIN_DOMAIN,
            Math.floor(actualMin * 0.9)
        );

        return [calculatedMinDomain, FIXED_MAX];
    }, [data, THRESHOLDS]);

    const chartTitle = useMemo(() => {
        switch (reportType) {
            case "today": {
                return `Water Level Readings for ${dayjs().format(
                    "MMMM DD, YYYY"
                )}`;
            }
            case "weekly": {
                const start = dayjs().startOf("isoWeek").format("MMM DD");
                const end = dayjs().endOf("isoWeek").format("MMM DD, YYYY");
                return `Average Water Levels: ${start} - ${end}`;
            }
            case "monthly": {
                const month = selectedMonth.format("MMMM YYYY");
                return `Average Water Levels for ${month} (Grouped by ${
                    monthView === "day" ? "Day" : "Week"
                })`;
            }
            case "annually": {
                const years = selectedYears.sort((a, b) => b - a).join(", ");
                return `Comparative Annual Water Level Averages (Years: ${years})`;
            }
            default:
                return "Water Level Monitoring Report";
        }
    }, [reportType, selectedMonth, selectedYears, monthView]);

    // --- Data Fetching Logic (Kept the same) ---
    const fetchReadings = useCallback(async (start, end) => {
        const { data: readings, error } = await supabase
            .from("sensor_readings")
            .select("water_level, created_at")
            .gte("created_at", start.toISOString())
            .lt("created_at", end.toISOString())
            .order("created_at", { ascending: true });

        if (error) {
            console.error("Error fetching readings:", error);
            message.error("Failed to fetch sensor data");
            return [];
        }
        return readings || [];
    }, []);

    const fetchSensorData = useCallback(async () => {
        setLoading(true);
        setData([]);
        setLineKeys([]);
        const today = dayjs();
        let chartData = [];
        let keys = [];

        try {
            switch (reportType) {
                case "today": {
                    const start = today.startOf("day");
                    const end = today.add(1, "day").startOf("day");
                    const readings = await fetchReadings(start, end);
                    chartData = readings.map((r) => ({
                        // Use 12-hour format for better readability in reports
                        date: dayjs(r.created_at).format("hh:mm A"),
                        "Water Level": +r.water_level.toFixed(2),
                    }));
                    keys = ["Water Level"];
                    break;
                }

                case "weekly": {
                    const readings = await fetchReadings(
                        today.startOf("isoWeek"),
                        today.endOf("isoWeek").add(1, "day").startOf("day") // Use start of next day for end bound
                    );
                    chartData = averageByDay(readings);
                    keys = ["Water Level"];
                    break;
                }

                case "monthly": {
                    const readings = await fetchReadings(
                        selectedMonth.startOf("month"),
                        selectedMonth
                            .endOf("month")
                            .add(1, "day")
                            .startOf("day") // Use start of next month for end bound
                    );

                    if (monthView === "week") {
                        chartData = averageByWeek(readings);
                    } else {
                        chartData = averageByDayOfMonth(readings);
                    }
                    keys = ["Water Level"];
                    break;
                }

                case "annually": {
                    const merged = [];
                    let currentKeys = [];

                    // Fetch data for all selected years
                    for (const year of selectedYears) {
                        const start = dayjs(`${year}-01-01T00:00:00Z`);
                        const end = dayjs(`${year}-12-31T23:59:59Z`);

                        const { data: rpcData, error } = await supabase.rpc(
                            "get_monthly_averages_in_range",
                            {
                                start_date: start.toISOString(),
                                end_date: end.toISOString(),
                            }
                        );
                        if (error) throw new Error(`RPC error for ${year}`);

                        const lineKey = `Avg Level ${year}`; // Changed key name for clarity
                        currentKeys.push(lineKey);

                        (rpcData || []).forEach((row) => {
                            const [yr, mon] = row.month_label.split("-");
                            const month = dayjs(`${yr}-${mon}-01`).format(
                                "MMM"
                            );
                            // Find existing month data or create new
                            let monthEntry = merged.find(
                                (m) => m.date === month
                            );
                            if (!monthEntry) {
                                monthEntry = { date: month };
                                merged.push(monthEntry);
                            }
                            monthEntry[lineKey] = +row.avg_level.toFixed(2);
                        });
                    }

                    // Sort merged data by month order
                    merged.sort(
                        (a, b) =>
                            MONTH_ORDER.indexOf(a.date) -
                            MONTH_ORDER.indexOf(b.date)
                    );

                    // Fill in missing months with null for continuous lines (Recharts handles null)
                    const finalChartData = MONTH_ORDER.map((month) => {
                        const existing = merged.find(
                            (m) => m.date === month
                        ) || { date: month };
                        currentKeys.forEach((key) => {
                            existing[key] = existing[key] ?? null;
                        });
                        return existing;
                    });

                    chartData = finalChartData;
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
            console.error("Fetch error:", err);
            message.error("Failed to load report data");
        } finally {
            setLoading(false);
        }
    }, [reportType, selectedMonth, monthView, selectedYears, fetchReadings]);

    // --- Effects (Kept the same) ---
    useEffect(() => {
        fetchSensorData();
    }, [fetchSensorData]);

    useEffect(() => {
        const channel = supabase
            .channel("sensor_readings_changes")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "sensor_readings" },
                () => {
                    if (reportType === "today" || reportType === "weekly") {
                        fetchSensorData();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchSensorData, reportType]);

    const resetMonthly = useCallback(() => {
        setMonthView("day");
        setSelectedMonth(dayjs());
        // fetchSensorData will run via the useEffect hook when state changes
    }, []);

    const resetAnnual = () => setSelectedYears([dayjs().year().toString()]);

    // --- Chart Rendering Logic (Updated for government theme) ---
    const renderChartLines = () => {
        const isAnnual = reportType === "annually";
        const currentYearLineKey = `Avg Level ${dayjs().year()}`;

        let colorIndex = 0;

        const keysToRender =
            lineKeys.length > 0
                ? lineKeys
                : Object.keys(data[0] || {}).filter((k) => k !== "date");

        return keysToRender.map((key) => {
            let color = GOVERNMENT_THEME.PRIMARY_BLUE; // Default single-line color

            if (isAnnual) {
                if (key === currentYearLineKey) {
                    // Highlight current year with the user's primary color
                    color = GOVERNMENT_THEME.PRIMARY_BLUE;
                } else {
                    // Use comparison colors for other years
                    color =
                        COMPARISON_COLORS[
                            colorIndex++ % COMPARISON_COLORS.length
                        ];
                }
            } else if (reportType === "today") {
                // Use the accent color for current readings line to draw attention
                color = GOVERNMENT_THEME.ACCENT_YELLOW;
            }

            return (
                <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={color}
                    strokeWidth={isAnnual ? 3 : 2}
                    dot={{ r: isAnnual ? 4 : reportType === "today" ? 0 : 3 }}
                    activeDot={{ r: 8 }}
                    connectNulls={isAnnual} // Important for annual comparisons
                />
            );
        });
    };

    const showLegend = reportType === "annually" && data.length > 0;

    return (
        <div
            style={{
                padding: 24,
                backgroundColor: GOVERNMENT_THEME.LIGHT_GRAY,
                minHeight: "100vh",
            }}
        >
            <Card
                style={{
                    borderRadius: 8,
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                }}
            >
                {/* -- HEADER/TITLE ROW -- */}
                <Flex
                    justify="space-between"
                    align="center"
                    wrap="wrap" // 👈 CRITICAL: Wraps on smaller screens
                    gap={16}
                    style={{
                        marginBottom: 20,
                    }}
                >
                    <Title
                        level={3}
                        style={{
                            margin: 0,
                            color: GOVERNMENT_THEME.PRIMARY_BLUE,
                            flexGrow: 1,
                            minWidth: "50%", // Ensures title has enough space
                        }}
                    >
                        <span
                            style={{
                                color: GOVERNMENT_THEME.ACCENT_YELLOW,
                                marginRight: 8,
                            }}
                        ></span>
                        {chartTitle}
                    </Title>
                    <Button
                        type="primary"
                        onClick={fetchSensorData}
                        loading={loading}
                        style={{
                            backgroundColor: GOVERNMENT_THEME.PRIMARY_BLUE,
                            borderColor: GOVERNMENT_THEME.PRIMARY_BLUE,
                            flexShrink: 0,
                        }}
                    >
                        Refresh Data
                    </Button>
                </Flex>

                <div
                    style={{
                        marginBottom: 0,
                        borderBottom: `1px solid ${GOVERNMENT_THEME.GRID_STROKE}`,
                    }}
                >
                    {/* -- MAIN CONTROL ROW -- */}
                    <Flex
                        justify="flex-start"
                        align="center"
                        wrap="wrap" // 👈 CRITICAL FOR RESPONSIVENESS: Wraps controls onto new lines
                        gap={16} // Space between items
                        style={{
                            padding: "1px 0",
                        }}
                    >
                        {/* Report Type Radio Group */}
                        <Flex
                            vertical={false}
                            align="center"
                            gap={8}
                            wrap="wrap" // Ensures Radio buttons wrap if needed
                        >
                            <Text strong>Select Report View:</Text>
                            <Radio.Group
                                value={reportType}
                                onChange={(e) => setReportType(e.target.value)}
                                buttonStyle="solid"
                            >
                                <Radio.Button value="today">
                                    Today's Readings
                                </Radio.Button>
                                <Radio.Button value="weekly">
                                    Weekly Average
                                </Radio.Button>
                                <Radio.Button value="monthly">
                                    Monthly Average
                                </Radio.Button>
                                <Radio.Button value="annually">
                                    Annual Comparison
                                </Radio.Button>
                            </Radio.Group>
                        </Flex>

                        {/* DYNAMIC FILTERS */}
                        {(reportType === "monthly" ||
                            reportType === "annually") && (
                            <Flex
                                size="middle"
                                align="center"
                                wrap="wrap" // CRITICAL: Wraps date/select controls
                                gap={16}
                                style={{
                                    padding: 12,
                                    borderRadius: 4,
                                    // Use a dashed left border to separate from radio buttons when stacked
                                    borderLeft: `1px dashed ${GOVERNMENT_THEME.GRID_STROKE}`,
                                    paddingLeft: 16,
                                    marginLeft: 16,
                                }}
                            >
                                {reportType === "monthly" && (
                                    <>
                                        <Text strong>Month:</Text>
                                        <DatePicker
                                            picker="month"
                                            value={selectedMonth}
                                            onChange={setSelectedMonth}
                                            allowClear={false}
                                            style={{ minWidth: 120 }}
                                        />
                                        <Text strong>Group By:</Text>
                                        <Select
                                            value={monthView}
                                            onChange={setMonthView}
                                            style={{ width: 100 }}
                                        >
                                            <Option value="day">Day</Option>
                                            <Option value="week">Week</Option>
                                        </Select>
                                        <Button onClick={resetMonthly}>
                                            Reset Month View
                                        </Button>
                                    </>
                                )}

                                {reportType === "annually" && (
                                    <>
                                        <Text strong>Compare Years:</Text>
                                        <Select
                                            mode="multiple"
                                            value={selectedYears}
                                            onChange={setSelectedYears}
                                            placeholder="Select years to compare"
                                            style={{ minWidth: 180 }}
                                        >
                                            {Array.from(
                                                { length: 10 },
                                                (_, i) => {
                                                    const year = (
                                                        dayjs().year() - i
                                                    ).toString();
                                                    return (
                                                        <Option
                                                            key={year}
                                                            value={year}
                                                        >
                                                            {year}
                                                        </Option>
                                                    );
                                                }
                                            )}
                                        </Select>
                                        <Button onClick={resetAnnual}>
                                            Reset Years
                                        </Button>
                                    </>
                                )}
                            </Flex>
                        )}
                    </Flex>
                </div>
                {/* -- CHART AREA -- */}
                <div style={{ padding: "20px 0" }}>
                    {loading ? (
                        <div
                            style={{
                                height: 600,
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                backgroundColor: "#ffffff",
                            }}
                        >
                            <Spin
                                size="large"
                                tip={
                                    <Text
                                        style={{
                                            color: GOVERNMENT_THEME.PRIMARY_BLUE,
                                        }}
                                    >
                                        Loading Official Report Data...
                                    </Text>
                                }
                            />
                        </div>
                    ) : data.length === 0 ? (
                        <div
                            style={{
                                height: 400,
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                border: "1px dashed #ccc",
                                backgroundColor: "#ffffff",
                                borderRadius: 4,
                            }}
                        >
                            <p
                                style={{
                                    fontSize: "1.2em",
                                    color: GOVERNMENT_THEME.TEXT_COLOR,
                                }}
                            >
                                No sensor readings found for the selected
                                period.
                            </p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={600}>
                            <LineChart
                                data={data}
                                margin={{
                                    top: 80, // INCREASED for stacking L1, L2, L3 labels
                                    right: 80,
                                    left: 20,
                                    bottom: 20,
                                }}
                            >
                                <CartesianGrid
                                    strokeDashArray="3 3"
                                    stroke={GOVERNMENT_THEME.GRID_STROKE}
                                />

                                {/* DANGER (RED) ZONE: Below Risk Level */}
                                <ReferenceArea
                                    y1={getYAxisDomain[0]}
                                    y2={THRESHOLDS.RISK_LEVEL}
                                    fill={GOVERNMENT_THEME.ACCENT_RED}
                                    opacity={0.15}
                                    label={{
                                        value: "ALERT: Low Water Risk Zone",
                                        position: "top",
                                        fill: GOVERNMENT_THEME.ACCENT_RED,
                                        fontWeight: "bold",
                                        fontSize: 14,
                                        dy: 33,
                                    }}
                                />

                                {/* SAFE (GREEN) ZONE: Above Safe Level */}
                                <ReferenceArea
                                    y1={THRESHOLDS.SAFE_LEVEL}
                                    y2={getYAxisDomain[1]}
                                    fill={GOVERNMENT_THEME.ACCENT_GREEN}
                                    opacity={0.15}
                                    label={{
                                        value: "Normal/Safe Zone",
                                        position: "bottom",
                                        fill: GOVERNMENT_THEME.ACCENT_GREEN,
                                        fontWeight: "bold",
                                        fontSize: 14,
                                        dy: -40,
                                    }}
                                />

                                {/* --- NEW THRESHOLD LINES (L1, L2, L3) --- */}

                                {/* L1 (Closest to Safe) */}
                                <ReferenceLine
                                    y={THRESHOLDS.L1_LEVEL}
                                    stroke={GOVERNMENT_THEME.LEVEL_1_COLOR}
                                    strokeWidth={2}
                                    strokeDashArray="4 4"
                                    label={{
                                        value: `L1 THRESHOLD: ${THRESHOLDS.L1_LEVEL}m (Low Caution)`,
                                        position: "top",
                                        fill: GOVERNMENT_THEME.LEVEL_1_COLOR,
                                        fontSize: 12,
                                        fontWeight: "bold",
                                        dy: 20, // Adjusted to prevent overlap with L2
                                    }}
                                />

                                {/* L2 (Middle) */}
                                <ReferenceLine
                                    y={THRESHOLDS.L2_LEVEL}
                                    stroke={GOVERNMENT_THEME.LEVEL_2_COLOR}
                                    strokeWidth={2}
                                    strokeDashArray="4 4"
                                    label={{
                                        value: `L2 THRESHOLD: ${THRESHOLDS.L2_LEVEL}m (Moderate Caution)`,
                                        position: "top",
                                        fill: GOVERNMENT_THEME.LEVEL_2_COLOR,
                                        fontSize: 12,
                                        fontWeight: "bold",
                                        dy: 0, // Adjusted to prevent overlap with L3
                                    }}
                                />

                                {/* L3 (Closest to Risk) */}
                                <ReferenceLine
                                    y={THRESHOLDS.L3_LEVEL}
                                    stroke={GOVERNMENT_THEME.LEVEL_3_COLOR}
                                    strokeWidth={2}
                                    strokeDashArray="4 4"
                                    label={{
                                        value: `L3 THRESHOLD: ${THRESHOLDS.L3_LEVEL}m (High Caution)`,
                                        position: "top",
                                        fill: GOVERNMENT_THEME.LEVEL_3_COLOR,
                                        fontSize: 12,
                                        fontWeight: "bold",
                                        dy: 1, // Adjusted to prevent overlap with L1/L2
                                    }}
                                />

                                <XAxis
                                    dataKey="date"
                                    angle={
                                        reportType === "today" ||
                                        reportType === "monthly"
                                            ? -45 // Rotate for crowded time-series data
                                            : 0
                                    }
                                    textAnchor={
                                        reportType === "today" ||
                                        reportType === "monthly"
                                            ? "end"
                                            : "middle"
                                    }
                                    height={
                                        reportType === "today" ||
                                        reportType === "monthly"
                                            ? 60
                                            : 30
                                    } // Increase height for rotation
                                    stroke={GOVERNMENT_THEME.TEXT_COLOR}
                                    tickLine={{
                                        stroke: GOVERNMENT_THEME.TEXT_COLOR,
                                    }}
                                    // IMPROVEMENT: Preserve start and end ticks for better context on mobile
                                    interval="preserveStartEnd"
                                />
                                <YAxis
                                    domain={getYAxisDomain}
                                    label={{
                                        value: "Water Level (meters)",
                                        angle: -90,
                                        position: "left",
                                        fill: GOVERNMENT_THEME.PRIMARY_BLUE,
                                        fontWeight: "bold",
                                        dx: -10,
                                    }}
                                    tick={{ fill: GOVERNMENT_THEME.TEXT_COLOR }}
                                    stroke={GOVERNMENT_THEME.TEXT_COLOR}
                                    tickLine={{
                                        stroke: GOVERNMENT_THEME.TEXT_COLOR,
                                    }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "#ffffff",
                                        border: `1px solid ${GOVERNMENT_THEME.GRID_STROKE}`,
                                        borderRadius: 4,
                                    }}
                                    labelStyle={{
                                        color: GOVERNMENT_THEME.PRIMARY_BLUE,
                                        fontWeight: "bold",
                                    }}
                                />
                                {showLegend && (
                                    <Legend
                                        verticalAlign="top"
                                        align="right"
                                        wrapperStyle={{ top: 0, right: 0 }}
                                    />
                                )}
                                {renderChartLines()}
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default ReportPage;
