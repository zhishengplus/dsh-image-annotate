# 发布指南

## 当前状态

仓库已经发布：**https://github.com/zhishengplus/dsh-image-annotate**（公开）。

还剩三件可选的事，互不依赖，按需做：

| 目标 | 需要什么 | 说明 |
|---|---|---|
| ① npm 上架 | 一个 npm 账号（个人 scope 即可） | 之后用户能 `dsh plugin add @<scope>/dsh-image-annotate` |
| ② 上架插件市场 dsh-plug.in | 给 `dsh-plugins/dsh-plugin-market` 提 PR | **任何人都能提**；本仓库 `market/` 里已备好描述文件 |
| ③ 收进 `dsh-plugins` 组织 | 组织成员权限（owner：古镇天Gugle） | 收编后包名可改成 `@dsh-plugin/dsh-image-annotate` |

## ① 发到 npm

```powershell
cd <repo>                                   # 本仓库根目录
npm login ; npm whoami                       # npm 用户名就是你的个人 scope

# 用 https://github.com/<user>/dsh-image-annotate 当仓库地址时，名字可以保持 @dsh-plugin 之外的形式；
# 换 scope 会同时改 package.json / cordis.patch.yml / lib/client.js 三处：
node scripts/rename-scope.mjs @<你的npm用户名>
npm run check

npm pack --pack-destination dist             # 产出 <包名>-0.1.0.tgz
npm publish dist/<包名>-0.1.0.tgz --access public
```

发布后建议把 README 顶部徽章换成 npm 版本徽章：

```md
[![npm](https://img.shields.io/npm/v/<包名>.svg)](https://www.npmjs.com/package/<包名>)
```

### 用 GitHub Actions 自动发（可选）

仓库已带 `.github/workflows/npm-publish.yml`：

1. npm → Access Tokens → 生成 **Automation** token（对该包有 publish 权限）；
2. GitHub 仓库 → Settings → Secrets and variables → Actions → 新建 secret：`NPM_TOKEN`；
3. 以后发版：`npm version patch` → `git push --follow-tags` → `gh release create vX.Y.Z --generate-notes`，
   workflow 会自动 `npm publish --provenance --access public`。

`.github/workflows/ci.yml` 每次 push/PR 都会跑：语法检查 + `npm pack --dry-run` + 两套 Playwright fixture 测试。

## ② 上架插件市场（dsh-plug.in）

市场是独立仓库 `dsh-plugins/dsh-plugin-market`，一个插件一个 JSON，PR 合并后自动聚合、站点自动刷新。

```powershell
gh repo fork dsh-plugins/dsh-plugin-market --clone --remote
cd dsh-plugin-market
git checkout -b add-dsh-image-annotate
# 把本仓库 market/dsh-plugins-dsh-image-annotate.json 复制进 plugins/
#   id 二选一：
#     "github:zhishengplus/dsh-image-annotate"      ← 还没发 npm 时用这个
#     "@<scope>/dsh-image-annotate"                 ← 发过 npm 之后用这个
git add plugins/dsh-plugins-dsh-image-annotate.json
git commit -m "Add DSH Image Annotate"
git push -u origin add-dsh-image-annotate
gh pr create --title "Add DSH Image Annotate" `
  --body "Image-lightbox annotation pen. Repo: https://github.com/zhishengplus/dsh-image-annotate"
```

字段规范见市场仓库 README：`id` / `name` / `description[]` / `support_versions` / `urls` / `relationship`。
本插件**零依赖**（不需要 dsh-loader），所以 `relationship` 是空数组。

## ③ 申请收进 dsh-plugins 组织

组织 owner 是 **古镇天Gugle**（`.github` 仓库 profile 里有 QQ 群 906233087）。
组织里的插件都是 `@dsh-plugin/*` 包名 + `dsh-plugins/*` 仓库 + 市场 JSON，与本仓库结构一致。
申请时可以直接发：

> 你好，我做了一个 DSH 插件想收进 dsh-plugins：
>
> - **dsh-image-annotate** —— 给图片预览（lightbox）加一支画笔：圈选 / 箭头 / 方框 / 文字，画完还能再选中拖动、缩放、改字，一键把标注后的 PNG 放进输入框发给模型
> - 仓库：https://github.com/zhishengplus/dsh-image-annotate
> - 依赖：**零依赖**（不 import 任何 `@deepseek-ai/*`，也不需要 dsh-loader；纯 DOM 叠加 + 手写 client bundle，无构建步骤）
> - 支持版本：dsh `0.2.0-rc.2` 实测通过
> - 验证：fixture 17 + 19 项、隔离实例真机端到端 21 项（含导出分辨率与附件投递断言），仓库带 CI
> - 希望：收进组织并发布为 `@dsh-plugin/dsh-image-annotate`（npm 上该名字未被占用），仓库可以转过去或我提 PR
>
> README（英文 / 中文）和演示 GIF 都在仓库里。

有权限之后（或对方建好仓库之后）：

```powershell
git remote set-url origin git@github.com:dsh-plugins/dsh-image-annotate.git
git push -u origin main
# 包名不用改（本来就是 @dsh-plugin/dsh-image-annotate），拿到 scope 权限后：
npm publish dist/dsh-plugin-dsh-image-annotate-0.1.0.tgz --access public
```

## 改包名 / 换 scope

插件身份写在三处，必须一致，否则浏览器端加载不到 bundle：

1. `package.json` → `name`
2. `cordis.patch.yml` → `insert[].name`（loader 按包名解析）
3. `lib/client.js` → `window.__ModuleLoader__.load({ id })`（模块表按包名注册）

```powershell
node scripts/rename-scope.mjs --check          # 检查三处是否一致
node scripts/rename-scope.mjs @<scope>         # 一键改三处
```

## 发布前检查清单

- [ ] `npm run check` 通过
- [ ] `python test/test_annotate.py` 与 `python test/test_edit.py` 全绿（或看 CI）
- [ ] `npm pack --dry-run` 只含运行时文件（不应出现 `test/`、`docs/`、`market/`、`scripts/`）
- [ ] `package.json` 的 `repository` / `homepage` / `bugs` 指向真实仓库
- [ ] `LICENSE` 署名正确
- [ ] `market/*.json` 的 `id` 与实际包名（或 `github:owner/repo`）一致
- [ ] 演示素材不含任何真实工作区 / 会话 / 账号信息（`docs/*` 由 `test/record_demo.py` 在全新实例上生成）
