import type { ReminderSettingsGuideSectionContent } from '../reminder-settings-guide.types';

interface ReminderSettingsGuideNavProps {
  sections: ReminderSettingsGuideSectionContent[];
}

export function ReminderSettingsGuideNav({ sections }: ReminderSettingsGuideNavProps) {
  return (
    <nav className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        Navegacion rapida
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              className="block rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] transition hover:bg-slate-50"
              href={`#${section.id}`}
            >
              {section.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

