import vinext from "vinext";
import { defineConfig } from "vite";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const vinextShimChunkWorkaround = {
  name: "vinext-shims-single-chunk",
  configEnvironment(name: string) {
    if (name !== "client") return;
    return {
      build: {
        rolldownOptions: {
          output: {
            codeSplitting: {
              groups: [
                {
                  name: "vinext-shims",
                  test: /[\\/]node_modules[\\/]vinext[\\/]dist[\\/]shims[\\/]/,
                },
              ],
            },
          },
        },
      },
    };
  },
};

export default defineConfig(() => ({
  server: isCodexSeatbeltSandbox
    ? { watch: { useFsEvents: false, usePolling: true } }
    : undefined,
  plugins: [vinextShimChunkWorkaround, vinext()],
}));
