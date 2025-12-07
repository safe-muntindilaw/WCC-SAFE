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
    Flex,
    Drawer,
    Badge,
} from "antd";
import { FilterOutlined, ReloadOutlined } from "@ant-design/icons";
import { supabase } from "@/globals";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
dayjs.extend(isoWeek);

const { Option } = Select;
const { Title, Text } = Typography;

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

const GOVERNMENT_THEME = {
    PRIMARY_BLUE: PRIMARY_COLOR,
    ACCENT_RED: "#CC3333",
    ACCENT_GREEN: "#33854d",
    ACCENT_YELLOW: ACCENT_COLOR,
    LIGHT_GRAY: "#f0f2f5",
    TEXT_COLOR: "#333333",
    GRID_STROKE: "#cccccc",
    LEVEL_1_COLOR: "#33854d",
    LEVEL_2_COLOR: "#ffa600ff",
    LEVEL_3_COLOR: "#ff0000ff",
};

const COMPARISON_COLORS = [
    GOVERNMENT_THEME.ACCENT_YELLOW,
    GOVERNMENT_THEME.PRIMARY_BLUE,
    ...COMPARISON_LINE_COLORS,
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
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Handle resize for responsiveness
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const THRESHOLDS = useMemo(
        () => ({
            SAFE_LEVEL: 4,
            RISK_LEVEL: 1,
            L1_LEVEL: 4,
            L2_LEVEL: 2.5,
            L3_LEVEL: 1,
        }),
        []
    );

    const getYAxisDomain = useMemo(() => {
        const maxThreshold = THRESHOLDS.SAFE_LEVEL;
        const FIXED_MAX = maxThreshold + 1;
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
                return `Water Level - ${dayjs().format("MMMM DD, YYYY")}`;
            }
            case "weekly": {
                const start = dayjs().startOf("isoWeek").format("MMM DD");
                const end = dayjs().endOf("isoWeek").format("MMM DD, YYYY");
                return `Weekly Average: ${start} - ${end}`;
            }
            case "monthly": {
                const month = selectedMonth.format("MMMM YYYY");
                return `${month} - By ${monthView === "day" ? "Day" : "Week"}`;
            }
            case "annually": {
                const years = selectedYears.sort((a, b) => b - a).join(", ");
                return `Annual Comparison (${years})`;
            }
            default:
                return "Water Level Report";
        }
    }, [reportType, selectedMonth, selectedYears, monthView]);

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
                        date: dayjs(r.created_at).format("hh:mm A"),
                        "Water Level": +r.water_level.toFixed(2),
                    }));
                    keys = ["Water Level"];
                    break;
                }

                case "weekly": {
                    const readings = await fetchReadings(
                        today.startOf("isoWeek"),
                        today.endOf("isoWeek").add(1, "day").startOf("day")
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
                            .startOf("day")
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

                        const lineKey = `Avg Level ${year}`;
                        currentKeys.push(lineKey);

                        (rpcData || []).forEach((row) => {
                            const [yr, mon] = row.month_label.split("-");
                            const month = dayjs(`${yr}-${mon}-01`).format(
                                "MMM"
                            );
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

                    merged.sort(
                        (a, b) =>
                            MONTH_ORDER.indexOf(a.date) -
                            MONTH_ORDER.indexOf(b.date)
                    );

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
    }, []);

    const resetAnnual = () => setSelectedYears([dayjs().year().toString()]);

    const renderChartLines = () => {
        const isAnnual = reportType === "annually";
        const currentYearLineKey = `Avg Level ${dayjs().year()}`;

        let colorIndex = 0;

        const keysToRender =
            lineKeys.length > 0
                ? lineKeys
                : Object.keys(data[0] || {}).filter((k) => k !== "date");

        return keysToRender.map((key) => {
            let color = GOVERNMENT_THEME.PRIMARY_BLUE;

            if (isAnnual) {
                if (key === currentYearLineKey) {
                    color = GOVERNMENT_THEME.PRIMARY_BLUE;
                } else {
                    color =
                        COMPARISON_COLORS[
                            colorIndex++ % COMPARISON_COLORS.length
                        ];
                }
            } else if (reportType === "today") {
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
                    connectNulls={isAnnual}
                />
            );
        });
    };

    const showLegend = reportType === "annually" && data.length > 0;

    const filterControls = (
        <Space
            direction="vertical"
            size="large"
            style={{ width: "100%", padding: 12 }}
        >
            {reportType === "monthly" && (
                <>
                    <div>
                        <Text
                            strong
                            style={{ display: "block", marginBottom: 8 }}
                        >
                            Select Month:
                        </Text>
                        <DatePicker
                            picker="month"
                            value={selectedMonth}
                            onChange={setSelectedMonth}
                            allowClear={false}
                            style={{ width: "100%" }}
                            size={isMobile ? "middle" : "large"}
                        />
                    </div>
                    <div>
                        <Text
                            strong
                            style={{ display: "block", marginBottom: 8 }}
                        >
                            Group By:
                        </Text>
                        <Select
                            value={monthView}
                            onChange={setMonthView}
                            style={{ width: "100%" }}
                            size={isMobile ? "middle" : "large"}
                        >
                            <Option value="day">Day</Option>
                            <Option value="week">Week</Option>
                        </Select>
                    </div>
                    <Button
                        onClick={resetMonthly}
                        block
                        size={isMobile ? "middle" : "large"}
                    >
                        Reset to Current Month
                    </Button>
                </>
            )}

            {reportType === "annually" && (
                <>
                    <div>
                        <Text
                            strong
                            style={{ display: "block", marginBottom: 8 }}
                        >
                            Compare Years:
                        </Text>
                        <Select
                            mode="multiple"
                            value={selectedYears}
                            onChange={setSelectedYears}
                            placeholder="Select years"
                            style={{ width: "100%" }}
                            size={isMobile ? "middle" : "large"}
                        >
                            {Array.from({ length: 10 }, (_, i) => {
                                const year = (dayjs().year() - i).toString();
                                return (
                                    <Option key={year} value={year}>
                                        {year}
                                    </Option>
                                );
                            })}
                        </Select>
                    </div>
                    <Button
                        onClick={resetAnnual}
                        block
                        size={isMobile ? "middle" : "large"}
                    >
                        Reset to Current Year
                    </Button>
                </>
            )}
        </Space>
    );

    const hasFilters = reportType === "monthly" || reportType === "annually";
    const filterCount = reportType === "annually" ? selectedYears.length : 0;

    return (
        <div
            style={{
                padding: isMobile ? 12 : 24,
                backgroundColor: GOVERNMENT_THEME.LIGHT_GRAY,
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
            }}
        >
            <Card
                style={{
                    borderRadius: 8,
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                    marginBottom: 20,
                }}
            >
                {/* Header */}
                <Flex
                    justify="space-between"
                    align="center"
                    wrap="wrap"
                    gap={12}
                    style={{ marginBottom: 20 }}
                >
                    <Title
                        level={isMobile ? 4 : 3}
                        style={{
                            margin: 0,
                            color: GOVERNMENT_THEME.PRIMARY_BLUE,
                            flex: 1,
                            minWidth: "60%",
                        }}
                    >
                        {chartTitle}
                    </Title>
                    <Flex
                        gap={8}
                        style={{
                            width: "100%",
                            display: "flex",
                            justifyContent: "space-between",
                        }}
                    >
                        {hasFilters && isMobile && (
                            <Badge count={filterCount} offset={[-5, 5]}>
                                <Button
                                    icon={<FilterOutlined />}
                                    onClick={() => setDrawerVisible(true)}
                                    size="large"
                                >
                                    Filters
                                </Button>
                            </Badge>
                        )}
                        <Button
                            type="primary"
                            icon={<ReloadOutlined />}
                            onClick={fetchSensorData}
                            loading={loading}
                            size={isMobile ? "large" : "middle"}
                            style={{
                                backgroundColor: GOVERNMENT_THEME.PRIMARY_BLUE,
                                borderColor: GOVERNMENT_THEME.PRIMARY_BLUE,
                            }}
                        >
                            {isMobile ? "" : "Refresh"}
                        </Button>
                    </Flex>
                </Flex>

                {/* Report Type Selection */}
                <div style={{ marginBottom: 20 }}>
                    <Text strong style={{ display: "block", marginBottom: 8 }}>
                        Report View:
                    </Text>
                    <Radio.Group
                        value={reportType}
                        onChange={(e) => setReportType(e.target.value)}
                        buttonStyle="solid"
                        style={{ width: "100%" }}
                        size={isMobile ? "middle" : "large"}
                    >
                        <Flex wrap="wrap" gap={8}>
                            <Radio.Button
                                value="today"
                                style={{ flex: isMobile ? "1 1 45%" : "none" }}
                            >
                                {isMobile ? "Today" : "Today's Readings"}
                            </Radio.Button>
                            <Radio.Button
                                value="weekly"
                                style={{ flex: isMobile ? "1 1 45%" : "none" }}
                            >
                                {isMobile ? "Weekly" : "Weekly Average"}
                            </Radio.Button>
                            <Radio.Button
                                value="monthly"
                                style={{ flex: isMobile ? "1 1 45%" : "none" }}
                            >
                                {isMobile ? "Monthly" : "Monthly Average"}
                            </Radio.Button>
                            <Radio.Button
                                value="annually"
                                style={{ flex: isMobile ? "1 1 45%" : "none" }}
                            >
                                {isMobile ? "Annual" : "Annual Comparison"}
                            </Radio.Button>
                        </Flex>
                    </Radio.Group>
                </div>

                {/* Desktop Filters */}
                {hasFilters && !isMobile && (
                    <Card
                        size="small"
                        style={{
                            marginBottom: 20,
                            backgroundColor: "#fafafa",
                        }}
                    >
                        {filterControls}
                    </Card>
                )}

                {/* Mobile Filter Drawer */}
                <Drawer
                    title="Filter Options"
                    placement="bottom"
                    onClose={() => setDrawerVisible(false)}
                    open={drawerVisible}
                    height="auto"
                    bodyStyle={{ padding: 12 }}
                >
                    {filterControls}
                </Drawer>

                {/* Chart container with padding */}
                <div style={{ padding: isMobile ? "10px 0" : "20px" }}>
                    {loading ? (
                        <div
                            style={{
                                minHeight: isMobile ? 400 : 600,
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                backgroundColor: "#fff",
                                borderRadius: 8,
                            }}
                        >
                            <Spin size="large" tip="Loading report data..." />
                        </div>
                    ) : data.length === 0 ? (
                        <div
                            style={{
                                minHeight: isMobile ? 300 : 400,
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                border: "1px dashed #ccc",
                                backgroundColor: "#fff",
                                borderRadius: 8,
                                padding: 20,
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: isMobile ? "1em" : "1.2em",
                                    textAlign: "center",
                                }}
                            >
                                No sensor readings found for the selected
                                period.
                            </Text>
                        </div>
                    ) : (
                        <ResponsiveContainer
                            width="100%"
                            height={isMobile ? 400 : 600}
                        >
                            <LineChart
                                data={data}
                                margin={{
                                    top: isMobile ? 40 : 60,
                                    right: 20,
                                    left: 20,
                                    bottom: 20,
                                }}
                            >
                                {/* Grid and reference lines */}
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke={GOVERNMENT_THEME.GRID_STROKE}
                                />

                                <ReferenceArea
                                    y1={getYAxisDomain[0]}
                                    y2={THRESHOLDS.RISK_LEVEL}
                                    fill={GOVERNMENT_THEME.ACCENT_RED}
                                    opacity={0.15}
                                    label={
                                        isMobile
                                            ? undefined
                                            : {
                                                  value: "ALERT: Low Water Risk Zone",
                                                  position: "top",
                                                  fill: GOVERNMENT_THEME.ACCENT_RED,
                                                  fontWeight: "bold",
                                                  fontSize: 14,
                                                  dy: 33,
                                              }
                                    }
                                />

                                <ReferenceArea
                                    y1={THRESHOLDS.SAFE_LEVEL}
                                    y2={getYAxisDomain[1]}
                                    fill={GOVERNMENT_THEME.ACCENT_GREEN}
                                    opacity={0.15}
                                    label={
                                        isMobile
                                            ? undefined
                                            : {
                                                  value: "Normal/Safe Zone",
                                                  position: "bottom",
                                                  fill: GOVERNMENT_THEME.ACCENT_GREEN,
                                                  fontWeight: "bold",
                                                  fontSize: 14,
                                                  dy: -40,
                                              }
                                    }
                                />

                                {/* Threshold lines */}
                                <ReferenceLine
                                    y={THRESHOLDS.L1_LEVEL}
                                    stroke={GOVERNMENT_THEME.LEVEL_1_COLOR}
                                    strokeWidth={2}
                                    strokeDashArray="4 4"
                                    label={
                                        isMobile
                                            ? undefined
                                            : {
                                                  value: `L1: ${THRESHOLDS.L1_LEVEL}m`,
                                                  position: "top",
                                                  fill: GOVERNMENT_THEME.LEVEL_1_COLOR,
                                                  fontSize: 11,
                                                  fontWeight: "bold",
                                                  dy: 20,
                                              }
                                    }
                                />

                                <ReferenceLine
                                    y={THRESHOLDS.L2_LEVEL}
                                    stroke={GOVERNMENT_THEME.LEVEL_2_COLOR}
                                    strokeWidth={2}
                                    strokeDashArray="4 4"
                                    label={
                                        isMobile
                                            ? undefined
                                            : {
                                                  value: `L2: ${THRESHOLDS.L2_LEVEL}m`,
                                                  position: "top",
                                                  fill: GOVERNMENT_THEME.LEVEL_2_COLOR,
                                                  fontSize: 11,
                                                  fontWeight: "bold",
                                                  dy: 0,
                                              }
                                    }
                                />

                                <ReferenceLine
                                    y={THRESHOLDS.L3_LEVEL}
                                    stroke={GOVERNMENT_THEME.LEVEL_3_COLOR}
                                    strokeWidth={2}
                                    strokeDashArray="4 4"
                                    label={
                                        isMobile
                                            ? undefined
                                            : {
                                                  value: `L3: ${THRESHOLDS.L3_LEVEL}m`,
                                                  position: "top",
                                                  fill: GOVERNMENT_THEME.LEVEL_3_COLOR,
                                                  fontSize: 11,
                                                  fontWeight: "bold",
                                                  dy: 1,
                                              }
                                    }
                                />

                                {/* X and Y axes with adaptive labels */}
                                <XAxis
                                    dataKey="date"
                                    angle={isMobile ? -45 : 0}
                                    textAnchor={isMobile ? "end" : "middle"}
                                    height={isMobile ? 60 : 30}
                                    stroke={GOVERNMENT_THEME.TEXT_COLOR}
                                    tickLine={{
                                        stroke: GOVERNMENT_THEME.TEXT_COLOR,
                                    }}
                                    interval="preserveStartEnd"
                                    tick={{ fontSize: isMobile ? 10 : 12 }}
                                />
                                <YAxis
                                    domain={getYAxisDomain}
                                    label={
                                        !isMobile && {
                                            value: "Water Level (meters)",
                                            angle: -90,
                                            position: "left",
                                            fill: GOVERNMENT_THEME.PRIMARY_BLUE,
                                            fontWeight: "bold",
                                            dx: -10,
                                        }
                                    }
                                    tick={{
                                        fill: GOVERNMENT_THEME.TEXT_COLOR,
                                        fontSize: isMobile ? 10 : 12,
                                    }}
                                    stroke={GOVERNMENT_THEME.TEXT_COLOR}
                                    tickLine={{
                                        stroke: GOVERNMENT_THEME.TEXT_COLOR,
                                    }}
                                />

                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "#fff",
                                        border: `1px solid ${GOVERNMENT_THEME.GRID_STROKE}`,
                                        borderRadius: 4,
                                        fontSize: isMobile ? 12 : 14,
                                    }}
                                    labelStyle={{
                                        color: GOVERNMENT_THEME.PRIMARY_BLUE,
                                        fontWeight: "bold",
                                    }}
                                />
                                {showLegend && (
                                    <Legend
                                        verticalAlign={
                                            isMobile ? "bottom" : "top"
                                        }
                                        align={isMobile ? "center" : "right"}
                                        wrapperStyle={{
                                            bottom: isMobile ? -10 : 0,
                                            top: isMobile ? undefined : 0,
                                            right: isMobile ? undefined : 0,
                                            fontSize: 11,
                                        }}
                                        iconSize={isMobile ? 10 : 14}
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
