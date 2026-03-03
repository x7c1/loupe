import * as vscode from "vscode";
import { FileTreeViewProvider } from "./webview/viewProvider";

interface DemoStep {
  action: "command" | "type" | "key" | "wait";
  command?: string;
  text?: string;
  charDelay?: number;
  key?: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  ms?: number;
}

export function parseDemoScript(text: string): DemoStep[] {
  return JSON.parse(stripJsonComments(text));
}

function stripJsonComments(text: string): string {
  let result = "";
  let i = 0;
  let inString = false;
  while (i < text.length) {
    if (inString) {
      if (text[i] === "\\") {
        result += text[i] + (text[i + 1] ?? "");
        i += 2;
      } else if (text[i] === '"') {
        result += '"';
        inString = false;
        i++;
      } else {
        result += text[i];
        i++;
      }
    } else {
      if (text[i] === '"') {
        result += '"';
        inString = true;
        i++;
      } else if (text[i] === "/" && text[i + 1] === "/") {
        while (i < text.length && text[i] !== "\n") i++;
      } else if (text[i] === "/" && text[i + 1] === "*") {
        i += 2;
        while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
        i += 2;
      } else {
        result += text[i];
        i++;
      }
    }
  }
  return result;
}

export async function runDemo(
  provider: FileTreeViewProvider,
  steps: DemoStep[]
): Promise<void> {
  for (const step of steps) {
    switch (step.action) {
      case "command":
        if (step.command) {
          await vscode.commands.executeCommand(step.command);
        }
        break;
      case "wait":
        await delay(step.ms ?? 300);
        break;
      case "type":
        for (const char of step.text ?? "") {
          provider.sendDemoMessage({ type: "demo:type", char });
          await delay(step.charDelay ?? 80);
        }
        break;
      case "key":
        if (step.key) {
          provider.sendDemoMessage({
            type: "demo:key",
            key: step.key,
            ctrlKey: step.ctrlKey ?? false,
            shiftKey: step.shiftKey ?? false,
          });
        }
        break;
    }
  }
  vscode.window.showInformationMessage("Loupe: Demo finished.");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
