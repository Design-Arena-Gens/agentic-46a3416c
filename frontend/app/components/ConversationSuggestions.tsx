'use client';

interface ConversationSuggestionsProps {
  prompts: string[];
  onSelect: (prompt: string) => void;
}

export function ConversationSuggestions({ prompts, onSelect }: ConversationSuggestionsProps) {
  if (prompts.length === 0) return null;

  return (
    <div className="suggestions">
      {prompts.map((prompt) => (
        <button key={prompt} type="button" onClick={() => onSelect(prompt)}>
          {prompt}
        </button>
      ))}
    </div>
  );
}
