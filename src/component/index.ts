import { Node, Parser, Comment } from 'acorn';
import escodegen from 'escodegen';
import { RawSource, ReplaceSource, SourceMapSource } from 'webpack-sources';
import { RawSourceMap } from 'source-map';
import {
  BlockStatement,
  ClassDeclaration,
  ClassExpression,
  Expression,
  ExpressionStatement,
  FunctionExpression,
  Identifier,
  MemberExpression,
  MethodDefinition,
  Program,
  ThisExpression,
  VariableDeclaration,
} from 'estree';

import { prependTab, isString, isArray, arrayIsEqual, SYMBOL_POSTFIX } from '../util';
import { _n_vm, _n_wrap } from './helper';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AcornWalk = require('acorn-walk');

export interface ComponentParseOptions {
  resourcePath: string;
  emitErrorFn?: (err: unknown) => void;
  /**
   * @internal
   * 是否是用于构建 jinge 内核组件
   */
  _innerLib?: boolean;
}

export class ComponentParser {
  static parse(content: string, sourceMap: RawSourceMap, options: ComponentParseOptions) {
    return new ComponentParser(options).parse(content, sourceMap);
  }

  resourcePath: string;

  _replaces: { start: number; end: number; code: string }[];
  _innerLib: boolean;

  constructor(options: ComponentParseOptions) {
    this.resourcePath = options.resourcePath;
    this._innerLib = options._innerLib;
    this._replaces = null;
  }

  _walkAcorn(node: { type: string }, visitors: Record<string, (...args: unknown[]) => void | boolean>) {
    const baseVisitor = AcornWalk.base;
    (function c(node, state?: unknown, override?: string) {
      const found = visitors[node.type] || (override ? visitors[override] : null);
      let stopVisit = false;
      if (found) {
        if (found(node, state) === false) stopVisit = true;
      }
      if (!stopVisit) {
        baseVisitor[override || node.type](node as Node, state, c);
      }
    })(node);
  }

  walkClass(node: ClassDeclaration | ClassExpression) {
    const sc = node.superClass as unknown as { type: string; name: string };
    if (sc?.type !== 'Identifier' && sc?.name !== 'Component') {
      /* TODO: 支持 Component 有别名的写法 */
      return;
    }
    let constructorNode: MethodDefinition;
    for (let i = 0; i < node.body.body.length; i++) {
      const mem = node.body.body[i];
      if (mem.type !== 'MethodDefinition') continue;
      if (mem.kind === 'constructor') {
        constructorNode = mem;
      }
    }

    if (constructorNode) {
      this.walkConstructor(constructorNode as unknown as Node & MethodDefinition, node.id?.name || '-');
    }
  }

  _parse_mem_path(memExpr: MemberExpression, attrsName: string) {
    let paths: string[] = [];
    let computed = -1;
    let root: Expression = null;
    const walk = (node: MemberExpression) => {
      const objectExpr = node.object;
      const propertyExpr = node.property;
      if (node.computed) {
        if (propertyExpr.type === 'Literal') {
          paths.unshift(propertyExpr.value as string);
          if (computed < 0) computed = 0;
        } else {
          computed = 1;
          paths.unshift(null);
        }
      } else {
        if (propertyExpr.type !== 'Identifier') {
          throw new Error('not support');
        } else {
          paths.unshift(propertyExpr.name);
        }
      }
      if (objectExpr.type === 'ThisExpression') {
        root = objectExpr;
      } else if (objectExpr.type === 'Identifier') {
        root = objectExpr;
        paths.unshift(objectExpr.name);
      } else {
        if (objectExpr.type !== 'MemberExpression') {
          throw new Error('not support');
        } else {
          walk(objectExpr);
        }
      }
    };

    try {
      walk(memExpr);
    } catch (ex) {
      return null;
    }

    if (root.type !== 'Identifier' || root.name !== attrsName) {
      return null;
    }
    if (computed > 0) {
      // eslint-disable-next-line no-console
      console.error(
        `Warning: computed member expression is not supported.\n  > ${this.resourcePath}, line ${memExpr.loc.start.line}`,
      );
      return null;
    }

    paths = paths.slice(1);
    const privateIdx = paths.findIndex((p) => p.startsWith('_'));
    if (privateIdx >= 0) return null;
    return computed < 0 ? paths.join('.') : paths;
  }

  walkConstructor(node: Node & MethodDefinition, ClassName: string) {
    const fn = node.value as unknown as { body: Node & BlockStatement } & FunctionExpression;
    const an = fn.params.length === 0 ? null : (fn.params[0] as Identifier).name;
    if (!an) throw new Error(`constructor of ${ClassName} must accept at least one argument.`);
    let foundSupper = false;
    const vm = `__vm${SYMBOL_POSTFIX}`;
    /** 将 this.xx 转成 __vm.xx */
    const replaceThis = (stmt: ExpressionStatement) => {
      this._walkAcorn(stmt, {
        ThisExpression: (te: ThisExpression) => {
          const ts = te as unknown as Identifier;
          ts.type = 'Identifier';
          ts.name = vm;
          return false;
        },
      });
      return stmt;
    };
    const newBody: (ExpressionStatement | VariableDeclaration)[] = [];
    fn.body.body.forEach((stmt, i) => {
      if (stmt.type === 'ReturnStatement') {
        throw new Error(`constructor of '${ClassName}' can't have return statement.`);
      }
      if (stmt.type !== 'ExpressionStatement') {
        newBody.push(replaceThis(stmt as unknown as ExpressionStatement));
        return;
      }
      const expr = stmt.expression;
      if (expr.type === 'CallExpression') {
        if (expr.callee.type === 'Super') {
          if (expr.arguments.length === 0 || (expr.arguments[0] as Identifier).name !== an) {
            throw new Error(`constructor of ${ClassName} must pass first argument '${an}' to super-class`);
          }
          foundSupper = true;
          newBody.push(stmt);
          newBody.push(_n_wrap(SYMBOL_POSTFIX));
        } else {
          newBody.push(replaceThis(stmt));
        }
      } else if (expr.type === 'AssignmentExpression') {
        const exprLeft = expr.left;
        if (
          exprLeft.type !== 'MemberExpression' ||
          exprLeft.object.type !== 'ThisExpression' ||
          exprLeft.property.type !== 'Identifier' ||
          exprLeft.property.name.startsWith('_') ||
          exprLeft.computed
        ) {
          newBody.push(replaceThis(stmt));
          return;
        }
        if (!foundSupper) throw new Error("can't use 'this' before call super().");
        const props: (string | string[])[] = [];
        const addProp = (p: string | string[]) => {
          if (isString(p) && props.indexOf(p) < 0) props.push(p);
          if (isArray(p) && !props.find((sp) => arrayIsEqual(sp as string[], p))) props.push(p);
        };
        this._walkAcorn(expr.right, {
          MemberExpression: (node: MemberExpression) => {
            const paths = this._parse_mem_path(node, an);
            if (paths) addProp(paths);
            return false;
          },
        });
        if (props.length > 0) {
          newBody.push(..._n_vm(i, replaceThis(stmt), an, props, SYMBOL_POSTFIX));
        } else {
          newBody.push(replaceThis(stmt));
        }
      } else {
        newBody.push(replaceThis(stmt));
      }
    });
    fn.body.body = newBody;
    let newCode = escodegen.generate(fn.body, {
      indent: ''.padStart(2, ' '),
    });
    if (node.loc.start.column > 0) {
      const i = newCode.indexOf('\n');
      newCode = newCode.substring(i + 1);
      newCode = prependTab(newCode, false, node.loc.start.column);
      newCode = '{\n' + newCode;
    }

    this._replaces.push({
      start: fn.body.start,
      end: fn.body.end,
      code: newCode,
    });
  }

  async parse(code: string, origSrcMap: RawSourceMap) {
    const comments: Comment[] = [];
    let tree;
    try {
      tree = Parser.parse(code, {
        ranges: true,
        locations: true,
        ecmaVersion: 2020,
        sourceType: 'module',
        onComment: comments,
      }) as unknown as Program;
    } catch (ex) {
      throw new Error(ex.message + ' @ ' + this.resourcePath);
    }

    this._replaces = [];
    this._walkAcorn(tree, {
      ClassExpression: (node: ClassExpression) => {
        this.walkClass(node);
        return false;
      },
      ClassDeclaration: (node: ClassDeclaration) => {
        this.walkClass(node);
        return false;
      },
    });

    if (this._replaces.length === 0) {
      return {
        code,
        map: origSrcMap,
        ast: {
          webpackAST: {
            ...tree,
            comments,
          },
        },
      };
    }

    const sms = origSrcMap ? new SourceMapSource(code, this.resourcePath, origSrcMap) : new RawSource(code);
    const rs = new ReplaceSource(sms);
    rs.replace(
      0,
      0,
      `import { $$ as $$${SYMBOL_POSTFIX} } from '${this._innerLib ? '../vm/common' : 'jinge'}';\n` + code[0],
    );

    for (let i = 0; i < this._replaces.length; i++) {
      const r = this._replaces[i];
      rs.replace(r.start, r.end - 1, r.code);
    }
    return {
      code: rs.source(),
      map: rs.map(),
      ast: {
        webpackAST: {
          ...tree,
          comments,
        },
      },
    };
  }
}
