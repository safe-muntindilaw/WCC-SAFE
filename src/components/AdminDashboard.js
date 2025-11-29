// ============================================
// AdminDashboard.jsx
// ============================================
import { Row, Col, Card, Statistic } from "antd";
import {
    TeamOutlined,
    SettingOutlined,
    BankOutlined,
    HomeOutlined,
} from "@ant-design/icons";

export const AdminDashboard = ({
    roleCount,
    cardStyle,
    BARANGAY_THEME,
    loadingText,
}) => {
    const totalUsers = roleCount
        ? roleCount.Admin + roleCount.Official + roleCount.Resident
        : null;

    return (
        <Row gutter={[24, 24]}>
            <Col xs={24} sm={12} md={6}>
                <Card
                    style={{
                        ...cardStyle,
                        borderTop: `4px solid ${BARANGAY_THEME.BLUE_AUTHORITY}`,
                        height: "100%",
                        minHeight: 130,
                    }}
                    bodyStyle={{ padding: "24px" }}
                    hoverable
                >
                    <Statistic
                        title="Total Users in System (Kabuuang Gumagamit)"
                        value={totalUsers ?? loadingText}
                        prefix={<TeamOutlined />}
                        valueStyle={{
                            color: BARANGAY_THEME.BLUE_AUTHORITY,
                            fontWeight: "bold",
                        }}
                    />
                </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
                <Card
                    style={{
                        ...cardStyle,
                        borderTop: `4px solid ${BARANGAY_THEME.BLUE_AUTHORITY}`,
                        height: "100%",
                        minHeight: 130,
                    }}
                    bodyStyle={{ padding: "24px" }}
                    hoverable
                >
                    <Statistic
                        title="Admins (Mga Admin)"
                        value={roleCount?.Admin ?? loadingText}
                        prefix={<SettingOutlined />}
                        valueStyle={{
                            color: BARANGAY_THEME.BLUE_AUTHORITY,
                            fontWeight: "bold",
                        }}
                    />
                </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
                <Card
                    style={{
                        ...cardStyle,
                        borderTop: `4px solid ${BARANGAY_THEME.BLUE_AUTHORITY}`,
                        height: "100%",
                        minHeight: 130,
                    }}
                    bodyStyle={{ padding: "24px" }}
                    hoverable
                >
                    <Statistic
                        title="Officials (Mga Opisyal)"
                        value={roleCount?.Official ?? loadingText}
                        prefix={<BankOutlined />}
                        valueStyle={{
                            color: BARANGAY_THEME.BLUE_AUTHORITY,
                            fontWeight: "bold",
                        }}
                    />
                </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
                <Card
                    style={{
                        ...cardStyle,
                        borderTop: `4px solid ${BARANGAY_THEME.BLUE_AUTHORITY}`,
                        height: "100%",
                        minHeight: 130,
                    }}
                    bodyStyle={{ padding: "24px" }}
                    hoverable
                >
                    <Statistic
                        title="Residents (Mga Residente)"
                        value={roleCount?.Resident ?? loadingText}
                        prefix={<HomeOutlined />}
                        valueStyle={{
                            color: BARANGAY_THEME.BLUE_AUTHORITY,
                            fontWeight: "bold",
                        }}
                    />
                </Card>
            </Col>
        </Row>
    );
};
