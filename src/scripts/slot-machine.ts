type SlotItem = {
  name: string;
  rarity?: 'common' | 'rare' | 'epic';
};

const ITEMS: SlotItem[] = [
  { name: '皮卡丘', rarity: 'rare' },
  { name: '伊布', rarity: 'rare' },
  { name: '可达鸭' },
  { name: '妙蛙种子' },
  { name: '小火龙' },
  { name: '杰尼龟' },
  { name: '胖丁' },
  { name: '喵喵' },
  { name: '小拉达' },
  { name: '波波' },
  { name: '鲤鱼王', rarity: 'epic' },
  { name: '超梦', rarity: 'epic' },
];

function pick(): SlotItem {
  // Light-weight weighting: epics rarer.
  const r = Math.random();
  if (r < 0.06) return ITEMS.filter((i) => i.rarity === 'epic')[Math.floor(Math.random() * ITEMS.filter((i) => i.rarity === 'epic').length)];
  if (r < 0.22) return ITEMS.filter((i) => i.rarity === 'rare')[Math.floor(Math.random() * ITEMS.filter((i) => i.rarity === 'rare').length)];
  const commons = ITEMS.filter((i) => !i.rarity);
  return commons[Math.floor(Math.random() * commons.length)];
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

let BUSY = false;

async function spin(root: HTMLElement) {
  if (BUSY) return;

  const reels = Array.from(root.querySelectorAll<HTMLElement>('[data-reel]'));
  const btn = root.querySelector<HTMLButtonElement>('[data-spin]');
  const result = root.querySelector<HTMLElement>('[data-result]');
  if (!reels.length || !btn) return;

  BUSY = true;
  btn.disabled = true;
  root.classList.add('isSpinning');

  const setReel = (idx: number, text: string) => {
    const el = reels[idx]?.querySelector<HTMLElement>('.reelText');
    if (el) el.textContent = text;
  };

  const setResult = (text: string) => {
    if (result) result.textContent = text;
  };

  // quick "tick" effect by swapping text rapidly, then settle each reel with a slight delay
  const final: SlotItem[] = [pick(), pick(), pick()];

  const tick = async (reelIdx: number, ms: number) => {
    const endAt = Date.now() + ms;
    while (Date.now() < endAt) {
      setReel(reelIdx, pick().name);
      await sleep(60);
    }
    setReel(reelIdx, final[reelIdx].name);
  };

  await tick(0, 520);
  await tick(1, 620);
  await tick(2, 720);

  root.classList.remove('isSpinning');

  const [a, b, c] = final.map((x) => x.name);
  const jackpot = a === b && b === c;
  setResult(jackpot ? `命中！${a} 三连` : `结果：${a} / ${b} / ${c}`);

  root.classList.toggle('isJackpot', jackpot);
  await sleep(900);
  root.classList.remove('isJackpot');

  btn.disabled = false;
  BUSY = false;
}

export function initSlotMachine(root: HTMLElement) {
  const btn = root.querySelector<HTMLButtonElement>('[data-spin]');
  const result = root.querySelector<HTMLElement>('[data-result]');
  if (result) result.textContent = '';
  btn?.addEventListener('click', () => spin(root));
}

// For lazy loader: make the very first click spin immediately.
export function spinOnce(root: HTMLElement) {
  return spin(root);
}
