import { Toaster } from "sonner";
import { AppRoutes } from "@/app/app-routes";
import { AuthProvider } from "@/features/auth/auth-context";

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <Toaster />
    </AuthProvider>
  );
}

export default App;
