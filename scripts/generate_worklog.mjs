import fs from 'node:fs';
import path from 'node:path';

// Work Log policy: show ONLY daily summaries (one per day).
// No per-commit items on the public homepage.

const items = [];

const dailyPath = path.join('src', 'data', 'worklog.daily.json');
if (fs.existsSync(dailyPath)) {
  try {
    const daily = JSON.parse(fs.readFileSync(dailyPath, 'utf8'));
    if (Array.isArray(daily)) {
      for (const it of daily) {
        if (!it || typeof it !== 'object') continue;
        if (!it.text) continue;
        items.push({
          time: it.time || '—',
          tag: it.tag || '日报',
          text: it.text,
        });
      }
    }
  } catch {}
}

const outPath = path.join('src', 'data', 'worklog.generated.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(items.slice(0, 30), null, 2) + '\n');
console.log(`Generated ${outPath} (${items.length} items)`);
