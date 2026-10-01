import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const turkishCase = {
  selector: "CallExpression[callee.property.name=/^to(Lower|Upper)Case$/]",
  message: "Türkçe büyük/küçük harf: toLocaleLowerCase('tr-TR') ya da lib/text/tr.ts kullan (I/ı, İ/i).",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-syntax": ["error", turkishCase],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/lib/db/client"], message: "Veritabanına yalnızca withUser() (RLS) üzerinden eriş." },
            { group: ["@/lib/db/admin"], message: "Admin (RLS'siz) bağlantı yalnızca cron ve testlerde." },
          ],
        },
      ],
    },
  },
  {
    // The only places allowed to touch the raw connections.
    files: ["src/lib/db/**", "src/app/api/cron/**", "src/instrumentation.ts", "tests/**", "scripts/**"],
    rules: { "no-restricted-imports": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "coverage/**"]),
]);

export default eslintConfig;
