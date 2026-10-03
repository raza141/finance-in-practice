import type { SyllabusModule } from "../types";

/** Numbered curriculum modules with their topics. */
export function CourseSyllabus({ modules }: { modules: readonly SyllabusModule[] }) {
  return (
    <ol className="divide-y divide-line border-y border-line">
      {modules.map((module, index) => (
        <li key={`${index}-${module.title}`} className="grid gap-4 py-7 sm:grid-cols-[4.5rem_1fr]">
          <span className="font-mono text-sm text-quant tabular-nums">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div>
            <h3 className="text-lg leading-snug font-bold">{module.title}</h3>
            {module.summary && <p className="mt-2 leading-relaxed text-muted">{module.summary}</p>}
            {module.topics.length > 0 && (
              <ul className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                {module.topics.map((topic) => (
                  <li key={topic} className="flex gap-3 text-[15px] text-ink/90">
                    <span aria-hidden className="mt-2.5 h-px w-3 shrink-0 bg-quant/70" />
                    {topic}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
