export const TEXT_CONST = 'textRenderFn$POSTFIX$(component, $VAL$)';

export const EMPTY = 'emptyRenderFn$POSTFIX$';

export const PUSH_ROOT_ELE = 'component[__$POSTFIX$].rootNodes.push(el);';
export const PUSH_COM_ELE = 'component[__$POSTFIX$].nonRootCompNodes.push(el);';
export const SET_REF_ELE = "vm_0.__setRef('$NAME$', el, component)";

export const TEXT_EXPR = `(() => {
  const el = createTextNode$POSTFIX$();
$CODE$
  $PUSH_ELE$
  return el;
})()`;

export const PARAMETER = `...await (() => {
  const __ac = $VM_RENDERER$[__$POSTFIX$].slots;
  const renderFn = __ac && __ac['$ARG_USE$'] ? __ac['$ARG_USE$'] : $DEFAULT$;
  const attrs = attrs$POSTFIX$({
    $VM_PASS_INIT$
    [__$POSTFIX$]: {
      $VM_DEBUG_NAME$
      context: component[__$POSTFIX$].context,
      slots: {
        default: renderFn || emptyRenderFn$POSTFIX$
      }
    }
  });
$VM_PASS_SET$
  const el = (new ParameterComponent$POSTFIX$(attrs, $VM_PASS_PARAM$))[$$$POSTFIX$].proxy;
$VM_PASS_WATCH$
$PUSH_ELE$
  return el.__render();
})()`;

export const ERROR = '(el) => errorRenderFn$POSTFIX$(el, $MESSAGE$)';
