// eslint.config.mjs
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript", "prettier"),

  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },

  {
    files: ["scripts/**/*.{js,ts,mjs,cjs}", "**/*.mjs", "**/*.cjs"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-var-requires": "off",
    },
  },
];

export default config;
