import { LoaderContext } from 'webpack';
import { sharedOptions } from '../options';
import { parse, ParseErr } from './helper';
import { TemplateVisitor } from './visitor/visitor';

import * as TPL from './visitor/tpl';
import { replaceTplStr } from './visitor/helper';

export interface JingeTemplateParserOptions {
  resourcePath: string;
  baseLinePosition: number;
  webpackLoaderContext: LoaderContext<unknown>;
  wrapCode: boolean;
}

export class JingeTemplateParser {
  static _parse(content: string, options: JingeTemplateParserOptions) {
    function cl(s: string) {
      return s ? '\n' + s : '';
    }
    const tplParser = new JingeTemplateParser(options);
    const result = tplParser.parse(content);
    const depRegex = new RegExp(`([\\w$_][\\w\\d$_]+)${sharedOptions.symbolPostfix}\\b`, 'g');
    const imports = [
      ...new Set(
        [...result.renderFn.matchAll(depRegex), ...(result.i18nDeps ? result.i18nDeps.matchAll(depRegex) : [])].map(
          (m) => m[1],
        ),
      ),
    ].map((d) => `${d} as ${d}${sharedOptions.symbolPostfix}`);
    return options.wrapCode !== false
      ? {
          code:
            `import {  ${imports.join(', ')} } from 'jinge';` +
            cl(result.aliasImports) +
            cl(result.imports) +
            cl(result.i18nDeps) +
            `\nexport default ${result.renderFn}`,
        }
      : {
          globalImports: imports,
          i18nDeps: result.i18nDeps,
          aliasImports: result.aliasImports,
          localImports: result.imports,
          renderFn: result.renderFn,
        };
  }

  static async parse(content: string, sourceMap: unknown, options: JingeTemplateParserOptions) {
    return new Promise((resolve, reject) => {
      try {
        resolve(JingeTemplateParser._parse(content, options));
      } catch (err) {
        reject(err);
      }
    });
  }

  resourcePath: string;
  baseLinePosition: number;
  webpackLoaderContext: LoaderContext<unknown>;

  constructor(options: JingeTemplateParserOptions) {
    this.resourcePath = options.resourcePath;
    this.baseLinePosition = options.baseLinePosition || 1;
    this.webpackLoaderContext = options.webpackLoaderContext;
  }

  parse(source: string) {
    if (!source.trim()) {
      return {
        aliasImports: '',
        imports: '',
        renderFn: replaceTplStr(TPL.EMPTY, {
          POSTFIX: sharedOptions.symbolPostfix,
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
          POSTFIX: sharedOptions.symbolPostfix,
        }),
      };
    }
    const visitor = new TemplateVisitor({
      source: source,
      webpackLoaderContext: this.webpackLoaderContext,
      baseLinePosition: this.baseLinePosition,
      resourcePath: this.resourcePath,
    });
    try {
      return visitor.visit(tree);
    } catch (ex) {
      this.webpackLoaderContext.emitError(ex);
      return {
        aliasImports: '',
        imports: '',
        renderFn: replaceTplStr(TPL.ERROR, {
          POSTFIX: sharedOptions.symbolPostfix,
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
    this.webpackLoaderContext.emitError(
      new Error(`Error occur at line ${tokenPosition.line + this.baseLinePosition - 1}, column ${tokenPosition.column}:
> ${source.substring(idx, eidx > idx ? eidx : source.length)}
> ${this.resourcePath}
> ${msg}`),
    );
  }
}
