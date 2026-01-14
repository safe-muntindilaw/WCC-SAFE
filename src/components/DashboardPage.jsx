// DashboardPage.jsx - Enhanced Version
import { useEffect, useState, useMemo, useCallback } from "react";
import {
    Card,
    Row,
    Col,
    Statistic,
    Typography,
    Space,
    Spin,
    Button,
    ConfigProvider,
    Modal,
    Form,
    InputNumber,
    Empty,
    Input,
    Tabs,
    Flex,
    Alert,
} from "antd";
import {
    TeamOutlined,
    SettingOutlined,
    BankOutlined,
    HomeOutlined,
    AlertOutlined,
    RiseOutlined,
    ReloadOutlined,
    EditOutlined,
    MessageOutlined,
    LockOutlined,
    EyeInvisibleOutlined,
    EyeTwoTone,
    KeyOutlined,
    TrophyOutlined,
    FallOutlined,
} from "@ant-design/icons";
import { supabase } from "@/globals";
import { THEME, cardStyle, cardStyleAdaptive } from "@/utils/theme";
import { showSuccess, showError, showWarning } from "@/utils/notifications";
import { useResponsive } from "@/utils/useResponsive";
import { useConfirmDialog } from "@/utils/confirmDialog";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const UNIT = "m";

/* =========================
   ROLE & STATUS CONFIG
========================= */
const ROLE_CONFIG = {
    Admin: {
        canEditThresholds: true,
        canViewRoleCounts: true,
        canViewReadings: false,
        canEditDefaultPassword: true,
        showThresholds: true,
        dashboardTitle: "Admin Dashboard",
        sectionTitle: "System Management",
    },
    Official: {
        canEditThresholds: true,
        canViewRoleCounts: true,
        canViewReadings: true,
        canEditDefaultPassword: false,
        showThresholds: true,
        dashboardTitle: "Official's Dashboard",
        sectionTitle: "Live Data Overview & Monitoring",
    },
    Resident: {
        canEditThresholds: false,
        canViewRoleCounts: false,
        canViewReadings: true,
        canEditDefaultPassword: false,
        showThresholds: false,
        dashboardTitle: "Water Level Monitor",
        sectionTitle: "Current Water Level Status",
    },
};

const STATUS_CONFIG = {
    L0: { color: THEME.GREEN_SAFE, label: "L0", desc: "Safe Level" },
    L1: { color: THEME.YELLOW_NORMAL, label: "L1", desc: "Minor Risk" },
    L2: { color: THEME.ORANGE_ALERT, label: "L2", desc: "Moderate Risk" },
    L3: { color: THEME.RED_CRITICAL, label: "L3", desc: "Highest Risk" },
    default: {
        color: THEME.BLUE_AUTHORITY,
        label: "Unknown",
        desc: "Unknown Status",
    },
};

/* =========================
   HOOK: useAuth
========================= */
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

                const { data: roleData, error: roleError } = await supabase
                    .from("contacts")
                    .select("role")
                    .eq("user_id", session.user.id)
                    .maybeSingle();

                if (roleError) throw roleError;
                setUserRole(roleData?.role ?? null);
            } catch (err) {
                console.error(err);
                showError("Failed to load user role");
            } finally {
                setLoading(false);
            }
        };
        fetchUserRole();
    }, []);

    return { userRole, loading };
};

/* =========================
   COMPONENT: DefaultPasswordModal
========================= */
const DefaultPasswordModal = ({ isOpen, onClose, isMobile }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const { confirm } = useConfirmDialog();

    useEffect(() => {
        if (isOpen) {
            fetchCurrentPassword();
        }
    }, [isOpen]);

    const fetchCurrentPassword = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("default_password")
                .select("default")
                .single();

            if (error) throw error;
            setCurrentPassword(data.default);
            form.setFieldsValue({ password: data.default });
        } catch (err) {
            console.error(err);
            showError("Failed to load default password");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();

            confirm({
                title: "Update Default Password",
                content:
                    "Are you sure you want to change the default password for new users?",
                onOk: async () => {
                    setLoading(true);
                    try {
                        const { error } = await supabase
                            .from("default_password")
                            .update({ default: values.password })
                            .eq("id", 1);

                        if (error) throw error;

                        showSuccess("Default password updated successfully");
                        setCurrentPassword(values.password);
                        onClose();
                    } catch (err) {
                        console.error(err);
                        showError("Failed to update default password");
                    } finally {
                        setLoading(false);
                    }
                },
            });
        } catch (err) {
            console.log("Validation Failed:", err);
        }
    };

    return (
        <Modal
            title={
                <Title level={4} style={{ margin: 0 }}>
                    <LockOutlined style={{ marginRight: 8 }} />
                    Default Password Settings
                </Title>
            }
            open={isOpen}
            onCancel={onClose}
            footer={null}
            width={isMobile ? "100%" : 500}
            centered
            destroyOnHidden>
            <Card
                variant={false}
                style={{
                    borderTop: `4px solid ${THEME.BLUE_PRIMARY}`,
                    marginTop: 16,
                }}
                styles={{ body: { padding: isMobile ? 16 : 24 } }}>
                <Space direction="vertical" style={{ width: "100%" }}>
                    <Alert
                        message="Important"
                        description="This password will be assigned to all newly created user accounts. Users should change it immediately after their first login."
                        type="warning"
                        showIcon
                    />

                    <Form form={form} layout="vertical">
                        <Form.Item
                            name="password"
                            label="Default Password"
                            rules={[
                                {
                                    required: true,
                                    message: "Please enter a default password!",
                                },
                                {
                                    min: 6,
                                    message:
                                        "Password must be at least 6 characters!",
                                },
                            ]}>
                            <Input.Password
                                placeholder="Enter default password"
                                iconRender={(visible) =>
                                    visible ? (
                                        <EyeTwoTone />
                                    ) : (
                                        <EyeInvisibleOutlined />
                                    )
                                }
                            />
                        </Form.Item>
                    </Form>

                    <Flex justify="end" gap={12}>
                        <Button
                            danger
                            style={{
                                height: isMobile ? 32 : 40,
                                borderRadius: 6,
                                width: "100%",
                            }}
                            onClick={onClose}
                            disabled={loading}>
                            Cancel
                        </Button>
                        <Button
                            type="primary"
                            onClick={handleSave}
                            loading={loading}
                            style={{
                                height: isMobile ? 32 : 40,
                                borderRadius: 6,
                                width: "100%",
                            }}>
                            Update
                        </Button>
                    </Flex>
                </Space>
            </Card>
        </Modal>
    );
};

/* =========================
   COMPONENT: ThresholdSettingsModal
========================= */
const ThresholdSettingsModal = ({
    isOpen,
    record,
    onClose,
    onSave,
    isSaving,
    isMobile,
}) => {
    const [form] = Form.useForm();
    const [smsTemplates, setSmsTemplates] = useState([]);
    const [activeTab, setActiveTab] = useState("threshold");
    const [saving, setSaving] = useState(false);
    const { confirm } = useConfirmDialog();

    useEffect(() => {
        if (record) {
            form.setFieldsValue({
                min_level: parseFloat(record.min_level),
                max_level: parseFloat(record.max_level),
            });
            fetchSmsTemplates();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [record]);

    const fetchSmsTemplates = async () => {
        if (!record) return;
        try {
            const { data, error } = await supabase
                .from("sms_templates")
                .select("*")
                .eq("threshold_name", record.name);
            if (error) throw error;
            setSmsTemplates(data || []);
        } catch (err) {
            console.error(err);
            showError("Failed to load SMS templates");
        }
    };

    const handleSaveThreshold = async () => {
        try {
            const values = await form.validateFields([
                "min_level",
                "max_level",
            ]);
            onSave(record.id, values);
        } catch (err) {
            console.log("Validation Failed:", err);
        }
    };

    const handleSaveSmsTemplate = async (templateId) => {
        const value = form.getFieldValue(`template_${templateId}`);
        if (!value || !value.trim()) {
            throw new Error("SMS template cannot be empty");
        }

        const { error } = await supabase
            .from("sms_templates")
            .update({
                message_template: value,
                updated_at: new Date().toISOString(),
            })
            .eq("id", templateId);

        if (error) throw error;
    };

    const handleSaveAll = async () => {
        if (activeTab === "threshold") {
            confirm({
                title: "Save Threshold Changes",
                content: `Are you sure you want to update the threshold settings for ${record.name}?`,
                onOk: async () => {
                    await handleSaveThreshold();
                },
            });
        } else {
            const templateIds = smsTemplates.map((t) => t.id);
            if (templateIds.length === 0) {
                showWarning("No templates to save");
                return;
            }

            confirm({
                title: "Save SMS Template Changes",
                content: `Are you sure you want to update the SMS template(s) for ${record.name}?`,
                onOk: async () => {
                    setSaving(true);
                    let successCount = 0;
                    let failCount = 0;

                    for (const templateId of templateIds) {
                        try {
                            await handleSaveSmsTemplate(templateId);
                            successCount++;
                        } catch (err) {
                            console.error(err);
                            failCount++;
                        }
                    }

                    setSaving(false);

                    if (failCount === 0 && successCount > 0) {
                        showSuccess("SMS template(s) updated successfully");
                        await fetchSmsTemplates();
                    } else if (successCount === 0) {
                        showError("Failed to update SMS templates");
                    } else {
                        showWarning(
                            `Updated ${successCount} template(s), ${failCount} failed`
                        );
                        await fetchSmsTemplates();
                    }
                },
            });
        }
    };

    if (!record) return null;

    const thresholdTab = (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Card
                size="small"
                style={{
                    background: "#e6f7ff",
                    border: "1px solid #91d5ff",
                    borderRadius: 8,
                }}>
                <Space direction="vertical" size={4}>
                    <Text strong style={{ fontSize: 13 }}>
                        Threshold Settings:
                    </Text>
                    <ul
                        style={{
                            margin: 0,
                            paddingLeft: 18,
                            fontSize: 13,
                            color: "#595959",
                        }}>
                        <li>Minimum level must be less than maximum level</li>
                        <li>Values are measured in meters (m)</li>
                    </ul>
                </Space>
            </Card>

            <Form form={form} layout="vertical">
                <Form.Item
                    name="min_level"
                    label={`Minimum Level (${UNIT})`}
                    rules={[
                        {
                            required: true,
                            message: "Please input minimum level!",
                        },
                    ]}>
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
                            message: "Please input maximum level!",
                        },
                        ({ getFieldValue }) => ({
                            validator(_, value) {
                                if (
                                    !value ||
                                    value >= getFieldValue("min_level")
                                )
                                    return Promise.resolve();
                                return Promise.reject(
                                    new Error("Max must be >= Min!")
                                );
                            },
                        }),
                    ]}>
                    <InputNumber
                        min={0}
                        step={0.01}
                        style={{ width: "100%" }}
                        addonAfter={UNIT}
                    />
                </Form.Item>
            </Form>
        </Space>
    );

    const smsTab = (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Card
                size="small"
                style={{
                    background: "#e6f7ff",
                    border: "1px solid #91d5ff",
                    borderRadius: 8,
                }}>
                <Space direction="vertical" size={4}>
                    <Text strong style={{ fontSize: 13 }}>
                        SMS Template Guidelines:
                    </Text>
                    <ul
                        style={{
                            margin: 0,
                            paddingLeft: 18,
                            fontSize: 13,
                            color: "#595959",
                        }}>
                        <li>Keep messages clear and concise</li>
                        <li>Include relevant water level information</li>
                        <li>Add emergency contact if needed</li>
                        <li>Use {"{water_level}"} to display dynamic data</li>
                    </ul>
                </Space>
            </Card>

            {smsTemplates.length === 0 ? (
                <Card
                    size="small"
                    style={{
                        background: "#fff7e6",
                        border: "1px solid #ffd591",
                        borderRadius: 8,
                    }}>
                    <Text style={{ fontSize: 13, color: "#ad6800" }}>
                        No SMS template found for {record.name}. Please create
                        one in the database.
                    </Text>
                </Card>
            ) : (
                <Form form={form} layout="vertical">
                    {smsTemplates.map((template) => (
                        <Form.Item
                            key={template.id}
                            name={`template_${template.id}`}
                            label={`SMS Template for ${
                                template.threshold_name || record.name
                            }`}
                            initialValue={template.message_template}
                            rules={[
                                {
                                    required: true,
                                    message: "Template cannot be empty!",
                                },
                            ]}>
                            <TextArea
                                rows={4}
                                placeholder="Enter SMS message template..."
                                maxLength={160}
                                showCount
                            />
                        </Form.Item>
                    ))}
                </Form>
            )}
        </Space>
    );

    return (
        <Modal
            title={
                <Title level={4} style={{ margin: 0 }}>
                    <SettingOutlined style={{ marginRight: 8 }} />
                    Settings: {record.name}
                </Title>
            }
            open={isOpen}
            onCancel={onClose}
            footer={null}
            width={isMobile ? "100%" : 600}
            centered
            destroyOnHidden>
            <Card
                variant={false}
                style={{
                    borderTop: `4px solid ${THEME.BLUE_PRIMARY}`,
                    marginTop: 16,
                }}
                styles={{ body: { padding: isMobile ? 16 : 24 } }}>
                <Space direction="vertical" size={24} style={{ width: "100%" }}>
                    <Tabs
                        activeKey={activeTab}
                        onChange={setActiveTab}
                        items={[
                            {
                                key: "threshold",
                                label: (
                                    <span>
                                        <AlertOutlined /> Threshold
                                    </span>
                                ),
                                children: thresholdTab,
                            },
                            {
                                key: "sms",
                                label: (
                                    <span>
                                        <MessageOutlined /> SMS Template
                                    </span>
                                ),
                                children: smsTab,
                            },
                        ]}
                    />

                    <Flex justify="grow" gap={12}>
                        <Button
                            danger
                            style={{
                                height: isMobile ? 32 : 40,
                                borderRadius: 6,
                                width: "100%",
                            }}
                            onClick={onClose}
                            disabled={isSaving || saving}>
                            Cancel
                        </Button>

                        <Button
                            type="primary"
                            onClick={handleSaveAll}
                            loading={isSaving || saving}
                            disabled={
                                activeTab === "sms" && smsTemplates.length === 0
                            }
                            style={{
                                height: isMobile ? 32 : 40,
                                borderRadius: 6,
                                width: "100%",
                            }}>
                            {isSaving || saving
                                ? "Saving..."
                                : `Save ${
                                      activeTab === "threshold"
                                          ? "Threshold"
                                          : "Template"
                                  }`}
                        </Button>
                    </Flex>
                </Space>
            </Card>
        </Modal>
    );
};

/* =========================
   COMPONENT: CardContainer
========================= */
const CardContainer = ({
    title,
    value,
    prefix,
    color = THEME.BLUE_PRIMARY,
    subText,
    loading = false,
}) => (
    <Card
        style={{
            ...cardStyleAdaptive,
            border: `1px solid ${color}`,
            borderTopWidth: 4,
        }}>
        {loading ? (
            <Spin />
        ) : (
            <>
                <Statistic
                    title={title}
                    value={value ?? "N/A"}
                    prefix={prefix}
                    valueStyle={{ color }}
                />
                {subText && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {subText}
                    </Text>
                )}
            </>
        )}
    </Card>
);

/* =========================
   COMPONENT: RefreshButton
========================= */
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

/* =========================
   COMPONENT: ThresholdCards
========================= */
const ThresholdCards = ({ thresholds, isUserAdmin, onEdit }) => {
    if (!thresholds?.length)
        return <Empty description="No thresholds configured" />;

    return (
        <Row gutter={[24, 24]}>
            {thresholds.map((t) => {
                const status = STATUS_CONFIG[t.name] || STATUS_CONFIG.default;

                return (
                    <Col xs={24} sm={12} lg={6} key={t.id}>
                        <Card
                            style={{
                                ...cardStyleAdaptive,
                                border: `1px solid ${status.color}`,
                                borderTopWidth: "4px",
                            }}>
                            <Space
                                direction="vertical"
                                style={{ width: "100%" }}
                                size="middle">
                                <Text
                                    strong
                                    style={{
                                        fontSize: 24,
                                        color: status.color,
                                    }}>
                                    <AlertOutlined /> {t.name} THRESHOLD
                                </Text>
                                <Text type="secondary">{status.desc}</Text>
                                <Flex justify="center" gap={16}>
                                    <Text>
                                        Min: {t.min_level}
                                        {UNIT}
                                    </Text>
                                    |
                                    <Text>
                                        Max: {t.max_level}
                                        {UNIT}
                                    </Text>
                                </Flex>
                            </Space>
                            {isUserAdmin && (
                                <Button
                                    icon={<EditOutlined />}
                                    onClick={() => onEdit(t)}
                                    block
                                    type="primary"
                                    style={{ marginTop: 16 }}>
                                    Settings
                                </Button>
                            )}
                        </Card>
                    </Col>
                );
            })}
        </Row>
    );
};

/* =========================
   COMPONENT: DashboardPage
========================= */
const DashboardPage = () => {
    const { userRole, loading: isAuthLoading } = useAuth();
    const { isMobile } = useResponsive();

    const [roleCount, setRoleCount] = useState({
        Admin: 0,
        Official: 0,
        Resident: 0,
    });
    const [todayReadings, setTodayReadings] = useState([]);
    const [thresholds, setThresholds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

    const roleConfig = userRole ? ROLE_CONFIG[userRole] : null;

    /* =========================
     FETCH FUNCTIONS
  ========================== */
    const fetchRoleCounts = useCallback(async () => {
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

            const counts = {
                Admin: adminRes.count || 0,
                Official: officialRes.count || 0,
                Resident: residentRes.count || 0,
            };

            setRoleCount(counts);
        } catch (err) {
            console.error(err);
            showError("Failed to fetch user counts");
            setRoleCount({ Admin: 0, Official: 0, Resident: 0 });
        }
    }, []);

    const fetchTodayReadings = useCallback(async () => {
        try {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayStartISO = todayStart.toISOString();

            const { data, error } = await supabase
                .from("sensor_readings")
                .select("water_level, created_at")
                .gte("created_at", todayStartISO)
                .order("created_at", { ascending: false });

            if (error) throw error;

            setTodayReadings(data || []);
        } catch (err) {
            console.error(err);
            showWarning("Failed to load sensor readings");
            setTodayReadings([]);
        }
    }, []);

    const fetchThresholds = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from("water_thresholds")
                .select("*")
                .order("name");

            if (error) throw error;

            const formattedThresholds = (data || []).map((t) => ({
                ...t,
                min_level: parseFloat(t.min_level).toFixed(2),
                max_level: parseFloat(t.max_level).toFixed(2),
            }));

            setThresholds(formattedThresholds);
        } catch (err) {
            console.error(err);
            showWarning("Failed to load thresholds");
            setThresholds([]);
        }
    }, []);

    const refreshDashboard = useCallback(
        async (isInitial = false) => {
            if (!roleConfig) return;

            if (isInitial) setLoading(true);
            else setRefreshing(true);

            try {
                const promises = [fetchThresholds()];

                if (roleConfig.canViewRoleCounts) {
                    promises.push(fetchRoleCounts());
                }

                if (roleConfig.canViewReadings) {
                    promises.push(fetchTodayReadings());
                }

                await Promise.all(promises);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [roleConfig, fetchThresholds, fetchRoleCounts, fetchTodayReadings]
    );

    useEffect(() => {
        if (!isAuthLoading && userRole && roleConfig) {
            refreshDashboard(true);

            const interval = setInterval(() => {
                refreshDashboard(false);
            }, 10000);

            return () => {
                clearInterval(interval);
            };
        }
    }, [isAuthLoading, userRole, roleConfig, refreshDashboard]);

    /* =========================
     MODAL HANDLERS
  ========================== */
    const handleEditThreshold = useCallback((record) => {
        setEditingRecord(record);
        setIsModalOpen(true);
    }, []);

    const handleSaveThreshold = async (id, values) => {
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from("water_thresholds")
                .update(values)
                .eq("id", id);
            if (error) throw error;
            showSuccess(`Threshold ${editingRecord.name} updated successfully`);
            await fetchThresholds();
            setIsModalOpen(false);
            setEditingRecord(null);
        } catch (err) {
            console.error(err);
            showError("Failed to update threshold");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingRecord(null);
    };

    const handleOpenPasswordModal = () => {
        setIsPasswordModalOpen(true);
    };

    const handleClosePasswordModal = () => {
        setIsPasswordModalOpen(false);
    };

    /* =========================
     HELPER: Get threshold for water level
  ========================== */
    const getThresholdForLevel = useCallback(
        (level) => {
            if (!thresholds.length) return "default";
            const parsedLevel = parseFloat(level);
            const threshold = thresholds.find((t) => {
                const min = parseFloat(t.min_level);
                const max = parseFloat(t.max_level);
                return parsedLevel >= min && parsedLevel <= max;
            });
            return threshold?.name || "default";
        },
        [thresholds]
    );

    /* =========================
     WATER STATS
  ========================== */
    const waterLevelStats = useMemo(() => {
        if (!todayReadings.length || !thresholds.length) return {};

        try {
            const lastReading = parseFloat(todayReadings[0].water_level);

            const avg = (
                todayReadings.reduce(
                    (sum, r) => sum + parseFloat(r.water_level),
                    0
                ) / todayReadings.length
            ).toFixed(2);

            const peak = Math.max(
                ...todayReadings.map((r) => parseFloat(r.water_level))
            ).toFixed(2);

            const lowest = Math.min(
                ...todayReadings.map((r) => parseFloat(r.water_level))
            ).toFixed(2);

            const currentThreshold = getThresholdForLevel(lastReading);
            const avgThreshold = getThresholdForLevel(avg);
            const peakThreshold = getThresholdForLevel(peak);
            const lowestThreshold = getThresholdForLevel(lowest);

            return {
                lastReadingValue: `${lastReading.toFixed(2)}${UNIT}`,
                lastReadingTime: new Date(
                    todayReadings[0].created_at
                ).toLocaleTimeString(),
                averageReading: `${avg}${UNIT}`,
                peakReading: `${peak}${UNIT}`,
                lowestReading: `${lowest}${UNIT}`,
                totalReadings: todayReadings.length,
                currentStatus: STATUS_CONFIG[currentThreshold].label,
                currentStatusColor: STATUS_CONFIG[currentThreshold].color,
                avgColor: STATUS_CONFIG[avgThreshold].color,
                peakColor: STATUS_CONFIG[peakThreshold].color,
                lowestColor: STATUS_CONFIG[lowestThreshold].color,
            };
        } catch (err) {
            console.error(err);
            return {};
        }
    }, [todayReadings, thresholds, getThresholdForLevel]);

    /* =========================
     RENDER
  ========================== */
    if (isAuthLoading || loading) {
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
                    backgroundColor: "rgba(255, 255, 255, 0.9)",
                    zIndex: 100,
                }}>
                <Spin size="large" />
            </div>
        );
    }

    if (!userRole || !roleConfig) {
        return (
            <div style={{ padding: 32 }}>
                <Empty description="Access Denied" />
            </div>
        );
    }

    return (
        <ConfigProvider theme={{ token: { colorPrimary: THEME.BLUE_PRIMARY } }}>
            <Space
                direction="vertical"
                style={{ width: "100%", padding: isMobile ? 16 : 32 }}
                size="large">
                {/* HEADER */}
                <Card
                    style={{
                        ...cardStyle,
                        background: THEME.BLUE_PRIMARY,
                        border: "none",
                    }}>
                    <Row justify="space-between" align="middle">
                        <Col>
                            <Title
                                level={isMobile ? 4 : 2}
                                style={{ color: "#fff", margin: 0 }}>
                                {roleConfig.dashboardTitle}
                            </Title>
                            <Text style={{ color: "rgba(255,255,255,0.85)" }}>
                                {roleConfig.sectionTitle}
                            </Text>
                        </Col>
                        <Col>
                            <Space>
                                {roleConfig.canEditDefaultPassword && (
                                    <Button
                                        type="default"
                                        ghost
                                        icon={<LockOutlined />}
                                        onClick={handleOpenPasswordModal}
                                        style={{
                                            color: "white",
                                            borderColor: "white",
                                        }}>
                                        {!isMobile && "Default Password"}
                                    </Button>
                                )}
                                <RefreshButton
                                    refreshing={refreshing}
                                    onRefresh={() => refreshDashboard(false)}
                                />
                            </Space>
                        </Col>
                    </Row>
                </Card>

                {/* USER ROLE STATISTICS */}
                {roleConfig.canViewRoleCounts && (
                    <>
                        <Row gutter={[24, 24]}>
                            {userRole === "Admin" && (
                                <Col
                                    xs={userRole === "Admin" ? 12 : 24}
                                    sm={12}
                                    md={6}>
                                    <CardContainer
                                        title="Admins"
                                        value={roleCount?.Admin}
                                        prefix={<SettingOutlined />}
                                        color={THEME.BLUE_AUTHORITY}
                                    />
                                </Col>
                            )}
                            <Col
                                xs={userRole === "Admin" ? 12 : 24}
                                sm={12}
                                md={userRole === "Admin" ? 6 : 8}>
                                <CardContainer
                                    title="Officials"
                                    value={roleCount?.Official}
                                    prefix={<BankOutlined />}
                                    color={THEME.BLUE_PRIMARY}
                                />
                            </Col>
                            <Col
                                xs={userRole === "Admin" ? 12 : 24}
                                sm={12}
                                md={userRole === "Admin" ? 6 : 8}>
                                <CardContainer
                                    title="Residents"
                                    value={roleCount?.Resident}
                                    prefix={<HomeOutlined />}
                                    color={THEME.GREEN_SAFE}
                                />
                            </Col>
                            <Col
                                xs={userRole === "Admin" ? 12 : 24}
                                sm={12}
                                md={userRole === "Admin" ? 6 : 8}>
                                <CardContainer
                                    title="Total Users"
                                    value={
                                        roleCount
                                            ? userRole === "Admin"
                                                ? roleCount.Admin +
                                                  roleCount.Official +
                                                  roleCount.Resident
                                                : roleCount.Official +
                                                  roleCount.Resident
                                            : 0
                                    }
                                    prefix={<TeamOutlined />}
                                    color="#722ed1"
                                />
                            </Col>
                        </Row>
                    </>
                )}

                {/* WATER LEVEL MONITORING */}
                {roleConfig.canViewReadings && (
                    <>
                        {todayReadings.length === 0 ? (
                            <Card
                                style={{
                                    height: isMobile ? "55vh" : "35vh",
                                    border: "none",
                                }}
                                styles={{
                                    body: {
                                        height: "100%",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    },
                                }}>
                                <Empty description="No water level readings available today" />
                            </Card>
                        ) : (
                            <>
                                <Row gutter={[24, 24]}>
                                    <Col xs={12} md={8}>
                                        <CardContainer
                                            title="Current Status"
                                            value={
                                                waterLevelStats.currentStatus ||
                                                "N/A"
                                            }
                                            color={
                                                waterLevelStats.currentStatusColor
                                            }
                                            prefix={<AlertOutlined />}
                                            subText="Threshold Level"
                                        />
                                    </Col>
                                    <Col xs={12} md={8}>
                                        <CardContainer
                                            title="Last Reading"
                                            value={
                                                waterLevelStats.lastReadingValue ||
                                                "N/A"
                                            }
                                            color={
                                                waterLevelStats.currentStatusColor
                                            }
                                            subText={`As of ${
                                                waterLevelStats.lastReadingTime ||
                                                "N/A"
                                            }`}
                                        />
                                    </Col>
                                    <Col xs={12} md={8}>
                                        <CardContainer
                                            title="Peak Level"
                                            value={
                                                waterLevelStats.peakReading ||
                                                "N/A"
                                            }
                                            prefix={<RiseOutlined />}
                                            color={waterLevelStats.peakColor}
                                            subText="Highest today"
                                        />
                                    </Col>
                                    <Col xs={12} md={8}>
                                        <CardContainer
                                            title="Lowest Level"
                                            value={
                                                waterLevelStats.lowestReading ||
                                                "N/A"
                                            }
                                            prefix={<FallOutlined />}
                                            color={waterLevelStats.lowestColor}
                                            subText="Lowest today"
                                        />
                                    </Col>

                                    <Col xs={12} md={8}>
                                        <CardContainer
                                            title="Average Today"
                                            value={
                                                waterLevelStats.averageReading ||
                                                "N/A"
                                            }
                                            color={waterLevelStats.avgColor}
                                            subText={`From ${
                                                waterLevelStats.totalReadings ||
                                                0
                                            } readings`}
                                        />
                                    </Col>
                                    <Col xs={12} md={8}>
                                        <CardContainer
                                            title="Total Readings"
                                            value={
                                                waterLevelStats.totalReadings ||
                                                "N/A"
                                            }
                                            color="#5e5e5e"
                                            subText="Since midnight"
                                        />
                                    </Col>
                                </Row>
                            </>
                        )}
                    </>
                )}

                {/* THRESHOLD CONFIGURATION */}
                {roleConfig.showThresholds && (
                    <>
                        <Card
                            style={{
                                ...cardStyle,
                                background: THEME.BLUE_PRIMARY,
                                border: "none",
                            }}>
                            <Row justify="space-between" align="middle">
                                <Col>
                                    <Title
                                        level={isMobile ? 4 : 2}
                                        style={{ color: "#fff", margin: 0 }}>
                                        Threshold Settings
                                    </Title>
                                    <Text
                                        style={{
                                            color: "rgba(255,255,255,0.85)",
                                        }}>
                                        Configure threshold settings.
                                    </Text>
                                </Col>
                            </Row>
                        </Card>
                        <ThresholdCards
                            thresholds={thresholds}
                            isUserAdmin={roleConfig.canEditThresholds}
                            onEdit={handleEditThreshold}
                        />
                    </>
                )}
            </Space>

            <ThresholdSettingsModal
                isOpen={isModalOpen}
                record={editingRecord}
                onClose={handleCloseModal}
                onSave={handleSaveThreshold}
                isSaving={isSaving}
                isMobile={isMobile}
            />

            {roleConfig.canEditDefaultPassword && (
                <DefaultPasswordModal
                    isOpen={isPasswordModalOpen}
                    onClose={handleClosePasswordModal}
                    isMobile={isMobile}
                />
            )}
        </ConfigProvider>
    );
};

export default DashboardPage;
