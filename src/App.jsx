import { MemoryRouter } from "react-router-dom";
import { App as AntdApp } from "antd";
import AppRoutes from "./routes/AppRoutes";
import AuthProvider from "@/context/AuthContext";
import { NotificationSetter } from "@/utils/notifications";
import WaterAlertNotifier from "@/components/WaterAlertNotifier";

const App = () => (
    <AntdApp>
        <NotificationSetter />
        <WaterAlertNotifier />
        <AuthProvider>
            <MemoryRouter>
                <AppRoutes />
            </MemoryRouter>
        </AuthProvider>
    </AntdApp>
);

export default App;
