import { LoaderContext } from 'webpack';
import { TemplateParser } from '../template';
import { aliasManager, ComponentAlias } from '../template/alias';

export interface JingeLoaderOptions {
  componentAlias?: ComponentAlias;
}

export default function TemplateLoader(
  this: LoaderContext<JingeLoaderOptions>,
  source: string
) {
  const callback = this.async();
  if (this._compiler.parentCompilation) {
    return callback(null, source);
  }

  aliasManager.initialize((this.query as JingeLoaderOptions)?.componentAlias);

  TemplateParser.parse(source.toString(), {
    resourcePath: this.resourcePath,
    addDebugName: this._compiler.options.mode !== 'production',
    emitErrorFn: (err: unknown) => {
      this.emitError(err as Error);
    },
  }).then(({ code, ast }) => {
    callback(null, code, undefined, ast || undefined);
  }, callback);
}
