import { LoaderContext } from 'webpack';
import { TemplateParser } from '../template';
import { aliasManager, ComponentAlias } from '../template/alias';

export interface JingeLoaderOptions {
  componentAlias?: ComponentAlias;
}

export default function TemplateLoader(this: LoaderContext<JingeLoaderOptions>, source: string) {
  aliasManager.initialize((this.query as JingeLoaderOptions)?.componentAlias);
  const { code } = TemplateParser.parse(source.toString(), {
    resourcePath: this.resourcePath,
    addDebugName: this._compiler.options.mode !== 'production',
    emitErrorFn: (err: unknown) => {
      this.emitError(err as Error);
    },
  });
  return code;
}
