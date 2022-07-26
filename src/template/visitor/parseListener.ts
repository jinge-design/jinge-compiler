import { Expression, ExpressionStatement, Identifier, MemberExpression } from 'estree';
import { Node, Parser } from 'acorn';
import { getReplaceResult, ReplaceItem, sortedInsert } from '../../util';
import { TemplateVisitor } from './visitor';
import { Position } from './common';
import { logParseError, walkAcorn } from './helper';

function getVarVmReflect(varName: string, _visitor: TemplateVisitor) {
  const vmVar = _visitor._vms.find((v) => v.name === varName);
  const level = vmVar ? vmVar.level : 0;
  return `vm_${level}.${vmVar ? vmVar.reflect : varName}`;
}
/** $args 和 $event 是保留的两个特殊参数名。$event 会被替换为 args[0]，$args 会被替换为 args */
function getVar(name: string, _visitor: TemplateVisitor) {
  return name === '$args' ? 'args' : name === '$event' ? 'args[0]' : getVarVmReflect(name, _visitor);
}
export function parseListener(_visitor: TemplateVisitor, str: string, tag: Record<string, boolean>, pos: Position) {
  let tree;
  try {
    tree = Parser.parse(str, {
      locations: true,
      ecmaVersion: 'latest',
      sourceType: 'module',
    }) as unknown as { body: ExpressionStatement[] };
  } catch (ex) {
    throw logParseError(_visitor, pos, 'parse error: ' + ex.message);
  }

  if (!tree.body?.length) {
    throw logParseError(_visitor, pos, 'empty event listener');
  }

  const replaces: ReplaceItem[] = [];
  function loopReplace(node: Expression & Node) {
    walkAcorn(node, {
      Identifier: (id: Identifier & Node) => {
        sortedInsert(replaces, {
          sn: id.start,
          se: id.end,
          code: getVar(id.name, _visitor),
        });
        return false;
      },
      MemberExpression: (me: MemberExpression) => {
        const obj = me.object as Expression & Node;
        if (obj.type === 'Identifier') {
          sortedInsert(replaces, {
            sn: obj.start,
            se: obj.end,
            code: getVar(obj.name, _visitor),
          });
        } else {
          loopReplace(me.object as Expression & Node);
        }
        if (me.property.type !== 'Identifier' && me.property.type !== 'Literal') {
          loopReplace(me.property as Expression & Node);
        }
        return false;
      },
    });
  }
  loopReplace(tree as unknown as Expression & Node);
  let code = getReplaceResult(replaces, str);
  const type = tree.body[0]?.expression?.type;
  if (tree.body.length === 1 && (type === 'Identifier' || type === 'MemberExpression')) {
    code += '(...args);';
  }
  return {
    code,
    tag,
  };
}
