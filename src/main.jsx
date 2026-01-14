// Main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <ConfigProvider
            theme={{
                token: {
                    colorPrimary: "#0056a0",
                    colorPrimaryHover: "#004080",
                    colorLink: "#0056a0",
                    colorLinkHover: "#004080",

                    colorText: "#0A3D62",
                },
            }}>
            <App />
        </ConfigProvider>
    </React.StrictMode>
);
