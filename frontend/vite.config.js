import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
var rootDir = fileURLToPath(new URL(".", import.meta.url));
export default defineConfig(function (_a) {
    var command = _a.command, mode = _a.mode;
    // Load environment variables from .env files
    var env = loadEnv(mode, rootDir);
    var backendUrl = env.VITE_BACKEND_URL || "http://localhost:5000";
    return {
        plugins: [react()],
        resolve: {
            alias: {
                "@": path.resolve(rootDir, "./src"),
            },
        },
        server: {
            proxy: {
                "/api": {
                    target: backendUrl,
                    changeOrigin: true,
                },
            },
        },
        test: {
            environment: "jsdom",
            setupFiles: ["./src/test/setup.ts"],
            clearMocks: true,
        },
    };
});
