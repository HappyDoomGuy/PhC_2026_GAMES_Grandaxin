/**
 * Мат и грубые ругательства: проверка по нормализованной строке (подстроки).
 * Используется только при смене имени в рекордах (и в GAS для set_display_name).
 * Первый пинг записывает имя из Telegram/URL без этого фильтра — см. syncProfileIfEmpty_ в Code.gs.
 * Синхронизируйте список с FORBIDDEN_DISPLAY_NAME_PARTS_ в google-apps-script/Code.gs
 */

const FORBIDDEN_PARTS: readonly string[] = [
  // базовые / пользовательские примеры
  'жопа',
  'жопе',
  'жопу',
  'жопы',
  'жопк',
  'жопн',
  'хуй',
  'хуя',
  'хую',
  'хуе',
  'хуи',
  'хуё',
  'хуев',
  'хуил',
  'пизд',
  'пизж',
  'сука',
  'суки',
  'сучк',
  'сучар',
  'бляд',
  'блят',
  'бля ',
  ' бля',
  'распизд',
  'долбоеб',
  'долбоёб',
  'долбаеб',
  'долбоящер',
  'срака',
  'сраку',
  'срать',
  'сран',
  'ссать',
  'насрал',
  // распространённые
  'ебать',
  'еблан',
  'ебло',
  'ебан',
  'ёбан',
  'заеб',
  'выеб',
  'уеба',
  'уёба',
  'ебёт',
  'ебал',
  'ебну',
  'охуе',
  'охуел',
  'охуит',
  'похуй',
  'нахуй',
  'нехуй',
  'дохуя',
  'хуяр',
  'хуяч',
  'говно',
  'гавно',
  'мудак',
  'мудач',
  'мудил',
  'мудень',
  'пидор',
  'пидарас',
  'пидрас',
  'педик',
  'педрил',
  'залуп',
  'гандон',
  'дроч',
  'мразь',
  'мрази',
  'шлюх',
  'ублюд',
  'гнида',
  'тварь',
  'чмо',
  'чмош',
  'скотин',
  'урод',
  'мандавош',
  'сиськ',
  // англ. обход латиницей
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'dick',
  'cock',
  'slut',
  'whore',
  'nigg',
  'fagg',
];

function compactForProfanityCheck(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-яё]/gi, '');
}

export function isForbiddenDisplayName(name: string): boolean {
  const n = compactForProfanityCheck(name.trim());
  if (n.length < 2) return false;
  for (const part of FORBIDDEN_PARTS) {
    const p = part.toLowerCase().replace(/ё/g, 'е').trim();
    if (p && n.includes(p)) return true;
  }
  return false;
}
