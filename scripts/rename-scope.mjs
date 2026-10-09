#!/usr/bin/env node
/**
 * 一键改包名/scope。
 *
 * 插件身份写在三处，必须一致，否则浏览器端加载不到 bundle：
 *   1. package.json            → name
 *   2. cordis.patch.yml        → insert[].name（loader 按包名解析）
 *   3. lib/client.js           → window.__ModuleLoader__.load({ id })（模块表按包名注册）
 *
 * 用法：
 *   node scripts/rename-scope.mjs @zhishengzz          # 改成 @zhishengzz/dsh-image-annotate
 *   node scripts/rename-scope.mjs @zhishengzz my-name  # 自定义包名
 *   node scripts/rename-scope.mjs --check              # 只打印当前三处的一致性
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PKG_JSON = join(root, 'package.json');
const PATCH_YML = join(root, 'cordis.patch.yml');
const CLIENT_JS = join(root, 'lib', 'client.js');

const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8'));
const current = pkg.name;

const [, , scopeArg, nameArg] = process.argv;

if (!scopeArg || scopeArg === '--check') {
  const clientId = /id:\s*"([^"]+)"/.exec(readFileSync(CLIENT_JS, 'utf8'))?.[1];
  const patchName = /name:\s*'([^']+)'/.exec(readFileSync(PATCH_YML, 'utf8'))?.[1];
  console.log('package.json name :', current);
  console.log('cordis.patch.yml  :', patchName);
  console.log('lib/client.js id  :', clientId);
  console.log(current === patchName && current === clientId ? '\n✓ 三处一致' : '\n✗ 三处不一致');
  process.exit(0);
}

const next = nameArg ? (nameArg.startsWith('@') ? nameArg : `${scopeArg}/${nameArg}`) : `${scopeArg}/dsh-image-annotate`;

if (!/^@[a-z0-9-~][a-z0-9-._~]*\/[a-z0-9-~][a-z0-9-._~]*$/.test(next)) {
  console.error(`包名不合法：${next}`);
  process.exit(1);
}

pkg.name = next;
writeFileSync(PKG_JSON, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
writeFileSync(PATCH_YML, readFileSync(PATCH_YML, 'utf8').replaceAll(current, next), 'utf8');
writeFileSync(CLIENT_JS, readFileSync(CLIENT_JS, 'utf8').replaceAll(current, next), 'utf8');

console.log(`✓ ${current} → ${next}`);
console.log('  已更新 package.json / cordis.patch.yml / lib/client.js');
console.log('  别忘了 market/*.json 里的 id 也要跟着改（或直接用 github:owner/repo）。');
