import type { ReminderSettingsGuideSectionContent } from '../reminder-settings-guide.types';

interface ReminderSettingsGuideSectionProps {
  section: ReminderSettingsGuideSectionContent;
}

export function ReminderSettingsGuideSection({
  section,
}: ReminderSettingsGuideSectionProps) {
  return (
    <section
      id={section.id}
      className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-sm"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        {section.summary}
      </p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight">{section.title}</h2>

      <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--text)]">
        {section.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      {section.referenceRows ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--panel-muted)] text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">Campo</th>
                <th className="px-3 py-2">Significado</th>
              </tr>
            </thead>
            <tbody>
              {section.referenceRows.map((row) => (
                <tr className="border-t border-slate-100" key={`${section.id}-${row.field}`}>
                  <td className="px-3 py-2 font-medium">{row.field}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{row.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {section.bullets ? (
        <ul className="mt-4 space-y-2 text-sm text-[var(--text)]">
          {section.bullets.map((bullet) => (
            <li
              className="rounded-xl border border-[var(--border)] bg-[var(--panel-muted)] px-3 py-2"
              key={bullet}
            >
              {bullet}
            </li>
          ))}
        </ul>
      ) : null}

      {section.callout ? (
        <div
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
            section.callout.tone === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : section.callout.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-[var(--border)] bg-slate-50 text-[var(--muted)]'
          }`}
        >
          <p className="font-semibold">{section.callout.title}</p>
          <p className="mt-1">{section.callout.body}</p>
        </div>
      ) : null}
    </section>
  );
}

