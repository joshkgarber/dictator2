import { AppRoutes } from "@/app/app-routes";
import { AuthProvider } from "@/features/auth/auth-context";

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
