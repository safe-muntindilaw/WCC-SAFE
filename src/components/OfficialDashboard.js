// ============================================
// OfficialDashboard.jsx
// ============================================
import { Row, Col, Card, Typography, Divider, Statistic } from "antd";
import {
    TeamOutlined,
    AlertOutlined,
    RiseOutlined,
    ReloadOutlined,
} from "@ant-design/icons";

const { Text, Title } = Typography;

export const OfficialDashboard = ({
    roleCount,
    currentStatus,
    currentStatusColor,
    lastReadingValue,
    lastReadingTime,
    averageReading,
    peakReading,
    getStatusDescription,
    cardStyle,
    BARANGAY_THEME,
    loadingText,
    noReadingsText,
    UNIT,
}) => {
    const officialAndResidentCount = roleCount
        ? roleCount.Official + roleCount.Resident
        : null;

    const currentDescription = currentStatus
        ? getStatusDescription(currentStatus)
        : noReadingsText;

    return (
        <>
            <Row gutter={[24, 24]}>
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
                            <TeamOutlined style={{ marginRight: 15 }} />
                            {officialAndResidentCount ?? loadingText}
                        </Text>
                        <Text
                            type="secondary"
                            style={{
                                display: "block",
                                marginTop: 8,
                            }}
                        >
                            Includes all verified officials and residents in the
                            system.
                        </Text>
                    </Card>
                </Col>

                <Col xs={24} md={12}>
                    <Card
                        title="Current Water Level Status (Kasalukuyang Antas ng Tubig)"
                        style={{
                            ...cardStyle,
                            height: "100%",
                            minHeight: 180,
                            borderTop: `4px solid ${currentStatusColor}`,
                        }}
                        bodyStyle={{ padding: "24px" }}
                        hoverable
                    >
                        <Text
                            strong
                            style={{
                                color: currentStatusColor,
                                fontSize: "36px",
                                display: "flex",
                                alignItems: "center",
                                marginBottom: 8,
                            }}
                        >
                            <AlertOutlined style={{ marginRight: 15 }} />
                            {currentStatus ?? noReadingsText}
                        </Text>
                        <Text
                            type="secondary"
                            style={{
                                display: "block",
                                fontSize: "14px",
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
                            Huling Pagbasa: **{lastReadingValue ?? "N/A"}** @{" "}
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
                            title="Average Level Today (Karaniwang Antas Ngayon)"
                            value={
                                averageReading
                                    ? `${averageReading}${UNIT}`
                                    : noReadingsText
                            }
                            prefix={<RiseOutlined />}
                            valueStyle={{
                                color: BARANGAY_THEME.BLUE_AUTHORITY,
                                fontWeight: "bold",
                            }}
                        />
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                    <Card
                        style={{
                            ...cardStyle,
                            borderTop: `4px solid ${
                                currentStatus === "L3" || currentStatus === "L2"
                                    ? currentStatusColor
                                    : BARANGAY_THEME.BLUE_AUTHORITY
                            }`,
                            height: "100%",
                            minHeight: 130,
                        }}
                        bodyStyle={{ padding: "24px" }}
                        hoverable
                    >
                        <Statistic
                            title={`Peak Level Today (Pinakamataas na Antas - Lowest Reading in ${UNIT})`}
                            value={
                                peakReading
                                    ? `${peakReading}${UNIT}`
                                    : noReadingsText
                            }
                            prefix={<RiseOutlined />}
                            valueStyle={{
                                color:
                                    currentStatus === "L3" ||
                                    currentStatus === "L2"
                                        ? currentStatusColor
                                        : BARANGAY_THEME.BLUE_AUTHORITY,
                                fontWeight: "bold",
                            }}
                        />
                        <Text
                            type="secondary"
                            style={{ display: "block", marginTop: 8 }}
                        >
                            Lowest distance from sensor = Highest water level
                            (measured in {UNIT}).
                        </Text>
                    </Card>
                </Col>
                <Col xs={24} md={8}>
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
                            title="Last Sensor Reading Time (Oras ng Huling Pagbasa)"
                            value={lastReadingTime ?? "N/A"}
                            prefix={<ReloadOutlined />}
                            valueStyle={{
                                color: BARANGAY_THEME.BLUE_AUTHORITY,
                                fontWeight: "bold",
                            }}
                        />
                        {lastReadingValue && (
                            <Text
                                type="secondary"
                                style={{ display: "block", marginTop: 8 }}
                            >
                                Value: {lastReadingValue}
                            </Text>
                        )}
                    </Card>
                </Col>
            </Row>
        </>
    );
};
