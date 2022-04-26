import path from 'path';
import { isArray } from 'src/util';

type ComponentBaseItem = Record<string, string | string[]>;
export type ComponentBase = ComponentBaseItem | ComponentBaseItem[];

function prepareComponentBase(componentBase: ComponentBase) {
  if (isArray(componentBase)) {
    componentBase = Object.assign({}, ...(componentBase as ComponentBaseItem[]));
  } else if (!componentBase) {
    componentBase = {};
  }
  return componentBase as ComponentBaseItem;
}
export class ComponentBaseManager {
  /** @internal */
  componentBase: Record<string, string[]>;
  /** @internal */
  componentBaseLocals: Map<string, boolean>;

  constructor() {
    this.componentBase = null;
    this.componentBaseLocals = new Map();
  }

  initialize(componentBase: ComponentBase) {
    const defaultBase: Record<string, string[]> = {
      Component: [
        path.resolve(__dirname, '../../lib/index.js'),
        path.resolve(__dirname, '../../lib/core/component.js'),
        path.resolve(__dirname, '../../lib/core/index.js'),
      ],
    };
    componentBase = prepareComponentBase(componentBase);
    for (const n in componentBase) {
      const v = isArray(componentBase[n]) ? (componentBase[n] as string[]) : [componentBase[n] as string];
      if (n in defaultBase) {
        defaultBase[n] = defaultBase[n].concat(v);
      } else {
        defaultBase[n] = v;
      }
    }
    this.componentBase = defaultBase;
  }
}

// singleton
export const componentBaseManager = new ComponentBaseManager();
