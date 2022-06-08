import { generate } from 'escodegen';
import { BlockStatement, CallExpression, Identifier, IfStatement } from 'estree';
import { Parser } from 'acorn';
import { walkAcorn } from './helper';
import { TemplateVisitor } from './visitor';

export function parseListener(_visitor: TemplateVisitor, str: string, mode: string, tag: Record<string, boolean>) {
  const tree = Parser.parse(`function _() {\n ${str} \n}`, {
    ecmaVersion: 2020,
    sourceType: 'module',
  }) as unknown as { body: [{ body: BlockStatement }] };
  const block = tree.body[0].body;
  if (block.type !== 'BlockStatement') throw new Error('unimpossible?!');

  if (block.body.length === 1 && block.body[0].type === 'ExpressionStatement') {
    /**
     * if listener is identifer or member expression, conver it to function call.
     * for example,
     * <SomeComponent on:click="someFn" />
     * is exactly same as:
     * <SomeComponent on:click="someFn(...args)"/>
     */
    const exp = block.body[0];
    if (exp.expression.type === 'Identifier' || exp.expression.type === 'MemberExpression') {
      exp.expression = {
        type: 'CallExpression',
        callee: exp.expression,
        optional: false,
        arguments: [
          {
            type: 'SpreadElement',
            argument: {
              type: 'Identifier',
              name: 'args',
            },
          },
        ],
      };
    }
  }

  const dealId = (node: Identifier) => {
    const varName = node.name;
    const vmVar = _visitor._vms.find((v) => v.name === varName);
    const level = vmVar ? vmVar.level : 0;
    node.name = `vm_${level}.${vmVar ? vmVar.reflect : varName}`;
  };
  walkAcorn(block as unknown as acorn.Node, {
    Identifier: (node: Identifier) => {
      if (node.name === 'args') return false;
      if (mode === 'html' && node.name === '$event') {
        node.name = 'args[0]';
        return false;
      }
      dealId(node);
      return false;
    },
    CallExpression: (node: CallExpression) => {
      if (mode !== 'html') return;
      /**
       * we will replace all '$event' to 'args[0]' for html element listener
       */
      const args = node.arguments;
      if (!args || args.length === 0) return;
      args.forEach((a, i) => {
        if (a.type === 'Identifier' && a.name === '$event') {
          args[i] = {
            type: 'MemberExpression',
            computed: true,
            optional: false,
            object: {
              type: 'Identifier',
              name: 'args',
            },
            property: {
              type: 'Literal',
              value: 0,
              raw: '0',
            },
          };
        }
      });
    },
    // MemberExpression: node => {
    //   const obj = node.object;
    //   if (obj.type !== 'Identifier') return;
    //   if (obj.name === 'args') return false;
    //   if (mode === 'html' && obj.name === '$event') {
    //     obj.name = 'args[0]';
    //     return false;
    //   }
    //   dealId(obj);
    //   return false;
    // },
    IfStatement: (node: IfStatement) => {
      if (node.consequent.type !== 'BlockStatement') {
        node.consequent = {
          type: 'BlockStatement',
          body: [node.consequent],
        };
      }
      if (!node.alternate) return;
      if (node.alternate.type !== 'IfStatement' && node.alternate.type !== 'BlockStatement') {
        node.alternate = {
          type: 'BlockStatement',
          body: [node.alternate],
        };
      }
    },
  });
  let code = generate(tree, {
    indent: '',
  });
  code = code.substring(14, code.length - 1);
  return {
    code,
    tag,
  };
}
