import { LoaderContext } from 'webpack';
import { RawSourceMap } from 'source-map';
import { ComponentParser } from '../component';

export default function ComponentLoader(this: LoaderContext<unknown>, source: string, sourceMap?: RawSourceMap) {
  const { code, map, ast } = ComponentParser.parse(source.toString(), sourceMap, {
    resourcePath: this.resourcePath,
    emitErrorFn: (err: unknown) => {
      this.emitError(err as Error);
    },
  });

  this.callback(null, code, map || undefined, ast || undefined);
}
