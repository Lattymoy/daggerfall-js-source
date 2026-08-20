// THE DATA TABLE (Q1) - DFU Utility/Table.cs ported whole. The quest
// machine's tables (Quests-StaticMessages, Quests-GlobalVars, the
// QuestLists, Quests-Places/Items/Foes/...) all ride this one reader:
// '-' starts a comment, '//' starts an inline comment, 'schema:'
// names the columns ('*' marks the primary key, '$' a quoted string
// literal), every other non-empty line is a row. Values are always
// strings; GetInt's int.TryParse failure answer is -1 (Table.cs:407).
// Duplicate keys warn and keep the FIRST row (LoadRow's else arm) -
// which is load-bearing for Quests-StaticMessages, whose case-variant
// alias rows (RumorsPostfailure/RumorsPostFailure) share one id.

const INLINE_COMMENT = '//';
const LITERAL = '"';
const SEPARATOR = ',';

const isIntString = (s) => /^-?\d+$/.test(s?.trim() ?? '');

export class Table {
  /** @param {string[]|string} source lines array, or whole text. */
  constructor(source = null) {
    this.columnCount = 0;
    this.primaryColumnIndex = -1;
    this.columns = null;
    this.columnIndexDict = new Map();
    this.hasStringLiteralInSchema = false;
    if (source !== null) this.loadTable(Array.isArray(source) ? source : source.split(/\r\n|\r|\n/));
  }

  get rowCount() { return this.columns?.[this.primaryColumnIndex]?.values.length ?? 0; }

  loadTable(lines) {
    this.columnCount = 0;
    this.primaryColumnIndex = -1;
    this.columns = null;
    this.columnIndexDict = new Map();
    for (let i = 0; i < lines.length; i++) {
      let text = lines[i].trim();
      if (text.startsWith('-')) continue;
      if (!text) continue;
      text = text.split(INLINE_COMMENT)[0];
      if (/^schema:/i.test(text)) { this._loadSchema(text); continue; }
      if (this.columnCount === 0 || this.primaryColumnIndex === -1) continue;
      this._loadRow(text, i);
    }
    if (this.columnCount === 0 || this.primaryColumnIndex === -1) {
      throw new Error('Schema not found in source table.');
    }
  }

  /** AddIntoTable: extra rows against the existing schema. */
  addIntoTable(lines) {
    for (let i = 0; i < lines.length; i++) {
      let text = lines[i].trim();
      if (text.startsWith('-')) continue;
      if (!text) continue;
      text = text.split(INLINE_COMMENT)[0];
      this._loadRow(text, i);
    }
  }

  hasColumn(name) { return this.columnIndexDict.has(name); }

  hasValue(key) { return this.columns[this.primaryColumnIndex].keyIndexDict.has(key); }

  getValue(columnName, key) {
    if (!this.hasColumn(columnName)) throw new Error(`GetValue() columnName '${columnName}' does not exist.`);
    if (typeof key === 'number') {
      // GetValue(columnName, index) overload
      if (key < 0 || key > this.rowCount) throw new Error(`GetValue() index '${key}' does not exist.`);
      return this.columns[this.columnIndexDict.get(columnName)].values[key];
    }
    if (!this.hasValue(key)) throw new Error(`GetValue() key '${key}' does not exist.`);
    const valueIndex = this.columns[this.primaryColumnIndex].keyIndexDict.get(key);
    return this.columns[this.columnIndexDict.get(columnName)].values[valueIndex];
  }

  /** int.TryParse fail -> -1 (Table.cs GetInt). */
  getInt(columnName, key) {
    const value = this.getValue(columnName, key);
    return isIntString(value) ? parseInt(value, 10) : -1;
  }

  getRowIndex(key) {
    if (this.columnCount < 1 || this.rowCount < 1) return -1;
    return this.columns[this.primaryColumnIndex].keyIndexDict.get(key) ?? -1;
  }

  getRow(keyOrIndex) {
    const index = typeof keyOrIndex === 'number' ? keyOrIndex : this.getRowIndex(keyOrIndex);
    if (index === -1 || this.columnCount < 1 || this.rowCount < 1 || index >= this.rowCount) return [];
    return this.columns.map((c) => c.values[index]);
  }

  getColumnIndex(name) { return this.hasColumn(name) ? this.columnIndexDict.get(name) : -1; }
  getColumnName(index) { return (this.columnCount < 1 || index >= this.columnCount) ? '' : this.columns[index].name; }

  _loadSchema(text) {
    const columnNames = text.split(':')[1].split(',');
    this.columnCount = columnNames.length;
    if (this.columnCount === 0) throw new Error('Table must have at least one column in schema');
    this.columns = [];
    for (let i = 0; i < columnNames.length; i++) {
      let name = columnNames[i].trim();
      if (name.startsWith('*')) {
        if (this.primaryColumnIndex !== -1) throw new Error('Only one column can be key.');
        this.primaryColumnIndex = i;
        name = name.slice(1);
      }
      let isStringLiteral = false;
      if (name.startsWith('$')) { isStringLiteral = true; name = name.slice(1); }
      this.columns.push({ name, values: [], keyIndexDict: new Map(), isStringLiteral });
      if (isStringLiteral) this.hasStringLiteralInSchema = true;
      this.columnIndexDict.set(name, i);
    }
    if (this.primaryColumnIndex === -1) throw new Error('Table must tag at least one column as primary using *.');
  }

  _loadRow(text, lineNumber) {
    let parts;
    if (this.hasStringLiteralInSchema) {
      parts = this._splitLine(text);
    } else {
      parts = text.split(SEPARATOR);
      if (parts.length !== this.columnCount) {
        throw new Error(`Row on line ${lineNumber} does not match schema. "${text}"`);
      }
    }
    for (let i = 0; i < parts.length; i++) {
      const value = parts[i].trim();
      this.columns[i].values.push(value);
      if (i === this.primaryColumnIndex) {
        if (this.columns[i].keyIndexDict.has(value)) {
          console.warn(`[table] Duplicate key found: ${value}`);   // Debug.LogErrorFormat; first row keeps the key
        } else {
          this.columns[i].keyIndexDict.set(value, this.columns[i].values.length - 1);
        }
      }
    }
  }

  /** The literal-aware splitter (Table.cs SplitLine), positionally verbatim. */
  _splitLine(text) {
    let position = 0;
    const substrings = [];
    for (let row = 0; row < this.columnCount; row++) {
      let result = '';
      if (this.columns[row].isStringLiteral) {
        let openedLiteral = false;
        while (position < text.length) {
          if (text[position] === LITERAL) { openedLiteral = true; position++; break; }
          position++;
        }
        if (openedLiteral) {
          const literalStart = position;
          let closedLiteral = false;
          while (position < text.length) {
            if (text[position] === LITERAL) {
              result = text.slice(literalStart, position);
              closedLiteral = true;
              position++;
              break;
            }
            position++;
          }
          if (closedLiteral) {
            while (position < text.length) { if (text[position++] === SEPARATOR) break; }
          } else {
            console.warn(`[table] read error on line '${text}': expected closing string literal`);
          }
        }
      } else {
        const dataStart = position;
        while (position < text.length) { if (text[position++] === SEPARATOR) break; }
        const length = position - dataStart;
        if (dataStart + length < text.length) result = text.slice(dataStart, dataStart + length - 1);
        else if (dataStart + length === text.length) result = text.slice(dataStart, dataStart + length);
        else result = '';
        if (result.endsWith(SEPARATOR)) result = result.slice(0, -1);
      }
      if (!this.columns[row].isStringLiteral) result = result.trim();
      substrings.push(result);
    }
    return substrings;
  }
}
