// notifications.jsx

import { notification } from "antd";

// Global configuration for notifications
notification.config({
    placement: "topRight",
    duration: 3,
    maxCount: 3,
    // Ensures notifications appear on top of modals/drawers
    getContainer: () => document.body,
});

// Helper to keep code DRY since zIndex and basic structure are repeated
const openNotification = (type, content, duration, description = "") => {
    notification[type]({
        message: content,
        description: description,
        duration: duration,
        style: { zIndex: 9999 },
    });
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

// Note: Notifications don't have a built-in 'loading' spinner icon like message does.
// We use the 'info' type with a loading-style message.
export const showLoading = (content = "Loading...", duration = 0) => {
    const key = `loading-${Date.now()}`;
    notification.info({
        key,
        message: content,
        duration,
        style: { zIndex: 9999 },
        // You can add an icon property here if you want a custom spinner
    });
    return key; // Return key so it can be manually closed via notification.destroy(key)
};

export const showSuccessNotification = ({
    message: msg,
    description,
    duration = 4.5,
}) => {
    openNotification("success", msg, duration, description);
};

export const showErrorNotification = ({
    message: msg,
    description,
    duration = 0, // Errors often stay until closed
}) => {
    openNotification("error", msg, duration, description);
};

export const showWarningNotification = ({
    message: msg,
    description,
    duration = 4.5,
}) => {
    openNotification("warning", msg, duration, description);
};

export const showInfoNotification = ({
    message: msg,
    description,
    duration = 4.5,
}) => {
    openNotification("info", msg, duration, description);
};

export const showValidationErrors = (errors) => {
    const errorList = Array.isArray(errors) ? errors : [errors];

    notification.error({
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
