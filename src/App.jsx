import { MemoryRouter } from "react-router-dom";
import { App as AntdApp } from "antd"; // Alias it to avoid conflict with your component name
import AppRoutes from "./routes/AppRoutes";
import AuthProvider from "@/context/AuthContext";
import { NotificationSetter } from "@/utils/notifications";

const App = () => (
    <AntdApp>
        <NotificationSetter />
        <AuthProvider>
            <MemoryRouter>
                <AppRoutes />
            </MemoryRouter>
        </AuthProvider>
    </AntdApp>
);

export default App;
