import { ITag } from '@jingeweb/html5parser';
import { convertAttributeName, SYMBOL_POSTFIX } from '../../util';
import { HTML_BOOL_IDL_ATTRS, HTML_COMMON_IDL_ATTRS } from './const';
import { prependTab2Space, replaceTpl } from './helper';
import { parseAttributes, ParseAttributesResult } from './parseAttributes';
import { SET_REF_ELE, PUSH_ROOT_ELE } from './tpl';
import { TemplateVisitor } from './visitor';
// import { parseI18nAttribute } from './parseI18nAttribute';
import { parseArgUseParameter } from './parseArgUseParameter';
import { ParsedElement } from './common';

export function parseHtmlElement(_visitor: TemplateVisitor, etag: string, inode: ITag): ParsedElement {
  const result = parseAttributes(_visitor, 'html', etag, inode.attributes, _visitor._parent) as ParseAttributesResult;
  const elements = _visitor.visitChildNodes(inode.body, result.vms, {
    type: 'html',
    isSVG: _visitor._parent.isSVG || etag === 'svg',
    isPreOrCodeTag: etag === 'pre' || etag === 'code',
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
  const ce = `${ceFn}${SYMBOL_POSTFIX}`;
  const arr = [`"${etag}"`];
  if (result.constAttrs.length > 0) {
    const attrsArr = result.constAttrs.map((at) => {
      let code = at.code;
      const cors = at.name === 'class' || at.name === 'style';
      if (cors && /^[{[]/.test(code)) {
        // 如果是 { 或 [ 打头的常量，则认为是 object 或 array 常量，用 class2str/style2str 转成字符串。
        code = `${at.name}2str${SYMBOL_POSTFIX}(${code})`;
      }
      // 由于此处是为 html 元素设置属性，不需要将 object/array 转成 ViewModel
      return `  ${convertAttributeName(at.name)}: ${code}`;
    });
    const attrsCode = `{\n${attrsArr.join(',\n')}\n}`;
    arr.push(attrsCode);
  }
  arr.push(_visitor._join_elements(elements));
  let code;
  if (
    // result.translateAttrs.length > 0 ||
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
    if (at.name in HTML_BOOL_IDL_ATTRS) {
      const attr = HTML_BOOL_IDL_ATTRS[at.name as keyof typeof HTML_BOOL_IDL_ATTRS];
      if (attr.tags === '*' || attr.tags.indexOf(etag) >= 0) {
        return replaceTpl(at.code, {
          REL_COM: `component[$$${SYMBOL_POSTFIX}]`,
          ROOT_INDEX: i.toString(),
          RENDER_START: `el.${at.name} = !!(`,
          RENDER_END: ');',
        });
      }
    } else if (at.name in HTML_COMMON_IDL_ATTRS) {
      const attr = HTML_COMMON_IDL_ATTRS[at.name as keyof typeof HTML_COMMON_IDL_ATTRS];
      if (attr.tags.indexOf(etag) >= 0) {
        return replaceTpl(at.code, {
          REL_COM: `component[$$${SYMBOL_POSTFIX}]`,
          ROOT_INDEX: i.toString(),
          RENDER_START: `el.${at.name} = `,
          RENDER_END: ';',
        });
      }
    }
    const cors = at.name === 'class' || at.name === 'style';
    if (cors) {
      // 如果是 class 或 style 属性，则去除 vm 包裹。
      at.code = at.code.replace(`$RENDER_START$vm${SYMBOL_POSTFIX}`, '$RENDER_START$');
    }
    // 如果是 class 或 style 属性，使用 setClassAttribute/setStyleAttribute，否则使用 setAttribute
    return replaceTpl(at.code, {
      REL_COM: `component[$$${SYMBOL_POSTFIX}]`,
      ROOT_INDEX: i.toString(),
      RENDER_START: cors
        ? `set${at.name.replace(/^./, (m) => m.toUpperCase())}Attribute$POSTFIX$(el, `
        : `setAttribute$POSTFIX$(el, "${at.name}", `,
      RENDER_END: ');',
    });
  })
  .join('\n')}
${result.listeners
  .map((lt) => {
    return `addEvent${SYMBOL_POSTFIX}(el, '${lt.name}', function(...args) {
${prependTab2Space(lt.code)}${lt.tag?.stop ? '\n  args[0].stopPropagation();' : ''}${
      lt.tag?.prevent ? '\n  args[0].preventDefault();' : ''
    }
}${lt.tag ? `, ${JSON.stringify(lt.tag)}` : ''});`;
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
    return parseArgUseParameter(_visitor, [rtnEl], result.argUse, result.vmPass, vmLevel);
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
