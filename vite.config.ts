import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import vinext from "vinext";
import { defineConfig } from "vite";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

type HostingConfig = {
  d1?: string | null;
  r2?: string | null;
};

async function loadHostingConfig(): Promise<Required<HostingConfig>> {
  try {
    const source = await readFile(
      resolve(process.cwd(), ".openai", "hosting.json"),
      "utf8",
    );
    const config = JSON.parse(source) as HostingConfig;

    return {
      d1: config.d1 ?? null,
      r2: config.r2 ?? null,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { d1: null, r2: null };
    }
    throw error;
  }
}

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  const { d1, r2 } = await loadHostingConfig();
  const externalD1DatabaseId = process.env.D1_DATABASE_ID?.trim();
  const externalD1DatabaseName =
    process.env.D1_DATABASE_NAME?.trim() || "pulsetube-radar-history";
  const localBindingConfig = {
    main: "./worker/index.ts",
    compatibility_flags: ["nodejs_compat"],
    // The Cloudflare dashboard owns production values. Preserve them when the
    // generated Wrangler config is deployed from the connected repository.
    keep_vars: true,
    secrets: {
      required: ["YT_API_KEY"],
    },
    d1_databases: externalD1DatabaseId
      ? [
          {
            binding: "DB",
            database_name: externalD1DatabaseName,
            database_id: externalD1DatabaseId,
          },
        ]
      : d1
      ? [
          {
            binding: d1,
            database_name: "site-creator-d1",
            database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
          },
        ]
      : [],
    r2_buckets: r2
      ? [
          {
            binding: r2,
            bucket_name: "site-creator-r2",
          },
        ]
      : [],
    triggers: {
      crons: ["*/15 * * * *"],
    },
  };

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
    ],
  };
});
