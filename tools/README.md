# tools/ — Công cụ phát triển (không thuộc game build)

## capture.mjs — Chụp UI để kiểm tra bằng mắt

Dùng Playwright điều khiển **Chrome đã cài sẵn trên máy** (headless) để mở dev
server, render WebGL, mô phỏng thao tác bàn phím và chụp screenshot. Nhờ đó có
thể kiểm tra giao diện/gameplay trực tiếp từ host mà không cần mở trình duyệt
thủ công.

### Cách chạy

1. Chạy dev server ở một terminal:
   ```bash
   npm run dev
   ```
2. Ở terminal khác, chạy:
   ```bash
   npm run capture               # mặc định http://localhost:5173
   npm run capture http://localhost:5174   # chỉ định URL khác
   ```

### Kết quả

Ghi vào `tools/shots/` (đã được .gitignore):

- `01-default-vi.png` — cảnh mặc định, overlay tiếng Việt
- `02-moved-forward.png` — sau khi giữ W ~1s (player di chuyển, camera follow)
- `03-language-en.png` — sau khi nhấn L (overlay chuyển sang tiếng Anh)
- `report.json` — trạng thái WebGL, log console, lỗi runtime, text overlay

### Ghi chú

- Chỉ là **devDependency** (`playwright`). Không ảnh hưởng bản build/deploy
  (`dist/` vẫn là static site thuần).
- Dùng `channel: 'chrome'` nên không tải thêm Chromium; cần Chrome cài sẵn.
- Render headless qua ANGLE/SwiftShader: đủ để xác minh "có vẽ ra đúng không,
  bố cục/logic đúng không", không dùng để đo hiệu năng GPU thật.
