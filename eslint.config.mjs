import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Legacy Konva prototype kept in the repo, but not used by the active tldraw board.
    "src/components/Board.tsx",
    "src/components/MenuPanel.tsx",
    "src/components/ShapesPanel.tsx",
    "src/components/Toolbar.tsx",
    "src/store/useBoardStore.ts",
  ]),
]);

export default eslintConfig;
