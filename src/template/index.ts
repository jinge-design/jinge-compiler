import { SYMBOL_POSTFIX } from '../util';
import { parse, ParseErr } from './helper';
import { TemplateVisitor } from './visitor/visitor';

import * as TPL from './visitor/tpl';
import { replaceTplStr } from './visitor/helper';

export interface TemplateParserOptions {
  resourcePath: string;
  emitErrorFn: (err: unknown) => void;
  addDebugName: boolean;
}

export class TemplateParser {
  static _parse(content: string, options: TemplateParserOptions) {
    function cl(s: string) {
      return s ? '\n' + s : '';
    }
    const tplParser = new TemplateParser(options);
    const result = tplParser.parse(content);
    const depRegex = new RegExp(`([\\w$_][\\w\\d$_]+)${SYMBOL_POSTFIX}\\b`, 'g');
    const imports = [
      ...new Set(
        [
          ...result.renderFn.matchAll(depRegex)
        ].map((m) => m[1]),
      ),
    ].map((d) => `${d} as ${d}${SYMBOL_POSTFIX}`);
    return {
      code:
        `import {  ${imports.join(', ')} } from 'jinge';` +
        cl(result.aliasImports) +
        cl(result.imports) +
        `\nexport default ${result.renderFn}`,
    }
  }

  static async parse(content: string, options: TemplateParserOptions) {
    return new Promise((resolve, reject) => {
      try {
        resolve(TemplateParser._parse(content, options));
      } catch (err) {
        reject(err);
      }
    });
  }

  resourcePath: string;
  emitErrorFn: (err: unknown) => void;
  addDebugName: boolean;

  constructor(options: TemplateParserOptions) {
    this.resourcePath = options.resourcePath;
    this.emitErrorFn = options.emitErrorFn;
    this.addDebugName = options.addDebugName;
  }

  parse(source: string) {
    if (!source.trim()) {
      return {
        aliasImports: '',
        imports: '',
        renderFn: replaceTplStr(TPL.EMPTY, {
          POSTFIX: SYMBOL_POSTFIX,
        }),
      };
    }
    const [meetErr, tree] = parse(source);
    if (meetErr) {
      this._logParseError(source, meetErr, 'syntax of template is error.');
      return {
        aliasImports: '',
        imports: '',
        renderFn: replaceTplStr(TPL.ERROR, {
          POSTFIX: SYMBOL_POSTFIX,
        }),
      };
    }
    const visitor = new TemplateVisitor({
      source: source,
      emitErrorFn: this.emitErrorFn,
      resourcePath: this.resourcePath,
      addDebugName: this.addDebugName,
    });
    try {
      return visitor.visit(tree);
    } catch (ex) {
      this.emitErrorFn(ex);
      return {
        aliasImports: '',
        imports: '',
        renderFn: replaceTplStr(TPL.ERROR, {
          POSTFIX: SYMBOL_POSTFIX,
        }),
      };
    }
  }

  _logParseError(source: string, tokenPosition: ParseErr, msg: string) {
    let idx = -1;
    for (let i = 0; i < tokenPosition.line - 1; i++) {
      idx = source.indexOf('\n', idx + 1);
    }
    idx = idx + 1;
    const eidx = source.indexOf('\n', idx);
    this.emitErrorFn(
      new Error(`Error occur at line ${tokenPosition.line}, column ${tokenPosition.column}:
> ${source.substring(idx, eidx > idx ? eidx : source.length)}
> ${this.resourcePath}
> ${msg}`),
    );
  }
}
