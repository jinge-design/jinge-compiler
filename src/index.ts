import path from 'path';

export { JingeWebpackI18NPlugin } from './plugin';
export const JingeLoader = path.resolve(__dirname, './loader.js');
/**
 * 用于快速配置 jinge-loader 的 rule，所有 .c.{ts,js,html} 结尾的文件，
 * 或 .c 结尾的目录下的 index.{ts,js,html} 文件使用 jinge-loader 处理。
 **/
export const JingeRule = {
  test: /(\.c\.(ts|js|html)$)|(\.c\/index\.(ts|js|html)$)/,
  use: JingeLoader,
};
