import { i18nManager } from '../../i18n';
import { sharedOptions } from '../../options';
import { prependTab } from '../../util';
import { replaceTpl } from './helper';
import { TranslateAttribute } from './parseAttributes';
import { parseAttributeValue } from './parseAttributeValue';
import { parseExpr } from './parseExpr';
import * as TPL from './tpl';
import { TemplateVisitor } from './visitor';

export function parseI18nAttribute(
  _visitor: TemplateVisitor,
  at: [string, TranslateAttribute],
  idx: number,
  isDOM: boolean,
) {
  const [aname, attr] = at;
  if (attr.type === 'const') {
    const key = i18nManager.registerToDict(attr.value, _visitor._resourcePath);
    return replaceTpl(isDOM ? TPL.ATTR_I18N_DOM_CONST : TPL.ATTR_I18N_COMP_CONST_ON, {
      ROOT_INDEX: idx.toString(),
      NAME: aname,
      I18N_KEY: JSON.stringify(key),
    });
  }

  const vmsArgs = ['vm_0', ..._visitor._vms.map((n, i) => `vm_${i + 1}`)].join(', ');
  const registerI18N = (code: string) => {
    [...code.matchAll(new RegExp(`[\\w\\d$_]+${sharedOptions.symbolPostfix}`, 'g'))].forEach((m) => {
      if (_visitor._i18nRenderDeps.keys.has(m[0])) return;
      _visitor._i18nRenderDeps.keys.set(m[0], true);
      const idx = i18nManager.registerRenderDep(m[0]);
      if (idx >= 0) {
        _visitor._i18nRenderDeps.codes.push(`i18n${sharedOptions.symbolPostfix}.__regDep(${idx}, ${m[0]});`);
      }
    });
  };
  const i18nKey = i18nManager.registerToAttr(
    attr.value,
    _visitor._resourcePath,
    (locale, text) => {
      const expr = parseAttributeValue(text || attr.value);
      let code;
      try {
        code = parseExpr(_visitor, expr, attr.ctx).join('\n');
      } catch (ex) {
        if (locale !== i18nManager.defaultLocale.name) {
          _visitor._webpackLoaderContext.emitError(
            new Error(`Parse i18n expression failed, locale: ${locale}, expression: ${text}`),
          );
        }
        throw ex;
      }
      code = replaceTpl(code, {
        ROOT_INDEX: '',
        RENDER_START: 'const __attrV = ',
        RENDER_END: `;\n      isDOM ? setAttribute${sharedOptions.symbolPostfix}(target, attrName, __attrV) : target[attrName] = __attrV;`,
        REL_COM: `component[$$${sharedOptions.symbolPostfix}]`,
      });
      registerI18N(code);
      return `function(target, attrName, isDOM, component, ${vmsArgs}) {\n${prependTab(code, true, 4)}\n  }`;
    },
    (code) => {
      registerI18N(code);
    },
  );

  return replaceTpl(isDOM ? TPL.ATTR_I18N_DOM_EXPR : TPL.ATTR_I18N_COMP_EXPR_ON, {
    ROOT_INDEX: idx.toString(),
    NAME: aname,
    I18N_KEY: JSON.stringify(i18nKey),
    VMS: vmsArgs,
  });
}
