# Mục lục tài liệu Toonflow

[Quay lại trang chủ](../README.md)

## Giới thiệu project

| Ngôn ngữ README | Điểm vào |
| --- | --- |
| Tiếng Việt / English (commercial fork) | [README](../README.md) |
| 繁體中文 | [README](./readme/readmeZhTw.md) |
| English (upstream) | [README](./readme/readmeEn.md) |
| 日本語 | [README](./readme/readmeJa.md) |
| Русский | [README](./readme/readmeRu.md) |
| Tiếng Việt (upstream) | [README](./readme/readmeVi.md) |
| ไทย | [README](./readme/readmeTh.md) |
| 한국어 | [README](./readme/readmeKo.md) |
| हिन्दी | [README](./readme/readmeHi.md) |
| Bahasa Indonesia | [README](./readme/readmeId.md) |
| Bahasa Melayu | [README](./readme/readmeMs.md) |
| Filipino | [README](./readme/readmeFil.md) |
| বাংলা | [README](./readme/readmeBn.md) |
| اردو | [README](./readme/readmeUr.md) |
| தமிழ் | [README](./readme/readmeTa.md) |
| తెలుగు | [README](./readme/readmeTe.md) |
| मराठी | [README](./readme/readmeMr.md) |
| ਪੰਜਾਬੀ | [README](./readme/readmePa.md) |
| العربية | [README](./readme/readmeAr.md) |
| فارسی | [README](./readme/readmeFa.md) |
| Türkçe | [README](./readme/readmeTr.md) |

README gốc của fork này (`README.md`) được viết lại cho commercial edition; các bản dịch trong `docs/readme/` là upstream README giữ nguyên để tham khảo.

## Sử dụng & phát triển

- [Hướng dẫn sử dụng](https://qcn7xdsqgc4z.feishu.cn/docx/RXFqdgR2Xo0dXZxGfd0cZCGgnwf): thao tác hàng ngày và quy trình sáng tạo.
- [Hướng dẫn phát triển & mở rộng](./development.md): chạy từ source, mở rộng plugin, đóng gói desktop và phát hành update.
- [Hướng dẫn Android](../apps/mobile/readme.md): ARM64 APK, chạy local, kết nối thiết bị và build.
- [Hướng dẫn đóng góp](../CONTRIBUTING.md) và [quy tắc phát triển](../AGENTS.md): quy ước khi tham gia project.
- [Hướng dẫn i18n](../packages/i18n/readme.md): dictionary extraction, dynamic text, frontend/backend integration và language fallback.
- [Bản ghi i18n regression](../packages/i18n/regression.md): kiểm tra đã hoàn thành và phạm vi đã biết.
- [Hướng dẫn MCP](../packages/mcp/README.md): kết nối client bên ngoài và tool capability.

## Clean-room porting specs

Spec mức hành vi cho việc port tính năng ArcReel vào Toonflow (không copy code/prompt/schema AGPL):

| Spec | File |
| --- | --- |
| Gap matrix | `C:/Projects/toonflow-port-specs/00-gap-matrix.md` |
| Durable generation jobs | `C:/Projects/toonflow-port-specs/01-durable-generation-jobs.md` |
| Final cut assembly | `C:/Projects/toonflow-port-specs/02-final-cut-assembly.md` |
| Episode ledger & structured script | `C:/Projects/toonflow-port-specs/03-episode-ledger-structured-script.md` |
| Typed assets & consistency | `C:/Projects/toonflow-port-specs/04-typed-assets-consistency-versioning.md` |
| Cost estimation & billing | `C:/Projects/toonflow-port-specs/05-cost-estimation-billing-ledger.md` |

Quy tắc clean-room và checklist thương mại xem [AGENTS.md](../AGENTS.md) section A và section J.

## Quy ước thư mục

```text
docs/
  readme.md          Điểm vào tài liệu
  development.md     Hướng dẫn phát triển & mở rộng
  readme/            Upstream README các ngôn ngữ (tham khảo)
  images/            Logo, cert và image cộng đồng
    screenshots/     Ảnh chụp sản phẩm
    sponsors/        Ảnh sponsor upstream
```

Implementation + maintenance note của từng subpackage giữ trong `packages/` tương ứng. Khi cập nhật project intro, root `README.md` là chuẩn; các bản dịch trong `readme/` giữ nguyên upstream. Image dùng chung `images/`; khi move file, cập nhật cả relative link trong Markdown và HTML.
