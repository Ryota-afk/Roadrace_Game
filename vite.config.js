import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// src/ をソースルートに、自己完結の単一 index.html を dist/ へ出力する。
// build スクリプトが dist/index.html をリポジトリ直下へコピー（＝デプロイ用の真の成果物）。
export default defineConfig({
  root: "src",
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    // 単一ファイル化：チャンク分割を抑止し全アセットをインライン
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  },
});
