import { useState, useEffect } from "react";
import { Card, Table, InputNumber, Button, Typography, message } from "antd";
import { supabase } from "@/globals";
import { EditOutlined } from "@ant-design/icons";

const { Title } = Typography;

const ThresholdTable = ({ thresholds, refreshThresholds }) => {
    const [tableData, setTableData] = useState([]);
    const [updatingId, setUpdatingId] = useState(null);

    // Sync local state when external thresholds change
    useEffect(() => {
        setTableData(thresholds.map((t) => ({ ...t })));
    }, [thresholds]);

    const handleChange = (id, field, value) => {
        const numValue = +value;
        setTableData((prev) =>
            prev.map((row) =>
                row.id === id ? { ...row, [field]: numValue } : row
            )
        );
    };

    const handleUpdate = async (row) => {
        if (isNaN(row.min_level) || isNaN(row.max_level)) {
            message.error("Min/Max level must be a valid number.");
            return;
        }

        setUpdatingId(row.id);
        const { error } = await supabase
            .from("water_thresholds")
            .update({
                min_level: row.min_level,
                max_level: row.max_level,
            })
            .eq("id", row.id)
            .select();

        if (error)
            message.error("Failed to update threshold: " + error.message);
        else {
            message.success(`Updated threshold for ${row.name}`);
            refreshThresholds();
        }

        setUpdatingId(null);
    };

    // Table columns
    const columns = [
        {
            title: "Level",
            dataIndex: "name",
            key: "name",
        },
        {
            title: "Min Level",
            dataIndex: "min_level",
            key: "min_level",
            render: (value, record) => (
                <InputNumber
                    step={0.01}
                    value={value ?? ""}
                    onChange={(val) =>
                        handleChange(record.id, "min_level", val)
                    }
                    style={{ width: "100%" }}
                />
            ),
        },
        {
            title: "Max Level",
            dataIndex: "max_level",
            key: "max_level",
            render: (value, record) => (
                <InputNumber
                    step={0.01}
                    value={value ?? ""}
                    onChange={(val) =>
                        handleChange(record.id, "max_level", val)
                    }
                    style={{ width: "100%" }}
                />
            ),
        },
        {
            title: "Action",
            key: "action",
            render: (_, record) => {
                const isMobile = window.innerWidth <= 768;
                return (
                    <Button
                        type="primary"
                        icon={<EditOutlined />}
                        loading={updatingId === record.id}
                        onClick={() => handleUpdate(record)}
                        style={{
                            borderRadius: 6,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        {!isMobile &&
                            (updatingId === record.id
                                ? "Update"
                                : "Update")}
                    </Button>
                );
            },
        },
    ];

    return (
        <Card
            title={
                <Title level={4} style={{ marginBottom: 0 }}>
                    Manage Water Level Thresholds
                </Title>
            }
            style={{
                borderRadius: 8,
                boxShadow:
                    "0 6px 12px rgba(0, 0, 0, 0.1), 0 0 0 1px var(--color-border)",
                marginTop: 20,
            }}
        >
            <Table
                dataSource={tableData}
                columns={columns}
                rowKey="id"
                pagination={false}
                style={{
                    borderRadius: 12,
                }}
            />
        </Card>
    );
};

export default ThresholdTable;
