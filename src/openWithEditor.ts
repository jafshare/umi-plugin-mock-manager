import { exec } from "node:child_process";
/**
 * 用指定编辑器打开对应的文件
 * @param source
 */
export function openWithEditor(source: {
  filename: string;
  lineNumber?: number;
  columnNumber?: number;
  editor?: "vscode";
}) {
  const {
    filename,
    lineNumber = 1,
    columnNumber = 1,
    editor = "vscode"
  } = source;
  const editorCMDMap = {
    vscode: "code"
  };
  let cmd = "";
  if (editor === "vscode") {
    cmd = `${editorCMDMap[editor]} -g ${filename}:${lineNumber}:${columnNumber}`;
  }
  exec(cmd);
}
