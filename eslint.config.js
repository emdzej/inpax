import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["**/dist/**", "**/dist-embedded/**", "**/node_modules/**", "**/*.test.ts"]
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error"
    }
  }
];
