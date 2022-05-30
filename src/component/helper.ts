import { ExpressionStatement, VariableDeclaration } from 'estree';
import { isArray } from '../util';

export function _n_wrap(postfix: string): VariableDeclaration {
  return {
    type: 'VariableDeclaration',
    declarations: [
      {
        type: 'VariableDeclarator',
        id: {
          type: 'Identifier',
          name: `__vm${postfix}`,
        },
        init: {
          type: 'MemberExpression',
          optional: false,
          object: {
            type: 'MemberExpression',
            optional: false,
            object: {
              type: 'ThisExpression',
            },
            property: {
              type: 'Identifier',
              name: `$$${postfix}`,
            },
            computed: true,
          },
          property: {
            type: 'Identifier',
            name: 'proxy',
          },
          computed: false,
        },
      },
    ],
    kind: 'const',
  };
}

export function _n_vm(idx: number, stmt: unknown, an: string, props: (string | string[])[], postfix: string) {
  const ss: unknown[] = [
    {
      type: 'VariableDeclaration',
      declarations: [
        {
          type: 'VariableDeclarator',
          id: {
            type: 'Identifier',
            name: `fn_${idx}${postfix}`,
          },
          init: {
            type: 'ArrowFunctionExpression',
            id: null,
            params: [],
            body: {
              type: 'BlockStatement',
              body: [stmt],
            },
            generator: false,
            expression: false,
            async: false,
          },
        },
      ],
      kind: 'const',
    },
    {
      type: 'ExpressionStatement',
      expression: {
        type: 'CallExpression',
        callee: {
          type: 'Identifier',
          name: `fn_${idx}${postfix}`,
        },
        arguments: [] as unknown[],
      },
    },
  ];
  const sprops: unknown[] = props.map((prop) => {
    return {
      type: 'ExpressionStatement',
      expression: {
        type: 'CallExpression',
        callee: {
          type: 'MemberExpression',
          computed: false,
          object: {
            type: 'MemberExpression',
            computed: true,
            object: {
              type: 'Identifier',
              name: an,
            },
            property: {
              type: 'Identifier',
              name: `$$${postfix}`,
            },
          },
          property: {
            type: 'Identifier',
            name: `__watch`,
          },
        },
        arguments: [
          isArray(prop)
            ? {
                type: 'ArrayExpression',
                elements: prop.map((p) => ({
                  type: 'Literal',
                  value: p,
                  raw: JSON.stringify(p),
                })),
              }
            : {
                type: 'Literal',
                value: prop,
                raw: JSON.stringify(prop),
              },
          {
            type: 'Identifier',
            name: `fn_${idx}${postfix}`,
          },
        ],
      },
    };
  });
  return ss.concat(sprops) as unknown as ExpressionStatement[];
}
