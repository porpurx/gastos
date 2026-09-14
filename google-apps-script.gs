// Backend for Gastos: stores the app data in this Google Sheet. Setup steps are in README.md.
// Every sync writes one row per day on the "Copias" sheet (the latest row is the current data),
// so the sheet doubles as a history of daily backups.

const TOKEN = 'CAMBIA-ESTE-TOKEN'; // same secret you type in the app (Ajustes > Copia automática)
const KEEP = 60;                   // daily backups kept
const CHUNK = 45000;               // a cell holds up to 50,000 characters

function doPost(e) {
  const out = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return out({ ok: false, error: 'Solicitud no válida' });
  }
  if (TOKEN === 'CAMBIA-ESTE-TOKEN') return out({ ok: false, error: 'Cambia el TOKEN en el script' });
  if (req.token !== TOKEN) return out({ ok: false, error: 'Token incorrecto' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const book = SpreadsheetApp.getActive();
    const sheet = book.getSheetByName('Copias') || book.insertSheet('Copias');
    const last = sheet.getLastRow();

    if (req.action === 'load') {
      if (!last) return out({ ok: true, data: null });
      const row = sheet.getRange(last, 1, 1, sheet.getLastColumn()).getValues()[0];
      return out({ ok: true, data: JSON.parse(row.slice(3).join('')) });
    }

    if (req.action === 'save') {
      const json = JSON.stringify(req.data);
      const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
      const row = [now, req.device || '', String(json.length)].concat(json.match(new RegExp('[\\s\\S]{1,' + CHUNK + '}', 'g')));
      // Same day: replace that day's row instead of adding another.
      if (last && String(sheet.getRange(last, 1).getValue()).slice(0, 10) === now.slice(0, 10)) sheet.deleteRow(last);
      const range = sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length);
      range.setNumberFormat('@'); // plain text, so Sheets never turns a chunk into a number or formula
      range.setValues([row]);
      if (sheet.getLastRow() > KEEP) sheet.deleteRows(1, sheet.getLastRow() - KEEP);
      return out({ ok: true });
    }

    return out({ ok: false, error: 'Acción no válida' });
  } finally {
    lock.releaseLock();
  }
}
