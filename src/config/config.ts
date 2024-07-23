export const ConfigBet = {
  min: 3,
  max: 3 * 1e3,
  total: 8 * 1e3,
};

export const ConfigBetDiff = {
  min: 3,
  max: (3 * 1e3) / 2,
  total: (8 * 1e3) / 2,
};

export const ConfigVip = [
  { name: 'vip-1', value: 10, deposit: 50000, expired: 30 },
  { name: 'vip-2', value: 20, deposit: 400000, expired: 30 },
  { name: 'vip-3', value: 40, deposit: 1000000, expired: 30 },
  { name: 'vip-4', value: 100, deposit: 3000000, expired: 30 },
  { name: 'vip-5', value: 300, deposit: 5000000, expired: 30 },
  { name: 'vip-6', value: 500, deposit: 15000000, expired: 30 },
  { name: 'vip-7', value: 1000, deposit: 30000000, expired: 30 },
];

export const ConfigNoti = {
  min: 300,
};

export const ConfigExchange = {
  name: 'exchange-gold',
  diamon: 50,
  gold: 1,
};

export const ConfigMissionDays = [
  { name: 'mission-1', value: 1e3, prize: 10 },
  { name: 'mission-2', value: 1e3 * 4, prize: 10 * 3 },
  { name: 'mission-3', value: 1e3 * 10, prize: 10 * 6 },
  { name: 'mission-4', value: 1e3 * 30, prize: 10 * 10 },
  { name: 'mission-5', value: 1e3 * 50, prize: 10 * 30 },
  { name: 'mission-6', value: 1e3 * 80, prize: 10 * 50 },
  { name: 'mission-7', value: 1e3 * 100, prize: 10 * 10 },
];
