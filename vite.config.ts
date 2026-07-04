import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { editorContentSavePlugin } from "./editor-persistence/editorContentSave";

export default defineConfig({
  plugins: [react(), editorContentSavePlugin()],
});
