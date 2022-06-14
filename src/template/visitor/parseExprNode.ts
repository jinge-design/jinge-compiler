import { Node } from 'acorn';
import { CallExpression, Expression, Identifier, MemberExpression } from 'estree';
import { getReplaceResult, IMPORT_POSTFIX, ReplaceItem, sortedInsert, SYMBOL_POSTFIX } from '../../util';
import { walkAcorn } from './helper';
import { MememberPath, parseExprMemberNode } from './parseExprMemberNode';
import { TemplateVisitor } from './visitor';

type P = {
  vm: string;
  n: string;
};
const addPath = (p: P, wps: P[]) => {
  if (!wps.find((ep) => ep.vm === p.vm && ep.n === p.n)) wps.push(p);
};

type MemExp = { type: string; computed: boolean; object: MemExp; property: MemExp } & Node;
/**
 * 将 a.b["c"]["d"].e 转成 optional chain 格式，a?.b?.["c"]?.["d"]?.e ，渲染时可以避免报错。
 */
function replaceOptionalChain(replaces: ReplaceItem[], memnode: MemExp) {
  const walk = (mn: MemExp) => {
    sortedInsert(replaces, {
      sn: mn.object.end,
      se: mn.object.end,
      code: mn.computed ? '?.' : '?',
    });
    if (mn.object.type === 'MemberExpression') {
      walk(mn.object);
    }
  };
  walk(memnode);
}
function convert(_visitor: TemplateVisitor, node: Identifier & Node, props?: MememberPath[]) {
  const vmVar = _visitor._vms.find((v) => v.name === node.name);
  const level = vmVar ? vmVar.level : 0;
  const pn = props?.map((p) => p.value) || [node.name];
  if (vmVar) pn[0] = vmVar.reflect;
  return {
    code: `vm_${level}.${vmVar ? vmVar.reflect : node.name}`,
    path: {
      vm: `vm_${level}`,
      n: JSON.stringify(pn),
    },
  };
}
interface Rep {
  sn: number;
  se: number;
  code: string;
}
export function parseExprNode(
  _visitor: TemplateVisitor,
  info: {
    startLine: number;
    vars: string[];
    source: string;
  },
  expr: Expression & Node,
  levelPath: string[],
) {
  const computedMemberExprs: (ReturnType<typeof parseExprMemberNode> & { expr: MemberExpression & Node })[] = [];
  const watchPaths: P[] = [];
  const replaces: Rep[] = [];
  let isConst = true;
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
    Identifier: (node: Identifier & Node) => {
      let code;
      if (_visitor._imports.styles.has(node.name)) {
        code = node.name + IMPORT_POSTFIX;
      } else {
        const res = convert(_visitor, node);
        code = res.code;
        addPath(res.path, watchPaths);
        isConst = false;
      }
      sortedInsert(replaces, {
        sn: node.start,
        se: node.end,
        code,
      });
      return false;
    },
    MemberExpression: (memnode: MemberExpression & Node) => {
      const mn = parseExprMemberNode(_visitor, memnode, info.startLine);
      if (_visitor._imports.styles.has(mn.root.name)) {
        // mn.root.name += IMPORT_POSTFIX;
        sortedInsert(replaces, { sn: mn.root.start, se: mn.root.end, code: mn.root.name + IMPORT_POSTFIX });
        return false;
      }
      isConst = false;
      if (mn.computed < 1) {
        const res = convert(_visitor, mn.root, mn.paths);
        sortedInsert(replaces, {
          sn: mn.root.start,
          se: mn.root.end,
          code: res.code,
        });
        replaceOptionalChain(replaces, memnode as unknown as MemExp);
        addPath(res.path, watchPaths);
      } else {
        computedMemberExprs.push({
          ...mn,
          expr: memnode,
        });
      }
      return false;
    },
  });

  if (isConst) {
    // 如果没有 Identifier 或者 MemberExpression，说明是常量表达式。
    // 此外，对于 module css 表达式也作为常量处理。
    let code = getReplaceResult(replaces, info.source, expr).trim();
    if (code.startsWith('{') || code.startsWith('[')) {
      code = `vm${SYMBOL_POSTFIX}(${code})`;
    }
    return {
      isConst: true,
      codes: [code],
    };
  }

  // const exprCode = generate(expr);
  const levelId = levelPath.join('_');
  const parentLevelId = levelPath.slice(0, levelPath.length - 1).join('_');

  if (computedMemberExprs.length === 0) {
    const exprCode = getReplaceResult(replaces, info.source, expr);
    if (levelPath.length === 1) {
      const needWrapViewModel = expr.type === 'ObjectExpression' || expr.type === 'ArrayExpression';
      const codes = [
        '',
        `const fn_$ROOT_INDEX$ = () => {\n  $RENDER_START$${
          needWrapViewModel ? `vm${SYMBOL_POSTFIX}(` : ''
        }${exprCode}${needWrapViewModel ? ')' : ''}$RENDER_END$\n};`,
        'fn_$ROOT_INDEX$();',
        '',
        `${watchPaths
          .map((p) => `${p.vm}[$$${SYMBOL_POSTFIX}].__watch(${p.n}, fn_$ROOT_INDEX$, $REL_COM$);`)
          .join('\n')}`,
      ];
      return {
        isConst: false,
        codes,
      };
    } else {
      const codes = [
        `let _${levelId};`,
        `function _calc_${levelId}() {
  _${levelId} = ${exprCode};
}`,
        `_calc_${levelId}();`,
        `function _update_${levelId}() {
  _calc_${levelId}();
  _notify_${parentLevelId}();
  _update_${parentLevelId}();
}`,
        `${watchPaths
          .map((p) => `${p.vm}[$$${SYMBOL_POSTFIX}].__watch(${p.n}, _update_${levelId}, $REL_COM$);`)
          .join('\n')}`,
      ];
      return {
        isConst: false,
        codes,
      };
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
      const repls: ReplaceItem[] = [];
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
        const res = parseExprNode(_visitor, info, (cmp.value as MemberExpression).property as Expression & Node, llv);
        const [_ac, _cc, _ic, _uc, _wc] = res.codes;
        _ac && assignCodes.push(_ac);
        _cc && calcCodes.push(_cc);
        _ic && initCodes.push(_ic);
        _uc && updateCodes.unshift(_uc);
        _wc && watchCodes.push(_wc);
        const iname = `_${llv.join('_')}`;
        const pn = (cmp.value as MemberExpression).property as Node;
        sortedInsert(repls, {
          sn: pn.start,
          se: pn.end,
          code: iname,
        });
        __p.push(iname);
        cm.paths[pidx] = {
          type: 'id',
          value: iname,
        };
      });
      const vmVar = _visitor._vms.find((v) => v.name === cm.root.name);
      const level = vmVar ? vmVar.level : 0;
      sortedInsert(repls, {
        sn: cm.root.start,
        se: cm.root.end,
        code: `vm_${level}.${vmVar ? vmVar.reflect : cm.root.name}`,
      });
      if (vmVar) {
        __p[0] = `'${vmVar.reflect}'`;
      }
      replaceOptionalChain(repls, cm.expr as unknown as MemExp);
      calcCodes.push(`function _calc_${lv_id}() {
  _${lv_id} = ${getReplaceResult(repls, info.source, cm.expr)};
}`);
      updateCodes.unshift(`function _update_${lv_id}() {
  _calc_${lv_id}();
  _update_${levelId}();
}
function _notify_${lv_id}() {
  const _np = [${__p.join(', ')}];
  const _eq = _${lv_id}_p && arrayEqual${SYMBOL_POSTFIX}(_${lv_id}_p, _np);
  if (_${lv_id}_p && !_eq) {
    vm_${level}[$$${SYMBOL_POSTFIX}].__unwatch(_${lv_id}_p, _update_${lv_id}, $REL_COM$);
  }
  if (!_${lv_id}_p || !_eq) {
    _${lv_id}_p = _np;
    vm_${level}[$$${SYMBOL_POSTFIX}].__watch(_${lv_id}_p, _update_${lv_id}, $REL_COM$);
  }
}`);
      initCodes.push(`_calc_${lv_id}();`);
      watchCodes.push(`_notify_${lv_id}();`);
      sortedInsert(replaces, {
        sn: cm.expr.start,
        se: cm.expr.end,
        code: `_${lv_id}`,
      });
    });

    if (levelPath.length === 1) {
      const needWrapViewModel = expr.type === 'ObjectExpression' || expr.type === 'ArrayExpression';
      calcCodes.push(`function _calc_${levelId}() {
  $RENDER_START$${needWrapViewModel ? `vm${SYMBOL_POSTFIX}(` : ''}${getReplaceResult(replaces, info.source, expr)}${
        needWrapViewModel ? ')' : ''
      }$RENDER_END$
}`);
      initCodes.push(`_calc_${levelId}();`);
      updateCodes.unshift(`function _update_${levelId}() {\n  _calc_${levelId}();\n}`);
      watchCodes.push(
        `${watchPaths
          .map((p) => `${p.vm}[$$${SYMBOL_POSTFIX}].__watch(${p.n}, _calc_${levelId}, $REL_COM$);`)
          .join('\n')}`,
      );
    } else {
      calcCodes.push(`function _calc_${levelId}() {
  _${levelId} = ${getReplaceResult(replaces, info.source, expr)};
}`);
      updateCodes.unshift(`function _update_${levelId}() {
  _calc_${levelId}();
  _notify_${parentLevelId}();
}`);
      initCodes.push(`_calc_${levelId}();`);
      watchCodes.push(
        `${watchPaths
          .map((p) => `${p.vm}[$$${SYMBOL_POSTFIX}].__watch(${p.n}, _update_${levelId}, $REL_COM$);`)
          .join('\n')}`,
      );
    }

    return {
      isConst: false,
      codes: [
        assignCodes.join('\n'),
        calcCodes.join('\n'),
        initCodes.join('\n'),
        updateCodes.join('\n'),
        watchCodes.join('\n'),
      ],
    };
  }
}
