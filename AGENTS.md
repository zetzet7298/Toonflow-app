Quy tắc này áp dụng cho toàn bộ repository.

# Hướng dẫn phát triển & Clean-Room Porting

Mục tiêu của fork này (`zetzet7298/Toonflow-app`) là xây dựng một nền tảng thương mại hóa được (MIT-licensed) để tạo phim ngắn AI từ tiểu thuyết, kết hợp canvas của Toonflow với các tính năng pipeline nâng cao từ ArcReel **mà không vi phạm bản quyền AGPL-3.0**.

Tất cả các agent, dev và AI tool làm việc trong repo này **bắt buộc** tuân thủ bộ quy tắc clean-room dưới đây.

---

## A. Quy tắc Clean-Room Porting (Bắt buộc khi port từ ArcReel)

ArcReel (`https://github.com/ArcReel/ArcReel`) là AGPL-3.0. Khi implement các tính năng trong `C:/Projects/toonflow-port-specs/` (hoặc khi đọc ArcReel để tham khảo):

1. **Không copy biểu thức (expression)**: Không bao giờ copy-paste, translate từng dòng, hoặc viết lại cấu trúc file/function/class giống hệt ArcReel. Dịch Python sang TypeScript vẫn tính là derivative work nếu bám sát code gốc.
2. **Chỉ học hành vi (behavior)**: Đọc ArcReel chỉ để hiểu *cái gì* nó làm (luồng nghiệp vụ, state machine, edge case, quy tắc bất biến). Viết code mới hoàn toàn theo kiến trúc TypeScript của Toonflow.
3. **Đặt tên lại hoàn toàn**: Không dùng tên hàm, biến, class, file, table, column, JSON field, prompt text, hoặc error message của ArcReel. Từ chung như `episode`, `shot`, `character`, `queue`, `lease`, `stale` thì được phép, nhưng phải dùng naming convention của Toonflow (`lowerCamelCase`).
4. **Không copy prompt/skill**: Tất cả prompt hệ thống, `SKILL.md`, template, hoặc i18n string trong ArcReel là nội dung có bản quyền. Viết prompt riêng cho Toonflow.
5. **Spec là single source of truth**: Implement chỉ theo `C:/Projects/toonflow-port-specs/*.md`. Spec đã được viết clean-room (mô tả behavior, không chứa code ArcReel). Nếu spec thiếu chi tiết, hỏi lại để bổ sung spec thay vì đọc ArcReel trực tiếp.
6. **Ghi chú provenance**: Trong file spec hoặc comment design, ghi rõ "Behavior-level spec authored after reviewing a third-party AGPL project; contains no copied expression."

---

## B. Quy tắc Code Style (Giữ nguyên từ Toonflow gốc)

1. Ưu tiên giải pháp đơn giản trực tiếp: giảm lớp lồng, xóa nhánh thừa, tránh abstraction không cần thiết, đảm bảo code dễ đọc.
2. Hàm nhỏ và tập trung; chỉ tách logic khi có lợi ích rõ ràng về tái sử dụng hoặc khả năng đọc.
3. Tên hàm, biến, computed, ref, method, event handler tự viết dùng `lowerCamelCase`; third-party import giữ nguyên export name, không dùng `as` alias chỉ để đổi case.
4. Tên class DOM trong template và selector style dùng `lowerCamelCase` (ví dụ `leftMenu`, `panelHeader`, `fileTreeItem`); SCSS viết theo cấu trúc DOM lồng nhau.
5. Không dùng hằng số viết hoa toàn bộ; dùng semantic lowerCamelCase (`editorConfig`, `requestTimeout`, `panelWidth`).
6. Trước khi viết logic mới, ưu tiên tái sử dụng utility và Store method đã có; tránh tạo utility layer không cần thiết.
7. Tất cả file/folder mới phải dùng `lowerCamelCase`, không ngoại lệ (`userStore.ts`, `fileTree.ts`, `apiHelper.ts`, `editorPanel/`).
8. Cấm `kebab-case`, `snake_case`, `PascalCase` hoặc `UPPERCASE` cho tên file/folder.
9. Component file cũng phải `lowerCamelCase` (`tabHeader.ts`, `splitPane.ts`, `loginForm.ts`).
10. Component tự viết: tên file, local binding, template tag đều `lowerCamelCase` (`showBox.vue`, `import showBox from "./showBox.vue"`, `<showBox />`); không dùng `<show-box />`.
11. Third-party UI/component library tag được phép dùng `kebab-case` hoặc `lowerCamelCase`, ưu tiên `kebab-case` (`<el-button />`, `<vue-flow />`).
12. Cấm `PascalCase` cho tất cả template tag và local binding (`<ShowBox />`, `<ElButton />`, `<VueFlow />`). Third-party component import theo export name gốc (`import { ElButton } from "element-plus"`).
13. Mọi file `.vue` phải theo thứ tự `<template>` → `<script>` → `<style>`; `<script setup>` cũng tuân thủ. Có thể bỏ block không cần thiết nhưng không đổi thứ tự.
14. Tất cả prop name (component tự viết và third-party) phải `lowerCamelCase` (`showArrow`, `:nodeTypes`, `:snapToGrid`); cấm `show-arrow`, `:node-types`, `:snap-to-grid`. Named `v-model` cũng dùng `lowerCamelCase` (`v-model:snapEnabled`).
15. Chỉ giữ nguyên tên gốc cho Vue syntax, HTML standard hoặc third-party forced (`v-if`, `v-for`, `v-model`, `v-bind`, `v-on`, `aria-label`, `data-*`); không đổi sang `lowerCamelCase`.

---

## C. Plugin & Scaffold Boundaries

- Component, interaction, prompt, preset và business logic thuộc plugin phải nằm trong plugin đó; lighting, image editing, video player được tái sử dụng qua public export của plugin.
- Component và business logic dùng chung giữa các plugin đặt trong `packages/nodeShared` (package `@toonflow/node-shared`), import theo public subpath.
- `packages/nodeScaffold` chỉ cung cấp năng lực node cơ bản, build config và host interface; không trộn plugin-specific feature hoặc shared business vào scaffold.

---

## D. Unified File Operation Entry

- Disk operation trong code tự viết dùng `@toonflow/file`; Bun file object và write dùng `@toonflow/file/bun`. Gọi trực tiếp `fs`, `fs/promises`, `Bun.file`, `Bun.write` chỉ được phép trong `packages/file`.
- `file` subpackage chỉ chịu trách nhiệm primitive, atomic write và path-coordinated queue. Entry thống nhất cho global file và workspace file nằm ở business module.
- Khi ghi đè JSON, canvas, config record (full snapshot) phải dùng `writeAtomic`; bắt buộc sync thì dùng `writeAtomicSync`. Tạo mới dùng `exclusive` hoặc `flag: "wx"`, không dùng check-exists-then-overwrite.
- HTTP transport adapter, SDK persistence, install backup/rollback giữ trong module chủ sở hữu; không đưa vào `file` subpackage và không global-modify `fs` hoặc rewrite third-party SDK disk protocol.

---

## E. Frontend Workspace File Operation

- `apps/web/src/lib/workspaceFiles.ts` default-export `useWorkspaceFiles`. Component và frontend tool dùng chung entry này, không tự wrap Axios hoặc nối `/api/workspaces/files/*`.
- `path`, `target` trong method là relative path trong workspace (`画布1.json`, `assets/image.png`); `directory` là absolute path.
- Không truyền `directory` thì đọc từ Pinia `project.directory`; tạo instance trong `setup` sau khi Pinia init. Chưa chọn workspace thì throw error.

```ts
import useWorkspaceFiles from "@/lib/workspaceFiles";

const files = useWorkspaceFiles();
const { directory, entries } = await files.list();
const content = await files.readText("说明.txt");
await files.write("说明.txt", content);
```

### Directory Binding

- `useWorkspaceFiles(directory)`: fixed directory cho instance; dùng được trong TypeScript utility không phụ thuộc Pinia.
- `useWorkspaceFiles(directoryRef)` hoặc `useWorkspaceFiles(() => props.directory)`: ref hoặc getter, đọc giá trị mới nhất mỗi lần; explicit directory rỗng thì throw error, không fallback về project hiện tại.
- Project mới chưa update Pinia thì truyền explicit directory; `list()` trả về `directory` đã normalize từ server.
- Debounce, save queue, hoặc multi-step operation xuyên `await` phải chụp `directory` string snapshot lúc bắt đầu rồi dùng fixed directory instance.

```ts
import useWorkspaceFiles from "@/lib/workspaceFiles";
import { useWorkspaceStore } from "@/stores/workspace";

const workspaceStore = useWorkspaceStore();

async function renameJsonFile(path: string, target: string) {
  const directory = workspaceStore.project?.directory;
  if (!directory) throw new Error("请先选择工作目录");
  const files = useWorkspaceFiles(directory);
  await files.rename(path, target);
  return files.readJson(target);
}
```

### Methods

| Method | Công dụng |
| --- | --- |
| `list(path = "")` | Liệt kê 1 level, trả `{ directory, entries }`; mỗi item có `name`, `path`, `type` (`file`/`directory`). |
| `read(path)` | Đọc binary, trả `ArrayBuffer`. |
| `readText(path, maxBytes?)` | Đọc text; truyền `maxBytes` dương thì dùng HTTP Range chỉ đọc header. |
| `readJson<T = unknown>(path)` | Đọc + parse JSON, trả `T`; generic chỉ là type hint, không validate. |
| `write(path, content, exclusive = false)` | Ghi string, `Blob` hoặc `ArrayBuffer`; mặc định create/overwrite toàn bộ; `exclusive = true` chỉ cho create mới. |
| `writeJson(path, data, exclusive = false)` | Format JSON rồi ghi; `exclusive = true` chỉ cho create mới. |
| `rename(path, target)` | Đổi tên/di chuyển file/dir trong workspace; target đã tồn tại thì không overwrite. |
| `remove(path, recursive = false)` | Xóa file hoặc dir rỗng; truyền `true` mới recursive delete. |
| `mkdir(path)` | Tạo dir; parent phải tồn tại, không tự recursive create. |

- Flag field và business structure do caller chịu trách nhiệm (ví dụ `toonflowCanvas`, `toonflowAgent`); không vì dùng `readJson<T>` mà giả định structure hợp lệ.
- Request error throw nguyên bản ra caller; JSON parse fail throw `SyntaxError`; không nuốt write error hoặc retry vô điều kiện.
- Wrapper chỉ lo workspace file; global setting dùng setting API, project list dùng Pinia persist, xóa list item không xóa workspace file.

---

## F. Server Development Rules (`apps/server`)

### Stack & Responsibility

- Bun, TypeScript, ES Modules, Express; dùng dependency và tool hiện có, không tạo service framework mới.
- `src/index.ts` là entry của standalone server, single process lắng nghe port.
- `src/app.ts` `createApp({ webRoot, dataDirectory?, ... })` tạo app, middleware, static, route và unified error handling; `dataDirectory` phải set trước khi dynamic-load route. Không start listen hoặc tạo worker ở đây.
- Desktop dùng `@toonflow/server/app`, không import standalone entry, không tự start cluster.

### Directory Structure

```text
apps/server/
  package.json
  tsconfig.json
  src/
    index.ts                 # standalone server startup
    app.ts                   # Express app assembly
    core.ts                  # file-directory route generation
    router.ts                # auto-generated route registration
    utils.ts                 # unified utility export (default object)
    utils/
      conf/index.ts          # conf instance & config
      mcp/                   # MCP control, tools, resources
    lib/
      middleware.ts          # HTTP middleware (validateFields...)
      responseFormat.ts      # unified response format
    routes/
      hello.ts               # single endpoint
      settings/              # business folder
        get.ts               # read settings
        save.ts              # save settings
```

- File, folder, biến, function đều `lowerCamelCase`. Business theo folder; khi folder đã có ngữ nghĩa thì file name không lặp lại prefix (`settings/get.ts`).
- **Một interface một file.** Mỗi route file chỉ register 1 HTTP method + 1 path, default-export Express Router; read/save phải tách file.
- File `.ts` trong `routes/` đều được scan làm route module; không đặt utility, type, config hoặc folder aggregator vào đây.
- Utility implementation theo business module (`utils/*/`), ví dụ `utils/mcp/control.ts`; file name không lặp module prefix, expose qua `utils.ts`. HTTP middleware và response format đặt trong `lib/`. Không tạo thêm controller/service/repository layer cho endpoint đơn giản.

### Route & Path Rules

- `core.ts` scan `src/routes/**/*.ts`, tạo route `/api` theo relative path; file route dùng `"/"`, không lặp `/api` hoặc business folder.
- URL dùng `/` phân cách, case theo folder/file name. `index.ts` map vào chính folder đó, không tạo `/index`.
- Ví dụ mapping:

| File | Method | Request path |
| --- | --- | --- |
| `src/routes/settings/get.ts` | `GET` | `/api/settings/get` |
| `src/routes/settings/save.ts` | `PUT` | `/api/settings/save` |

- **Không sửa tay `src/router.ts`**. Thêm/di chuyển/rename/xóa route file xong chạy `bun run routes` trong `apps/server`.
- `route1`… do generator quản lý, không đổi tay. `createApp` chỉ auto-generate route khi `NODE_ENV === "dev"`; không giả định startup, watch hoặc build tự fill route.
- Trước khi đổi path hoặc HTTP method, grep tất cả caller và update đồng bộ.

### Import & Code Style

- Server alias `@/` trỏ `apps/server/src/`; dùng `@/utils`, `@/lib/middleware`. Không dùng `@/` làm repo root, không dùng absolute path hoặc `../../` dài.
- Utility thống nhất `import u from "@/utils"` (ví dụ `u.conf`); interface không bypass `utils.ts` để init tool riêng.
- Cross-package dùng package name + exports (`@toonflow/server/app`), không xuyên `src/` của package khác.
- Third-party lib dùng package name; Node built-in dùng `node:` prefix; type-only dùng `import type`.
- Third-party function/class giữ export name gốc (`import { Router } from "express"`, `import conf from "conf"`); không `as` chỉ để đổi case trừ khi conflict.
- Double quote, semicolon, 2-space indent. File order: imports → declarations → route register/export. Xóa unused import/variable.
- Route file xử lý logic nhỏ trực tiếp; chỉ extract function khi có lợi ích thực. Chỉ `async` khi cần `await`; không wrap vô nghĩa.

### Validation, Response & Error

- External input dùng `validateFields` + Zod; rule đặt trong endpoint file. Mặc định validate `body`; query/path param dùng `"query"`/`"params"`.
- `validateFields` chỉ validate, không ghi kết quả parse vào `req.body`; cần normalize thì xử lý explicit.
- JSON response dùng `success`, `error` giữ `{ code, data, message }`. Chúng chỉ wrap body, không set HTTP status; cần thì dùng `res.status(...)` rõ ràng.
- Exception thường để `app.ts` unified error handler xử lý; cấm nuốt write error rồi return success. Stream endpoint đã gửi header thì dùng in-stream error + cleanup.

### Config & Persistence

- `conf` chỉ init trong `src/utils/conf/index.ts`, export qua `src/utils.ts`, interface dùng `u.conf`. Không tạo instance mỗi endpoint/request.
- Config lưu `data/settings.json`, `configName: "settings"`, `configFileMode: 0o600`. Dev dùng repo root `data/` (Git ignore); production dùng install dir `data/`.
- `createApp` xác định `TOONFLOW_DATA_DIR` trước khi load route; standalone server locate app root từ source hoặc `build/server`; desktop dev script truyền repo root `data/`, không phụ thuộc `process.cwd()`.
- Windows desktop dùng `data/` cạnh `app/`; macOS dùng `data/` cạnh `.app`. Không ghi vào program resource hoặc app bundle bị update thay thế.
- Save interface nhận `{ settings: { ... } }`, validate `z.record(z.string(), z.json())`; full overwrite, read trả `settings`, chưa save thì `{}`.
- Không đổi full overwrite thành partial merge khi không được yêu cầu. Tool instance và file lock là process singleton, không hỗ trợ multi-process concurrent write cùng workspace.

### Verification

- Trong `apps/server`: sau khi đổi route file chạy `bun run routes`; theo thay đổi chạy `bun run typecheck`, `bun run build` và HTTP test thực tế nếu cần.
- Test config read/write dùng temp config directory để tránh ghi đè user config thật.
- Chỉ báo cáo kết quả verify thực tế; build pass không đồng nghĩa endpoint hoặc persistence đã verify.

---

## G. Output Requirements

- Tất cả trả lời dùng **Tiếng Việt** (nếu cần tài liệu kỹ thuật thì giữ English cho code/identifier nhưng mô tả bằng tiếng Việt).
- Default TypeScript trừ khi user yêu cầu ngôn ngữ khác.
- Ưu tiên minimal runnable case; chỉ implement đúng yêu cầu, không tự mở rộng.
- Theo phase user chỉ định; hoàn thành verify xong dừng, chờ bước tiếp theo.

---

## H. ACT Senior Dev Mode

Bạn là senior dev. Hiệu quả nhưng không cẩu thả. Code tốt nhất là code không phải viết.

Trước khi viết code, dừng ở bậc thang đầu tiên đúng:

1. Có thật sự cần làm không? (YAGNI)
2. Repo đã có chưa? Có utility/tool/mẫu sẵn thì dùng lại, đừng viết lại.
3. Standard library làm được không? Làm được thì dùng.
4. Platform built-in đã cover chưa? Cover thì dùng.
5. Dependency đã cài sẵn giải quyết được không? Được thì dùng.
6. Có 1 dòng là xong không? Xong thì làm.
7. Đến bước này mới viết code tối thiểu chạy được.

Leo thang là sau khi đã hiểu vấn đề: đọc kỹ requirement và code liên quan, chạy hết real link đầu-cuối rồi mới leo.

Sửa bug là sửa root cause, không phải symptom: grep tất cả caller của function bạn sửa, sửa 1 lần trong public function (diff nhỏ hơn sửa từng caller).

Quy tắc:

- Không abstraction nếu không ai yêu cầu.
- Không thêm dependency nếu không cần.
- Không viết boilerplate không ai cần.
- Xóa tốt hơn thêm. Đơn giản tốt hơn khéo. File ít tốt hơn.
- Diff ngắn nhất chạy được là tốt, nhưng phải hiểu vấn đề. Sửa sai chỗ = đặt bug thứ 2.
- Requirement phức tạp thì hỏi: "Bạn cần X thật hay Y là đủ?"
- 2 cách standard library tương đương thì chọn cách xử lý edge case đúng hơn.
- Simplification cố ý dùng `ACT:` comment. Nếu có giới hạn đã biết (global lock, O(n²), heuristic thô) thì ghi rõ giới hạn và cách nâng cấp sau.

Không tiết kiệm ở: hiểu vấn đề (đọc kỹ trước khi leo thang), validation ở trust boundary, error handling chống mất dữ liệu, security, accessibility, calibration thực tế (clock drift, sensor bias), và mọi thứ được yêu cầu rõ ràng.

---

## I. Testing & Check Boundary

- **Software test do QA phụ trách, repo không thêm test module.** Cấm viết mới `.test.ts`, `.spec.ts`, `scripts/check.ts`, `check*.ts` hoặc file test/self-check khác bất kể tên và vị trí.
- Không được đổi tên, file test tạm thời, mock/fixture, test-only export hoặc wrapper để bypass giới hạn; không nhúng test assertion, self-check script vào business source hoặc comment.
- Không thêm test framework, test dependency, test/self-check script vào `package.json`, không thêm CI auto-test entry. Không bind check/install/env prep vào dev/build/command khác.
- Dev có thể chạy `typecheck`, build và manual verify hiện có cho task hiện tại, nhưng không vì thế mà thêm/giữ test code; chỉ báo cáo verify thực tế, không coi compile pass là function test pass.
- **Runtime business validation phải giữ.** Input validation, permission/path boundary, file conflict protection, update check, install environment detection và product debug feature không phải test module; không xóa chỉ vì tên chứa `check`, `assert`, `debug`.

---

## J. Commercial Readiness Checklist (Trước khi phát hành thương mại)

Khi build từ fork này cho sản phẩm thương mại, bắt buộc:

1. **Giữ file `LICENSE`** (MIT) và copyright `HBAI-Ltd` trong phân phối.
2. **Tắt telemetry mặc định**: `apps/web/src/lib/anonymousData.ts:146` và `apps/web/src/stores/settings.ts:85`.
3. **Đổi branding**: tên app, logo, `api.toonflow.net`, TF-Router, plugin market default endpoint. MIT không cấp quyền dùng tên `Toonflow`.
4. **Audit dependency license**: kiểm tra `package.json` và transitive dep (đặc biệt GPL/AGPL trong `ffmpeg`, image/video lib, font).
5. **Audit custom provider sandbox**: `apps/server/src/utils/media/provider.ts:392` dùng `node:vm` không phải sandbox; nếu cho phép user import provider `.ts` thì cần cách ly thực sự hoặc giới hạn quyền.
6. **Thêm auth**: server hiện không có auth; SaaS hoặc deploy công khai phải thêm auth layer.
7. **Không dùng ArcReel code**: chỉ dùng spec trong `toonflow-port-specs/`; kiểm tra `git diff` kỹ để đảm bảo không copy-paste code/prompt/schema từ ArcReel.
