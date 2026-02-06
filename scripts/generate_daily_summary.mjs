import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function sh(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8');
}

function toISODateCN(d) {
  // YYYY-MM-DD in Asia/Shanghai
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function startOfDayCN(dateISO) {
  return `${dateISO}T00:00:00+08:00`;
}

function jsonSafeExtract(s) {
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a >= 0 && b > a) return s.slice(a, b + 1);
  throw new Error('No JSON object found in model output');
}

function heuristicSummary(dateISO, subjects) {
  const top = subjects.slice(0, 8);
  const bullets = top.map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const title = bullets.length ? '工作总结（简版）' : '工作总结（无提交）';
  return {
    title,
    bullets: bullets.length ? bullets : ['当天无代码提交（以仓库提交为准）。'],
  };
}

async function aiSummary({ dateISO, subjects }) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  if (!apiKey) {
    return { ...heuristicSummary(dateISO, subjects), _mode: 'heuristic' };
  }

  const prompt = `你是一个非常克制、面向公开主页的“工作日报”生成器。\n\n目标：为 ${dateISO}（北京时间）生成一段简短但信息密度高的“前一天工作总结”，只基于给定的 commit 列表。\n\n硬性约束：\n- 输出中文。\n- 不要暴露基础设施/安全细节：不要出现 IP、端口、token、密钥、SSH、服务名、路径、内部系统细节。\n- 不要重复 commit 原文；要抽象成成果与变化。\n- 语气偏“产品/体验视角”，短句，具体但不啰嗦。\n\n输出严格 JSON（不要 markdown），结构：\n{\n  "title": "<=12字的标题",\n  "bullets": ["要点1", "要点2", "要点3", "要点4"]\n}\nbullets 3-5 条，每条 <= 22 个汉字。\n\ncommit 列表：\n${subjects.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: prompt,
      temperature: 0.4,
      max_output_tokens: 280,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${txt.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = (data.output_text || '').trim();
  const parsed = JSON.parse(jsonSafeExtract(text));
  if (!parsed?.title || !Array.isArray(parsed?.bullets)) throw new Error('Bad JSON shape');

  return { ...parsed, _mode: 'ai' };
}

(async () => {
  // Run at 00:00 CN: generate yesterday summary.
  const now = new Date();
  const todayISO = toISODateCN(now);
  // Get yesterday by constructing date in UTC then formatting in CN.
  const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yISO = toISODateCN(y);

  const since = startOfDayCN(yISO);
  const until = startOfDayCN(todayISO);

  let subjects = [];
  try {
    const out = sh(`git log --no-merges --since='${since}' --until='${until}' --pretty=format:%s`);
    subjects = out
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !/^merge\b/i.test(s));
  } catch {
    subjects = [];
  }

  // Generate summary
  let summary;
  try {
    summary = await aiSummary({ dateISO: yISO, subjects });
  } catch (e) {
    summary = { ...heuristicSummary(yISO, subjects), _mode: 'fallback' };
  }

  const item = {
    time: startOfDayCN(yISO),
    tag: '日报',
    text: `${summary.title}\n- ${summary.bullets.join('\n- ')}`,
    meta: { mode: summary._mode || 'unknown', commits: subjects.length },
  };

  const dailyPath = path.join('src', 'data', 'worklog.daily.json');
  let daily = [];
  if (fs.existsSync(dailyPath)) {
    try {
      const x = JSON.parse(fs.readFileSync(dailyPath, 'utf8'));
      if (Array.isArray(x)) daily = x;
    } catch {}
  }

  // Upsert by time
  const idx = daily.findIndex((d) => d?.time === item.time);
  if (idx >= 0) daily[idx] = item;
  else daily.unshift(item);

  // Keep last 30
  daily = daily.filter(Boolean).slice(0, 30);

  fs.mkdirSync(path.dirname(dailyPath), { recursive: true });
  fs.writeFileSync(dailyPath, JSON.stringify(daily, null, 2) + '\n');

  console.log(`Generated daily summary for ${yISO} (${subjects.length} commits), mode=${item.meta.mode}`);
})();
