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

function cl(s: string) {
  return s ? '\n' + s : '';
}

const DEP_REGEX = new RegExp(`([\\w$_][\\w\\d$_]+)${SYMBOL_POSTFIX}\\b`, 'g');

export class TemplateParser {
  static aliasManager = aliasManager;

  static parse(content: string, options: TemplateParserOptions) {
    const tplParser = new TemplateParser(options);
    const result = tplParser.parse(content);
    const imports = [...new Set([...result.renderFn.matchAll(DEP_REGEX)].map((m) => m[1]))].map(
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

  static parse2(
    content: string,
    options: TemplateParserOptions,
  ): {
    /** jinge 库中需要 import 的依赖项 */
    jingeImports: string[];
    /** 通过 alias 注册的组件别名的依赖项的代码 */
    aliasImportsCode: string;
    /** 模板 html 代码中主动 import 的依赖项的代码 */
    templateImportsCode: string;
    /** 渲染函数的代码 */
    renderFnCode: string;
  } {
    const tplParser = new TemplateParser(options);
    const result = tplParser.parse(content);
    const imports = [...new Set([...result.renderFn.matchAll(DEP_REGEX)].map((m) => m[1]))].map(
      (d) => `${d} as ${d}${SYMBOL_POSTFIX}`,
    );
    return {
      jingeImports: imports,
      aliasImportsCode: result.aliasImports,
      templateImportsCode: result.imports,
      renderFnCode: result.renderFn,
    };
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
          MESSAGE: '`' + (ex.message || ex.toString()).replace(/ /g, '&nbsp;').replace(/\n/g, '<br/>') + '`',
          POSTFIX: SYMBOL_POSTFIX,
        }),
      };
    }
  }
}
