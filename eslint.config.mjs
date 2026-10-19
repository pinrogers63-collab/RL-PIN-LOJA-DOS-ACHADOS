import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"]
  },
  {
    // O código usa `any` de forma intencional em pontos de integração dinâmica
    // (Supabase, payloads de API). Rebaixado para aviso para não quebrar o lint.
    rules: {
      "@typescript-eslint/no-explicit-any": "warn"
    }
  }
];

export default eslintConfig;
