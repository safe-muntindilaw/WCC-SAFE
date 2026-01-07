// ReportPage.jsx
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
    Typography,
    Select,
    DatePicker,
    Space,
    Button,
    Spin,
    message,
    Radio,
} from "antd";
import { supabase } from "@/globals";
import dayjs from "dayjs";

import isoWeek from "dayjs/plugin/isoWeek";

dayjs.extend(isoWeek);

const { Title, Text } = Typography;

const { Option } = Select;

const ACCENT_COLOR = "#f8b701";
const PRIMARY_COLOR = "#0a3b82";
const COLORS = [
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
// Utility: Array of months for guaranteed sort order in annual view
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

const averageBy = (readings, keyFn, convertFn) => {
    const grouped = readings.reduce((acc, r) => {
        const key = keyFn(r);
        acc[key] ??= { sum: 0, count: 0 };
        const actualLevel = convertFn
            ? convertFn(r.water_level)
            : r.water_level;
        acc[key].sum += actualLevel;
        acc[key].count++;
        return acc;
    }, {});
    return Object.entries(grouped).map(([key, val]) => ({
        date: key,
        "Water Level": +(val.sum / val.count).toFixed(2),
    }));
};

const averageByDay = (readings, convertFn) =>
    averageBy(readings, (r) => dayjs(r.created_at).format("ddd"), convertFn);

const averageByDayOfMonth = (readings, convertFn) =>
    averageBy(readings, (r) => dayjs(r.created_at).format("MMM DD"), convertFn);

const averageByWeek = (readings, convertFn) =>
    averageBy(
        readings,
        (r) => `Week ${Math.ceil(dayjs(r.created_at).date() / 7)}`,
        convertFn
    );

const ReportPage = () => {
    const [reportType, setReportType] = useState("today");
    const [monthView, setMonthView] = useState("day");
    const [selectedMonth, setSelectedMonth] = useState(dayjs());
    const [selectedYears, setSelectedYears] = useState([
        dayjs().year().toString(),
    ]);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [lineKeys, setLineKeys] = useState([]);

    // Sensor 0m = water is at top (flood risk) - shows as 4.4m on chart (RED ZONE)
    // Sensor 4.5m = water is at bottom (safe) - shows as 0m on chart (GREEN ZONE)
    const SENSOR_MAX = 4.5;
    const THRESHOLDS = useMemo(
        () => ({
            SAFE_LEVEL: 1.0,
            FLOOD_RISK_LEVEL: 3.5,
        }),
        []
    );

    // Convert sensor reading to chart value (invert it)
    // Lower sensor reading = higher water level = higher on chart
    const convertToChartValue = (sensorReading) => {
        return SENSOR_MAX - sensorReading;
    };

    const getYAxisDomain = useMemo(() => {
        const FIXED_MAX = SENSOR_MAX; // Max is 4.4m
        const MIN_DOMAIN = 0;

        if (!data.length) return [MIN_DOMAIN, FIXED_MAX];

        const values = data.flatMap((d) =>
            Object.entries(d)
                .filter(([k]) => k !== "date")
                .map(([, v]) => v)
        );

        const actualMin = Math.min(...values, 0);
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
                    "MMM DD, YYYY"
                )}`;
            }
            case "weekly": {
                const start = dayjs().startOf("isoWeek").format("MMM DD");
                const end = dayjs().endOf("isoWeek").format("MMM DD, YYYY");
                return `Average Water Levels: ${start} - ${end}`;
            }
            case "monthly": {
                const month = selectedMonth.format("MMMM YYYY");
                // The 'monthView' state (day or week) is implicitly handled by the data
                return `Average Water Levels for ${month}`;
            }
            case "annually": {
                const years = selectedYears.sort((a, b) => b - a).join(", ");
                return `Comparative Annual Water Level Averages (Years: ${years})`;
            }
            default:
                return "Water Level Report";
        }
    }, [reportType, selectedMonth, selectedYears]);

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

                    // Display ALL readings in 24-hour format with converted values
                    chartData = readings.map((r) => ({
                        date: dayjs(r.created_at).format("HH:mm"),
                        "Water Level": +convertToChartValue(
                            r.water_level
                        ).toFixed(2),
                    }));
                    keys = ["Water Level"];
                    break;
                }

                case "weekly": {
                    const readings = await fetchReadings(
                        today.startOf("isoWeek"),
                        today.endOf("isoWeek")
                    );
                    chartData = averageByDay(readings, convertToChartValue);
                    keys = ["Water Level"];
                    break;
                }

                case "monthly": {
                    const readings = await fetchReadings(
                        selectedMonth.startOf("month"),
                        selectedMonth.endOf("month")
                    );

                    if (monthView === "week") {
                        chartData = averageByWeek(
                            readings,
                            convertToChartValue
                        );
                    } else {
                        chartData = averageByDayOfMonth(
                            readings,
                            convertToChartValue
                        );
                    }
                    keys = ["Water Level"];
                    break;
                }

                case "annually": {
                    const merged = [];
                    let currentKeys = [];

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

                        const lineKey = `Water Level ${year}`;
                        currentKeys.push(lineKey);

                        (rpcData || []).forEach((row, i) => {
                            const [yr, mon] = row.month_label.split("-");
                            const month = dayjs(`${yr}-${mon}-01`).format(
                                "MMM"
                            );
                            merged[i] ??= { date: month };
                            // Convert sensor reading to chart value
                            const chartValue = convertToChartValue(
                                row.avg_level
                            );
                            merged[i][lineKey] = +chartValue.toFixed(2);
                        });
                    }

                    chartData = merged.sort(
                        (a, b) =>
                            MONTH_ORDER.indexOf(a.date) -
                            MONTH_ORDER.indexOf(b.date)
                    );
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
        fetchSensorData();
    }, [fetchSensorData]);

    const resetAnnual = () => setSelectedYears([dayjs().year().toString()]);

    const renderChartLines = () => {
        const isAnnual = reportType === "annually";
        const currentYear = dayjs().year().toString();

        let colorIndex = 0;

        const keysToRender =
            lineKeys.length > 0
                ? lineKeys
                : Object.keys(data[0] || {}).filter((k) => k !== "date");

        return keysToRender.map((key) => {
            const yearMatch = key.match(/Water Level (\d{4})/);

            let color = ACCENT_COLOR;
            if (isAnnual) {
                if (yearMatch && yearMatch[1] === currentYear) {
                    color = ACCENT_COLOR; // Current year line
                } else {
                    color = COLORS[colorIndex++ % COLORS.length]; // Comparison year line
                }
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
                />
            );
        });
    };

    const showLegend = reportType === "annually" && data.length > 0;

    return (
        <div style={{ padding: "8px" }}>
            {/* -------------------------------------------------------------------------------- */}
            {/* START: INLINE CSS TO CENTER ANT DESIGN DROPDOWN */}
            {/* The DatePicker dropdown renders outside the component tree, requiring a global style. */}
            <style>
                {`
                    /* Target the specific DatePicker dropdown using its custom class */
                    .centered-calendar-dropdown {
                        left: 50% !important; /* Move the left edge to the center of the viewport */
                        transform: translateX(-50%) !important; /* Shift back by half of its own width for true centering */
                    }
                `}
            </style>
            {/* END: INLINE CSS TO CENTER ANT DESIGN DROPDOWN */}
            {/* -------------------------------------------------------------------------------- */}
            <Space
                direction="vertical"
                size="middle"
                style={{
                    marginBottom: 20,
                    width: "100%",
                }}>
                <div
                    style={{
                        width: "100%",
                        display: "flex",
                        justifyContent: "center",
                    }}>
                    <Radio.Group
                        value={reportType}
                        onChange={(e) => setReportType(e.target.value)}
                        buttonStyle="solid"
                        style={{
                            display: "flex",
                            flexWrap: "wrap",
                            justifyContent: "center",
                            gap: "4px",
                        }}>
                        <Radio.Button value="today">Today</Radio.Button>
                        <Radio.Button value="weekly">Weekly</Radio.Button>
                        <Radio.Button value="monthly">Monthly</Radio.Button>
                        <Radio.Button value="annually">Annually</Radio.Button>
                    </Radio.Group>
                </div>

                {reportType === "monthly" && (
                    <Space
                        direction="vertical"
                        size="small"
                        style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}>
                        <Space wrap style={{ justifyContent: "center" }}>
                            <span>Month:</span>
                            <DatePicker
                                picker="month"
                                value={selectedMonth}
                                onChange={setSelectedMonth}
                                allowClear={false}
                                // ADDED CLASS NAME TO HOOK THE INLINE CSS
                                dropdownClassName="centered-calendar-dropdown"
                            />
                        </Space>
                        <Space wrap style={{ justifyContent: "center" }}>
                            <span>By:</span>
                            <Select
                                value={monthView}
                                onChange={setMonthView}
                                className="reports-select"
                                style={{ minWidth: "100px" }}>
                                <Option value="day">Day</Option>
                                <Option value="week">Week</Option>
                            </Select>
                            <Button onClick={resetMonthly}>Reset</Button>
                        </Space>
                    </Space>
                )}

                {reportType === "annually" && (
                    <Space
                        direction="vertical"
                        size="small"
                        style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}>
                        <span>Compare Years:</span>
                        <Space wrap style={{ justifyContent: "center" }}>
                            <Select
                                mode="multiple"
                                value={selectedYears}
                                onChange={setSelectedYears}
                                placeholder="Select years"
                                className="reports-select"
                                style={{ minWidth: "200px" }}>
                                {Array.from({ length: 10 }, (_, i) => {
                                    const year = (
                                        dayjs().year() - i
                                    ).toString();
                                    return (
                                        <Option key={year} value={year}>
                                            {year}
                                        </Option>
                                    );
                                })}
                            </Select>
                            <Button onClick={resetAnnual}>Reset</Button>
                        </Space>
                    </Space>
                )}

                <Title
                    level={2}
                    style={{
                        margin: "16px 0 0 0",
                        textAlign: "center",
                        fontSize: "clamp(14px, 4vw, 24px)",
                        lineHeight: "1.3",
                    }}>
                    {chartTitle}
                </Title>
            </Space>

            <div className="reports-chart-container">
                {loading ? (
                    <div
                        className="loading-placeholder "
                        style={{
                            height: 600,
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                        }}>
                        <Spin size="large" tip="Loading report..." />
                    </div>
                ) : data.length === 0 ? (
                    <div
                        className="loading-placeholder"
                        style={{
                            height: "400px",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                        }}>
                        <p style={{ fontSize: "1.2em", color: "#888" }}>
                            No sensor readings found.
                        </p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={600}>
                        <LineChart
                            data={data}
                            margin={{
                                top: 80,
                                right: window.innerWidth < 768 ? 10 : 30,
                                left: window.innerWidth < 768 ? -40 : -20,
                                bottom: window.innerWidth < 768 ? 40 : 20,
                            }}>
                            <CartesianGrid strokeDasharray="3 3" />

                            {/* Reference Areas for visual guidance */}
                            {/* Green zone at bottom (low water = safe) */}
                            <ReferenceArea
                                y1={0}
                                y2={THRESHOLDS.SAFE_LEVEL}
                                fill="#03852e"
                                opacity={0.1}
                                stroke="#03852e"
                                strokeDasharray="3 3"
                            />
                            {/* Red zone at top (high water = flood risk) */}
                            <ReferenceArea
                                y1={THRESHOLDS.FLOOD_RISK_LEVEL}
                                y2={getYAxisDomain[1]}
                                fill="#ff3333"
                                opacity={0.1}
                                stroke="#ff3333"
                                strokeDashArray="3 3"
                            />

                            {/* Safe Level Line (Low Water - Green) */}
                            <ReferenceLine
                                y={THRESHOLDS.SAFE_LEVEL}
                                stroke="#03852eff"
                                strokeDasharray="5 5"
                                label={{
                                    value: `Safe Level (${THRESHOLDS.SAFE_LEVEL}m)`,
                                    position: "insideTopLeft",
                                    fill: "#03852eff",
                                }}
                            />
                            {/* Flood Risk Level Line (High Water - Red) */}
                            <ReferenceLine
                                y={THRESHOLDS.FLOOD_RISK_LEVEL}
                                stroke="#ff3333ff"
                                strokeDasharray="5 5"
                                label={{
                                    value: `Flood Risk (${THRESHOLDS.FLOOD_RISK_LEVEL}m)`,
                                    position: "insideBottomLeft",
                                    fill: "#ff3333ff",
                                }}
                            />

                            <XAxis
                                dataKey="date"
                                angle={-45}
                                textAnchor="end"
                                height={70}
                                interval="equidistant"
                            />
                            <YAxis
                                domain={getYAxisDomain}
                                label={{
                                    value: "Water Level (m)",
                                    angle: -90,
                                    position: "insideLeft",
                                    style: { textAnchor: "middle" },
                                }}
                            />
                            <Tooltip
                                wrapperStyle={{
                                    zIndex: 1000,
                                    overflow: "hidden",
                                }}
                            />
                            {showLegend && (
                                <Legend verticalAlign="top" height={60} />
                            )}
                            {renderChartLines()}
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
};

export default ReportPage;
