import crypto from 'crypto';
// import { sharedOptions } from './options';
import { SYMBOL_POSTFIX, isArray, isObject } from './util';

export type ComponentAlias = Record<string, Record<string, string | string[]>>;

function mergeAlias(src: ComponentAlias, dst: ComponentAlias) {
  if (!dst) return src;
  for (const k in src) {
    if (!isObject(src[k])) throw new Error('bad alias format');
    if (k in dst) {
      Object.assign(dst[k], src[k]);
    } else {
      dst[k] = src[k];
    }
  }
  return dst;
}

export class ComponentAliasManager {
  aliasPostfix: string;
  alias: Record<string, [string, string]>;
  localMap: Record<string, Record<string, string>>;

  constructor() {
    this.aliasPostfix = '';
    this.alias = {};
    this.localMap = {};
  }

  getComponentOfAlias(etag: string, imports: Record<string, string[]>) {
    if (!(etag in this.alias)) return null;
    const [c, source] = this.alias[etag];
    let arr = imports[source];
    if (!arr) {
      arr = imports[source] = [];
    }
    if (arr.indexOf(c) < 0) {
      arr.push(c);
    }
    return this.localMap[source][c];
  }

  getCode(imports: Record<string, string[]>) {
    return Object.keys(imports)
      .map((source) => {
        return `import { ${imports[source]
          .map((c) => `${c} as ${this.localMap[source][c]}`)
          .join(', ')} } from '${source}';`;
      })
      .join('\n');
  }

  initialize(componentAlias: ComponentAlias) {
    this.aliasPostfix =
      '_' + crypto.createHmac('sha256', 'component-alias-postfix').update(SYMBOL_POSTFIX).digest('hex').slice(0, 12);
    if (Array.isArray(componentAlias)) {
      componentAlias = Object.assign({}, ...componentAlias);
    }
    componentAlias = mergeAlias(componentAlias || {}, {
      jinge: {
        LogComponent: 'log',
        // I18nComponent: 'i18n',
        IfComponent: 'if',
        ForComponent: 'for',
        SwitchComponent: 'switch',
        HideComponent: 'hide',
        BindHtmlComponent: 'bind-html',
        ToggleClassComponent: 'toggle-class',
        DynamicRenderComponent: 'dynamic',
      },
    });
    for (const source in componentAlias) {
      const m = componentAlias[source];
      if (!this.localMap[source]) {
        this.localMap[source] = {};
      }
      if (source.startsWith('.')) {
        throw new Error('component base source must be absolute path or package under node_modules');
      }
      const hash = crypto.createHash('md5');
      const postfix = '_' + hash.update(source).digest('hex').slice(0, 12) + this.aliasPostfix;
      Object.keys(m).map((c, i) => {
        if (!(c in this.localMap[source])) {
          this.localMap[source][c] = (c === 'default' ? 'Component_default_' + i : c) + postfix;
        }
        const as = isArray(m[c]) ? (m[c] as string[]) : [m[c] as string];
        as.forEach((a) => {
          this.alias[a] = [c, source];
        });
      });
    }
  }
}

// singleton
export const aliasManager = new ComponentAliasManager();
