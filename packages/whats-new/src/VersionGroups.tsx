// VersionGroups: the versions, each with its date and its lines; the body of the sheet and of the list.
import type { VersionGroup } from './changelog.js';
import type { WhatsNewLabels } from './labels.js';

export function VersionGroups({ groups, labels }: { groups: readonly VersionGroup[]; labels: Pick<WhatsNewLabels, 'new' | 'fixed'> }) {
  return (
    <div className="bk-whats-new__groups">
      {groups.map((group) => (
        <section className="bk-whats-new__group" key={group.version}>
          <div className="bk-whats-new__group-head">
            <h3 className="bk-whats-new__version">{group.version}</h3>
            <time className="bk-whats-new__date" dateTime={group.date}>
              {group.date}
            </time>
          </div>
          <ul className="bk-whats-new__lines">
            {group.entries.map((entry, i) => (
              <li className="bk-whats-new__line" key={i}>
                <span className={`bk-whats-new__kind bk-whats-new__kind--${entry.kind}`}>{labels[entry.kind]}</span>
                <span className="bk-whats-new__text">{entry.text}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
