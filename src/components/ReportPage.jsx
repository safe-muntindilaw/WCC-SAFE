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
// import "../styles/ReportPage.css";

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

    // Reversed safety logic: Higher levels (6) are SAFE, lower levels (1) are RISK.
    const THRESHOLDS = useMemo(
        () => ({
            SAFE_LEVEL: 4,
            RISK_LEVEL: 1,
        }),
        []
    );

    const getYAxisDomain = useMemo(() => {
        const FIXED_MAX = THRESHOLDS.SAFE_LEVEL + 1;
        const MIN_DOMAIN = 0;

        if (!data.length) return [MIN_DOMAIN, FIXED_MAX];

        const values = data.flatMap((d) =>
            Object.entries(d)
                .filter(([k]) => k !== "date")
                .map(([, v]) => v)
        );

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
            .lt("created_at", end.toISOString()) // ⬅️ MODIFIED to use LT
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
                    // ⬅️ MODIFIED: Set end to start of tomorrow for robust boundary
                    const start = today.startOf("day");
                    const end = today.add(1, "day").startOf("day");

                    const readings = await fetchReadings(start, end);

                    // Display ALL readings in 24-hour format
                    chartData = readings.map((r) => ({
                        date: dayjs(r.created_at).format("HH:mm"),
                        "Water Level": +r.water_level.toFixed(2),
                    }));
                    keys = ["Water Level"];
                    break;
                }

                case "weekly": {
                    const readings = await fetchReadings(
                        today.startOf("isoWeek"),
                        today.endOf("isoWeek")
                    );
                    chartData = averageByDay(readings);
                    keys = ["Water Level"];
                    break;
                }

                case "monthly": {
                    const readings = await fetchReadings(
                        selectedMonth.startOf("month"),
                        selectedMonth.endOf("month")
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
                            merged[i][lineKey] = +row.avg_level.toFixed(2);
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
        <div style={{ padding: 16 }}>
            <Space
                direction="horizontal"
                size="large"
                wrap
                style={{
                    marginBottom: 20,
                    width: "100%",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <div>
                    <Radio.Group
                        value={reportType}
                        onChange={(e) => setReportType(e.target.value)}
                        buttonStyle="solid"
                    >
                        <Radio.Button value="today">Today</Radio.Button>
                        <Radio.Button value="weekly">Weekly</Radio.Button>
                        <Radio.Button value="monthly">Monthly</Radio.Button>
                        <Radio.Button value="annually">Annually</Radio.Button>
                    </Radio.Group>

                    {reportType === "monthly" && (
                        <Space style={{ marginLeft: 20 }}>
                            <span>Month:</span>
                            <DatePicker
                                picker="month"
                                value={selectedMonth}
                                onChange={setSelectedMonth}
                                allowClear={false}
                            />
                            <span>By:</span>
                            <Select
                                value={monthView}
                                onChange={setMonthView}
                                className="reports-select"
                            >
                                <Option value="day">Day</Option>
                                <Option value="week">Week</Option>
                            </Select>
                            <Button onClick={resetMonthly}>Reset</Button>
                        </Space>
                    )}

                    {reportType === "annually" && (
                        <Space style={{ marginLeft: 20 }}>
                            <span>Compare Years:</span>
                            <Select
                                mode="multiple"
                                value={selectedYears}
                                onChange={setSelectedYears}
                                placeholder="Select years to compare"
                                className="reports-select"
                            >
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
                    )}
                </div>

                <Title>
                    {/* Chart Title on the left */}
                    <h2 style={{ marginRight: 20, padding: 0 }}>
                        {chartTitle}
                    </h2>
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
                        }}
                    >
                        <Spin size="large" tip="Loading report..." />
                    </div>
                ) : data.length === 0 ? (
                    <div
                        className="loading-placeholder"
                        style={{ height: 600 }}
                    >
                        <p style={{ fontSize: "1.2em", color: "#888" }}>
                            No sensor readings found for the selected period.
                        </p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={600}>
                        <LineChart
                            data={data}
                            margin={{
                                top: 80,
                                right: 30,
                                left: -10,
                                bottom: 20,
                            }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />

                            {/* Reference Areas for visual guidance */}
                            <ReferenceArea
                                y1={0}
                                y2={THRESHOLDS.RISK_LEVEL}
                                fill="#ff3333"
                                opacity={0.1}
                                stroke="#ff3333"
                                strokeDasharray="3 3"
                            />
                            <ReferenceArea
                                y1={THRESHOLDS.SAFE_LEVEL}
                                y2={getYAxisDomain[1]}
                                fill="#03852e"
                                opacity={0.1}
                                stroke="#03852e"
                                strokeDashArray="3 3"
                            />

                            {/* High Safe Level (Green) */}
                            <ReferenceLine
                                y={THRESHOLDS.SAFE_LEVEL}
                                stroke="#03852eff"
                                strokeDasharray="5 5"
                                label={{
                                    value: "Safe Level (High)",
                                    position: "insideTopLeft",
                                    fill: "#03852eff",
                                }}
                            />
                            {/* Low Risk Level (Red) */}
                            <ReferenceLine
                                y={THRESHOLDS.RISK_LEVEL}
                                stroke="#ff3333ff"
                                strokeDasharray="5 5"
                                label={{
                                    value: "Risk Level (Low)",
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
