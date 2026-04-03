export default function LoadingDots() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm">
        <p className="text-[11px] font-medium uppercase tracking-wider text-sage">
          Teachings
        </p>
        <div className="mt-2 flex gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-saffron-light [animation-delay:0ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-saffron-light [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-saffron-light [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
