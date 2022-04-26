import { ParserRuleContext } from 'antlr4-build';
import { convertAttributeName } from '../../util';
import { sharedOptions } from '../../options';
import { logParseError, prependTab2Space, replaceTpl } from './helper';
import { parseAttributes, ParseAttributesCtx } from './parseAttributes';
import { TemplateVisitor, VisitChildNodesCtx } from './visitor';
import * as TPL from './tpl';
import { parseI18nAttribute } from './parseI18nAttribute';
import { ParsedElement } from './common';
import { parseArgUseParameter } from './parseArgUseParameter';

export function parseComponentElement(
  _visitor: TemplateVisitor,
  tag: string,
  Component: string,
  ctx: ParserRuleContext,
) {
  const result = parseAttributes(
    _visitor,
    'component',
    Component,
    ctx as unknown as ParseAttributesCtx,
    _visitor._parent,
  );
  /**
   * for 组件也是一个标准组件，并没有特殊性，且组件别名也可以被覆盖。因此只给予避免踩杭的告警，
   * 而不是抛出错误。
   */
  if (tag === 'for' && !result.vms.find((v) => v.reflect === 'each')) {
    logParseError(_visitor, ctx.start, '<for> component require vm:each attribute.', 'Warning');
  }
  let elements = _visitor.visitChildNodes(ctx as unknown as VisitChildNodesCtx, result.vms, {
    type: 'component',
    sub: result.argPass || result.vms.length > 0 ? 'argument' : result.argUse ? 'parameter' : 'normal',
    vms: result.vms,
  });
  if (tag === '_slot' && elements.length === 0 && result.argPass) {
    _visitor._throwParseError(ctx.start, '<_slot> component with slot-pass: attribute must have child.');
  }
  const hasArg = _visitor._assert_arg_pass(ctx.start, elements, tag);
  if (result.vms.length > 0 && !result.argPass && hasArg) {
    _visitor._throwParseError(
      ctx.start,
      "if component has vm-use: attribute but do not have slot-pass: attribute, it's root children can't have slot-pass: attribute.",
    );
  }
  const setRefCode = result.ref
    ? replaceTpl(TPL.SET_REF_ELE, {
        NAME: result.ref,
      })
    : '';
  const vmLevel = result.vms.length > 0 ? result.vms[result.vms.length - 1].level : -1;
  if (tag === '_slot' && result.argUse) {
    return parseArgUseParameter(this, elements, result.argUse, result.vmPass, vmLevel);
  }

  if (tag === '_slot' && result.argPass) {
    return {
      type: 'component',
      sub: 'argument',
      argPass: result.argPass,
      value: _visitor._gen_render(elements, vmLevel),
    };
  }

  if (elements.length > 0 && !hasArg) {
    elements = [
      {
        type: 'component',
        sub: 'argument',
        argPass: 'default',
        value: _visitor._gen_render(elements, vmLevel),
      },
    ];
  }

  const attrs = [];
  result.argAttrs.length > 0 && attrs.push(...result.argAttrs.map((at) => `${convertAttributeName(at[0])}: null`));
  result.translateAttrs.length > 0 && attrs.push(...result.translateAttrs.map((at) => `${at[0]}: null`));
  result.constAttrs.length > 0 &&
    attrs.push(...result.constAttrs.map((at) => `${convertAttributeName(at[0])}: ${JSON.stringify(at[1])}`));

  const vmAttrs = `const attrs = attrs${sharedOptions.symbolPostfix}({
[__${sharedOptions.symbolPostfix}]: {
${!_visitor._isProdMode ? `    debugName: "attrs_of_<${tag}>",` : ''}
${prependTab2Space(`  context: component[__${sharedOptions.symbolPostfix}].context,`)}
${
  result.listeners.length > 0
    ? prependTab2Space(`  listeners: {
${result.listeners.map(
  (lt) =>
    `    ${convertAttributeName(lt[0])}: { fn: function(...args) { ${lt[1].code} }, opts: ${
      lt[1].tag ? `${JSON.stringify(lt[1].tag)}` : 'null'
    } }`,
)}
},`)
    : ''
}
${
  elements.length > 0
    ? prependTab2Space(`  slots: {
${elements.map((el) => `    '${el.argPass}': ${el.value}`).join(',\n')}
}`)
    : ''
}
},
${prependTab2Space(attrs.join(',\n'), true)}
});
${result.argAttrs
  .map((at, i) =>
    replaceTpl(at[1], {
      REL_COM: `component[$$${sharedOptions.symbolPostfix}]`,
      ROOT_INDEX: i.toString(),
      RENDER_START: `attrs.${at[0]} = `,
      RENDER_END: ';',
    }),
  )
  .join('\n')}
${result.translateAttrs
  .map((at, i) => {
    return parseI18nAttribute(_visitor, at, result.argAttrs.length + i, false);
  })
  .join('\n')}`;

  const code =
    '...(() => {\n' +
    prependTab2Space(
      `
${vmAttrs}
const el = ${Component}.create(attrs);
${result.translateAttrs
  .map((at, i) => {
    const attr = at[1];
    if (attr.type === 'const') {
      return replaceTpl(TPL.ATTR_I18N_COMP_CONST_OFF, {
        ROOT_INDEX: (result.argAttrs.length + i).toString(),
      });
    } else {
      return replaceTpl(TPL.ATTR_I18N_COMP_EXPR_OFF, {
        ROOT_INDEX: (result.argAttrs.length + i).toString(),
      });
    }
  })
  .join('\n')}
${setRefCode}
${_visitor._parent.type === 'component' ? replaceTpl(TPL.PUSH_ROOT_ELE) : replaceTpl(TPL.PUSH_COM_ELE)}
return assertRenderResults${sharedOptions.symbolPostfix}(el.__render());`,
      true,
    ) +
    '\n})()';

  const rtnEl: ParsedElement = {
    type: 'component',
    sub: 'normal',
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
