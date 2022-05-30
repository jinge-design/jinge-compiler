import { LoaderContext } from 'webpack';
import { RawSourceMap } from 'source-map';
import { TemplateParser } from './template';
import { ComponentParser } from './component';
// import { sharedOptions, checkCompressOption } from './options';
// import { getSymbolPostfix } from './util';
import { aliasManager, ComponentAlias } from './alias';

export interface JingeLoaderOptions {
  // symbolPostfix?: string;
  componentAlias?: ComponentAlias;
}
let inited = false;
// let i18nDepImported = false;
function initialize(loaderOpts: JingeLoaderOptions) {
  // if ('compress' in sharedOptions) {
  //   Object.assign(sharedOptions, {
  //     compress: checkCompressOption(webpackOpts),
  //   });
  // }

  aliasManager.initialize(loaderOpts.componentAlias);
}

let warn = false;

export default function jingeLoader(this: LoaderContext<unknown>, source: string, sourceMap?: RawSourceMap) {
  const callback = this.async();
  if (this._compiler.parentCompilation) {
    return callback(null, source, sourceMap);
  }
  const resourcePath = this.resourcePath;
  const opts = this.query || {};

  if (!inited) {
    initialize(opts);
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
    addDebugName: this._compiler.options.mode !== 'production',
    emitErrorFn: (err: unknown) => {
      this.emitError(err as Error);
    },
  };
  const Parser = resourcePath.endsWith('.html') ? TemplateParser : ComponentParser;
  Parser.parse(source.toString(), sourceMap, parseOpts).then(({ code, map }) => {
    // if (sharedOptions.i18n && !i18nDepImported) {
    //   i18nDepImported = true;
    //   code = `import 'jinge/lib/${i18nRenderDepsRegisterFile}';` + code;
    // }
    callback(null, code, map || null);
  }, callback);
}
