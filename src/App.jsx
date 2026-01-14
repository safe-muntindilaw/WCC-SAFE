// import { BrowserRouter } from "react-router-dom";
import { MemoryRouter } from "react-router-dom";
import AppRoutes from "./routes/AppRoutes";
import AuthProvider from "@/context/AuthContext";

const App = () => (
    <AuthProvider>
        <MemoryRouter>
            <AppRoutes />
        </MemoryRouter>
    </AuthProvider>
);

export default App;
