import { LoaderContext } from 'webpack';
import { RawSourceMap } from 'source-map';
import { ComponentParser } from '../component';

export default function ComponentLoader(this: LoaderContext<unknown>, source: string, sourceMap?: RawSourceMap) {
  const callback = this.async();
  if (this._compiler.parentCompilation) {
    return callback(null, source, sourceMap);
  }

  ComponentParser.parse(source.toString(), sourceMap, {
    resourcePath: this.resourcePath,
    emitErrorFn: (err: unknown) => {
      this.emitError(err as Error);
    },
  }).then(({ code, map, ast }) => {
    callback(null, code, map || undefined, ast || undefined);
  }, callback);
}
