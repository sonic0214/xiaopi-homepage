import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function sh(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8');
}

function safeTag(msg) {
  const m = msg.toLowerCase();
  if (/(seo|gsc|ga4|ctr)/.test(m)) return 'SEO';
  if (/(mail|email|gmail|imap)/.test(m)) return '邮件';
  if (/(calendar|日程|timeblock)/.test(m)) return '日程';
  if (/(ci|deploy|pages|workflow|build|astro)/.test(m)) return '网站';
  if (/(design|ui|ux|style|css)/.test(m)) return '设计';
  return '更新';
}

// Read git history (works in CI if checkout fetch-depth > 1)
let lines = '';
try {
  // iso time, short sha, subject
  // NOTE: use %x09 for tabs; \t is not expanded in git pretty format.
  lines = sh("git log -n 12 --date=iso-strict --pretty=format:%ad%x09%h%x09%s");
} catch (e) {
  lines = '';
}

const items = [];
for (const row of lines.split('\n')) {
  if (!row.trim()) continue;
  const [time, sha, subject] = row.split('\t');
  if (!time || !sha || !subject) continue;
  // Keep it public-safe: only use the repo commit subject.
  items.push({
    time,
    tag: safeTag(subject),
    text: subject,
    ref: sha,
  });
}

// Daily summaries (auto-committed)
const dailyPath = path.join('src', 'data', 'worklog.daily.json');
if (fs.existsSync(dailyPath)) {
  try {
    const daily = JSON.parse(fs.readFileSync(dailyPath, 'utf8'));
    if (Array.isArray(daily)) {
      // Show a few most recent daily summaries on top.
      for (const it of daily.slice(0, 3)) {
        if (!it || typeof it !== 'object') continue;
        if (!it.text) continue;
        items.unshift({
          time: it.time || '最近',
          tag: it.tag || '日报',
          text: it.text,
        });
      }
    }
  } catch {}
}

// Optional manual public-safe items (committed)
const manualPath = path.join('src', 'data', 'worklog.manual.json');
if (fs.existsSync(manualPath)) {
  try {
    const manual = JSON.parse(fs.readFileSync(manualPath, 'utf8'));
    if (Array.isArray(manual)) {
      for (const it of manual.slice(0, 10)) {
        if (!it || typeof it !== 'object') continue;
        if (!it.text) continue;
        items.unshift({
          time: it.time || '最近',
          tag: it.tag || '记录',
          text: it.text,
        });
      }
    }
  } catch {}
}

const outPath = path.join('src', 'data', 'worklog.generated.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(items.slice(0, 10), null, 2) + '\n');
console.log(`Generated ${outPath} (${items.length} items)`);
