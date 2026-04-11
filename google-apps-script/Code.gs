/**
 * Веб-приложение Google Apps Script: развернуть как «Веб-приложение»,
 * доступ «Все», выполнять от имени владельца.
 *
 * В таблице (первый лист): A — дата/время входа, B — session id (uuid),
 * C — user id из utm_medium, D — длительность сессии (сек),
 * E — score, F — tablets, G — тревога, H — нервозность, I — стресс, J — всего, K — tg_name (устар.; не заполняется; имя только лист «Профили»).
 *
 * Лист «Профили»: A — user_id, B — tg_name (одна строка на пользователя).
 *
 * POST, тело JSON в e.postData.contents:
 *   { "entry": "<ISO>", "sid": "<uuid>", "uid": "<digits>", "sec": number, "tg_name": "..." (опционально) }
 *   sec > 0  — первая запись строки: записать sec как начальную длительность (клиент шлёт 5–23).
 *   sec === 0 — обновление: найти строку с sid в колонке B и прибавить к D случайное 20–29.
 *
 * Итог игры (экран game over):
 *   { "cmd": "game_results", "sid", "uid", "entry", "tg_name" (опц.), "score", … "vsego" }
 *   Если строки с таким sid ещё нет — добавляется новая строка (гонка с первым пингом).
 *
 * Рекорды (топ-10 + «я»):
 *   очки / «всего» / таблетки — сумма только по строкам с итогом игры (E заполнен);
 *   сессии — число всех строк с этим uid и непустым session_id (включая незавершённые);
 *   время — сумма D по всем таким строкам (включая незавершённые сессии).
 *   { "cmd": "leaderboard", "uid": "<digits или пусто>" }
 *
 * Имя:
 *   { "cmd": "stored_tg_name", "uid" } — tg_name из листа «Профили»; если пусто — из K на первом листе (и перенос в «Профили»).
 *   { "cmd": "set_display_name", "uid", "tg_name" } — смена имени в «Профили»: ≥ 4 символов, без запрещённых слов (словарь в скрипте).
 * При пинге / game_results: имя из «Профилей» или из клиента; при первом появлении в «Профили» — как в Telegram/URL, без фильтра мата.
 * Смена имени (set_display_name): ≥ 4 символов и словарь запрещённых слов.
 */
var SPREADSHEET_ID = '1ooVI0IlhyeuB2IHqdM3bCRQ0mvuUGA-ynCAI5ww61W0';

function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) {
      return jsonOut({ ok: false, error: 'no body' });
    }
    var id = getSpreadsheetId_();
    if (!id) {
      return jsonOut({ ok: false, error: 'Set SPREADSHEET_ID in Code.gs or script property SPREADSHEET_ID' });
    }

    var data = JSON.parse(e.postData.contents);
    if (data.track_debug) {
      Logger.log(
        'doPost debug cmd=' +
          String(data.cmd || '') +
          ' sid=' +
          String(data.sid || '').slice(0, 12) +
          ' sec=' +
          data.sec
      );
    }

    var ss = SpreadsheetApp.openById(id);
    var sheet = ss.getSheets()[0];
    ensureHeaders_(sheet);
    var profilesSheet = ensureProfilesSheet_(ss);

    if (String(data.cmd || '') === 'game_results') {
      return handleGameResults_(ss, sheet, data);
    }
    if (String(data.cmd || '') === 'leaderboard') {
      return handleLeaderboard_(ss, sheet, data);
    }
    if (String(data.cmd || '') === 'stored_tg_name') {
      return handleGetStoredTgName_(ss, sheet, data);
    }
    if (String(data.cmd || '') === 'set_display_name') {
      return handleSetDisplayName_(ss, sheet, data);
    }

    var entry = String(data.entry || '');
    var sid = String(data.sid || '');
    var uid = String(data.uid || '');
    var sec = Number(data.sec);
    var storedTg = uid ? getStoredTgNameForUid_(ss, sheet, uid) : '';
    var tgName = storedTg ? storedTg : normalizeTgName_(data.tg_name);

    if (!sid || !uid) {
      return jsonOut({ ok: false, error: 'sid and uid required' });
    }

    if (sec > 0) {
      var rowFirst = findRowBySessionId_(sheet, sid);
      if (rowFirst >= 2) {
        var d0 = sheet.getRange(rowFirst, 4);
        var curD0 = Number(d0.getValue());
        if (isNaN(curD0) || curD0 === 0) {
          d0.setValue(isNaN(sec) || sec < 0 ? 0 : sec);
        }
        syncProfileIfEmpty_(profilesSheet, uid, tgName);
        return jsonOut({ ok: true, mode: 'prime_duration' });
      }
      sheet.appendRow(trackingRowValues_(formatEntry_(entry), sid, uid, sec));
      syncProfileIfEmpty_(profilesSheet, uid, tgName);
      return jsonOut({ ok: true, mode: 'append' });
    }

    var added = randomInt_(20, 29);
    var updated = updateDurationBySessionId_(sheet, sid, added);
    syncProfileIfEmpty_(profilesSheet, uid, tgName);
    return jsonOut({ ok: true, mode: 'update', added: added, rowFound: updated });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

/** Проверка развёртывания: открыть URL веб-приложения в браузере */
function doGet() {
  return ContentService.createTextOutput('ok');
}

function getSpreadsheetId_() {
  var fromProp = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (fromProp && String(fromProp).trim()) {
    return String(fromProp).trim();
  }
  return String(SPREADSHEET_ID || '').trim();
}

var HEADER_ROW_ = [
  'entry_datetime',
  'session_id',
  'user_id',
  'session_duration_sec',
  'score',
  'tablets',
  'тревога',
  'нервозность',
  'стресс',
  'всего',
  'tg_name'
];

/** Одна строка трекинга: A–D заполнены, E–J пустые; K не используется (имя — лист «Профили»). */
function trackingRowValues_(entryCell, sid, uid, sec) {
  return [entryCell, sid, uid, sec, '', '', '', '', '', '', ''];
}

function normalizeTgName_(v) {
  var s = String(v != null ? v : '').trim();
  if (s.length > 500) {
    s = s.substring(0, 500);
  }
  return s;
}

/** Синхронизируйте с lib/forbiddenDisplayNames.ts (FORBIDDEN_PARTS). */
var FORBIDDEN_DISPLAY_NAME_PARTS_ = [
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
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'dick',
  'cock',
  'slut',
  'whore',
  'nigg',
  'fagg'
];

function compactForProfanityCheck_(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-яё]/gi, '');
}

function isForbiddenDisplayName_(name) {
  var n = compactForProfanityCheck_(name);
  if (n.length < 2) {
    return false;
  }
  var parts = FORBIDDEN_DISPLAY_NAME_PARTS_;
  for (var i = 0; i < parts.length; i++) {
    var p = String(parts[i] || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .trim();
    if (p && n.indexOf(p) !== -1) {
      return true;
    }
  }
  return false;
}

var PROFILES_SHEET_NAME_ = 'Профили';
var PROFILES_HEADER_ROW_ = ['user_id', 'tg_name'];

function ensureProfilesSheet_(ss) {
  var sh = ss.getSheetByName(PROFILES_SHEET_NAME_);
  if (!sh) {
    sh = ss.insertSheet(PROFILES_SHEET_NAME_);
  }
  if (sh.getLastRow() < 1 || String(sh.getRange(1, 1).getValue() || '').trim() === '') {
    sh.getRange(1, 1, 1, PROFILES_HEADER_ROW_.length).setValues([PROFILES_HEADER_ROW_]);
  }
  return sh;
}

function findProfileRowByUid_(profSheet, uid) {
  var u = String(uid || '').trim();
  if (!u) {
    return -1;
  }
  var lastRow = profSheet.getLastRow();
  if (lastRow < 2) {
    return -1;
  }
  var numRows = lastRow - 1;
  var colA = profSheet.getRange(2, 1, numRows, 1).getValues();
  for (var i = 0; i < colA.length; i++) {
    if (String(colA[i][0]).trim() === u) {
      return i + 2;
    }
  }
  return -1;
}

function readProfileTgName_(profSheet, uid) {
  var row = findProfileRowByUid_(profSheet, uid);
  if (row < 2) {
    return '';
  }
  return normalizeTgName_(profSheet.getRange(row, 2).getValue());
}

function upsertProfileTgName_(profSheet, uid, name) {
  var u = String(uid || '').trim();
  var nm = normalizeTgName_(name);
  if (!u || !nm) {
    return;
  }
  var row = findProfileRowByUid_(profSheet, u);
  if (row >= 2) {
    profSheet.getRange(row, 2).setValue(nm);
  } else {
    profSheet.appendRow([u, nm]);
  }
}

/** Последнее непустое K на основном листе (миграция со старых данных). */
function getLegacyTgNameFromMainSheet_(mainSheet, uid) {
  var u = String(uid || '').trim();
  if (!u) {
    return '';
  }
  var lastRow = mainSheet.getLastRow();
  if (lastRow < 2) {
    return '';
  }
  var numRows = lastRow - 1;
  var colC = mainSheet.getRange(2, 3, numRows, 1).getValues();
  var colK = mainSheet.getRange(2, 11, numRows, 1).getValues();
  var last = '';
  for (var i = 0; i < colC.length; i++) {
    if (String(colC[i][0]).trim() === u) {
      var k = normalizeTgName_(colK[i][0]);
      if (k) {
        last = k;
      }
    }
  }
  return last;
}

/**
 * Имя для uid: лист «Профили»; если пусто — последнее K на основном листе (ленивый перенос в «Профили»).
 */
function getStoredTgNameForUid_(ss, mainSheet, uid) {
  var u = String(uid || '').trim();
  if (!u) {
    return '';
  }
  var prof = ensureProfilesSheet_(ss);
  var fromProf = readProfileTgName_(prof, u);
  if (fromProf) {
    return fromProf;
  }
  var legacy = getLegacyTgNameFromMainSheet_(mainSheet, u);
  if (legacy) {
    upsertProfileTgName_(prof, u, legacy);
    return legacy;
  }
  return '';
}

/** Если в «Профили» ещё нет имени — записать (первый заход с Telegram/URL). */
function syncProfileIfEmpty_(profSheet, uid, tgName) {
  var u = String(uid || '').trim();
  var nm = normalizeTgName_(tgName);
  if (!u || !nm) {
    return;
  }
  if (readProfileTgName_(profSheet, u)) {
    return;
  }
  upsertProfileTgName_(profSheet, u, nm);
}

function handleGetStoredTgName_(ss, sheet, data) {
  var uid = String(data.uid || '').trim();
  return jsonOut({
    ok: true,
    tgName: getStoredTgNameForUid_(ss, sheet, uid)
  });
}

function handleSetDisplayName_(ss, sheet, data) {
  var uid = String(data.uid || '').trim();
  var name = normalizeTgName_(data.tg_name);
  if (!uid || !name) {
    return jsonOut({ ok: false, error: 'uid and non-empty tg_name required' });
  }
  if (name.length < 4) {
    return jsonOut({ ok: false, error: 'Имя не короче 4 символов' });
  }
  if (isForbiddenDisplayName_(name)) {
    return jsonOut({ ok: false, error: 'Имя содержит недопустимые выражения' });
  }
  var prof = ensureProfilesSheet_(ss);
  upsertProfileTgName_(prof, uid, name);
  return jsonOut({ ok: true, updated: 1, profile: true });
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() < 1 || sheet.getRange('A1').getValue() === '') {
    sheet.getRange(1, 1, 1, HEADER_ROW_.length).setValues([HEADER_ROW_]);
    return;
  }
  var lastCol = sheet.getLastColumn();
  for (var i = lastCol; i < HEADER_ROW_.length; i++) {
    sheet.getRange(1, i + 1).setValue(HEADER_ROW_[i]);
  }
}

function traceGameResults_(data, msg) {
  if (data.track_debug) {
    Logger.log('game_results trace: ' + msg);
  }
  return msg;
}

function handleGameResults_(ss, sheet, data) {
  var dbg = Boolean(data.track_debug);
  var sid = String(data.sid || '').trim();
  if (!sid) {
    var e1 = { ok: false, error: 'sid required' };
    if (dbg) {
      e1._trace = traceGameResults_(data, 'reject: no sid');
    }
    return jsonOut(e1);
  }
  var uid = String(data.uid || '').trim();
  var entryRaw = String(data.entry || '').trim();
  var tgNameGr = uid ? getStoredTgNameForUid_(ss, sheet, uid) || normalizeTgName_(data.tg_name) : normalizeTgName_(data.tg_name);
  var score = Number(data.score);
  var tablets = Number(data.tablets);
  var trevoga = Number(data.trevoga);
  var nervoznost = Number(data.nervoznost);
  var stress = Number(data.stress);
  var vsego = Number(data.vsego);
  var nums = [score, tablets, trevoga, nervoznost, stress, vsego];
  var labels = ['score', 'tablets', 'trevoga', 'nervoznost', 'stress', 'vsego'];
  for (var i = 0; i < nums.length; i++) {
    if (!isFinite(nums[i]) || nums[i] < 0) {
      var e2 = { ok: false, error: 'invalid numeric field', field: labels[i], raw: data[labels[i]] };
      if (dbg) {
        e2._trace = traceGameResults_(data, 'reject: bad number ' + labels[i]);
      }
      return jsonOut(e2);
    }
  }
  var rowNum = findRowBySessionId_(sheet, sid);
  if (rowNum < 2) {
    if (!uid) {
      var e3 = { ok: false, error: 'row not found and uid missing for append' };
      if (dbg) {
        e3._trace = traceGameResults_(data, 'reject: no row, no uid');
      }
      return jsonOut(e3);
    }
    var entryCell = entryRaw ? formatEntry_(entryRaw) : formatEntry_(new Date().toISOString());
    sheet.appendRow([entryCell, sid, uid, 0, score, tablets, trevoga, nervoznost, stress, vsego, '']);
    syncProfileIfEmpty_(ensureProfilesSheet_(ss), uid, tgNameGr);
    var r = sheet.getLastRow();
    if (dbg) {
      Logger.log('game_results append row=' + r + ' sid=' + sid.slice(0, 12));
    }
    return jsonOut({
      ok: true,
      mode: 'game_results_append',
      row: r,
      _trace: dbg ? 'appended full row with E–J' : undefined
    });
  }
  // getRange(row, col, numRows, numColumns) — не «конечная ячейка»; иначе получается rowNum строк × 10 столбцов
  sheet.getRange(rowNum, 5, 1, 6).setValues([[score, tablets, trevoga, nervoznost, stress, vsego]]);
  var uidForSync = uid;
  if (!uidForSync && rowNum >= 2) {
    uidForSync = String(sheet.getRange(rowNum, 3).getValue() || '').trim();
  }
  syncProfileIfEmpty_(ensureProfilesSheet_(ss), uidForSync, tgNameGr);
  if (dbg) {
    Logger.log('game_results update row=' + rowNum + ' E–J; имя — только «Профили»');
  }
  return jsonOut({
    ok: true,
    mode: 'game_results',
    row: rowNum,
    _trace: dbg ? 'updated E–J on existing row' : undefined
  });
}

function findRowBySessionId_(sheet, sid) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return -1;
  }
  var numRows = Math.max(0, lastRow - 1);
  var colB = numRows > 0 ? sheet.getRange(2, 2, numRows, 1).getValues() : [];
  for (var i = 0; i < colB.length; i++) {
    if (String(colB[i][0]).trim() === sid) {
      return i + 2;
    }
  }
  return -1;
}

function formatEntry_(iso) {
  var d = new Date(iso);
  if (isNaN(d.getTime())) {
    return iso;
  }
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss');
}

function randomInt_(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Ищет sid в колонке B (со строки 2), прибавляет delta к колонке D.
 */
function updateDurationBySessionId_(sheet, sid, delta) {
  var rowNum = findRowBySessionId_(sheet, sid);
  if (rowNum < 2) {
    return false;
  }
  var cell = sheet.getRange(rowNum, 4);
  var current = Number(cell.getValue());
  if (isNaN(current)) {
    current = 0;
  }
  cell.setValue(current + delta);
  return true;
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function leaderboardNum_(v) {
  var n = Number(v);
  return isFinite(n) ? n : 0;
}

/** Строка учёта сессии: есть session_id (B) и user_id (C). */
function isTrackingSessionRow_(row) {
  if (!row || row.length < 3) {
    return false;
  }
  var sid = String(row[1] != null ? row[1] : '').trim();
  var uid = String(row[2] != null ? row[2] : '').trim();
  return sid !== '' && uid !== '';
}

/** Строка с итогом игры: в E записан score (в т.ч. 0). */
function isCompletedSessionRow_(row) {
  if (!row || row.length < 10) {
    return false;
  }
  var raw = row[4];
  if (raw === '' || raw === null) {
    return false;
  }
  var score = Number(raw);
  return isFinite(score) && score >= 0;
}

function leaderboardGapAbove_(myVal, aboveVal) {
  if (myVal < aboveVal) {
    return Math.ceil(aboveVal - myVal - 1e-9);
  }
  return 1;
}

function buildMeRankBlock_(sorted, getValue, meUid) {
  var uid = String(meUid || '').trim();
  var idx = -1;
  for (var i = 0; i < sorted.length; i++) {
    if (String(sorted[i].uid) === uid) {
      idx = i;
      break;
    }
  }
  var myEntry = idx >= 0 ? sorted[idx] : null;
  var myVal = myEntry ? getValue(myEntry) : 0;
  var myName = myEntry && myEntry.tgName ? String(myEntry.tgName) : '';
  var rank = idx >= 0 ? idx + 1 : null;
  var inTop10 = rank !== null && rank <= 10;

  var gapToTenth = null;
  var gapToNextAbove = null;

  if (sorted.length >= 10) {
    var tenthVal = getValue(sorted[9]);
    if (rank === null || rank > 10) {
      if (myVal < tenthVal) {
        gapToTenth = Math.ceil(tenthVal - myVal - 1e-9);
      } else {
        gapToTenth = 1;
      }
    }
  }

  if (rank !== null && rank > 1) {
    var aboveVal = getValue(sorted[rank - 2]);
    gapToNextAbove = leaderboardGapAbove_(myVal, aboveVal);
  }

  return {
    rank: rank,
    uid: uid,
    tgName: myName,
    value: myVal,
    inTop10: inTop10,
    gapToTenth: gapToTenth,
    gapToNextAbove: gapToNextAbove
  };
}

function buildCategory_(list, getValue, meUid) {
  var sorted = list.slice().sort(function (a, b) {
    var va = getValue(a);
    var vb = getValue(b);
    if (vb !== va) {
      return vb - va;
    }
    return String(a.uid).localeCompare(String(b.uid));
  });
  var top10 = [];
  var n = Math.min(10, sorted.length);
  for (var i = 0; i < n; i++) {
    top10.push({
      rank: i + 1,
      uid: sorted[i].uid,
      tgName: sorted[i].tgName || String(sorted[i].uid),
      value: getValue(sorted[i])
    });
  }
  return {
    top10: top10,
    me: buildMeRankBlock_(sorted, getValue, meUid),
    playersTotal: sorted.length
  };
}

function handleLeaderboard_(ss, sheet, data) {
  var meUid = String(data.uid || '').trim();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    var emptyList = [];
    return jsonOut({
      ok: true,
      empty: true,
      playersTotal: 0,
      score: buildCategory_(emptyList, function (x) {
        return x.totalScore;
      }, meUid),
      symptoms: buildCategory_(emptyList, function (x) {
        return x.totalVsego;
      }, meUid),
      tablets: buildCategory_(emptyList, function (x) {
        return x.totalTablets;
      }, meUid),
      sessions: buildCategory_(emptyList, function (x) {
        return x.sessions;
      }, meUid),
      time: buildCategory_(emptyList, function (x) {
        return x.totalTime;
      }, meUid)
    });
  }
  var numRows = lastRow - 1;
  var values = sheet.getRange(2, 1, numRows, 11).getValues();

  var agg = {};
  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    if (!isTrackingSessionRow_(row)) {
      continue;
    }
    var uid = String(row[2] != null ? row[2] : '').trim();
    var dur = leaderboardNum_(row[3]);
    var nameCell = row.length >= 11 ? normalizeTgName_(row[10]) : '';

    if (!agg[uid]) {
      agg[uid] = {
        uid: uid,
        tgName: '',
        totalScore: 0,
        totalVsego: 0,
        totalTablets: 0,
        sessions: 0,
        totalTime: 0
      };
    }
    var a = agg[uid];
    if (nameCell) {
      a.tgName = nameCell;
    }
    a.sessions += 1;
    a.totalTime += dur;

    if (isCompletedSessionRow_(row)) {
      var score = leaderboardNum_(row[4]);
      var tablets = leaderboardNum_(row[5]);
      var vsego = leaderboardNum_(row[9]);
      a.totalScore += score;
      a.totalVsego += vsego;
      a.totalTablets += tablets;
    }
  }

  var profLb = ensureProfilesSheet_(ss);
  for (var k2 in agg) {
    if (Object.prototype.hasOwnProperty.call(agg, k2)) {
      var pn = readProfileTgName_(profLb, k2);
      if (pn) {
        agg[k2].tgName = pn;
      }
    }
  }

  var list = [];
  for (var k in agg) {
    if (Object.prototype.hasOwnProperty.call(agg, k)) {
      list.push(agg[k]);
    }
  }

  return jsonOut({
    ok: true,
    empty: list.length === 0,
    playersTotal: list.length,
    score: buildCategory_(list, function (x) {
      return x.totalScore;
    }, meUid),
    symptoms: buildCategory_(list, function (x) {
      return x.totalVsego;
    }, meUid),
    tablets: buildCategory_(list, function (x) {
      return x.totalTablets;
    }, meUid),
    sessions: buildCategory_(list, function (x) {
      return x.sessions;
    }, meUid),
    time: buildCategory_(list, function (x) {
      return x.totalTime;
    }, meUid)
  });
}
