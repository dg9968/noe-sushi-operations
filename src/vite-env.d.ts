/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_ODOO_URL?: string;
  readonly VITE_MODE?: string;
  readonly VITE_ENABLE_ODOO?: string;
  readonly VITE_ENABLE_DEMO?: string;
  readonly VITE_ENABLE_LOGGING?: string;
  readonly VITE_AIRTABLE_API_KEY?: string;
  readonly VITE_AIRTABLE_BASE_ID?: string;
  readonly VITE_ENABLE_AIRTABLE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
