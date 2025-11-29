import { useEffect, useState, useMemo, useCallback } from "react";
import {
    Card,
    Row,
    Col,
    Statistic,
    Typography,
    Space,
    message,
    Spin,
    Button,
    Divider,
    ConfigProvider,
    Modal,
    Form,
    InputNumber,
} from "antd";
import {
    TeamOutlined,
    SettingOutlined,
    BankOutlined,
    HomeOutlined,
    AlertOutlined,
    RiseOutlined,
    ReloadOutlined,
    ExclamationCircleOutlined,
    EditOutlined,
} from "@ant-design/icons";
import { supabase } from "@/globals";

const { Title, Text } = Typography;

const CONVERSION_FACTOR = 1;
const UNIT = "m";

const BARANGAY_THEME = {
    BLUE_AUTHORITY: "#0A3D62",
    RED_CRITICAL: "#CF1322",
    YELLOW_ALERT: "#FAAD14",
    GREEN_NORMAL: "#52C41A",
    CARD_SHADOW: "0 4px 12px rgba(0, 0, 0, 0.12)",
    PRIMARY_COLOR: "#0A3D62",
};

const cardStyle = {
    borderRadius: 10,
    boxShadow: BARANGAY_THEME.CARD_SHADOW,
    transition: "transform 0.3s ease, box-shadow 0.3s ease",
    borderTop: `4px solid ${BARANGAY_THEME.BLUE_AUTHORITY}`,
    background: "#fff",
    cursor: "default",
};

const getStatusColor = (statusName) => {
    switch (statusName) {
        case "L1":
            return BARANGAY_THEME.GREEN_NORMAL;
        case "L2":
            return BARANGAY_THEME.YELLOW_ALERT;
        case "L3":
            return BARANGAY_THEME.RED_CRITICAL;
        default:
            return BARANGAY_THEME.BLUE_AUTHORITY;
    }
};

const getStatusDescription = (statusName) => {
    switch (statusName) {
        case "L1":
            return "Normal (Lowest Risk, Safe Water Level - Pinakamababa ang peligro, ligtas na antas ng tubig)";
        case "L2":
            return "Alert (Moderate Risk, Requires Monitoring - Katamtamang peligro, kailangang bantayan)";
        case "L3":
            return "Critical (Highest Risk, Approaching Overflow - Pinakamataas na peligro, malapit na umapaw)";
        default:
            return "Unknown Status (Hindi Tiyak na Katayuan)";
    }
};

const getTodayStartISO = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString();
};

const useAuth = () => {
    const [userRole, setUserRole] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUserRole = async () => {
            setLoading(true);
            try {
                const {
                    data: { session },
                    error,
                } = await supabase.auth.getSession();
                if (error) throw error;

                if (!session?.user) {
                    setUserRole(null);
                    return;
                }

                const userId = session.user.id;
                const { data: roleData, error: roleError } = await supabase
                    .from("contacts")
                    .select("role")
                    .eq("user_id", userId)
                    .maybeSingle();

                if (roleError) throw roleError;

                setUserRole(roleData?.role ?? null);
            } catch (err) {
                console.error("Error fetching user role:", err);
                setUserRole(null);
            } finally {
                setLoading(false);
            }
        };

        fetchUserRole();
    }, []);

    return { userRole, loading };
};

const ThresholdEditModal = ({ isOpen, record, onClose, onSave, isSaving }) => {
    const [form] = Form.useForm();

    useEffect(() => {
        if (record) {
            form.setFieldsValue({
                min_level: parseFloat(record.min_level),
                max_level: parseFloat(record.max_level),
            });
        }
    }, [record, form]);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            onSave(record.id, values);
        } catch (errorInfo) {
            console.log("Validation Failed:", errorInfo);
        }
    };

    if (!record) return null;

    return (
        <Modal
            title={`Edit Threshold: ${record.name} - ${getStatusDescription(
                record.name
            )
                .split("(")[0]
                .trim()}`}
            open={isOpen}
            onCancel={onClose}
            onOk={handleOk}
            confirmLoading={isSaving}
            okText="Save Changes"
            centered
        >
            <Form
                form={form}
                layout="vertical"
                initialValues={{
                    min_level: parseFloat(record.min_level),
                    max_level: parseFloat(record.max_level),
                }}
            >
                <Form.Item
                    name="min_level"
                    label={`Minimum Level (${UNIT})`}
                    rules={[
                        {
                            required: true,
                            message: "Please input the minimum level!",
                        },
                    ]}
                >
                    <InputNumber
                        min={0}
                        step={0.01}
                        style={{ width: "100%" }}
                        addonAfter={UNIT}
                    />
                </Form.Item>
                <Form.Item
                    name="max_level"
                    label={`Maximum Level (${UNIT})`}
                    rules={[
                        {
                            required: true,
                            message: "Please input the maximum level!",
                        },
                        ({ getFieldValue }) => ({
                            validator(_, value) {
                                if (
                                    !value ||
                                    value >= getFieldValue("min_level")
                                ) {
                                    return Promise.resolve();
                                }
                                return Promise.reject(
                                    new Error(
                                        "Max Level must be greater than or equal to Min Level!"
                                    )
                                );
                            },
                        }),
                    ]}
                >
                    <InputNumber
                        min={0}
                        step={0.01}
                        style={{ width: "100%" }}
                        addonAfter={UNIT}
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};

const ThresholdCards = ({ thresholds, isUserAdmin, onEdit }) => {
    if (!thresholds || thresholds.length === 0) {
        return (
            <Card
                style={{
                    boxShadow: BARANGAY_THEME.CARD_SHADOW,
                    borderTop: `4px solid ${BARANGAY_THEME.BLUE_AUTHORITY}`,
                    textAlign: "center",
                    padding: "40px 20px",
                }}
            >
                <Text type="secondary">
                    No thresholds configured (Walang nakaset na antas)
                </Text>
            </Card>
        );
    }

    return (
        <Row gutter={[16, 16]}>
            {thresholds.map((threshold) => {
                const statusColor = getStatusColor(threshold.name);
                const statusText = getStatusDescription(threshold.name)
                    .split("(")[0]
                    .trim();
                const statusDescriptionFull = getStatusDescription(
                    threshold.name
                );

                return (
                    <Col xs={24} md={8} key={threshold.id}>
                        <Card
                            style={{
                                ...cardStyle,
                                borderTop: `4px solid ${statusColor}`,
                                minHeight: 200,
                            }}
                            bodyStyle={{ padding: "24px" }}
                            hoverable
                        >
                            <Space
                                direction="vertical"
                                style={{ width: "100%" }}
                                size="middle"
                            >
                                {/* Level and Status Title */}
                                <div>
                                    <Text
                                        strong
                                        style={{
                                            fontSize: "28px",
                                            color: statusColor,
                                            display: "block",
                                            lineHeight: 1.2,
                                        }}
                                    >
                                        {threshold.name} {statusText}
                                    </Text>
                                </div>

                                {/* Full Description */}
                                <Text
                                    type="secondary"
                                    style={{
                                        fontSize: "13px",
                                        display: "block",
                                        lineHeight: 1.5,
                                    }}
                                >
                                    {statusDescriptionFull}
                                </Text>

                                {/* Min and Max Levels in single line */}
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-around",
                                        alignItems: "center",
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: "15px",
                                        }}
                                    >
                                        <strong>Min Level:</strong>{" "}
                                        {threshold.min_level} {UNIT}
                                    </Text>
                                    <Text
                                        style={{
                                            fontSize: "20px",
                                            color: "#d9d9d9",
                                            margin: "0 8px",
                                        }}
                                    >
                                        |
                                    </Text>
                                    <Text
                                        style={{
                                            fontSize: "15px",
                                        }}
                                    >
                                        <strong>Max Level:</strong>{" "}
                                        {threshold.max_level} {UNIT}
                                    </Text>
                                </div>

                                {/* Edit Button */}
                                {isUserAdmin && (
                                    <Button
                                        icon={<EditOutlined />}
                                        onClick={() => onEdit(threshold)}
                                        style={{
                                            width: "100%",
                                            backgroundColor:
                                                BARANGAY_THEME.BLUE_AUTHORITY,
                                            color: "#fff",
                                            borderColor:
                                                BARANGAY_THEME.BLUE_AUTHORITY,
                                        }}
                                    >
                                        Edit Threshold
                                    </Button>
                                )}
                            </Space>
                        </Card>
                    </Col>
                );
            })}
        </Row>
    );
};

const DashboardPage = () => {
    const { userRole, loading: isAuthLoading } = useAuth();
    const [roleCount, setRoleCount] = useState(null);
    const [todayReadings, setTodayReadings] = useState([]);
    const [thresholds, setThresholds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const fetchRoleCounts = async () => {
        try {
            const [adminRes, officialRes, residentRes] = await Promise.all([
                supabase
                    .from("contacts")
                    .select("*", { count: "exact", head: true })
                    .eq("role", "Admin"),
                supabase
                    .from("contacts")
                    .select("*", { count: "exact", head: true })
                    .eq("role", "Official"),
                supabase
                    .from("contacts")
                    .select("*", { count: "exact", head: true })
                    .eq("role", "Resident"),
            ]);

            if (adminRes.error) throw adminRes.error;
            if (officialRes.error) throw officialRes.error;
            if (residentRes.error) throw residentRes.error;

            setRoleCount({
                Admin: adminRes.count || 0,
                Official: officialRes.count || 0,
                Resident: residentRes.count || 0,
            });
        } catch (err) {
            console.error("Error fetching user role counts:", err);
            message.error("Error fetching user role counts.");
            setRoleCount(null);
        }
    };

    const fetchTodayReadings = async () => {
        try {
            const { data, error } = await supabase
                .from("sensor_readings")
                .select("water_level, created_at")
                .gte("created_at", getTodayStartISO())
                .order("created_at", { ascending: false });

            if (error) throw error;

            setTodayReadings(data || []);
        } catch (err) {
            console.error("Error fetching readings:", err);
            message.warning("Failed to load today's sensor readings.");
            setTodayReadings([]);
        }
    };

    const fetchThresholds = async () => {
        try {
            const { data, error } = await supabase
                .from("water_thresholds")
                .select("*")
                .order("name", { ascending: true });

            if (error) throw error;

            setThresholds(
                (data || []).map((t) => ({
                    ...t,
                    min_level: parseFloat(t.min_level).toFixed(2),
                    max_level: parseFloat(t.max_level).toFixed(2),
                }))
            );
        } catch (err) {
            console.error("Error fetching thresholds:", err);
            message.warning("Failed to load alert thresholds.");
            setThresholds([]);
        }
    };

    const handleEditThreshold = useCallback((record) => {
        setEditingRecord(record);
        setIsModalOpen(true);
    }, []);

    const handleSaveThreshold = async (id, values) => {
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from("water_thresholds")
                .update({
                    min_level: values.min_level,
                    max_level: values.max_level,
                })
                .eq("id", id);

            if (error) throw error;

            message.success(
                `Successfully updated ${editingRecord.name} thresholds.`
            );
            await fetchThresholds();
            setIsModalOpen(false);
            setEditingRecord(null);
        } catch (err) {
            console.error("Error updating threshold:", err);
            message.error("Failed to update threshold. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingRecord(null);
    };

    const refreshDashboard = useCallback(
        async (isInitial = false) => {
            if (!userRole) return;

            if (isInitial) setLoading(true);
            else setRefreshing(true);

            try {
                const promises = [fetchThresholds()];

                if (["Admin", "Official"].includes(userRole))
                    promises.push(fetchRoleCounts());
                if (["Official", "Resident"].includes(userRole))
                    promises.push(fetchTodayReadings());

                await Promise.all(promises);
            } catch (err) {
                console.error("Refresh cycle failed:", err);
            } finally {
                if (isInitial) setLoading(false);
                else setRefreshing(false);
            }
        },
        [userRole]
    );

    useEffect(() => {
        if (!isAuthLoading) {
            refreshDashboard(true);
            const interval = userRole
                ? setInterval(() => refreshDashboard(false), 10000)
                : null;

            return () => {
                if (interval) clearInterval(interval);
            };
        }
    }, [isAuthLoading, refreshDashboard, userRole]);

    const {
        averageReading,
        peakReading,
        lastReadingValue,
        lastReadingTime,
        currentStatus,
        currentStatusColor,
    } = useMemo(() => {
        if (!todayReadings.length || !thresholds.length) {
            return {
                averageReading: null,
                peakReading: null,
                lastReadingValue: null,
                lastReadingTime: null,
                currentStatus: null,
                currentStatusColor: BARANGAY_THEME.BLUE_AUTHORITY,
            };
        }

        const readingsInM = todayReadings.map(
            (r) => parseFloat(r.water_level) * CONVERSION_FACTOR
        );
        const lastLevelM = readingsInM[0];

        const avg = (
            readingsInM.reduce((a, b) => a + b, 0) / readingsInM.length
        ).toFixed(2);
        const peak = Math.min(...readingsInM).toFixed(2);
        const timeString = new Date(
            todayReadings[0].created_at
        ).toLocaleTimeString();
        const lastValue = `${lastLevelM.toFixed(2)}${UNIT}`;

        const status =
            thresholds.find(
                (t) =>
                    lastLevelM >= parseFloat(t.min_level) &&
                    lastLevelM <= parseFloat(t.max_level)
            )?.name ?? "N/A";

        const color = getStatusColor(status);

        return {
            averageReading: avg,
            peakReading: peak,
            lastReadingValue: lastValue,
            lastReadingTime: timeString,
            currentStatus: status,
            currentStatusColor: color,
        };
    }, [todayReadings, thresholds]);

    const loadingText = "Loading... (Naglo-load...)";
    const noReadingsText = "No readings yet (Wala pang naitala)";

    const RefreshButton = () => (
        <Button
            type="primary"
            icon={<ReloadOutlined spin={refreshing} />}
            onClick={() => refreshDashboard(false)}
            loading={refreshing}
            style={{
                backgroundColor: BARANGAY_THEME.BLUE_AUTHORITY,
                borderColor: BARANGAY_THEME.BLUE_AUTHORITY,
                fontWeight: "bold",
            }}
        />
    );

    const CardContainer = ({
        title,
        value,
        prefix,
        color = BARANGAY_THEME.BLUE_AUTHORITY,
        subText,
    }) => (
        <Card
            style={{
                ...cardStyle,
                borderTop: `4px solid ${color}`,
                height: "100%",
                minHeight: 130,
            }}
            bodyStyle={{ padding: "24px" }}
            hoverable
        >
            <Statistic
                title={title}
                value={value ?? loadingText}
                prefix={prefix}
                valueStyle={{ color, fontWeight: "bold" }}
            />
            {subText && (
                <Text
                    type="secondary"
                    style={{ display: "block", marginTop: 8 }}
                >
                    {subText}
                </Text>
            )}
        </Card>
    );

    const CommonDashboardLayout = ({
        title,
        children,
        showThresholds = true,
    }) => {
        const isUserAdmin = userRole === "Admin";
        const sectionTitle = isUserAdmin
            ? "Key User Statistics"
            : "Live Data Overview";

        return (
            <Space
                direction="vertical"
                style={{ width: "100%", paddingInline: 32, marginBottom: 32 }}
                size="middle"
            >
                <Title
                    level={2}
                    style={{
                        marginBottom: 0,
                        marginTop: 24,
                        color: BARANGAY_THEME.BLUE_AUTHORITY,
                    }}
                >
                    {title}
                </Title>
                <Divider style={{ margin: "10px 0 20px 0" }} />

                <Row
                    justify="space-between"
                    align="middle"
                    style={{ marginBottom: 0 }}
                >
                    <Title
                        level={4}
                        style={{
                            margin: 0,
                            color: BARANGAY_THEME.BLUE_AUTHORITY,
                        }}
                    >
                        {sectionTitle}
                    </Title>
                    <RefreshButton />
                </Row>

                {children}

                {showThresholds && userRole !== "Resident" && (
                    <>
                        <Divider />
                        <Row
                            justify="space-between"
                            align="middle"
                            style={{ marginBottom: 10 }}
                        >
                            <Title
                                level={4}
                                style={{
                                    margin: 0,
                                    color: BARANGAY_THEME.BLUE_AUTHORITY,
                                }}
                            >
                                <ExclamationCircleOutlined
                                    style={{ marginRight: 8 }}
                                />
                                Water Level Alert Thresholds (Mga Antas ng
                                Babala)
                            </Title>
                        </Row>
                        <ThresholdCards
                            thresholds={thresholds}
                            isUserAdmin={isUserAdmin}
                            onEdit={handleEditThreshold}
                        />
                    </>
                )}
            </Space>
        );
    };

    if (isAuthLoading || loading) {
        return (
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: "calc(100vh - 60px)",
                    width: "100%",
                }}
            >
                <Spin size="large" tip="Loading Barangay dashboard..." />
            </div>
        );
    }

    if (userRole === "Admin") {
        const totalUsers = roleCount
            ? roleCount.Admin + roleCount.Official + roleCount.Resident
            : null;
        return (
            <>
                <CommonDashboardLayout
                    title="Barangay Admin Control Panel"
                    showThresholds={true}
                >
                    <Row gutter={[24, 24]}>
                        <Col xs={24} sm={12} md={6}>
                            <CardContainer
                                title="Total Users in System (Kabuuang Gumagamit)"
                                value={totalUsers}
                                prefix={<TeamOutlined />}
                                color={BARANGAY_THEME.BLUE_AUTHORITY}
                            />
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <CardContainer
                                title="Admins (Mga Admin)"
                                value={roleCount?.Admin}
                                prefix={<SettingOutlined />}
                                color={BARANGAY_THEME.BLUE_AUTHORITY}
                            />
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <CardContainer
                                title="Officials (Mga Opisyal)"
                                value={roleCount?.Official}
                                prefix={<BankOutlined />}
                                color={BARANGAY_THEME.BLUE_AUTHORITY}
                            />
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <CardContainer
                                title="Residents (Mga Residente)"
                                value={roleCount?.Resident}
                                prefix={<HomeOutlined />}
                                color={BARANGAY_THEME.BLUE_AUTHORITY}
                            />
                        </Col>
                    </Row>
                </CommonDashboardLayout>
                <ThresholdEditModal
                    isOpen={isModalOpen}
                    record={editingRecord}
                    onClose={handleCloseModal}
                    onSave={handleSaveThreshold}
                    isSaving={isSaving}
                />
            </>
        );
    }

    const isOfficial = userRole === "Official";
    const titleText = isOfficial
        ? "Barangay Official's Overview"
        : "Barangay Resident Water Monitor";
    const currentDescription = currentStatus
        ? getStatusDescription(currentStatus)
        : noReadingsText;

    if (isOfficial || userRole === "Resident") {
        const officialAndResidentCount = roleCount
            ? roleCount.Official + roleCount.Resident
            : null;

        return (
            <ConfigProvider
                theme={{
                    token: {
                        colorPrimary: BARANGAY_THEME.PRIMARY_COLOR,
                        borderRadius: 8,
                    },
                }}
            >
                <CommonDashboardLayout title={titleText}>
                    <Row gutter={[24, 24]}>
                        {isOfficial && (
                            <Col xs={24} md={12}>
                                <Card
                                    title="Total Barangay Users (Opisyal + Residente)"
                                    style={{
                                        ...cardStyle,
                                        height: "100%",
                                        minHeight: 180,
                                        borderTop: `4px solid ${BARANGAY_THEME.BLUE_AUTHORITY}`,
                                    }}
                                    bodyStyle={{ padding: "30px 24px" }}
                                    hoverable
                                >
                                    <Text
                                        strong
                                        style={{
                                            fontSize: "36px",
                                            display: "flex",
                                            alignItems: "center",
                                            color: BARANGAY_THEME.BLUE_AUTHORITY,
                                        }}
                                    >
                                        <TeamOutlined
                                            style={{ marginRight: 15 }}
                                        />
                                        {officialAndResidentCount ??
                                            loadingText}
                                    </Text>
                                    <Text
                                        type="secondary"
                                        style={{
                                            display: "block",
                                            marginTop: 8,
                                        }}
                                    >
                                        Includes all verified officials and
                                        residents in the system.
                                    </Text>
                                </Card>
                            </Col>
                        )}

                        <Col xs={24} md={isOfficial ? 12 : 24}>
                            <Card
                                title="Current Water Level Status (Kasalukuyang Antas ng Tubig)"
                                style={{
                                    ...cardStyle,
                                    height: "100%",
                                    minHeight: isOfficial ? 180 : 200,
                                    borderTop: `4px solid ${currentStatusColor}`,
                                }}
                                bodyStyle={{
                                    padding: isOfficial ? "24px" : "30px 24px",
                                }}
                                hoverable
                            >
                                <Text
                                    strong
                                    style={{
                                        color: currentStatusColor,
                                        fontSize: isOfficial ? "36px" : "48px",
                                        display: "flex",
                                        alignItems: "center",
                                        marginBottom: 8,
                                    }}
                                >
                                    <AlertOutlined
                                        style={{ marginRight: 15 }}
                                    />
                                    {currentStatus ?? noReadingsText}
                                </Text>
                                <Text
                                    type="secondary"
                                    style={{
                                        display: "block",
                                        fontSize: isOfficial ? "14px" : "18px",
                                    }}
                                >
                                    **{currentDescription}**
                                </Text>
                                <Text
                                    type="secondary"
                                    style={{
                                        display: "block",
                                        marginTop: 4,
                                    }}
                                >
                                    Huling Pagbasa: **
                                    {lastReadingValue ?? "N/A"}** @{" "}
                                    {lastReadingTime ?? "N/A"}
                                </Text>
                            </Card>
                        </Col>
                    </Row>

                    <Divider />

                    <Title
                        level={4}
                        style={{
                            marginTop: 10,
                            marginBottom: 20,
                            color: BARANGAY_THEME.BLUE_AUTHORITY,
                        }}
                    >
                        Water Level Statistics Today
                    </Title>

                    <Row gutter={[24, 24]}>
                        <Col xs={24} md={8}>
                            <CardContainer
                                title="Average Level Today (Karaniwang Antas Ngayon)"
                                value={
                                    averageReading
                                        ? `${averageReading}${UNIT}`
                                        : noReadingsText
                                }
                                prefix={<RiseOutlined />}
                            />
                        </Col>
                        <Col xs={24} md={8}>
                            <CardContainer
                                title={`Peak Level Today (Pinakamataas na Antas - Lowest Reading in ${UNIT})`}
                                value={
                                    peakReading
                                        ? `${peakReading}${UNIT}`
                                        : noReadingsText
                                }
                                prefix={<RiseOutlined />}
                                color={
                                    currentStatus === "L3" ||
                                    currentStatus === "L2"
                                        ? currentStatusColor
                                        : BARANGAY_THEME.BLUE_AUTHORITY
                                }
                                subText={`Lowest distance from sensor = Highest water level (measured in ${UNIT}).`}
                            />
                        </Col>
                        <Col xs={24} md={8}>
                            <CardContainer
                                title="Last Sensor Reading Time (Oras ng Huling Pagbasa)"
                                value={lastReadingTime ?? "N/A"}
                                prefix={<ReloadOutlined />}
                                subText={
                                    lastReadingValue
                                        ? `Value: ${lastReadingValue}`
                                        : null
                                }
                            />
                        </Col>
                    </Row>
                </CommonDashboardLayout>
            </ConfigProvider>
        );
    }

    return (
        <div style={{ padding: 24 }}>
            <Title level={2}>Access Denied (Hindi Pinahihintulutan)</Title>
            <Text type="secondary">
                Your role ({userRole}) does not have a defined dashboard view or
                permission to view the data.
            </Text>
        </div>
    );
};

export default DashboardPage;
