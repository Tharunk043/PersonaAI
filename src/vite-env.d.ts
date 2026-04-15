/// <reference types="vite/client" />
declare module '*.svg' {
  const content: any;
  export default content;
}

interface ImportMetaEnv {
  readonly VITE_GROQ_API_KEY: string;
  readonly VITE_DEEPGRAM_API_KEY: string;
  readonly VITE_APIFY_API_TOKEN: string;
  readonly VITE_SCRAPING_BEE_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
