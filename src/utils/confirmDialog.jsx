import { App, Typography } from "antd";
import { ExclamationCircleFilled, InfoCircleFilled } from "@ant-design/icons";
import { useResponsive } from "@/utils/useResponsive";
const { Text } = Typography;

export const useConfirmDialog = () => {
    const { isMobile } = useResponsive();
    const { modal } = App.useApp();

    const confirm = ({
        title,
        content,
        onOk,
        onCancel,
        okText = "Confirm",
        cancelText = "Cancel",
        danger = false,
    }) => {
        modal.confirm({
            icon: null,
            title: null,
            width: 480,
            centered: true,
            styles: {
                body: { padding: 0 },
            },
            className: "custom-full-width-modal",
            content: (
                <div style={{ margin: "-24px -24px 0 -24px" }}>
                    <style>
                        {`
                            .custom-full-width-modal .ant-modal-confirm-paragraph {
                                max-width: 100% !important;
                                width: 100% !important;
                                margin: 0 !important;
                            }
                        `}
                    </style>

                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            padding: "0 24px",
                            height: "72px",
                            background: danger ? "#FFF1F0" : "#F0F7FF",
                            borderBottom: `1px solid ${
                                danger ? "#FFCCC7" : "#BAE7FF"
                            }`,
                        }}>
                        <div
                            style={{
                                display: "flex",
                                gap: 8,
                                marginTop: 8,
                            }}>
                            {danger ?
                                <ExclamationCircleFilled
                                    style={{ color: "#ff4d4f", fontSize: 22 }}
                                />
                            :   <InfoCircleFilled
                                    style={{ color: "#1890ff", fontSize: 22 }}
                                />
                            }
                            <Text
                                strong
                                style={{
                                    fontSize: 17,
                                    color: "#262626",
                                }}>
                                {title}
                            </Text>
                        </div>
                    </div>

                    <div style={{ padding: "24px 24px 10px 24px" }}>
                        <Text
                            style={{
                                fontSize: 15,
                                color: "#595959",
                                lineHeight: 1.6,
                            }}>
                            {content}
                        </Text>
                    </div>
                </div>
            ),
            okText,
            cancelText,
            okButtonProps: {
                danger,
                type: "primary",
                style: {
                    height: isMobile ? 32 : 40,
                    borderRadius: 8,
                    paddingInline: 24,
                    fontWeight: 600,
                },
            },
            cancelButtonProps: {
                danger: true,
                style: {
                    height: isMobile ? 32 : 40,
                    borderRadius: 8,
                    paddingInline: 20,
                },
            },
            onOk,
            onCancel,
            modalRender: (node) => (
                <div
                    style={{
                        borderRadius: 16,
                        overflow: "hidden",
                        backgroundColor: "#fff",
                    }}>
                    {node}
                </div>
            ),
        });
    };

    return { confirm };
};
