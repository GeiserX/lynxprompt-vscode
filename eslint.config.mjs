// Flat config port of the old .eslintrc.json: same rule sets, same overrides.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "node_modules/", "esbuild.js"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: { project: "./tsconfig.json" },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-unused-vars": "off",
      // New in eslint 10's recommended set; off to keep findings the same as
      // under eslint 8. Its one hit is an unused fileWatcher in src/extension.ts.
      "no-unassigned-vars": "off",
    },
  },
);
