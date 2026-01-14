// FloatLabel.jsx
import React from "react";
import "../styles/FloatLabel.css";

export const FloatLabel = ({ label, value, children, hasPrefix, status }) => {
    const [focus, setFocus] = React.useState(false);

    // Check if label is floating
    const isFloating = focus || (value && value.length !== 0);

    // Add "has-prefix" class if an icon is present
    const containerClass = `float-label ${isFloating ? "is-floating" : ""} ${
        hasPrefix ? "has-prefix" : ""
    } ${status ? `status-${status}` : ""} ${focus ? "is-focused" : ""}`;
    const labelClass = isFloating ? "label label-float" : "label";

    return (
        <div
            className={containerClass}
            onBlur={() => setFocus(false)}
            onFocus={() => setFocus(true)}>
            {children}
            <label className={labelClass}>{label}</label>
        </div>
    );
};
