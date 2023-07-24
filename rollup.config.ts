import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { defineConfig } from "rollup";
import copy from "rollup-plugin-copy";

export default defineConfig({
  input: "src/index.ts",
  output: {
    dir: "dist",
    format: "commonjs"
  },
  plugins: [
    nodeResolve({
      // 仅作为模块导入
      modulesOnly: true,
      preferBuiltins: false
    }),
    typescript(),
    copy({
      targets: [
        {
          src: "src/*.tsx",
          dest: "dist"
        }
      ]
    })
  ]
});
