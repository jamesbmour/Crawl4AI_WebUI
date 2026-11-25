import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { tokyoNight } from "@uiw/codemirror-theme-tokyo-night";

const extensions = { javascript: [javascript()], json: [json()] };

interface Props {
  language: keyof typeof extensions;
  value: string;
  onChange: (value: string) => void;
  height?: string;
  placeholder?: string;
  lineNumbers?: boolean;
  foldGutter?: boolean;
}

export default function CodeEditor({ language, lineNumbers = true, foldGutter = false, ...props }: Props) {
  return (
    <CodeMirror
      {...props}
      theme={tokyoNight}
      extensions={extensions[language]}
      basicSetup={{ lineNumbers, foldGutter }}
    />
  );
}
