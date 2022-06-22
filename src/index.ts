import path from 'path';

export { TemplateParser, TemplateParserOptions } from './template';
export { ComponentParser, ComponentParseOptions } from './component';

import * as util from './util';
export { util };

export const JingeComponentLoader = path.resolve(__dirname, './webpack/component-loader');
export const JingeTemplateLoader = path.resolve(__dirname, './webpack/template-loader');

export const JingeComponentRule = {
  test: /(\.c\.(ts|js)$)|(\.c\/index\.(ts|js)$)/,
  use: JingeComponentLoader,
};
export const JingeTemplateRule = {
  test: /\.html$/,
  use: JingeTemplateLoader,
};
/**
 * 用于快速配置 jinge-loader 的 rules：
 * .c.{ts,js} 结尾的文件，或 .c 结尾的目录下的 index.{ts,js} 文件，使用 JingeComponentLoader 处理。
 * .html 结尾的文件，使用 JingeTemplateLoader 处理。
 **/
export const JingeRules = [JingeComponentRule, JingeTemplateRule];

export function getJingeTemplateRuleWithAlias(alias: unknown) {
  return {
    test: JingeTemplateRule.test,
    use: {
      loader: JingeTemplateRule.use,
      options: {
        componentAlias: alias,
      },
    },
  };
}
