import { ParserRuleContext } from 'antlr4-build';
import { convertAttributeName } from '../../util';
import { sharedOptions } from '../../options';
import { HTML_BOOL_IDL_ATTRS, HTML_COMMON_IDL_ATTRS } from './const';
import { prependTab2Space, replaceTpl } from './helper';
import { parseAttributes, ParseAttributesResult } from './parseAttributes';
import { SET_REF_ELE, PUSH_ROOT_ELE } from './tpl';
import { TemplateVisitor, VisitChildNodesCtx } from './visitor';
import { parseI18nAttribute } from './parseI18nAttribute';
import { parseArgUseParameter } from './parseArgUseParameter';
import { ParsedElement } from './common';

export function parseHtmlElement(_visitor: TemplateVisitor, etag: string, ctx: ParserRuleContext) {
  const result = parseAttributes.call(this, 'html', etag, ctx, _visitor._parent) as ParseAttributesResult;
  const elements = _visitor.visitChildNodes(ctx as unknown as VisitChildNodesCtx, result.vms, {
    type: 'html',
    isSVG: _visitor._parent.isSVG || etag === 'svg',
  });
  const setRefCode = result.ref
    ? replaceTpl(SET_REF_ELE, {
        NAME: result.ref,
      })
    : '';
  const pushEleCode = _visitor._parent.type === 'component' ? replaceTpl(PUSH_ROOT_ELE) : '';

  const ceFn = `create${_visitor._parent.isSVG || etag === 'svg' ? 'SVG' : ''}Element${
    result.constAttrs.length > 0 ? '' : 'WithoutAttrs'
  }`;
  const ce = `${ceFn}${sharedOptions.symbolPostfix}`;
  const arr = [`"${etag}"`];
  if (result.constAttrs.length > 0) {
    const attrsArr = result.constAttrs.map((at) => `  ${convertAttributeName(at[0])}: ${JSON.stringify(at[1])}`);
    const attrsCode = `{\n${attrsArr.join(',\n')}\n}`;
    arr.push(attrsCode);
  }
  arr.push(_visitor._join_elements(elements));
  let code;
  if (
    result.translateAttrs.length > 0 ||
    result.argAttrs.length > 0 ||
    result.listeners.length > 0 ||
    setRefCode ||
    pushEleCode
  ) {
    code =
      '(() => {\n' +
      prependTab2Space(
        ` 
const el = ${ce}(
${prependTab2Space(arr.join(',\n'))}
);
${result.argAttrs
  .map((at, i) => {
    if (at[0] in HTML_BOOL_IDL_ATTRS) {
      const attr = HTML_BOOL_IDL_ATTRS[at[0] as keyof typeof HTML_BOOL_IDL_ATTRS];
      if (attr.tags === '*' || attr.tags.indexOf(etag) >= 0) {
        return replaceTpl(at[1], {
          REL_COM: `component[$$${sharedOptions.symbolPostfix}]`,
          ROOT_INDEX: i.toString(),
          RENDER_START: `el.${at[0]} = !!(`,
          RENDER_END: ');',
        });
      }
    } else if (at[0] in HTML_COMMON_IDL_ATTRS) {
      const attr = HTML_COMMON_IDL_ATTRS[at[0] as keyof typeof HTML_COMMON_IDL_ATTRS];
      if (attr.tags.indexOf(etag) >= 0) {
        return replaceTpl(at[1], {
          REL_COM: `component[$$${sharedOptions.symbolPostfix}]`,
          ROOT_INDEX: i.toString(),
          RENDER_START: `el.${at[0]} = `,
          RENDER_END: ';',
        });
      }
    }
    return replaceTpl(at[1], {
      REL_COM: `component[$$${sharedOptions.symbolPostfix}]`,
      ROOT_INDEX: i.toString(),
      RENDER_START: `setAttribute$POSTFIX$(el, "${at[0]}", `,
      RENDER_END: ');',
    });
  })
  .join('\n')}
${result.translateAttrs
  .map((at, i) => {
    return parseI18nAttribute(_visitor, at, result.argAttrs.length + i, true);
  })
  .join('\n')}
${result.listeners
  .map((lt) => {
    return `addEvent${sharedOptions.symbolPostfix}(el, '${lt[0]}', function(...args) {${lt[1].code}${
      lt[1].tag?.stop ? ';args[0].stopPropagation()' : ''
    }${lt[1].tag?.prevent ? ';args[0].preventDefault()' : ''}}${lt[1].tag ? `, ${JSON.stringify(lt[1].tag)}` : ''})`;
  })
  .join('\n')}
${setRefCode}
${pushEleCode}
return el;`,
        true,
      ) +
      '\n})()';
  } else {
    code = `${ce}(\n${prependTab2Space(arr.join(',\n'))}\n)`;
  }

  const vmLevel = result.vms.length > 0 ? result.vms[result.vms.length - 1].level : -1;
  const rtnEl: ParsedElement = {
    type: 'html',
    value: code,
  };

  if (result.argUse) {
    return parseArgUseParameter(this, [rtnEl], result.argUse, result.vmPass, vmLevel);
  }
  if (result.argPass) {
    return {
      type: 'component',
      sub: 'argument',
      argPass: result.argPass,
      value: _visitor._gen_render([rtnEl], vmLevel),
    };
  }
  return rtnEl;
}
