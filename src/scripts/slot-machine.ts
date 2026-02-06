type SlotItem = {
  name: string;
  spriteIndex: number; // 0..11
};

export const ITEMS: SlotItem[] = [
  { name: '皮卡丘', spriteIndex: 0 },
  { name: '伊布', spriteIndex: 1 },
  { name: '可达鸭', spriteIndex: 2 },
  { name: '妙蛙种子', spriteIndex: 3 },
  { name: '小火龙', spriteIndex: 4 },
  { name: '杰尼龟', spriteIndex: 5 },
  { name: '胖丁', spriteIndex: 6 },
  { name: '喵喵', spriteIndex: 7 },
  { name: '卡比兽', spriteIndex: 8 },
  { name: '耿鬼', spriteIndex: 9 },
  { name: '鲤鱼王', spriteIndex: 10 },
  { name: '超梦', spriteIndex: 11 },
];

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function pickIndex(): number {
  // Rare weighting: last two are rarer.
  const r = Math.random();
  if (r < 0.05) return 11;
  if (r < 0.10) return 10;
  return Math.floor(Math.random() * 10);
}

function setItemStyle(el: HTMLElement, idx: number) {
  const s = ITEMS[idx].spriteIndex;
  const x = (s % 6) * 64;
  const y = Math.floor(s / 6) * 64;
  el.style.setProperty('--sprite', String(s));
  el.style.setProperty('--bx', `-${x}px`);
  el.style.setProperty('--by', `-${y}px`);
  el.setAttribute('aria-label', ITEMS[idx].name);
}

let BUSY = false;

function buildReelStrip(strip: HTMLElement) {
  // Build 3 cycles to allow long scroll.
  strip.innerHTML = '';
  const cycles = 3;
  for (let c = 0; c < cycles; c++) {
    for (let i = 0; i < ITEMS.length; i++) {
      const cell = document.createElement('div');
      cell.className = 'reelCell';
      setItemStyle(cell, i);
      strip.appendChild(cell);
    }
  }
}

function setStripOffset(strip: HTMLElement, offsetPx: number, animate: boolean) {
  strip.style.transitionDuration = animate ? '780ms' : '0ms';
  strip.style.transform = `translate3d(0, ${-offsetPx}px, 0)`;
}

export function initSlotMachine(root: HTMLElement) {
  const reels = Array.from(root.querySelectorAll<HTMLElement>('[data-reel]'));
  const btn = root.querySelector<HTMLButtonElement>('[data-spin]');
  const result = root.querySelector<HTMLElement>('[data-result]');

  if (!reels.length || !btn) return;

  // init
  reels.forEach((reel) => {
    const strip = reel.querySelector<HTMLElement>('.reelStrip');
    if (strip) buildReelStrip(strip);
    // start at the first cell of middle cycle
    const itemH = 56;
    const base = ITEMS.length * itemH;
    if (strip) setStripOffset(strip, base, false);
  });
  if (result) result.textContent = '';

  btn.addEventListener('click', () => spinOnce(root));
}

export async function spinOnce(root: HTMLElement) {
  if (BUSY) return;

  const reels = Array.from(root.querySelectorAll<HTMLElement>('[data-reel]'));
  const btn = root.querySelector<HTMLButtonElement>('[data-spin]');
  const result = root.querySelector<HTMLElement>('[data-result]');
  if (!reels.length || !btn) return;

  BUSY = true;
  btn.disabled = true;
  root.classList.add('isSpinning');

  const itemH = 56;
  const cycleH = ITEMS.length * itemH;

  const finalIdx = [pickIndex(), pickIndex(), pickIndex()];

  // Each reel scrolls from middle cycle to end of last cycle + target index.
  for (let r = 0; r < reels.length; r++) {
    const reel = reels[r];
    const strip = reel.querySelector<HTMLElement>('.reelStrip');
    if (!strip) continue;

    // reset to middle cycle start without anim
    setStripOffset(strip, cycleH, false);
    // force reflow so transition applies
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    strip.offsetHeight;

    const extraTurns = 1 + r; // stagger a bit
    const target = (2 + extraTurns) * cycleH + finalIdx[r] * itemH;
    setStripOffset(strip, target, true);

    // small delay before next reel starts
    await sleep(140);
  }

  // Wait for the last reel to finish.
  await sleep(980);
  root.classList.remove('isSpinning');

  const names = finalIdx.map((i) => ITEMS[i].name);
  const jackpot = names[0] === names[1] && names[1] === names[2];
  if (result) result.textContent = jackpot ? `命中！${names[0]} 三连` : `结果：${names[0]} / ${names[1]} / ${names[2]}`;

  root.classList.toggle('isJackpot', jackpot);
  await sleep(900);
  root.classList.remove('isJackpot');

  btn.disabled = false;
  BUSY = false;
}
