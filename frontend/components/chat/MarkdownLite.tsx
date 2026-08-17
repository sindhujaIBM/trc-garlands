// Pooja's replies naturally use **bold** and "- " bullets (normal LLM habit).
// Not pulling in a full markdown library for two patterns — just parses
// what she actually produces, safely (no dangerouslySetInnerHTML).
function renderInline(text: string, keyPrefix: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{part}</span>
    )
  );
}

export function MarkdownLite({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];

  function flushList(key: string) {
    if (listItems.length === 0) return;
    elements.push(
      <ul key={key} className="ml-4 list-disc space-y-0.5">
        {listItems.map((item, i) => (
          <li key={i}>{renderInline(item, `${key}-${i}`)}</li>
        ))}
      </ul>
    );
    listItems = [];
  }

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      listItems.push(trimmed.slice(2));
      return;
    }
    flushList(`list-${idx}`);
    if (trimmed) elements.push(<p key={idx}>{renderInline(trimmed, `p-${idx}`)}</p>);
  });
  flushList("list-end");

  return <div className="space-y-1">{elements}</div>;
}
