import { RichText } from "./rich-text";

/** Shared question presentation for active tests and their completed reviews. */
export function TestQuestionPrompt({ prompt, kind }: { prompt: string; kind: string }) {
  const text = kind === "fill_blank" ? prompt.replace("____", "______") : prompt;
  return <div className="testQuestionPrompt"><RichText text={text} /></div>;
}
