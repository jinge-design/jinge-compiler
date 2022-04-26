import { LoaderContext, RawLoaderDefinitionFunction, WebpackOptionsNormalized } from 'webpack';
import { TemplateParser } from './template';
import { ComponentParser, componentBaseManager } from './component';
import { sharedOptions, checkCompressOption } from './options';
import { getSymbolPostfix } from './util';
import { aliasManager, ComponentAlias } from './alias';
import { i18nManager, i18nRenderDepsRegisterFile } from './i18n';
import { ComponentBase } from './component/base';

export interface JingeLoaderOptions {
  /** 用于解决潜在冲突的变量名后缀。通常不需要指定该参数，由编译器自动处理。 */
  symbolPostfix?: string;
  componentBase?: ComponentBase;
  componentAlias?: ComponentAlias;
}
let inited = false;
let i18nDepImported = false;
function initialize(loaderOpts: JingeLoaderOptions, webpackOpts: WebpackOptionsNormalized) {
  if (loaderOpts.symbolPostfix) {
    if (sharedOptions.symbolPostfix && loaderOpts.symbolPostfix !== sharedOptions.symbolPostfix) {
      throw new Error('conflict symbolPostfix');
    }
    sharedOptions.symbolPostfix = loaderOpts.symbolPostfix;
  }
  if (!sharedOptions.symbolPostfix) {
    sharedOptions.symbolPostfix = getSymbolPostfix();
  }
  if ('compress' in sharedOptions) {
    Object.assign(sharedOptions, {
      compress: checkCompressOption(webpackOpts),
    });
  }
  sharedOptions.publicPath = (webpackOpts.output.publicPath || '') as string;

  if (sharedOptions.i18n) {
    i18nManager.initialize();
  }

  componentBaseManager.initialize(loaderOpts.componentBase);
  aliasManager.initialize(loaderOpts.componentAlias);
}

let warn = false;
type P = Parameters<RawLoaderDefinitionFunction>;

export default function jingeLoader(this: LoaderContext<unknown>, source: P[0], sourceMap?: P[1]) {
  const callback = this.async();
  if (this._compiler.parentCompilation) {
    return callback(null, source, sourceMap);
  }
  const resourcePath = this.resourcePath;
  const opts = this.query || {};

  if (!inited) {
    initialize(opts, this._compiler.options);
    inited = true;
  }

  if (!/\.(ts|js|html)$/.test(resourcePath)) {
    return callback(new Error('jingeLoader only support .ts,.js,.html file'));
  }
  if (!/\.c\.(ts|js|html)$/.test(resourcePath) && !warn) {
    warn = true;
    this.emitWarning(new Error('it is recommended to use `.c.(ts|js|html)` as component file suffix'));
  }
  const parseOpts = {
    resourcePath,
    webpackLoaderContext: this,
  };
  const Parser = resourcePath.endsWith('.html') ? TemplateParser : ComponentParser;
  Parser.parse(source.toString(), sourceMap, parseOpts).then(({ code, map }) => {
    if (sharedOptions.i18n && !i18nDepImported) {
      i18nDepImported = true;
      code = `import 'jinge/lib/${i18nRenderDepsRegisterFile}';` + code;
    }
    callback(null, code, map || null);
  }, callback);
}
