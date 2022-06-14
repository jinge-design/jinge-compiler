import { Expression, ExpressionStatement, Identifier } from 'estree';
import { Node, Parser } from 'acorn';
import { ancestor } from 'acorn-walk';
import { getReplaceResult, sortedInsert } from '../../util';
import { TemplateVisitor } from './visitor';

function getVarVmReflect(varName: string, _visitor: TemplateVisitor) {
  const vmVar = _visitor._vms.find((v) => v.name === varName);
  const level = vmVar ? vmVar.level : 0;
  return `vm_${level}.${vmVar ? vmVar.reflect : varName}`;
}
/** $args 和 $event 是保留的两个特殊参数名。$event 会被替换为 args[0]，$args 会被替换为 ...args */
function getVar(name: string, _visitor: TemplateVisitor) {
  return name === '$args' ? '...args' : name === '$event' ? 'args[0]' : getVarVmReflect(name, _visitor);
}
export function parseListener(_visitor: TemplateVisitor, str: string, mode: string, tag: Record<string, boolean>) {
  const tree = Parser.parse(str, {
    locations: true,
    ecmaVersion: 2020,
    sourceType: 'module',
  }) as unknown as { body: ExpressionStatement[] };
  const unsupport = () => new Error('unsupport listener expression');
  if (tree.body.length !== 1 || tree.body[0].type !== 'ExpressionStatement') {
    throw unsupport();
  }

  const expr = tree.body[0].expression as Expression & Node;
  if (expr.type === 'Identifier') {
    /**
     * 如果事件属性的值是一个 Identifier 变量，则转换为函数调用。比如 <div on:click="someFn" /> 等价于 <div on:click="someFn(...args)"/>，
     * 而其中的 args 是由框架调用时传递的参数。对于 html 元素来说，args 数组有且只有一个元素即 Event 对象；对于其它组件来说，args 数组是组件传递的参数。
     */
    return { code: getVarVmReflect(expr.name, _visitor) + '(...args);', tag };
  } else if (expr.type === 'CallExpression') {
    const args: string[] = [];
    expr.arguments.forEach((arg: Expression & Node) => {
      if (arg.type === 'Identifier') {
        // 如果是 $event 参数且是 html 元素的事件，则直接转成 args[0]。其它参数则认为是 vm 上的属性，转换为对应的属性名。
        args.push(getVar(arg.name, _visitor));
      } else {
        const replaces: { sn: number; code: string; se: number }[] = [];
        // console.log('ARG:', arg);
        ancestor(arg, {
          Identifier: (node: Identifier & Node, paths: Expression[]) => {
            // if (node.name === 'o') debugger
            if (node !== paths[paths.length - 1]) throw new Error('impossible??');
            const pn = paths[paths.length - 2];
            if (pn && pn.type === 'MemberExpression') {
              if (node === pn.property && !pn.computed) return;
            }
            const code = getVar(node.name, _visitor);
            sortedInsert(replaces, {
              sn: node.start,
              se: node.end,
              code,
            });
          },
        });
        args.push(getReplaceResult(replaces, str, arg));
      }
    });
    if (expr.callee.type !== 'Identifier') {
      throw unsupport();
    }
    return { code: getVarVmReflect(expr.callee.name, _visitor) + `(${args.join(', ')})`, tag };
  } else {
    throw unsupport();
  }
}
