import { defineConfig, globalIgnores } from "eslint/config";
import eslint from "@eslint/js";
import next from "@next/eslint-plugin-next";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  globalIgnores([
    ".next/**",
    "dist/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  reactHooks.configs.flat["recommended-latest"],
  jsxA11y.flatConfigs.recommended,
  next.configs["core-web-vitals"],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.serviceworker,
      },
    },
    rules: {
      // CouponShare intentionally synchronizes URL/auth/image-processing state from effects.
      // Keep the correctness-oriented hooks rules while disabling this optimization-only recommendation.
      "react-hooks/set-state-in-effect": "off",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    files: ["app/login/page.tsx"],
    rules: {
      // Login controls are nested in their labels; translated runtime text prevents this static rule from recognizing the association.
      "jsx-a11y/label-has-associated-control": "off",
    },
  },
  {
    files: ["app/dunnes/page.tsx"],
    rules: {
      // The reservation backdrop has a mouse-only convenience close; the dialog always exposes keyboard-accessible Cancel/Close buttons.
      "jsx-a11y/no-noninteractive-element-interactions": "off",
    },
  },
]);

export default eslintConfig;
