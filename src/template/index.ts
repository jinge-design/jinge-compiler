import { parse } from '@jingeweb/html5parser';
import { SYMBOL_POSTFIX } from '../util';
import { aliasManager } from './alias';
import { TemplateVisitor } from './visitor';
import { replaceTplStr } from './visitor/helper';
import { EMPTY, ERROR } from './visitor/tpl';

export interface TemplateParserOptions {
  resourcePath: string;
  emitErrorFn: (err: unknown) => void;
  addDebugName: boolean;
}

export class TemplateParser {
  static aliasManager = aliasManager;
  static _parse(content: string, options: TemplateParserOptions) {
    function cl(s: string) {
      return s ? '\n' + s : '';
    }
    const tplParser = new TemplateParser(options);
    const result = tplParser.parse(content);
    const depRegex = new RegExp(`([\\w$_][\\w\\d$_]+)${SYMBOL_POSTFIX}\\b`, 'g');
    const imports = [...new Set([...result.renderFn.matchAll(depRegex)].map((m) => m[1]))].map(
      (d) => `${d} as ${d}${SYMBOL_POSTFIX}`,
    );
    return {
      code:
        `import {  ${imports.join(', ')} } from 'jinge';` +
        cl(result.aliasImports) +
        cl(result.imports) +
        `\nexport default ${result.renderFn}`,
    };
  }

  static async parse(content: string, options: TemplateParserOptions) {
    return new Promise<{ code: string }>((resolve, reject) => {
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
        renderFn: replaceTplStr(EMPTY, {
          POSTFIX: SYMBOL_POSTFIX,
        }),
      };
    }
    const inodes = parse(source, {
      setAttributeMap: false,
    });
    const visitor = new TemplateVisitor({
      source,
      emitErrorFn: this.emitErrorFn,
      resourcePath: this.resourcePath,
      addDebugName: this.addDebugName,
    });
    try {
      return visitor.visitHtml(inodes);
    } catch (ex) {
      this.emitErrorFn(ex);
      return {
        aliasImports: '',
        imports: '',
        renderFn: replaceTplStr(ERROR, {
          POSTFIX: SYMBOL_POSTFIX,
        }),
      };
    }
  }
}
