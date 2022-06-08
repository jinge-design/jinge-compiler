import path from 'path';

export { TemplateParser, TemplateParserOptions } from './template/index';
export { ComponentParser, ComponentParseOptions } from './component/index';

export const JingeComponentLoader = path.resolve(__dirname, './webpack/component-loader');
export const JingeTemplateLoader = path.resolve(__dirname, './webpack/template-loader');

/**
 * 用于快速配置 jinge-loader 的 rules：
 * .c.{ts,js} 结尾的文件，或 .c 结尾的目录下的 index.{ts,js} 文件，使用 JingeComponentLoader 处理。
 * .html 结尾的文件，使用 JingeTemplateLoader 处理。
 **/
export const JingeRules = [
  {
    test: /(\.c\.(ts|js)$)|(\.c\/index\.(ts|js)$)/,
    use: JingeComponentLoader,
  },
  {
    test: /\.html$/,
    use: JingeTemplateLoader,
  },
];
