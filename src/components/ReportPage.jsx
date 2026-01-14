// ReportPage.jsx - Refactored Clean Layout
import React, { useEffect, useState, useCallback, useMemo } from "react";
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
} from "antd";
import {
    ReloadOutlined,
    CalendarOutlined,
    LineChartOutlined,
    FilterOutlined,
    CloseOutlined,
} from "@ant-design/icons";
import { supabase } from "@/globals";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { THEME, cardStyle } from "@/utils/theme";
import { showError, showWarning, showInfo } from "@/utils/notifications";
import { useResponsive } from "@/utils/useResponsive";

dayjs.extend(isoWeek);

const { Title, Text } = Typography;
const { Option } = Select;

const ACCENT_COLOR = THEME.ACCENT_YELLOW;
const COLORS = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#FFA07A",
    "#98D8C8",
    "#F7DC6F",
    "#BB8FCE",
    "#85C1E2",
    "#F8B195",
    "#6C5CE7",
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
const SENSOR_MAX = 4.5;

const convertToChartValue = (sensorReading) => SENSOR_MAX - sensorReading;

const getStatusColor = (statusName) => {
    const colors = {
        L0: THEME.GREEN_SAFE,
        L1: THEME.YELLOW_NORMAL,
        L2: THEME.ORANGE_ALERT,
        L3: THEME.RED_CRITICAL,
    };
    return colors[statusName] || THEME.BLUE_AUTHORITY;
};

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

const RefreshButton = ({ refreshing, onRefresh }) => (
    <Button
        type="default"
        ghost
        icon={<ReloadOutlined spin={refreshing} />}
        onClick={onRefresh}
        loading={refreshing}
        style={{ color: "white", borderColor: "white" }}
    />
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
    const [refreshing, setRefreshing] = useState(false);
    const [initialLoadDone, setInitialLoadDone] = useState(false);
    const [lineKeys, setLineKeys] = useState([]);
    const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);
    const [thresholds, setThresholds] = useState([]);
    const { isMobile } = useResponsive();

    const fetchThresholds = useCallback(async () => {
        try {
            const { data: thresholdData, error } = await supabase
                .from("water_thresholds")
                .select("*")
                .order("min_level", { ascending: true });
            if (error) throw error;
            const sortedThresholds = (thresholdData || []).map((t) => ({
                ...t,
                min_level: parseFloat(t.min_level),
                max_level: parseFloat(t.max_level),
            }));
            setThresholds(sortedThresholds);
            return sortedThresholds;
        } catch (error) {
            console.error("Error fetching thresholds:", error);
            showWarning("Failed to load thresholds");
            return [];
        }
    }, []);

    const fetchReadings = useCallback(async (start, end) => {
        try {
            const { data: readings, error } = await supabase
                .from("sensor_readings")
                .select("water_level, created_at")
                .gte("created_at", start.toISOString())
                .lt("created_at", end.toISOString())
                .order("created_at", { ascending: true });
            if (error) throw error;
            return readings || [];
        } catch (error) {
            console.error("Error fetching readings:", error);
            showError("Failed to fetch sensor data");
            return [];
        }
    }, []);

    const chartTitle = useMemo(() => {
        const today = dayjs();
        switch (reportType) {
            case "today":
                return `Today's Water Level`;
            case "weekly":
                return `This Week's Average`;
            case "monthly":
                return `${selectedMonth.format("MMMM YYYY")}`;
            case "annually":
                const years = selectedYears.sort((a, b) => b - a).join(", ");
                return `Annual Comparison (${years})`;
            default:
                return "Water Level Report";
        }
    }, [reportType, selectedMonth, selectedYears]);

    const chartSubtitle = useMemo(() => {
        const today = dayjs();
        switch (reportType) {
            case "today":
                return today.format("MMMM DD, YYYY");
            case "weekly":
                return `${today.startOf("isoWeek").format("MMM DD")} - ${today
                    .endOf("isoWeek")
                    .format("MMM DD, YYYY")}`;
            case "monthly":
                return monthView === "week"
                    ? "Weekly Averages"
                    : "Daily Averages";
            case "annually":
                return "Monthly Averages Comparison";
            default:
                return "";
        }
    }, [reportType, selectedMonth, monthView]);

    const fetchSensorData = useCallback(
        async (isRefresh = false) => {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);

            setData([]);
            setLineKeys([]);
            const today = dayjs();
            let chartData = [];
            let keys = [];

            let currentThresholds = thresholds;
            if (!currentThresholds.length) {
                currentThresholds = await fetchThresholds();
            }

            try {
                switch (reportType) {
                    case "today": {
                        const start = today.startOf("day");
                        const end = today.add(1, "day").startOf("day");
                        const readings = await fetchReadings(start, end);

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

                        chartData =
                            monthView === "week"
                                ? averageByWeek(readings, convertToChartValue)
                                : averageByDayOfMonth(
                                      readings,
                                      convertToChartValue
                                  );
                        keys = ["Water Level"];
                        break;
                    }
                    case "annually": {
                        if (selectedYears.length === 0) {
                            showWarning("Please select at least one year");
                            break;
                        }
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
                            if (error) {
                                console.error(`RPC error for ${year}:`, error);
                                showError(`Failed to load data for ${year}`);
                                continue;
                            }
                            const lineKey = `${year}`;
                            currentKeys.push(lineKey);
                            (rpcData || []).forEach((row, i) => {
                                const [yr, mon] = row.month_label.split("-");
                                const month = dayjs(`${yr}-${mon}-01`).format(
                                    "MMM"
                                );
                                merged[i] ??= { date: month };
                                merged[i][lineKey] = +convertToChartValue(
                                    row.avg_level
                                ).toFixed(2);
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
                showError("Failed to load report data");
            } finally {
                setLoading(false);
                setRefreshing(false);
                setInitialLoadDone(true);
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
        ]
    );

    useEffect(() => {
        fetchThresholds();
    }, [fetchThresholds]);

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
                    if (reportType === "today" || reportType === "weekly")
                        fetchSensorData(true);
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

    const resetAnnual = () => {
        setSelectedYears([dayjs().year().toString()]);
    };

    const getYAxisDomain = useMemo(() => {
        const FIXED_MAX = SENSOR_MAX;
        const MIN_DOMAIN = 0;
        if (!data.length) return [MIN_DOMAIN, FIXED_MAX];
        const values = data.flatMap((d) =>
            Object.entries(d)
                .filter(([k]) => k !== "date")
                .map(([, v]) => v)
        );
        const actualMin = Math.min(...values, 0);
        return [Math.max(MIN_DOMAIN, Math.floor(actualMin * 0.9)), FIXED_MAX];
    }, [data]);

    const renderChartLines = () => {
        const isAnnual = reportType === "annually";
        const currentYear = dayjs().year().toString();
        let colorIndex = 0;
        const keysToRender =
            lineKeys.length > 0
                ? lineKeys
                : Object.keys(data[0] || {}).filter((k) => k !== "date");
        return keysToRender.map((key) => {
            let color = ACCENT_COLOR;
            if (isAnnual) {
                color =
                    key === currentYear
                        ? ACCENT_COLOR
                        : COLORS[colorIndex++ % COLORS.length];
            }
            return (
                <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={color}
                    strokeWidth={isAnnual ? 3 : 2.5}
                    dot={{ r: isAnnual ? 5 : reportType === "today" ? 0 : 4 }}
                    activeDot={{ r: 8 }}
                />
            );
        });
    };

    const showLegend = reportType === "annually" && data.length > 0;

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div
                    style={{
                        backgroundColor: "rgba(255, 255, 255, 0.98)",
                        border: `2px solid ${THEME.BLUE_PRIMARY}`,
                        borderRadius: 8,
                        padding: "10px 14px",
                        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                    }}>
                    <Text
                        strong
                        style={{
                            display: "block",
                            marginBottom: 6,
                            fontSize: 13,
                        }}>
                        {label}
                    </Text>
                    {payload.map((entry, index) => (
                        <div key={index}>
                            <Text style={{ color: entry.color, fontSize: 12 }}>
                                {entry.name}: {entry.value}m
                            </Text>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    const renderThresholdReferences = () => {
        if (!thresholds.length) return null;
        return thresholds.map((threshold, index) => {
            const color = getStatusColor(threshold.name);
            const isTopThreshold = index === thresholds.length - 1;
            return (
                <React.Fragment key={threshold.id}>
                    <ReferenceArea
                        y1={threshold.min_level}
                        y2={
                            isTopThreshold
                                ? getYAxisDomain[1]
                                : threshold.max_level
                        }
                        fill={color}
                        opacity={0.08}
                    />
                    {index < thresholds.length - 1 && (
                        <ReferenceLine
                            y={threshold.max_level}
                            stroke={color}
                            strokeDasharray="5 5"
                            strokeWidth={2}
                            label={{
                                value: `${threshold.name} (${threshold.max_level}m)`,
                                position: "insideTopLeft",
                                fill: color,
                                fontSize: isMobile ? 10 : 12,
                                fontWeight: 600,
                            }}
                        />
                    )}
                </React.Fragment>
            );
        });
    };

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
                <Spin size="large" tip="Loading water level data..." />
            </div>
        );
    }

    return (
        <ConfigProvider theme={{ token: { colorPrimary: THEME.BLUE_PRIMARY } }}>
            <div
                style={{
                    padding: isMobile ? 16 : 24,
                    // minHeight: "100vh",
                }}>
                {/* Header Card */}
                <Card
                    style={{
                        ...cardStyle,
                        background: THEME.BLUE_PRIMARY,
                        marginBottom: 16,
                        border: "none",
                    }}
                    bodyStyle={{ padding: isMobile ? 16 : 20 }}>
                    <Row
                        align="middle"
                        justify="space-between"
                        gutter={[12, 12]}>
                        <Col xs={24} sm={16}>
                            <Space direction="vertical" size={2}>
                                <Title
                                    level={isMobile ? 4 : 2}
                                    style={{
                                        margin: 0,
                                        color: "white",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                    }}>
                                    <LineChartOutlined /> Water Level Reports
                                </Title>
                                <Text
                                    style={{
                                        color: "rgba(255, 255, 255, 0.85)",
                                        fontSize: isMobile ? 12 : 14,
                                    }}>
                                    Real-time monitoring and historical data
                                </Text>
                            </Space>
                        </Col>
                        {!isMobile && (
                            <Col sm={8} style={{ textAlign: "right" }}>
                                <RefreshButton
                                    refreshing={refreshing}
                                    onRefresh={() => fetchSensorData(true)}
                                />
                            </Col>
                        )}
                    </Row>
                </Card>

                {/* Chart Section */}
                <Card
                    style={{
                        ...cardStyle,
                        borderTop: `5px solid ${THEME.BLUE_PRIMARY}`,
                    }}
                    bodyStyle={{ padding: isMobile ? 16 : 20 }}
                    title={
                        isMobile && (
                            <Row justify="space-between" align="middle">
                                <Col>
                                    <Text strong style={{ fontSize: 14 }}>
                                        {reportType === "today" && "Today"}
                                        {reportType === "weekly" && "Weekly"}
                                        {reportType === "monthly" && "Monthly"}
                                        {reportType === "annually" && "Annual"}
                                    </Text>
                                </Col>
                                <Col>
                                    <Space size={8}>
                                        <Text
                                            type="secondary"
                                            style={{
                                                padding: 0,
                                            }}>
                                            Filter
                                        </Text>
                                        <Button
                                            label="pwet"
                                            type="text"
                                            icon={<FilterOutlined />}
                                            onClick={() =>
                                                setFilterDrawerVisible(true)
                                            }
                                            style={{
                                                color: THEME.BLUE_PRIMARY,
                                            }}
                                        />
                                        <Button
                                            type="text"
                                            icon={
                                                <ReloadOutlined
                                                    spin={refreshing}
                                                />
                                            }
                                            onClick={() =>
                                                fetchSensorData(true)
                                            }
                                            loading={refreshing}
                                            style={{
                                                color: THEME.BLUE_PRIMARY,
                                            }}
                                        />
                                    </Space>
                                </Col>
                            </Row>
                        )
                    }>
                    {/* Report Type Selector - Desktop Only */}
                    {!isMobile && (
                        <div
                            style={{
                                width: "100%",
                                display: "flex",
                                justifyContent: "center",
                                marginBottom: 20,
                            }}>
                            <Radio.Group
                                value={reportType}
                                onChange={(e) => setReportType(e.target.value)}
                                buttonStyle="solid"
                                size="middle"
                                style={{ display: "flex", gap: 6 }}>
                                <Radio.Button value="today">
                                    <CalendarOutlined /> Today
                                </Radio.Button>
                                <Radio.Button value="weekly">
                                    Weekly
                                </Radio.Button>
                                <Radio.Button value="monthly">
                                    Monthly
                                </Radio.Button>
                                <Radio.Button value="annually">
                                    Annual
                                </Radio.Button>
                            </Radio.Group>
                        </div>
                    )}

                    {/* Monthly Controls - Desktop Only */}
                    {!isMobile && reportType === "monthly" && (
                        <Space
                            size="middle"
                            style={{
                                width: "100%",
                                justifyContent: "center",
                                marginBottom: 20,
                                flexWrap: "wrap",
                            }}>
                            <Space size="small">
                                <Text strong>Month:</Text>
                                <DatePicker
                                    picker="month"
                                    value={selectedMonth}
                                    onChange={setSelectedMonth}
                                    allowClear={false}
                                    size="middle"
                                />
                            </Space>
                            <Space size="small">
                                <Text strong>View:</Text>
                                <Select
                                    value={monthView}
                                    onChange={setMonthView}
                                    size="middle"
                                    style={{ width: 100 }}>
                                    <Option value="day">Daily</Option>
                                    <Option value="week">Weekly</Option>
                                </Select>
                            </Space>
                            <Button
                                onClick={resetMonthly}
                                icon={<ReloadOutlined />}
                                size="middle">
                                Reset
                            </Button>
                        </Space>
                    )}

                    {/* Annual Controls - Desktop Only */}
                    {!isMobile && reportType === "annually" && (
                        <Space
                            size="middle"
                            style={{
                                width: "100%",
                                justifyContent: "center",
                                marginBottom: 20,
                                flexWrap: "wrap",
                            }}>
                            <Space size="small">
                                <Text strong>Compare:</Text>
                                <Select
                                    mode="multiple"
                                    value={selectedYears}
                                    onChange={setSelectedYears}
                                    placeholder="Select years"
                                    size="middle"
                                    style={{ minWidth: 200 }}
                                    maxTagCount={3}>
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
                            </Space>
                            <Button
                                onClick={resetAnnual}
                                icon={<ReloadOutlined />}
                                size="middle">
                                Reset
                            </Button>
                        </Space>
                    )}

                    {/* Chart Title */}
                    <div style={{ textAlign: "center", marginBottom: 16 }}>
                        <Title
                            level={isMobile ? 5 : 4}
                            style={{
                                margin: 0,
                                color: THEME.BLUE_AUTHORITY,
                                fontWeight: 700,
                            }}>
                            {chartTitle}
                        </Title>
                        <Text
                            type="secondary"
                            style={{
                                fontSize: isMobile ? 12 : 13,
                                display: "block",
                                marginTop: 2,
                            }}>
                            {chartSubtitle}
                        </Text>
                    </div>

                    {/* Chart Container */}
                    <div
                        style={{ width: "100%", marginTop: isMobile ? 8 : 16 }}>
                        {loading ? (
                            <div
                                style={{
                                    height: isMobile ? 450 : 500,
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    flexDirection: "column",
                                    gap: 12,
                                }}>
                                <Spin size="large" />
                                <Text type="secondary" style={{ fontSize: 13 }}>
                                    Loading data...
                                </Text>
                            </div>
                        ) : data.length === 0 ? (
                            <div
                                style={{
                                    height: isMobile ? 310 : 500,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}>
                                <Empty
                                    description={
                                        <Space direction="vertical" size={2}>
                                            <Text type="secondary">
                                                No data found
                                            </Text>
                                            <Text
                                                type="secondary"
                                                style={{ fontSize: 12 }}>
                                                Try a different time period
                                            </Text>
                                        </Space>
                                    }
                                />
                            </div>
                        ) : (
                            <ResponsiveContainer
                                width="100%"
                                height={isMobile ? 310 : 500}>
                                <LineChart
                                    data={data}
                                    margin={{
                                        // top: 60,
                                        right: isMobile ? 20 : 20,
                                        left: isMobile ? -40 : -30,
                                        bottom: isMobile ? 0 : 0,
                                    }}>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="#E8E8E8"
                                    />
                                    {renderThresholdReferences()}
                                    <XAxis
                                        dataKey="date"
                                        angle={-45}
                                        textAnchor="end"
                                        height={isMobile ? 60 : 70}
                                        interval={
                                            isMobile ? "preserveStartEnd" : 0
                                        }
                                        tick={{
                                            fontSize: isMobile ? 10 : 12,
                                        }}
                                    />
                                    <YAxis
                                        domain={getYAxisDomain}
                                        label={{
                                            // value: "Level (m)",
                                            angle: -90,
                                            position: "insideLeft",
                                            style: {
                                                fontSize: isMobile ? 11 : 13,
                                                fontWeight: 600,
                                            },
                                        }}
                                        tick={{
                                            fontSize: isMobile ? 10 : 12,
                                        }}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    {showLegend && (
                                        <Legend
                                            verticalAlign="top"
                                            height={50}
                                            wrapperStyle={{ fontSize: 12 }}
                                        />
                                    )}
                                    {renderChartLines()}
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </Card>

                {/* Mobile Filter Drawer */}
                <Drawer
                    style={{
                        borderRadius: "0 0 50vw 50vw",
                        borderBottom: `4px solid ${THEME.BLUE_PRIMARY}`,
                    }}
                    placement="top"
                    onClose={() => setFilterDrawerVisible(false)}
                    open={filterDrawerVisible}
                    height="auto"
                    styles={{
                        body: { padding: isMobile ? 16 : 24 },
                        mask: { backdropFilter: "blur(4px)" },
                    }}
                    closable={false}>
                    <Card
                        variant={false}
                        style={{
                            height: "100%",
                            borderTop: `4px solid ${THEME.BLUE_PRIMARY}`,
                            borderRadius: "0 0 50vw 50vw",
                            backgroundColor: "rgba(255, 255, 255, 0.9)",
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
                                    onChange={(e) =>
                                        setReportType(e.target.value)
                                    }
                                    buttonStyle="solid"
                                    size="middle"
                                    style={{ width: "100%", display: "flex" }}>
                                    <Radio.Button
                                        value="today"
                                        style={{
                                            flex: 1,
                                            textAlign: "center",
                                        }}>
                                        Today
                                    </Radio.Button>
                                    <Radio.Button
                                        value="weekly"
                                        style={{
                                            flex: 1,
                                            textAlign: "center",
                                        }}>
                                        Week
                                    </Radio.Button>
                                    <Radio.Button
                                        value="monthly"
                                        style={{
                                            flex: 1,
                                            textAlign: "center",
                                        }}>
                                        Month
                                    </Radio.Button>
                                    <Radio.Button
                                        value="annually"
                                        style={{
                                            flex: 1,
                                            textAlign: "center",
                                        }}>
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
                                            onChange={setSelectedMonth}
                                            allowClear={false}
                                            style={{
                                                width: "100%",
                                                height: 40,
                                            }}
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
                                            onChange={setMonthView}
                                            style={{
                                                width: "100%",
                                                height: 40,
                                            }}>
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
                                            onChange={setSelectedYears}
                                            placeholder="Select years"
                                            style={{
                                                width: "100%",
                                                minHeight: 40,
                                            }}
                                            maxTagCount={2}>
                                            {Array.from(
                                                { length: 10 },
                                                (_, i) => {
                                                    const year = (
                                                        dayjs().year() - i
                                                    ).toString();
                                                    return (
                                                        <Option
                                                            key={year}
                                                            value={year}>
                                                            {year}
                                                        </Option>
                                                    );
                                                }
                                            )}
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

                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "center",
                                    marginTop: 8,
                                }}>
                                <Button
                                    shape="circle"
                                    icon={<CloseOutlined />}
                                    onClick={() =>
                                        setFilterDrawerVisible(false)
                                    }
                                    style={{ width: 40, height: 40 }}
                                />
                            </div>
                        </Space>
                    </Card>
                </Drawer>
            </div>
        </ConfigProvider>
    );
};

export default ReportPage;
