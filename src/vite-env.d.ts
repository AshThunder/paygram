/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAGIC_API_KEY: string;
  readonly VITE_PROJECT_ID: string;
  readonly VITE_CLIENT_KEY: string;
  readonly VITE_APP_ID: string;
  readonly VITE_ARB_RPC_URL: string;
  readonly VITE_BOT_USERNAME: string;
  readonly VITE_MINI_APP_URL: string;
  readonly VITE_DEMO_RECIPIENT_ADDRESS: string;
  readonly VITE_API_URL: string;
  /** Optional fiat on-ramp URL; use `{address}` placeholder for the deposit wallet. */
  readonly VITE_ONRAMP_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
