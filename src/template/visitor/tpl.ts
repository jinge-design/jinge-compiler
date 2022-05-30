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

// export const ATTR_I18N_COMP_CONST_ON = `export const fn_$ROOT_INDEX$ = () => {
//   attrs.$NAME$ = i18n$POSTFIX$.__t($I18N_KEY$);
// };
// fn_$ROOT_INDEX$();`;

// export const ATTR_I18N_COMP_CONST_OFF = 'el.__i18nWatch(fn_$ROOT_INDEX$);';

// export const ATTR_I18N_COMP_EXPR_ON = `export const rls_$ROOT_INDEX$ = {
//   [$$$POSTFIX$]: null
// };
// export const fn_$ROOT_INDEX$ = () => {
//   if (rls_$ROOT_INDEX$[$$$POSTFIX$]) {
//     rls_$ROOT_INDEX$[$$$POSTFIX$].__destroy();
//   }
//   rls_$ROOT_INDEX$[$$$POSTFIX$] = new ViewModelCoreImpl$POSTFIX$({});
//   i18n$POSTFIX$.__r($I18N_KEY$, 'attributes')(attrs, '$NAME$', false, rls_$ROOT_INDEX$, $VMS$);
// };
// fn_$ROOT_INDEX$();`;

// export const ATTR_I18N_COMP_EXPR_OFF = `el.__i18nWatch(fn_$ROOT_INDEX$);
// el.__on('before-destroy', () => rls_$ROOT_INDEX$[$$$POSTFIX$].__destroy());`;

// export const ATTR_I18N_DOM_CONST = `export const fn_$ROOT_INDEX$ = () => {
//   el.setAttribute('$NAME$', i18n$POSTFIX$.__t($I18N_KEY$));
// };
// fn_$ROOT_INDEX$();
// component.__i18nWatch(fn_$ROOT_INDEX$);`;

// export const ATTR_I18N_DOM_EXPR = `export const rls_$ROOT_INDEX$ = {
//   [$$$POSTFIX$]: null
// };
// export const fn_$ROOT_INDEX$ = () => {
//   if (rls_$ROOT_INDEX$[$$$POSTFIX$]) {
//     rls_$ROOT_INDEX$[$$$POSTFIX$].__destroy();
//   }
//   rls_$ROOT_INDEX$[$$$POSTFIX$] = new ViewModelCoreImpl$POSTFIX$({});
//   i18n$POSTFIX$.__r($I18N_KEY$, 'attributes')(el, '$NAME$', true, rls_$ROOT_INDEX$, $VMS$);
// };
// fn_$ROOT_INDEX$();
// component.__i18nWatch(fn_$ROOT_INDEX$);
// component.__on('before-destroy', () => rls_$ROOT_INDEX$.__destroy());`;

// export const I18N = `...(() => {
//   export const el = new I18nComponent$POSTFIX$(attrs$POSTFIX$({
//     [__$POSTFIX$]: {
//       context: component[__$POSTFIX$].context
//     }
//   }), $RENDER_KEY$, [$VMS$]);
//   $PUSH_ELE$
//   return assertRenderResults$POSTFIX$(el.__render());
// })()`;

export const PARAMETER = `...(() => {
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
  return assertRenderResults$POSTFIX$(el.__render());
})()`;

export const ERROR = 'errorRenderFn$POSTFIX$';
