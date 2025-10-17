import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "dist/**",
      "coverage/**",
      "public/**",
      "*.config.{js,ts}",
      "*.config.{cjs,mjs}",
      "*.d.ts",
      "*.json",
      "*.md",
      "*.yml",
      "*.yaml",
      ".env",
      ".env.*",
      "package-lock.json",
      "scripts/**/*.sh",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
      globals: {
        URL: "readonly",
        Request: "readonly",
        Response: "readonly",
        console: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly",
        AbortController: "readonly",
        Headers: "readonly",
        fetch: "readonly",
        window: "readonly",
        document: "readonly",
        HTMLFormElement: "readonly",
        URLSearchParams: "readonly",
        RequestInit: "readonly",
        File: "readonly",
        FileList: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];
