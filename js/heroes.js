/* ============================================================
   英雄池：50 个英雄（每位置 10 个）
   每局每个位置随机刷出 6 个在场英雄，再随机禁用 1 个，
   双方从同一批英雄中各选 1 个（MVP 允许重复选择）。
   cls 对应 8 类英雄精通，str 为英雄基础强度（25-99）。
   Created by haodongsheng
   ============================================================ */
const HEROES = [
  // —— 上单 TOP ——
  { id: 'Ornn',    cn: '奥恩', pos: 'TOP', cls: 'TANK',   str: 80 },
  { id: 'Sion',    cn: '塞恩', pos: 'TOP', cls: 'TANK',   str: 75 },
  { id: 'Maokai',  cn: '大树', pos: 'TOP', cls: 'TANK',   str: 82 },
  { id: 'Fiora',   cn: '剑姬', pos: 'TOP', cls: 'FIGHTER', str: 88 },
  { id: 'Renekton', cn: '鳄鱼', pos: 'TOP', cls: 'FIGHTER', str: 84 },
  { id: 'Jax',     cn: '武器', pos: 'TOP', cls: 'FIGHTER', str: 86 },
  { id: 'Gwen',    cn: '格温', pos: 'TOP', cls: 'FIGHTER', str: 85 },
  { id: 'Aatrox',  cn: '剑魔', pos: 'TOP', cls: 'FIGHTER', str: 87 },
  { id: 'Rumble',  cn: '兰博', pos: 'TOP', cls: 'MAGE',   str: 80 },
  { id: 'Kennen',  cn: '凯南', pos: 'TOP', cls: 'MAGE',   str: 78 },

  // —— 打野 JG ——
  { id: 'Sejuani', cn: '猪妹', pos: 'JG', cls: 'TANK',   str: 83 },
  { id: 'Jarvan',  cn: '皇子', pos: 'JG', cls: 'ENGAGE', str: 82 },
  { id: 'XinZhao', cn: '赵信', pos: 'JG', cls: 'FIGHTER', str: 82 },
  { id: 'LeeSin',  cn: '盲僧', pos: 'JG', cls: 'FIGHTER', str: 90 },
  { id: 'KhaZix',  cn: '螳螂', pos: 'JG', cls: 'AD_ASN', str: 88 },
  { id: 'Rengar',  cn: '狮子狗', pos: 'JG', cls: 'AD_ASN', str: 86 },
  { id: 'Evelynn', cn: '寡妇', pos: 'JG', cls: 'AP_ASN', str: 87 },
  { id: 'Ekko',    cn: '艾克', pos: 'JG', cls: 'AP_ASN', str: 88 },
  { id: 'Lillia',  cn: '莉莉娅', pos: 'JG', cls: 'MAGE',  str: 80 },
  { id: 'Kindred', cn: '千珏', pos: 'JG', cls: 'MARK',   str: 84 },

  // —— 中单 MID ——
  { id: 'Orianna', cn: '发条', pos: 'MID', cls: 'MAGE',   str: 87 },
  { id: 'Syndra',  cn: '辛德拉', pos: 'MID', cls: 'MAGE',   str: 86 },
  { id: 'Azir',    cn: '沙皇', pos: 'MID', cls: 'MAGE',   str: 88 },
  { id: 'Viktor',  cn: '维克托', pos: 'MID', cls: 'MAGE',   str: 85 },
  { id: 'TF',      cn: '卡牌', pos: 'MID', cls: 'MAGE',   str: 80 },
  { id: 'Zed',     cn: '劫', pos: 'MID', cls: 'AD_ASN', str: 88 },
  { id: 'Talon',   cn: '男刀', pos: 'MID', cls: 'AD_ASN', str: 82 },
  { id: 'Akali',   cn: '阿卡丽', pos: 'MID', cls: 'AP_ASN', str: 90 },
  { id: 'Leblanc', cn: '妖姬', pos: 'MID', cls: 'AP_ASN', str: 87 },
  { id: 'Sylas',   cn: '塞拉斯', pos: 'MID', cls: 'FIGHTER', str: 85 },

  // —— 下路 ADC ——
  { id: 'Ezreal',  cn: 'EZ', pos: 'ADC', cls: 'MARK', str: 85 },
  { id: 'Jinx',    cn: '金克丝', pos: 'ADC', cls: 'MARK', str: 86 },
  { id: 'Kaisa',   cn: '卡莎', pos: 'ADC', cls: 'MARK', str: 90 },
  { id: 'Varus',   cn: '维鲁斯', pos: 'ADC', cls: 'MARK', str: 84 },
  { id: 'Caitlyn', cn: '女警', pos: 'ADC', cls: 'MARK', str: 83 },
  { id: 'Jhin',    cn: '烬', pos: 'ADC', cls: 'MARK', str: 84 },
  { id: 'Xayah',   cn: '霞', pos: 'ADC', cls: 'MARK', str: 85 },
  { id: 'Vayne',   cn: '薇恩', pos: 'ADC', cls: 'MARK', str: 89 },
  { id: 'Cassiopeia', cn: '蛇女', pos: 'ADC', cls: 'MAGE', str: 80 },
  { id: 'Ziggs',   cn: '炸弹人', pos: 'ADC', cls: 'MAGE', str: 78 },

  // —— 辅助 SUP ——
  { id: 'Thresh',  cn: '锤石', pos: 'SUP', cls: 'ENGAGE', str: 88 },
  { id: 'Nautilus', cn: '泰坦', pos: 'SUP', cls: 'ENGAGE', str: 85 },
  { id: 'Rell',    cn: '芮尔', pos: 'SUP', cls: 'ENGAGE', str: 84 },
  { id: 'Rakan',   cn: '洛', pos: 'SUP', cls: 'ENGAGE', str: 86 },
  { id: 'Braum',   cn: '布隆', pos: 'SUP', cls: 'ENGAGE', str: 83 },
  { id: 'Lulu',    cn: '璐璐', pos: 'SUP', cls: 'ENCH',   str: 87 },
  { id: 'Nami',    cn: '娜美', pos: 'SUP', cls: 'ENCH',   str: 85 },
  { id: 'Yuumi',   cn: '猫咪', pos: 'SUP', cls: 'ENCH',   str: 84 },
  { id: 'Pyke',    cn: '派克', pos: 'SUP', cls: 'AD_ASN', str: 85 },
  { id: 'Lux',     cn: '拉克丝', pos: 'SUP', cls: 'MAGE',  str: 84 },
];

const HERO_POOL = {};
SIM_CONFIG.POS_LIST.forEach(function(pos) { HERO_POOL[pos] = []; });
HEROES.forEach(function(h) { if (HERO_POOL[h.pos]) HERO_POOL[h.pos].push(h); });

const HERO_BY_ID = {};
HEROES.forEach(function(h) { HERO_BY_ID[h.id] = h; });

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HEROES, HERO_POOL, HERO_BY_ID };
}
