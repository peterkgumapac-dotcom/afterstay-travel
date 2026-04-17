export type AlertLevel = 'green' | 'yellow' | 'orange' | 'red';

export interface BudgetStatus {
  level: AlertLevel;
  emoji: string;
  title: string;
  message: string;
  percentUsed: number;
  remaining: number;
}

const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const MESSAGES = {
  green: {
    under50: [
      { title: "You're doing great 🌊", msg: "Stay breezy — plenty of budget left." },
      { title: "Cruising 🌴", msg: "Vacation mode activated without the guilt." },
    ],
    at50: [
      { title: "Halfway there 🏖️", msg: "Halfway through your budget, halfway to paradise." },
      { title: "Midway magic ✨", msg: "Half spent, half saved. Balance found." },
    ],
  },
  yellow: {
    at75: [
      { title: "Slow down, big spender 🥥", msg: "75% in — got a few more days of island life ahead." },
      { title: "Pace yourself 🌺", msg: "Three quarters used. Still time for sunset drinks." },
      { title: "Starting to sip the budget 🍹", msg: "Plenty of trip left — maybe skip a fancy dinner?" },
    ],
  },
  orange: {
    at90: [
      { title: "Hold up, traveler ⚠️", msg: (r: number) => `Only ₱${r.toLocaleString()} left. Maybe skip the cocktail tonight?` },
      { title: "Yellow alert 🚨", msg: (r: number) => `₱${r.toLocaleString()} remaining. Beach picnic vibes > fine dining.` },
      { title: "Tread carefully 🐚", msg: (r: number) => `₱${r.toLocaleString()} and counting. Save it for one more memory.` },
    ],
  },
  red: {
    at100: [
      { title: "Budget blown 💸", msg: (o: number) => `You're ₱${o.toLocaleString()} over. This one's on future you.` },
      { title: "Over the line 🌊", msg: (o: number) => `₱${o.toLocaleString()} past budget. You're in paradise — treat yourself?` },
      { title: "Future you says hi 👋", msg: (o: number) => `₱${o.toLocaleString()} over. Worth every peso, right?` },
    ],
  },
};

export const getBudgetStatus = (
  spent: number,
  total: number,
  daysRemaining: number
): BudgetStatus => {
  const percentUsed = total > 0 ? (spent / total) * 100 : 0;
  const remaining = total - spent;
  const over = Math.abs(remaining);

  if (percentUsed >= 100) {
    const m = pickRandom(MESSAGES.red.at100);
    return {
      level: 'red',
      emoji: '💸',
      title: m.title,
      message: typeof m.msg === 'function' ? m.msg(over) : m.msg,
      percentUsed,
      remaining,
    };
  }

  if (percentUsed >= 90) {
    const m = pickRandom(MESSAGES.orange.at90);
    return {
      level: 'orange',
      emoji: '⚠️',
      title: m.title,
      message: typeof m.msg === 'function' ? m.msg(remaining) : m.msg,
      percentUsed,
      remaining,
    };
  }

  if (percentUsed >= 75) {
    const m = pickRandom(MESSAGES.yellow.at75);
    return {
      level: 'yellow',
      emoji: '🥥',
      title: m.title,
      message: typeof m.msg === 'function' ? (m.msg as Function)(daysRemaining) : m.msg,
      percentUsed,
      remaining,
    };
  }

  if (percentUsed >= 50) {
    const m = pickRandom(MESSAGES.green.at50);
    return {
      level: 'green',
      emoji: '🌴',
      title: m.title,
      message: typeof m.msg === 'function' ? (m.msg as Function)(0) : m.msg,
      percentUsed,
      remaining,
    };
  }

  const m = pickRandom(MESSAGES.green.under50);
  return {
    level: 'green',
    emoji: '🌊',
    title: m.title,
    message: typeof m.msg === 'function' ? (m.msg as Function)(0) : m.msg,
    percentUsed,
    remaining,
  };
};

export const splitEqually = (amount: number, peopleCount: number): number => {
  if (peopleCount <= 0) return 0;
  return Math.round((amount / peopleCount) * 100) / 100;
};
