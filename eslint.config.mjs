import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // NEXT_PUBLIC_* values are inlined into the browser bundle; this app exposes none.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.type='MemberExpression'][object.object.name='process'][object.property.name='env'][property.name=/^NEXT_PUBLIC_/]",
          message: "NEXT_PUBLIC_ env vars reach the browser bundle. Keep configuration server-only.",
        },
        {
          selector:
            "MemberExpression[object.type='MemberExpression'][object.object.name='process'][object.property.name='env'][property.value=/^NEXT_PUBLIC_/]",
          message: "NEXT_PUBLIC_ env vars reach the browser bundle. Keep configuration server-only.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    ".vercel/**",
    ".claude/**",
    ".agentkit/**",
    "plans/**",
    "public/maplibre/**",
  ]),
]);

export default eslintConfig;
