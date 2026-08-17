export function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-xl bg-bg px-3.5 py-2.5 text-sm leading-[1.5] text-ink">{text}</div>
    </div>
  );
}
