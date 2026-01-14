import { App } from "antd";
import React from "react";

let notificationInstance = null;

export const NotificationSetter = () => {
    const { notification } = App.useApp();
    notificationInstance = notification;
    return null;
};

const openNotification = (type, content, duration, description = "") => {
    if (notificationInstance) {
        notificationInstance[type]({
            message: content,
            description: description,
            duration: duration,
            style: { zIndex: 9999 },
        });
    }
};

export const showSuccess = (content, duration = 3) => {
    openNotification("success", content, duration);
};

export const showError = (content, duration = 5) => {
    openNotification("error", content, duration);
};

export const showWarning = (content, duration = 3) => {
    openNotification("warning", content, duration);
};

export const showInfo = (content, duration = 3) => {
    openNotification("info", content, duration);
};

export const showLoading = (content = "Loading...", duration = 0) => {
    const key = `loading-${Date.now()}`;
    if (notificationInstance) {
        notificationInstance.info({
            key,
            message: content,
            duration,
            style: { zIndex: 9999 },
        });
    }
    return key;
};

export const showSuccessNotification = ({
    message,
    description,
    duration = 4.5,
}) => {
    openNotification("success", message, duration, description);
};

export const showErrorNotification = ({
    message,
    description,
    duration = 0,
}) => {
    openNotification("error", message, duration, description);
};

export const showWarningNotification = ({
    message,
    description,
    duration = 4.5,
}) => {
    openNotification("warning", message, duration, description);
};

export const showInfoNotification = ({
    message,
    description,
    duration = 4.5,
}) => {
    openNotification("info", message, duration, description);
};

export const showValidationErrors = (errors) => {
    const errorList = Array.isArray(errors) ? errors : [errors];
    if (notificationInstance) {
        notificationInstance.error({
            message: "Validation Error",
            description: (
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {errorList.map((error, index) => (
                        <li key={index}>{error}</li>
                    ))}
                </ul>
            ),
            duration: 0,
            style: { zIndex: 9999 },
        });
    }
};

export const showBatchOperationResult = ({
    success,
    failed,
    operation = "Operation",
}) => {
    const total = success + failed;
    if (failed === 0) {
        showSuccessNotification({
            message: `${operation} Successful`,
            description: `Successfully processed ${success} item${
                success !== 1 ? "s" : ""
            }.`,
        });
    } else if (success === 0) {
        showErrorNotification({
            message: `${operation} Failed`,
            description: `Failed to process ${failed} item${
                failed !== 1 ? "s" : ""
            }.`,
        });
    } else {
        showWarningNotification({
            message: `${operation} Partially Completed`,
            description: `Success: ${success}, Failed: ${failed} out of ${total} items.`,
        });
    }
};
