import { Toaster } from "sonner";
import { AppRoutes } from "@/app/app-routes";
import { AuthProvider } from "@/features/auth/auth-context";

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <Toaster position="top-center" richColors={true} />
    </AuthProvider>
  );
}

export default App;
