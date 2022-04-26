const { readFileSync } = require('fs');
const path = require('path');
const { parse: csvParse } = require('csv-parse/sync');
const sharedOptions = require('../options').default;

function parseCsvContent(locale) {
  const defaultLocale = sharedOptions.i18n.defaultLocale;
  const content = readFileSync(path.join(sharedOptions.i18n.translateDir, `translate.${locale}.csv`), 'utf-8');
  const csvStore = {
    /** 原始 csv 的所有行数据 */
    rows: csvParse(content, { columns: true }),
    /** 将相同的原始语言（defaultLocale）文本聚合后的记录 */
    record: new Map(),
  };

  csvStore.rows.forEach((row, i) => {
    if (!row || !(defaultLocale in row) || !(locale in row)) {
      throw new Error(`Bad format for "translate.${locale}.csv". Wrong line format at ${i}. see https://todo.`);
    }
    let record = csvStore.get(row[defaultLocale]);
    if (!record) {
      record = {
        allSame: true, // 对于同一个中文文本，是否翻译的文本全部相同
        firstText: row[targetLocale],
        entries: new Map(),
      };
      targetMeta.set(row[defaultLocale], translateInfo);
    } else {
      if (translateInfo.firstText !== row[targetLocale]) {
        translateInfo.allSame = false;
      }
    }
    if (record.entries.has(row.location)) {
      throw new Error(
        `dulplicate csv entry at both line ${
          translateInfo.entries.get(row.location).lineAt
        } and line ${i} in "translate.${targetLocale}.csv"`,
      );
    }
    record.entries.set(row.location, {
      lineAt: i, // 在 csv 文件中的行号
      key: null, // 预留字段
      text: row[targetLocale], // 翻译后的文本
    });
  });
}

function loadTranslateCsv() {
  
  sharedOptions.targetLocales.forEach((locale) => {

  })
}