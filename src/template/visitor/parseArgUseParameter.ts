import { SYMBOL_POSTFIX } from '../../util';
import { ParsedElement } from './common';
import { prependTab2Space, replaceTpl } from './helper';
import { TemplateVisitor } from './visitor';
import { ArgUseAttribute, VMPassAttribute } from './parseAttributes';
import * as TPL from './tpl';

export function parseArgUseParameter(
  _visitor: TemplateVisitor,
  elements: ParsedElement[],
  argUse: ArgUseAttribute,
  vmPass: VMPassAttribute[],
  vmLevel: number,
) {
  let vmPassInitCode = '';
  let vmPassSetCode = '';
  let vmPassWatchCode = '';
  const vmPassParamCode: string[] = [];
  if (vmPass.length > 0) {
    vmPass.forEach((vp, i) => {
      vmPassInitCode += `${vp.name}: null, `;
      vmPassSetCode += replaceTpl(vp.expr.slice(0, 3).join('\n'), {
        ROOT_INDEX: i.toString(),
        RENDER_START: `attrs.${vp.name} = `,
        RENDER_END: ';',
        REL_COM: `el[$$${SYMBOL_POSTFIX}]`,
      });
      vmPassWatchCode += replaceTpl(vp.expr.slice(3).join('\n'), {
        ROOT_INDEX: i.toString(),
        REL_COM: `el[$$${SYMBOL_POSTFIX}]`,
      });
      vmPassParamCode.push(vp.name);
    });
  }
  debugger;
  return {
    type: 'component',
    sub: 'parameter',
    value: replaceTpl(TPL.PARAMETER, {
      VM_RENDERER: argUse.component ? argUse.component : 'vm_0',
      VM_DEBUG_NAME: _visitor._addDebugName ? `debugName: "attrs_of_<parameter>",` : '',
      VM_PASS_INIT: vmPassInitCode,
      VM_PASS_SET: prependTab2Space(vmPassSetCode),
      VM_PASS_WATCH: prependTab2Space(vmPassWatchCode),
      VM_PASS_PARAM: JSON.stringify(vmPassParamCode),
      PUSH_ELE: prependTab2Space(
        replaceTpl(_visitor._parent.type === 'component' ? TPL.PUSH_ROOT_ELE : TPL.PUSH_COM_ELE),
      ),
      ARG_USE: argUse.fn,
      DEFAULT: elements.length > 0 ? prependTab2Space(_visitor._gen_render(elements, vmLevel)) : 'null',
    }),
  };
}
