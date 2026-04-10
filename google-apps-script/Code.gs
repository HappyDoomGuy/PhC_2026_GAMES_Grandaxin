/**
 * Веб-приложение Google Apps Script: развернуть как «Веб-приложение»,
 * доступ «Все», выполнять от имени владельца.
 *
 * В таблице (первый лист): A — дата/время входа, B — session id (uuid),
 * C — user id из utm_medium, D — длительность сессии (сек).
 *
 * POST, тело JSON в e.postData.contents:
 *   { "entry": "<ISO>", "sid": "<uuid>", "uid": "<digits>", "sec": number }
 *   sec > 0  — первая запись строки: записать sec как начальную длительность (клиент шлёт 5–23).
 *   sec === 0 — обновление: найти строку с sid в колонке B и прибавить к D случайное 20–29.
 */
var SPREADSHEET_ID = '';

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
    var entry = String(data.entry || '');
    var sid = String(data.sid || '');
    var uid = String(data.uid || '');
    var sec = Number(data.sec);

    if (!sid || !uid) {
      return jsonOut({ ok: false, error: 'sid and uid required' });
    }

    var ss = SpreadsheetApp.openById(id);
    var sheet = ss.getSheets()[0];
    ensureHeaders_(sheet);

    if (sec > 0) {
      sheet.appendRow([formatEntry_(entry), sid, uid, sec]);
      return jsonOut({ ok: true, mode: 'append' });
    }

    var added = randomInt_(20, 29);
    var updated = updateDurationBySessionId_(sheet, sid, added);
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

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() < 1 || sheet.getRange('A1').getValue() === '') {
    sheet.getRange(1, 1, 1, 4).setValues([[
      'entry_datetime',
      'session_id',
      'user_id',
      'session_duration_sec'
    ]]);
  }
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
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return false;
  }
  var colB = sheet.getRange(2, 2, lastRow, 2).getValues();
  for (var i = 0; i < colB.length; i++) {
    if (String(colB[i][0]) === sid) {
      var rowNum = i + 2;
      var cell = sheet.getRange(rowNum, 4);
      var current = Number(cell.getValue());
      if (isNaN(current)) {
        current = 0;
      }
      cell.setValue(current + delta);
      return true;
    }
  }
  return false;
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
