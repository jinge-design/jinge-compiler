import { generate } from 'escodegen';
import { Node } from 'acorn';
import { CallExpression, ConditionalExpression, Expression, Identifier, MemberExpression, Statement } from 'estree';
import { isSimpleProp } from '../../util';
import { sharedOptions } from '../../options';
import { walkAcorn } from './helper';
import { MememberPath, parseExprMemberNode } from './parseExprMemberNode';
import { TemplateVisitor } from './visitor';
import { VM } from './common';

type P = {
  vm: string;
  n: string;
};
const addPath = (p: P, wps: P[]) => {
  if (!wps.find((ep) => ep.vm === p.vm && ep.n === p.n)) wps.push(p);
};

function replaceExpr(nodeExpr: CallExpression, root: Identifier, props: MememberPath[]) {
  if (props.length <= 1) return;

  /*
   * convert member expression to optional chain expression:
   *   a.b.c["d"].e ===>  a?.b?.c?.["d"]?.e
   * TODO: use browser optional chain when acorn supported.
   *   https://github.com/acornjs/acorn/pull/891
   */

  const _decl = {
    type: 'VariableDeclaration',
    declarations: new Array(props.length - 1).fill(0).map((n, i) => ({
      type: 'VariableDeclarator',
      id: { type: 'Identifier', name: `_${i}` },
      init: null,
    })),
    kind: 'let',
  };
  let tmp: ConditionalExpression | Identifier;
  props.forEach((p, i) => {
    if (i === 0) {
      tmp = {
        type: 'Identifier',
        name: root.name,
      };
      return;
    }
    const isSp = p.type === 'const' && isSimpleProp(p.value);
    tmp = {
      type: 'ConditionalExpression',
      alternate: {
        type: 'MemberExpression',
        computed: !isSp,
        optional: false,
        object: {
          type: 'Identifier',
          name: `_${i - 1}`,
        },
        property:
          isSp || p.type === 'id'
            ? {
                type: 'Identifier',
                name: p.value as string,
              }
            : {
                type: 'Literal',
                value: p.value as string,
              },
      },
      consequent: {
        type: 'UnaryExpression',
        operator: 'void',
        argument: {
          type: 'Literal',
          value: 0,
          raw: '0',
        },
        prefix: true,
      },
      test: {
        type: 'LogicalExpression',
        operator: '||',
        left: {
          type: 'BinaryExpression',
          operator: '===',
          left: {
            type: 'AssignmentExpression',
            operator: '=',
            left: {
              type: 'Identifier',
              name: `_${i - 1}`,
            },
            right: tmp,
          },
          right: {
            type: 'Literal',
            value: null,
            raw: 'null',
          },
        },
        right: {
          type: 'BinaryExpression',
          operator: '===',
          left: {
            type: 'Identifier',
            name: `_${i - 1}`,
          },
          right: {
            type: 'UnaryExpression',
            operator: 'void',
            argument: {
              type: 'Literal',
              value: 0,
              raw: '0',
            },
            prefix: true,
          },
        },
      },
    };
  });
  const _rtn = {
    type: 'ReturnStatement',
    argument: tmp,
  };
  nodeExpr.type = 'CallExpression';
  (nodeExpr as CallExpression).callee = {
    type: 'FunctionExpression',
    id: null,
    params: [],
    body: {
      type: 'BlockStatement',
      body: [_decl as Statement, _rtn as Statement],
    },
    generator: false,
    // expression: false,
    async: false,
  };
  nodeExpr.arguments = [];
}
function convert(nodeExpr: Expression, root: Identifier, props: MememberPath[], _vms: VM[], watchPaths: P[]) {
  const varName = root.name;
  const vmVar = _vms.find((v) => v.name === varName);
  const level = vmVar ? vmVar.level : 0;
  root.name = `vm_${level}.${vmVar ? vmVar.reflect : varName}`;

  replaceExpr(nodeExpr as CallExpression, root, props);

  if (varName.startsWith('_')) {
    // do not need watch private property.
    return;
  }
  if (vmVar) {
    props[0].value = vmVar.reflect;
  }
  addPath(
    {
      vm: `vm_${level}`,
      n: JSON.stringify(props.map((p) => p.value)),
    },
    watchPaths,
  );
}

export function parseExprNode(
  _visitor: TemplateVisitor,
  info: {
    startLine: number;
    vars: string[];
  },
  expr: Expression,
  levelPath: string[],
) {
  const computedMemberExprs: ReturnType<typeof parseExprMemberNode>[] = [];
  const watchPaths: P[] = [];

  walkAcorn(expr as unknown as Node, {
    CallExpression: (node: CallExpression) => {
      _visitor._throwParseError(
        {
          line: info.startLine + node.loc.start.line - 1,
          column: node.loc.start.column,
        },
        'Function call is not allowed in expression',
      );
    },
    Identifier: (node: Identifier) => {
      convert(
        node,
        node,
        [
          {
            type: 'const',
            value: node.name,
          },
        ],
        _visitor._vms,
        watchPaths,
      );
      return false;
    },
    MemberExpression: (node: MemberExpression) => {
      const mn = parseExprMemberNode(_visitor, node, info.startLine);
      if (mn.computed < 1) {
        convert(mn.memExpr, mn.root, mn.paths, _visitor._vms, watchPaths);
      } else {
        computedMemberExprs.push(mn);
      }
      return false;
    },
  });

  const levelId = levelPath.join('_');
  const parentLevelId = levelPath.slice(0, levelPath.length - 1).join('_');

  if (computedMemberExprs.length === 0) {
    if (levelPath.length === 1) {
      const needWrapViewModel = expr.type === 'ObjectExpression' || expr.type === 'ArrayExpression';
      return [
        '',
        `const fn_$ROOT_INDEX$ = () => {\n  $RENDER_START$${
          needWrapViewModel ? `vm${sharedOptions.symbolPostfix}(` : ''
        }${generate(expr)}${needWrapViewModel ? ')' : ''}$RENDER_END$\n};`,
        'fn_$ROOT_INDEX$();',
        '',
        `${watchPaths
          .map((p) => `${p.vm}[$$${sharedOptions.symbolPostfix}].__watch(${p.n}, fn_$ROOT_INDEX$, $REL_COM$);`)
          .join('\n')}`,
      ];
    } else {
      return [
        `let _${levelId};`,
        `function _calc_${levelId}() {
_${levelId} = ${generate(expr)};
}`,
        `_calc_${levelId}();`,
        `function _update_${levelId}() {
_calc_${levelId}();
_notify_${parentLevelId}();
_update_${parentLevelId}();
}`,
        `${watchPaths
          .map((p) => `${p.vm}[$$${sharedOptions.symbolPostfix}].__watch(${p.n}, _update_${levelId}, $REL_COM$);`)
          .join('\n')}`,
      ];
    }
  } else {
    const assignCodes: string[] = [];
    const calcCodes: string[] = [];
    const initCodes: string[] = [];
    const updateCodes: string[] = [];
    const watchCodes: string[] = [];
    computedMemberExprs.forEach((cm, i) => {
      const lv = levelPath.slice().concat([i.toString()]);
      const lv_id = lv.join('_');
      const __p = [];
      let __si = 0;
      assignCodes.push(`let _${lv_id};\nlet _${lv_id}_p;`);
      cm.paths.forEach((cmp, pidx) => {
        if (cmp.type === 'const') {
          __p.push(JSON.stringify(cmp.value));
          return;
        }
        if (cmp.type === 'id') {
          throw new Error('unexpected');
        }
        const llv = lv.slice().concat([(__si++).toString()]);
        const [_ac, _cc, _ic, _uc, _wc] = parseExprNode(
          _visitor,
          info,
          (cmp.value as MemberExpression).property as Identifier,
          llv,
        );
        _ac && assignCodes.push(_ac);
        _cc && calcCodes.push(_cc);
        _ic && initCodes.push(_ic);
        _uc && updateCodes.unshift(_uc);
        _wc && watchCodes.push(_wc);
        (cmp.value as MemberExpression).property = {
          type: 'Identifier',
          name: `_${llv.join('_')}`,
        };
        __p.push(((cmp.value as MemberExpression).property as Identifier).name);
        cm.paths[pidx] = {
          type: 'id',
          value: ((cmp.value as MemberExpression).property as Identifier).name,
        };
      });
      const vmVar = _visitor._vms.find((v) => v.name === cm.root.name);
      const level = vmVar ? vmVar.level : 0;
      cm.root.name = `vm_${level}.${vmVar ? vmVar.reflect : cm.root.name}`;
      if (vmVar) {
        __p[0] = `'${vmVar.reflect}'`;
      }
      replaceExpr(cm.memExpr as unknown as CallExpression, cm.root, cm.paths);
      calcCodes.push(`function _calc_${lv_id}() {
_${lv_id} = ${generate(cm.memExpr)};
}`);
      updateCodes.unshift(`function _update_${lv_id}() {
_calc_${lv_id}();
_update_${levelId}();
}
function _notify_${lv_id}() {
const _np = [${__p.join(', ')}];
const _eq = _${lv_id}_p && arrayEqual${sharedOptions.symbolPostfix}(_${lv_id}_p, _np);
if (_${lv_id}_p && !_eq) {
  vm_${level}[$$${sharedOptions.symbolPostfix}].__unwatch(_${lv_id}_p, _update_${lv_id}, $REL_COM$);
}
if (!_${lv_id}_p || !_eq) {
  _${lv_id}_p = _np;
  vm_${level}[$$${sharedOptions.symbolPostfix}].__watch(_${lv_id}_p, _update_${lv_id}, $REL_COM$);
}
}`);
      initCodes.push(`_calc_${lv_id}();`);
      watchCodes.push(`_notify_${lv_id}();`);
      (cm.memExpr as unknown as Identifier).type = 'Identifier';
      (cm.memExpr as unknown as Identifier).name = `_${lv_id}`;
    });

    if (levelPath.length === 1) {
      const needWrapViewModel = expr.type === 'ObjectExpression' || expr.type === 'ArrayExpression';
      calcCodes.push(`function _calc_${levelId}() {
$RENDER_START$${needWrapViewModel ? `vm${sharedOptions.symbolPostfix}(` : ''}${generate(expr)}${
        needWrapViewModel ? ')' : ''
      }$RENDER_END$
}`);
      initCodes.push(`_calc_${levelId}();`);
      updateCodes.unshift(`function _update_${levelId}() { _calc_${levelId}(); }`);
      watchCodes.push(
        `${watchPaths
          .map((p) => `${p.vm}[$$${sharedOptions.symbolPostfix}].__watch(${p.n}, _calc_${levelId}, $REL_COM$);`)
          .join('\n')}`,
      );
    } else {
      calcCodes.push(`function _calc_${levelId}() {
_${levelId} = ${generate(expr)};
}`);
      updateCodes.unshift(`function _update_${levelId}() {
_calc_${levelId}();
_notify_${parentLevelId}();
}`);
      initCodes.push(`_calc_${levelId}();`);
      watchCodes.push(
        `${watchPaths
          .map((p) => `${p.vm}[$$${sharedOptions.symbolPostfix}].__watch(${p.n}, _update_${levelId}, $REL_COM$);`)
          .join('\n')}`,
      );
    }

    return [
      assignCodes.join('\n'),
      calcCodes.join('\n'),
      initCodes.join('\n'),
      updateCodes.join('\n'),
      watchCodes.join('\n'),
    ];
  }
}
