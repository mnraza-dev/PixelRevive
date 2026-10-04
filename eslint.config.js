// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    files: ["backend/**/*.js"],
    ignores: ["backend/.venv/**", "backend/data/**", "backend/models/**"],
    languageOptions: {
      globals: { Bun: "readonly", Buffer: "readonly" },
    },
    // Backend environment variables are read at runtime, not inlined by Expo.
    rules: { "expo/no-dynamic-env-var": "off" },
  }
]);
