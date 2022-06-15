import { IAttribute } from '@jingeweb/html5parser';
// import { i18nManager } from '../../i18n';
import { Parent, Position, VM } from './common';
import { KNOWN_ATTR_TYPES } from './const';
import { logParseError } from './helper';
import { parseExpr } from './parseExpr';
import { parseListener } from './parseListener';
import { TemplateVisitor } from './visitor';

function obj2arr<T = unknown>(obj: Record<string, T>): [string, T][] {
  return Object.keys(obj).map((k) => [k, obj[k]]);
}

export interface VMPassAttribute {
  name: string;
  expr: string[];
}
export interface TranslateAttribute {
  type: 'expr' | 'const';
  value: string;
}

export interface ArgUseAttribute {
  component: string;
  fn: string;
}

type Lis = [string, Record<string, boolean>, Position];
export interface ParseAttributesResult {
  constAttrs: { name: string; code: string }[];
  argAttrs: { name: string; code: string }[];
  listeners: { name: string; code: string; tag: Record<string, boolean> }[];
  vms: VM[];
  vmPass: VMPassAttribute[];
  argPass: string | null;
  ref: string | null;
  argUse: ArgUseAttribute | null;
}

export function parseAttributes(
  _visitor: TemplateVisitor,
  mode: 'html' | 'component',
  tag: string,
  iattrs: IAttribute[],
  parentInfo: Parent,
): ParseAttributesResult {
  if (!iattrs || iattrs.length === 0) {
    return {
      argAttrs: [],
      constAttrs: [],
      listeners: [],
      vms: [],
      vmPass: [],
      argPass: null,
      ref: null,
      argUse:
        mode !== 'html' && tag === '_slot'
          ? {
              component: null,
              fn: 'default',
            }
          : null,
    };
  }

  // const translateAttrs: Record<string, TranslateAttribute> = {};
  const argAttrs: Record<string, string> = {};
  const constAttrs: Record<string, string> = {};
  const listenerAttrs: Record<string, Lis> = {};
  const vms: VM[] = [];
  const vmPass: { name: string; expr: string; pos: Position }[] = [];
  const pVms = _visitor._vms;
  let argPass: string = null;
  let argUse: {
    component: string;
    fn: string;
  } = null;
  let ref: string = null;

  iattrs.forEach((iattr) => {
    const attr_data = iattr.name.value.split(':');
    if (attr_data.length > 2) throw new Error('bad attribute format.');

    let [a_category, a_name] = attr_data;
    let a_tag: string | Record<string, boolean> = null;
    if (attr_data.length === 1) {
      a_name = a_category;
      a_category = 'str';
    }
    if (!a_category) {
      a_category = 'expr';
    }
    if (a_category.startsWith('slot-use|')) {
      a_tag = a_category.substring(9);
      a_category = 'slot-use';
    }
    if (a_category.startsWith('on|')) {
      a_tag = {};
      a_category
        .substring(3)
        .split(',')
        .forEach((t) => {
          (a_tag as Record<string, boolean>)[t.trim()] = true;
        });
      a_category = 'on';
    }

    if (a_category && KNOWN_ATTR_TYPES.indexOf(a_category.toLowerCase()) < 0) {
      throw logParseError(_visitor, iattr.loc.start, 'unkown attribute type ' + a_category);
    }
    if (!/^[\w\d$_-][\w\d$_.|-]*$/.test(a_name)) {
      throw logParseError(_visitor, iattr.loc.start, 'attribute name must match /^[\\w\\d$_-][\\w\\d$_.|-]*$/');
    }
    a_category = a_category.toLowerCase();

    if (a_category === 'ref') {
      if (!a_name) throw logParseError(_visitor, iattr.loc.start, 'ref attribute require name.');
      if (ref) throw logParseError(_visitor, iattr.loc.start, 'ref attribute can only be used once!');
      ref = a_name;
      return;
    }

    if (a_category === 'vm') a_category = 'vm-use';
    else if (a_category === 's') a_category = 'str';
    else if (a_category === 'e') a_category = 'expr';

    let aval = iattr.value?.value?.trim() || '';
    // extract from quote

    if (a_category === 'vm-use') {
      if (!a_name) logParseError(_visitor, iattr.loc.start, 'vm-use type attribute require reflect variable name.');
      if (!aval) aval = a_name;
      if (!/^[\w\d$_]+$/.test(aval))
        throw logParseError(
          _visitor,
          iattr.loc.start,
          'vm-use type attribute value must match /^[\\w\\d$_]+$/, but got: ' + aval,
        );
      if (!/^[\w\d$_]+$/.test(a_name))
        throw logParseError(
          _visitor,
          iattr.loc.start,
          'vm-use type attribute reflect vairable name must match /^[\\w\\d$_]+$/, but got: ' + a_name,
        );
      if (vms.find((v) => v.name === aval))
        throw logParseError(_visitor, iattr.loc.start, 'vm-use type attribute name dulipcated: ' + a_name);
      if (pVms.find((v) => v.name === aval))
        throw logParseError(
          _visitor,
          iattr.loc.start,
          'vm-use attribute reflect vairiable name"' + a_name + '" has been declared in parent context.',
        );
      vms.push({
        name: aval,
        reflect: a_name,
        level: pVms.length > 0 ? pVms[pVms.length - 1].level + 1 : 1,
      });
      return;
    }

    if (a_category === 'vm-pass') {
      if (!a_name)
        throw logParseError(_visitor, iattr.loc.start, 'vm-pass type attribute require reflect variable name.');
      if (!aval) aval = a_name;
      if (mode === 'html')
        throw logParseError(_visitor, iattr.loc.start, "vm-pass attribute can't be used on html element");
      if (!/^[\w\d$_]+$/.test(a_name))
        throw logParseError(
          _visitor,
          iattr.loc.start,
          'vm-pass type attribute reflect vairable name must match /^[\\w\\d$_]+$/',
        );
      if (vmPass.find((v) => v.name === a_name))
        throw logParseError(_visitor, iattr.loc.start, 'vm-pass type attribute name dulipcated: ' + a_name);
      vmPass.push({
        name: a_name,
        expr: aval,
        pos: iattr.loc.start,
      });
      return;
    }

    if (a_category === 'slot-pass') {
      if (argPass) throw logParseError(_visitor, iattr.loc.start, 'slot-pass: attribute can only be used once!');
      if (parentInfo.sub === 'argument') {
        throw logParseError(
          _visitor,
          iattr.loc.start,
          "if parent component has slot-pass: or vm-use: attribute, child component can't also have slot-pass: attribue. Try to put component under <_slot>.",
        );
      }
      if (parentInfo.type !== 'component') {
        throw logParseError(
          _visitor,
          iattr.loc.start,
          'slot-pass: attribute can only be used as root child of Component element.',
        );
      }
      argPass = a_name;
      return;
    }

    if (a_category === 'slot-use') {
      if (argUse) {
        throw logParseError(_visitor, iattr.loc.start, 'slot-use: attribute can only be used once!');
      }
      if (a_tag) {
        const ns = (a_tag as string).split('.');
        const vmVar = _visitor._vms.find((v) => v.name === ns[0]);
        const level = vmVar ? vmVar.level : 0;
        ns[0] = `vm_${level}.${vmVar ? vmVar.reflect : ns[0]}`;
        a_tag = ns.join('.');
      }
      argUse = {
        component: a_tag as string,
        fn: a_name,
      };
      return;
    }

    if (a_category === 'on') {
      if (!a_name) {
        throw logParseError(_visitor, iattr.loc.start, 'event name is required!');
      }
      if (a_name in listenerAttrs) {
        throw logParseError(_visitor, iattr.loc.start, 'event name is dulplicated: ' + a_name);
      }
      listenerAttrs[a_name] = [aval, a_tag as Record<string, boolean>, iattr.value?.loc.start || iattr.loc.start];
      return;
    }

    if (/* a_name in translateAttrs || */ a_name in constAttrs || a_name in argAttrs) {
      throw logParseError(_visitor, iattr.loc.start, 'dulplicated attribute: ' + a_name);
    }
    if (!aval) {
      // if (a_category === '_t') {
      //   logParseError(_visitor,iattr.loc.start, 'attribute with _t: type require non-empty value');
      // }
      if (a_category === 'expr') {
        throw logParseError(_visitor, iattr.loc.start, 'Attribute with expression type must have value.');
      }
      a_category = 'expr';
      aval = 'true';
    }

    if (a_category === 'str') {
      aval = '`' + aval + '`';
    }
    const res = parseExpr(_visitor, aval, iattr.value?.loc.start || iattr.loc.start);
    if (res.isConst) {
      constAttrs[a_name] = res.codes[0];
    } else {
      argAttrs[a_name] = res.codes.join('\n');
    }
  });

  /*
   * The logic is so complex that I have to write
   * Chinese comment to keep myself not forget it.
   */

  /**
   *
   * # slot-pass:, arg-use:, vm-pass:, vm-use:
   *
   * ## 基本说明
   *
   * #### slot-pass:
   *
   * 该属性指定要将外部元素传递到组件的内部渲染中。比如：
   *
   * ````html
   * <SomeComponent>
   * <_slot slot-pass:a>
   *  <span>hello</span>
   * </_slot>
   * </SomeComponent>
   * ````
   *
   * 以上代码会将 <_slot> 节点内的所有内容，按 key="a" 传递给
   * SomeComponent 组件。SomeComponent 组件在渲染时，可获取到该外部传递进
   * 来的元素。
   *
   * 对于 html 元素，slot-pass 属性本质上是给它包裹了一个父组件，比如：
   *   `<span slot-pass:a>hello</span>` 等价于：
   *   `<_slot slot-pass:a><span>hello</span></_slot>`，
   *
   * 对于 Component 元素，slot-pass 属性会让编译器忽略该组件的任何性质（或者理解成，
   *   任何有 slot-pass 属性的组件都会被替换成 <_slot> 空组件）。
   *
   * 对任何组件元素来说，如果它没有任何根子节点包含 slot-pass 属性，则编译器会
   *   默认将所有根子节点包裹在 <_slot slot-pass:default> 里。比如：
   *   `<SomeComponent><span>hello</span>Good<span>world</span></SomeComponent>`
   *   等价于：
   *   ````html
   *   <SomeComponent>
   *   <_slot slot-pass:default>
   *     <span>hello</span>Good<span>world</span>
   *   </_slot>
   *   </SomeComponent>
   *   ````
   *
   * #### vm-use:
   *
   * vm-use: 可以简化写成 vm: 。
   *
   * 只有 slot-pass: 属性存在时，才能使用 vm-use: 属性。vm-use: 用于指定要通过 slot-pass: 传递到组件内部去的
   * 外部元素，在组件内部被渲染时，可以使用哪些组件内部提供的渲染参数；因此脱离 slot-pass: 属性，vm-use: 属性没有意义。
   *
   * 但为了代码的简介性，当 Component 元素没有根子节点有 slot-pass: 属性（即，它的所有根子节点
   * 被当作默认的 <_slot slot-pass:default>）时，
   * 这个组件`可以只有 vm-use: 而没有 slot-pass: 属性`。
   * 这种情况属于语法糖，本质上等价于在其默认的 <_slot slot-pass:default> 上添加了这些 vm-use:。比如：
   * `<SomeComponent vm-use:a="b"><span>${b}</span></SomeComponent>` 等价于：
   * `<SomeComponent><_slot slot-pass:default vm-use:a="b"><span>${b}</span></_slot></SomeComponent>`
   *
   * 一个典型的实际例子是 <for> 循环。<for> 是 ForComponent 组件的别名，
   * 该组件自身的渲染逻辑，是循环渲染通过 slot-pass:default 传递进来的外部元素。
   * 结合上文，常见的代码 `<for e:loop="list" vm:each="item">${item}</for>` 等价于：
   * ````html
   * <!-- import {ForComponent} from 'jinge' -->
   * <ForComponent e:loop="list">
   * <_slot slot-pass:default vm-use:each="item">${item}</_slot>
   * </ForComponent>
   * ````
   *
   * 其中，vm 是 vm-use 的简化写法。
   *
   * #### arg-use:
   *
   * 指定该组件在自己的内部渲染中，使用哪些通过 slot-pass: 传递进来的外部元素。
   * 以上文 slot-pass: 属性下的代码为例， SomeComponent 组件的模板里，
   * 可以这样使用：
   *
   * ````html
   * <!-- SomeComponent.html -->
   * <parameter arg-use:a />
   * <parameter arg-use:b>
   *   <span>default text</span>
   * </parameter>
   * ````
   *
   * 通过跟 slot-pass: 一致的 key="a"，实现了 arg-use: 和 slot-pass: 的关联，
   * 将外部的元素渲染到自身内部。如果 arg-use: 属性的组件，还有子节点，则这些子节点
   * 代表外部没有传递对应 key 的外部元素时，要默认渲染的元素。
   *
   * 以上代码最终渲染的结果是 `<span>hello</span><span>default text</span>`。
   *
   * 对于 html 元素，arg-use: 属性本质上是给它包裹了一个父组件，比如：
   *   `<span arg-use:a>default</span>` 等价于：
   *   `<parameter arg-use:a><span>default</span></parameter>`，
   *
   * 对于 Component 元素，arg-use: 属性会让编译器忽略该组件的任何性质（或者理解成，
   *   任何有 arg-use: 属性的组件都会被替换成 <parameter> 空组件）。
   *
   * #### vm-pass:
   *
   * 只有 arg-use: 属性存在时，才能使用 vm-pass: 属性。vm-pass: 用于指定要向外部通过 slot-pass: 传递进来的
   * 外部元素传递过去哪些渲染参数，因此脱离 arg-use: 属性，vm-pass: 属性没有意义。
   *
   * 比如常见的 <for> 循环，即 ForComponent 组件，会向外部元素传递 'each' 和 'index' 两
   * 个渲染参数。但对 ForComponent 组件，这种传递是直接在 js 逻辑里写的，而没有
   * 直接通过 vm-pass: 属性（因为 ForComponent 组件自身没有模板）。
   *
   * 如下是在模板中传递渲染参数的示例：
   *
   * ````html
   * <!-- SomeComponent.html -->
   * <div><parameter arg-use:a vm-pass:xx="name + '_oo' ">hello, ${name}</parameter></div>
   * ````
   *
   * 以上代码会向外部组件传递名称为 xx 的渲染参数，这个参数的值是 `name + 'oo'` 这个表达式
   * 的结果。表达式里的 name 是该组件的 property。当 name 发生变化时，向外传递的 xx 也会更新并
   * 通知外部组件重新渲染。
   *
   * 以下是使用 SomeComponent 组件时的用法：
   *
   * ````html
   * <!-- app.html -->
   * <SomeComponent>
   *   <p slot-pass:a vm-use:xx="yy">override ${yy}</p>
   * </SomeComponent>
   * ````
   *
   * 假设 SomeComponent 的 name 是 'jinge'，则 app.html 最终渲染出来是
   * `<p>override jinge_oo</p>`
   *
   * ## 补充说明
   *
   * #### slot-pass: 必须用于 Component 元素的子元素。
   *
   * #### slot-pass: 和 arg-use: 不能同时使用。
   *
   * slot-pass: 和 arg-use: 同时存在，可以设计来没有歧义，
   *   比如：`<span slot-pass:a arg-use:c>hello</span>` 可以设计为等价于：
   *
   * 可以等价于：
   *
   * ````html
   * <_slot slot-pass:a>
   *   <_slot slot-use:b>
   *     <span>hello</span>
   *   </_slot>
   * </_slot>
   * ````
   *
   * 但这种等价有一定的隐晦性。由于这种使用场景很少，
   * 因此不提供这个场景的简化写法。
   *
   */

  const attrsPos = iattrs[0].loc.start;
  // slot-pass: 属性和 arg-use: 属性不能同时存在，详见上面的注释。
  if (argPass && argUse) {
    logParseError(_visitor, attrsPos, "slot-pass: and slot-use: attribute can' be both used on same element");
  }

  // html 元素上的必须有 slot-pass: 属性，才能有 vm-use: 属性
  // component 元素可以只有 vm-use: 属性，但需要满足上面注释里详细描述的条件，这个条件的检测在之后的代码逻辑里。
  if (vms.length > 0 && !argPass && mode === 'html') {
    logParseError(
      _visitor,
      attrsPos,
      'vm-use: attribute require slot-pass: attribute on html element. see https://[todo]',
    );
  }

  // vm-pass: 属性必须用在有 arg-use: 属性的元素上。
  if (vmPass.length > 0 && !argUse) {
    logParseError(_visitor, attrsPos, 'vm-pass: attribute require slot-use: attribute');
  }
  // vm-use: 属性不能用在有 arg-use: 属性的元素上。
  if (argUse && vms.length > 0) {
    logParseError(_visitor, attrsPos, "vm-use: attribute can't be used with slot-use: attribute");
  }
  if (argPass && (_visitor._parent.type !== 'component' || _visitor._parent.sub === 'root')) {
    logParseError(_visitor, attrsPos, "slot-pass: attribute can only be used on Component element's root child.");
  }
  //
  if (tag === '_slot' && !argPass && !argUse) {
    logParseError(_visitor, attrsPos, '<_slot> component require "slot-pass:" or "slot-use:" attribute.');
  }
  /**
   * 如果元素上有 slot-pass: 和 vm-use: ，则该元素等价于被包裹在
   * slot-pass: 和 vm-use: 的 <_slot> 组件里。这种情况下，html 元素上
   * 的其它表达式值属性，是可以使用该 vm-use: 引入的渲染参数的。因此，要将这些参数
   * 先添加到参数列表里，再进行 _parse_expr 或 _parse_listener，
   * parse 结束后，再恢复参数列表。比如如下代码：
   *
   * ````html
   * <SomeComponent>
   *   <p slot-pass:a vm-use:xx="yy" class="c1 ${yy}">override ${yy}</p>
   *   <AnotherComponent slot:b vm:xx="yy"/>
   * </SomeComponent>
   * ````
   *
   * 等价于：
   *
   * ````html
   * <SomeComponent>
   * <_slot slot-pass:a vm-use:xx="yy">
   *   <p class="c1 ${yy}">override ${yy}</p>
   * </_slot>
   * <_slot slot-pass:b vm-use:xx="yy">
   *   <AnotherComponent/>
   * </_slot>
   * </SomeComponent>
   * ````
   *
   * 其中的，`class="c1 ${yy}"` 使用了 `vm-use:xx="yy"` 引入的渲染参数。
   *
   */
  if (tag !== '_slot' && vms.length > 0) {
    _visitor._vms = pVms.slice().concat(vms);
  }

  const rtn = {
    constAttrs: Object.keys(constAttrs).map((k) => ({ name: k, code: constAttrs[k] })),
    argAttrs: Object.keys(argAttrs).map((k) => ({ name: k, code: argAttrs[k] })),
    listeners: obj2arr(listenerAttrs).map((lis) => {
      const lisResult = parseListener(_visitor, ...lis[1]);
      // lisResult.code = lisResult.code
      //   .replace(/(^[\s;]+)|([\s;]+$)/g, '')
      //   .replace(/[\r\n]/g, ';')
      //   .replace(/;+/g, ';')
      //   .replace(/\{\s*;+/g, '{');

      return { name: lis[0], ...lisResult };
    }),
    vms,
    vmPass: vmPass.map((vp) => {
      return {
        name: vp.name,
        expr: parseExpr(_visitor, vp.expr, vp.pos).codes,
      };
    }),
    argPass,
    argUse,
    ref,
  };
  if (tag !== '_slot' && vms.length > 0) {
    _visitor._vms = pVms;
  }

  if (tag === '_slot' && (rtn.ref || rtn.argAttrs.length > 0 || rtn.listeners.length > 0)) {
    logParseError(_visitor, attrsPos, '<_slot> component can only have slot-pass: or slot-use: attribute');
  }
  return rtn;
}
