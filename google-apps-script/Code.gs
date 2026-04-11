/**
 * Веб-приложение Google Apps Script: развернуть как «Веб-приложение»,
 * доступ «Все», выполнять от имени владельца.
 *
 * В таблице (первый лист): A — дата/время входа, B — session id (uuid),
 * C — user id из utm_medium, D — длительность сессии (сек),
 * E — score, F — tablets, G — тревога, H — нервозность, I — стресс, J — всего, K — tg_name.
 *
 * POST, тело JSON в e.postData.contents:
 *   { "entry": "<ISO>", "sid": "<uuid>", "uid": "<digits>", "sec": number, "tg_name": "..." (опционально) }
 *   sec > 0  — первая запись строки: записать sec как начальную длительность (клиент шлёт 5–23).
 *   sec === 0 — обновление: найти строку с sid в колонке B и прибавить к D случайное 20–29.
 *
 * Итог игры (экран game over):
 *   { "cmd": "game_results", "sid", "uid", "entry", "tg_name" (опц.), "score", … "vsego" }
 *   Если строки с таким sid ещё нет — добавляется новая строка (гонка с первым пингом).
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

    if (String(data.cmd || '') === 'game_results') {
      return handleGameResults_(sheet, data);
    }

    var entry = String(data.entry || '');
    var sid = String(data.sid || '');
    var uid = String(data.uid || '');
    var sec = Number(data.sec);
    var tgName = normalizeTgName_(data.tg_name);

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
        writeTgNameCellIfPresent_(sheet, rowFirst, tgName);
        return jsonOut({ ok: true, mode: 'prime_duration' });
      }
      sheet.appendRow(trackingRowValues_(formatEntry_(entry), sid, uid, sec, tgName));
      return jsonOut({ ok: true, mode: 'append' });
    }

    var added = randomInt_(20, 29);
    var updated = updateDurationBySessionId_(sheet, sid, added);
    var rowAfter = findRowBySessionId_(sheet, sid);
    writeTgNameCellIfPresent_(sheet, rowAfter, tgName);
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

/** Одна строка трекинга: A–D заполнены, E–J пустые, K — tg_name */
function trackingRowValues_(entryCell, sid, uid, sec, tgName) {
  return [entryCell, sid, uid, sec, '', '', '', '', '', '', tgName || ''];
}

function normalizeTgName_(v) {
  var s = String(v != null ? v : '').trim();
  if (s.length > 500) {
    s = s.substring(0, 500);
  }
  return s;
}

function writeTgNameCellIfPresent_(sheet, rowNum, tgName) {
  if (rowNum < 2 || !tgName) {
    return;
  }
  sheet.getRange(rowNum, 11).setValue(tgName);
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

function handleGameResults_(sheet, data) {
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
  var tgNameGr = normalizeTgName_(data.tg_name);
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
    sheet.appendRow([entryCell, sid, uid, 0, score, tablets, trevoga, nervoznost, stress, vsego, tgNameGr]);
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
  writeTgNameCellIfPresent_(sheet, rowNum, tgNameGr);
  if (dbg) {
    Logger.log('game_results update row=' + rowNum + ' E–J, K if tg_name');
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
