# Muse.ai sidecar (fork addition)

Service FastAPI nhỏ bọc `museClient.py` — client muse.ai (Noise XX + WS tunnel,
vendored từ `C:/Projects/muse-api`, 0 sửa logic). Toonflow gọi qua provider
`muse` (`packages/providers/src/media/muse.ts`).

## Chạy

```bash
pip install -r requirements.txt        # hoặc venv riêng
python museService.py                  # 127.0.0.1:19301 (MUSE_SIDECAR_PORT đổi port)
```

Endpoints: `GET /health`, `POST /probe` (verify handshake), `POST /generate`
(body `GenRequest`: `kind` = `image`|`video`, `prompt`, `images[]` =
`{name, mimeType, dataBase64}` — mọi media đính kèm đi qua trường này,
`count`, `timeoutSec`, `session`, `cookie`, `cookieFile`).

## Cookie

Ưu tiên: field `apiKey` trong cấu hình provider (UI Settings → Media Models)
→ env `MUSE_COOKIE` → `~/.muse/cookie.txt`. Cookie lấy từ header `Cookie:`
của phiên đăng nhập muse.ai (`hatch_sess` + `hatch_gw`), hết hạn phải copy lại.

## Giới hạn

- Serialize một lượt generation (cookie chia sẻ, không parallel).
- Video/audio input đính kèm được; agent tự quyết output — provider chỉ map
  tham số (duration/ratio/resolution) vào prompt hints.
- VM "confidential" (CVM challenge) không hỗ trợ — xem `museClient.py`.
