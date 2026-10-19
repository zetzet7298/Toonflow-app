# Hướng dẫn phát triển & mở rộng

[Trang chủ Toonflow](../README.md) · [Mục lục docs](./readme.md) · [Hướng dẫn đóng góp](../CONTRIBUTING.md) · [Quy tắc phát triển](../AGENTS.md)

Tài liệu này tổng hợp hướng dẫn phát triển plugin, chạy từ source, đóng gói desktop và phát hành update. Lần đầu tham gia dev, hãy đọc [hướng dẫn đóng góp](../CONTRIBUTING.md) trước.

## 🧩 Plugin & mở rộng model

Qua **Settings → Plugin Market** để khám phá và quản lý node, tool, skill; đầu market có thể mở [web market](https://api.toonflow.net/console/plugIn) và [tài liệu dev](https://qcn7xdsqgc4z.feishu.cn/docx/KNBNd9naqolsy6xjAOCcEAkqnRd). Market cần TF-Router API Key, chưa cấu hình sẽ hiện prompt điền.

| Loại mở rộng | Công dụng | Điểm vào dev |
| --- | --- | --- |
| Node | Thêm component tương tác, cổng input/output và thao tác node vào canvas. | [Node scaffold](../packages/nodeScaffold/readme.md) · [Node built-in](../packages/nodes/) |
| Tool | Thêm workspace operation, search, media generation cho Agent, có thể kèm UI tương tác. | [Tool scaffold](../packages/toolScaffold/readme.md) · [Tool built-in](../packages/tools/) |
| Skill | Mô tả quy trình sáng tạo, phương pháp và quy ước thao tác bằng `SKILL.md` + tài liệu kèm theo. | [Skill built-in](../packages/skills/) |
| Provider | Adapter cho model list, request param và media response của các nền tảng khác nhau. | [Provider implementation](../packages/providers/src/) |

Form cấu hình node/tool dùng chung rule `@form-create/element-ui`; có required field chưa điền thì nút config hiện chấm đỏ. Tool chỉ nhận config của chính nó, host không truyền full app settings.

Media interface gồm image, video, audio; năng lực thực tế do provider implement, hiện TF-Router media adapter built-in có image + video generation. Skill có thể cài global hoặc đặt trong `skill/` của workspace; trùng tên thì dùng bản workspace.

Khi cần điều khiển Toonflow từ Coding tool bên ngoài, bật service trong **Settings → MCP** và copy client config, hỗ trợ HTTP + stdio. Thao tác canvas/node cần giữ cửa sổ hoặc tab Toonflow mở; xem [hướng dẫn MCP](../packages/mcp/README.md).

<details>
<summary><strong>Cài plugin qua web (desktop deep link)</strong></summary>

Sau khi cài desktop client, web có thể gọi `toonflow://install` để cài plugin. App hiện loại, tên file và URL download, user xác nhận mới tải + cài.

```ts
const link = new URL("toonflow://install");
link.searchParams.set("type", "node");
link.searchParams.set("url", "https://example.com/plugins/exampleNode.umd.js");
window.location.href = link.href;
```

| `type` | Định dạng file | Vị trí cài |
| --- | --- | --- |
| `node` | `.umd.js` | `data/nodes/` |
| `tool` | `.tool.js` | `data/tools/` |
| `skill` | `SKILL.md`, `.zip`, `.tar`, `.tar.gz`, `.tgz` | `data/skills/<name>/` |
| `provider` | Media provider `.ts` | `data/providers/` |

URL phải HTTP/HTTPS, tên file lấy từ URL path. Node/tool/skill trùng tên cho phép update khi version cao hơn; ghi đè cùng version hoặc downgrade cần bật force install trong dev option. Provider không ghi đè trùng tên.

Plugin + skill package tối đa 20 MB, giải nén skill cũng chịu giới hạn; provider tối đa 2 MB. Skill package hỗ trợ ZIP và TAR, phải có `SKILL.md` với `name`, `description` frontmatter; tài nguyên phụ đặt cùng thư mục. TAR dùng USTAR thường, không link và không PAX/GNU extension.

Windows installer đăng ký protocol; macOS cần đặt app trong `/Applications` hoặc `~/Applications`. Dev mode trong browser thường không đăng ký desktop protocol.

</details>

---

## 🛠️ Dev & build

Frontend, business server và desktop cùng quản lý trong Bun Workspaces repo.

| Layer | Công nghệ |
| --- | --- |
| Runtime & package | Bun 1.3.14, Bun Workspaces |
| Frontend | Vue 3, Vite, TypeScript, Pinia, Element Plus, Vue Flow |
| Server | Bun, Express 5, Zod |
| Agent | Pi Agent SDK, tool plugin, Markdown skill + memory |
| Desktop | Electrobun; Windows dùng WebView2 + NSIS installer |
| 3D & media | Three.js, FFmpeg, media provider extensible |

### Dev local

Cài Git và Bun đúng version:

```sh
git clone https://github.com/zetzet7298/Toonflow-app.git
cd Toonflow-app
bun install

# Lần đầu hoặc sau khi sửa plugin, build node/tool sync vào data/
bun run dev:plugins

# Khởi động Web + Server đồng thời
bun run dev
```

Mở `http://localhost:5173`. Standalone server mặc định lắng nghe `3000`, Vite dev server proxy API. `dev` không tự build/sync plugin nên lần đầu cần `dev:plugins`.

### Lệnh thường dùng

Chạy ở repo root:

| Lệnh | Công dụng |
| --- | --- |
| `bun run dev:web` | Chỉ chạy Web dev server. |
| `bun run dev:server` | Chỉ chạy business Server. |
| `bun run dev:plugins` | Build node + tool, sync vào dev data dir. |
| `bun run dev:desktop` | Sync dev plugin, build Web, khởi động desktop app. |
| `bun run build` | Build tool, Web, Server, MCP, output skill + provider. |
| `bun run build:server` | Build node, tool, Web, Server, MCP, skill, provider cho deploy độc lập (Linux được). |
| `bun run build:nodes` | Build node vào `build/nodes/`, không ghi `data/nodes/`. |
| `bun run build:tools` | Build tool vào `build/tools/`, không ghi `data/tools/`. |
| `bun run start:server` | Chạy server đã build trong `build/server/`. |
| `bun run build:desktop` | Build desktop app + bundled resource cho platform hiện tại. |
| `bun run package:desktop` | Tạo Windows NSIS installer hoặc macOS DMG. |
| `bun run release:desktop <version> --auto` | Tạo installer, full update package, và patch nếu có version trước. |
| `bun run typecheck` | Type-check các workspace. |
| `bun run --cwd packages/i18n extract` | Extract Chinese source text + source index, không tạo bản dịch ngôn ngữ khác. |

Build và typecheck chạy riêng. Sau khi thêm/move/xóa business interface, chạy `bun run routes` trong `apps/server` để generate route.

### Đa ngôn ngữ

Language dictionary + translation runtime ở [`packages/i18n`](../packages/i18n/readme.md). Web explicit display position được Vite plugin transform lúc compile; business source vẫn dùng Chinese, dynamic text dùng `t`/`msg` template tag. Server dùng request language context tránh xuyên ngôn ngữ giữa concurrent request.

Sửa Chinese text xong chạy `extract` thủ công, rồi bổ sung key tương ứng trong `packages/i18n/src/locales/`, giữ placeholder. Dev startup và build không tự extract hoặc tự gen bản dịch. Dịch chỉ dùng hiển thị, không đổi user data, model body hoặc business judgement; provider, tool, node, node scaffold subpackage và installer không nằm trong phạm vi dịch. Chi tiết rule fallback và verification xem [i18n readme](../packages/i18n/readme.md).

<details>
<summary><strong>Chạy Web + Server đã build trên máy local</strong></summary>

Lần đầu chạy từ source, sau `bun install`:

```sh
bun run build:server
bun run start:server
```

Mở `http://localhost:3000`. Dùng `data/` mặc định ở repo root; lần khởi động đầu server khởi tạo built-in node, tool, skill, provider từ build artifact, giữ file plugin có sẵn. Khi migrate sang thư mục/máy khác cần mang cả runtime dependency, config và workspace, không chỉ copy `build/`.

Standalone server chạy single process. Desktop dùng chung `createApp`, lắng nghe local port do OS cấp. Directory selection, native save và desktop update interface chỉ có ở desktop host.

</details>

<details>
<summary><strong>Chuẩn bị build desktop: Windows và macOS</strong></summary>

Desktop script hỗ trợ Windows x64, macOS arm64 và macOS x64, phải build trên đúng OS + arch.

**Windows x64**

Dùng Electrobun 2.0.1. Package cần NSIS, mặc định tìm `C:/Program Files (x86)/NSIS/makensis.exe`, có thể chỉ định qua `NSIS_PATH`. Lần package đầu sẽ download + verify Microsoft WebView2 bootstrapper.

```sh
bun run build:desktop
bun run package:desktop
```

Installer output `build/desktop/artifacts/toonflow-<version>-Setup.exe`.

**macOS**

Cài Xcode Command Line Tools. Apple Silicon dùng Electrobun 2.0.1; Intel Mac dùng Electrobun 1.18.1 compatible build trong `compat/macIntel/`, cần chuẩn bị dependency trước:

```sh
# Chỉ Intel Mac cần
cd compat/macIntel
bun install --frozen-lockfile
cd ../..
```

Trên Mac đúng arch, tạo native startup library rồi build:

```sh
bun packages/startup/scripts/buildMac.ts
bun run build:desktop
bun run package:desktop
```

Script startup library download ThorVG cố định version + verify checksum. Artifact nằm `build/desktop/artifacts/macArm64/` và `build/desktop/artifacts/macX64/`.

Local mặc định tạo package không ký Developer ID + không notarize; GitHub Actions ARM build tự ký + notarize theo config dưới đây, Intel vẫn không re-sign. Với test app tự build và chắc nguồn gốc, nếu bị quarantine chặn có thể gỡ quarantine riêng app đó:

```sh
xattr -dr com.apple.quarantine "/Applications/toonflow.app"
```

**Typecheck và SDK**

Nếu Windows x64 hoặc Apple Silicon cần typecheck riêng trước lần build đầu, chuẩn bị Electrobun SDK trước:

```sh
bun apps/desktop/node_modules/electrobun/bin/electrobun.cjs prepare
bun run typecheck
```

Intel Mac sau khi cài compatible SDK, chạy một lần dev/build desktop để tạo file thích ứng. Typecheck không tự cài dependency hoặc compile native library.

</details>

<details>
<summary><strong>Release, update và plugin sync</strong></summary>

**Auto release bằng version tag**

Release dùng tag `vX.Y.Z` trên commit sẵn có, không cần Git Flow hoặc release branch.

1. Commit code cần release, trong SourceTree chọn commit đó, bấm **Tag**.
2. Điền tag đầy đủ, ví dụ `v2.0.0`, xác nhận tag trỏ đúng commit.
3. Trong danh sách tag bên trái, chuột phải tag mới → **Push Tag**, đích là `origin`. Chỉ push tag này, không tick "Push all tags".

Push tag sẽ kèm commit mà tag trỏ tới, không cần tạo/push release branch. GitHub Actions tự chạy **Release desktop v2.0.0**, build Windows x64, macOS ARM64 và macOS x64, tất cả thành công thì tạo GitHub Release.

Cũng có thể chạy 2 lệnh (đổi `2.0.0` thành version hiện tại):

```sh
git tag -a v2.0.0 -m "Release v2.0.0"
git push --no-follow-tags origin refs/tags/v2.0.0:refs/tags/v2.0.0
```

Version format chữ `v` thường + `X.Y.Z`; lightweight tag và annotated tag đều được. Dùng version mới, không ghi đè tag cũ. Build fail thì xem Actions log; code không đổi có thể re-run, sửa code thì dùng version mới.

**Build 3 platform một lần**

Trong GitHub repo mở **Actions → Release desktop → Run workflow**, chọn branch tin cậy, điền version (ví dụ `2.0.1`), `ref` để trống. Push `vX.Y.Z` tag cũng trigger release. Build có ARM yêu cầu `ref` trùng commit với branch/tag trigger, không được switch sang commit khác; chỉ build Windows hoặc Intel vẫn có thể chỉ định `ref` khác.

Workflow build trên runner Windows, Intel Mac và Apple Silicon, tất cả thành công thì upload lên GitHub Release:

| Platform | Installer | Update file |
| --- | --- | --- |
| Windows x64 | `toonflow-<version>-Setup.exe` | `stable-win-x64-*` |
| macOS Intel | DMG | `stable-macos-x64-*` |
| macOS Apple Silicon | DMG | `stable-macos-arm64-*` |

Mỗi platform gồm full update `.tar.zst`, update manifest `*-update.json`, và patch `<platform>-<old hash>.patch` từ GitHub latest release → version hiện tại. Lần release đầu platform đó không có manifest (HTTP 404) thì chỉ tạo installer + full update; network error khác, manifest không hợp lệ hoặc thiếu patch thì hủy build. Version phải cao hơn version trước trong update source.

Build cố định dùng `releases/latest/download` của GitHub Releases để lấy manifest và full package của version trước. GitHub Actions dùng repo hiện tại (`GITHUB_SERVER_URL` / `GITHUB_REPOSITORY`), local build mặc định `zetzet7298/Toonflow-app`. Địa chỉ này ghi vào SDK build config, client không đổi được; client lúc chạy chọn update source trong **Settings → About**, mặc định dùng official source `https://api.toonflow.net/version/desktopUpdates`, có thể chuyển sang GitHub Releases. Dev option có thể lưu custom update file directory address, lưu xong xuất hiện trong dropdown update source ở **About**. Workflow upload file lên GitHub Release, official update service vẫn phải sync riêng theo lệnh dưới.

[Debug workflow](../.github/workflows/debug.yml) có thể chọn platform riêng hoặc tất cả, artifact giữ 7 ngày, không tạo Release. Mặc định chỉ đóng gói full, tick `generatePatch` để verify incremental build. CI build + archive check không thay thế verify cài đặt thật, GUI launch hoặc macOS Gatekeeper.

**ARM auto-sign & notarize: cấu hình lần đầu**

Trong GitHub repo **Settings → Secrets and variables → Actions → New repository secret** thêm:

| Secret | Nội dung |
| --- | --- |
| `MACOS_CERTIFICATE_BASE64` | File `.p12` chứa certificate **Developer ID Application** hợp lệ + private key, encode Base64. |
| `MACOS_CERTIFICATE_PASSWORD` | Password không rỗng khi export `.p12`. |
| `MACOS_NOTARIZATION_KEY_ID` | Key ID của App Store Connect team API key. |
| `MACOS_NOTARIZATION_ISSUER_ID` | Issuer ID đầy đủ của team API key, không phải Team ID. |
| `MACOS_NOTARIZATION_KEY_BASE64` | File `.p8` private key tương ứng, encode Base64. |

Trong Windows PowerShell chạy lệnh sau, đổi path thành đường dẫn cert thật. Lệnh chỉ copy vào clipboard, không in nội dung cert, không tạo file; sau đó paste vào ô Secret `MACOS_CERTIFICATE_BASE64`:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\cert-dir\signing.p12')) | Set-Clipboard
```

Sau đó chạy riêng lệnh dưới, đổi path `.p8` thành file thật, lưu clipboard vào `MACOS_NOTARIZATION_KEY_BASE64`:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\cert-dir\AuthKey_YourKeyID.p8')) | Set-Clipboard
```

Paste lưu xong có thể `Set-Clipboard -Value ''` để xóa clipboard. Password điền trực tiếp vào `MACOS_CERTIFICATE_PASSWORD`, không ghi vào lệnh, source hoặc chat log. Base64 chỉ là encode, không phải mã hóa; P12, P8, Base64, password đều không commit repo công khai hoặc upload làm build artifact.

Notarize dùng **team API key** của App Store Connect, Key ID, Issuer ID và P8 phải cùng một key có quyền. Đổi P12 không bắt buộc đổi API key notarize còn hiệu lực. Cách này không cần Apple ID password hoặc Team ID; P12 + password dùng ký code.

Sau khi cấu hình, Debug và Release ARM build đều tự import keychain tạm, dùng Electrobun ký native code trong app, app trong full update package, installer wrapper và DMG, rồi submit Apple notarize, chờ pass, attach và verify notarization ticket. Full update archive tạo sau khi app notarize; trước khi upload còn verify nghiêm ngặt app sau giải nén, DMG và app trong image, và kiểm tra dùng đúng Developer ID cert lần import này.

Thiếu Secret, không có một Developer ID Application identity hợp lệ duy nhất, Apple reject notarize hoặc acceptance fail đều hủy build, không fallback package không ký/không notarize. P12 tạm xóa sau bước import; P8 và keychain xóa trong cleanup sau khi build thành công, fail hoặc cancel, đều đặt trong runner temp dir. Cert Base64, password và P8 Base64 chỉ inject vào credential prepare step, notarize API identifier chỉ truyền thêm vào ARM build step. Thời gian chờ notarize tính trong timeout 90 phút hiện có, quá timeout không release.

Repo công khai chỉ ký từ manual action hoặc tag `v*` tin cậy, không nhận `pull_request`/`pull_request_target`. Dùng GitHub Rulesets bảo vệ release branch và tag `v*`, giới hạn repo write permission; signed build chạy code của commit đã chọn, ai có quyền sửa release code hoặc workflow cũng nằm trong trust boundary của Secrets. Cách import cert xem [GitHub docs](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications).

ARM CI build bắt buộc ký + notarize, local build mặc định không bật; Intel old SDK re-sign giới hạn giữ nguyên. Notarize không cần lên App Store, lần mở đầu vẫn có thể hiện prompt mở app từ internet. CI acceptance không thay verify tải từ browser, cài đặt, khởi động và nâng cấp trên Mac thật, xem [Apple safe open app](https://support.apple.com/en-us/102445).

Nếu credential prepare step báo "không tìm thấy Developer ID Application identity hợp lệ duy nhất", xem output bước đó về loại cert, thời hạn và system diagnostic. `Apple Development`, `Apple Distribution`, `Developer ID Installer` không thay thế `Developer ID Application`. Nếu loại đúng, kiểm tra private key khớp, còn hạn, và cert chain; import P12 thành công không đồng nghĩa có signing identity hợp lệ. Diagnostic không in private key, password hoặc cert subject.

**Package local và update server độc lập**

Update server độc lập với business server, mặc định `http://127.0.0.1:8091`. Config, deploy và release rule xem [update server readme](../apps/updateServer/readme.md).

```sh
bun run start:updateServer

# Local chỉ build OS + arch hiện tại; tự nhận biết đã có version trước chưa
bun run release:desktop 2.0.0 --auto
bun run publish:update build/desktop/releases/2.0.0

# Khi server đã giữ version trước, build + publish version mới
bun run release:desktop 2.0.1
bun run publish:update build/desktop/releases/2.0.1
```

Mac release dir thêm `macX64/` hoặc `macArm64/`, ví dụ `build/desktop/releases/macArm64/2.0.1`. Mọi release mode đều tạo installer; `--auto` tự nhận baseline, không option yêu cầu đã có version trước, `--initial` bỏ qua baseline check và không tạo patch. Cùng platform + arch + version không tạo snapshot trùng. `build:desktop`, `package:desktop` thường không truy cập update server.

Desktop user trong **Settings → About** check update, download và restart app. Windows update swap app directory, giữ `data/` và `WebView2/`; uninstall mặc định cũng giữ data, chỉ khi chọn "delete user data too" mới xóa hết.

Built-in node và tool sync theo build hash: sau upgrade/downgrade lần khởi động đầu sẽ thay plugin built-in trùng tên; Windows reinstall cùng version cũng trigger sync. Restart thường không ghi đè lại. Skill và provider theo rule first-init, giữ file hiện có; third-party plugin và user asset không bị ghi đè bởi sync built-in node/tool.

</details>

### Cấu trúc project

```text
apps/
  web/                 Vue page, settings, workspace và canvas
  server/              Business API và Agent runtime, desktop dùng chung service này
  desktop/             Electrobun entry, build script và installer
  updateServer/        Update file server độc lập + publish script
packages/
  assets/              Shared image + icon
  i18n/                Language dictionary, runtime và text extraction
  nodes/               Built-in canvas node
  nodeScaffold/        Node dev scaffold + runtime
  tools/               Agent tool plugin
  toolScaffold/        Tool dev scaffold + runtime
  providers/           Text + media model provider
  skills/              Markdown skill + tài liệu kèm theo
  mcp/                 MCP service + protocol adapter
  ffmpeg/              FFmpeg capability
  startup/             Native startup window + animation
docs/                  Project doc, dev doc và image
compat/macIntel/       Intel Mac compatible build
build/                 Build output
data/                  Local runtime data, không commit
```

---

## 🧹 Commercial fork checklist

Khi phát triển trên fork `zetzet7298/Toonflow-app` cho mục đích thương mại:

1. Đọc `AGENTS.md` section A (Clean-Room Porting) trước khi port tính năng ArcReel.
2. Thay toàn bộ clone/install URL từ `HBAI-Ltd/Toonflow-app` sang `zetzet7298/Toonflow-app`.
3. Trước release thương mại: chạy checklist `AGENTS.md` section J (telemetry, branding, auth, dependency audit, provider sandbox, LICENSE).
4. Không commit upstream sponsor asset, QR code, business contact, hoặc TF-Router credential.

---

## 📜 License

MIT License — xem [LICENSE](../LICENSE). Copyright © 2026 北京爱阿科技有限公司 (upstream) + fork contributor.
