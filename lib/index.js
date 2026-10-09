/**
 * dsh-image-annotate 宿主半区（host half）。
 *
 * 本插件是纯客户端外观插件：宿主侧只负责让包作为 cordis bundle 行挂载
 * （loader entry），使 client-modules 扫描到 package.json 里的 dsh.client
 * 声明与 exports["./client"]，把浏览器半区编入 Web 清单。
 *
 * 浏览器半区的全部实现见 lib/client.js（手写、无构建步骤）。
 */
export const name = 'image-annotate';

export function apply(ctx) {
  ctx.logger?.debug?.('[dsh-image-annotate] host half loaded (client-only image annotation)');
}
