# Assets

Theo dõi mọi asset bên ngoài đưa vào project (nguồn, license, attribution).

## Trạng thái hiện tại (STEP 4)

**Không có asset ngoài nào được thêm.**

Toàn bộ hình ảnh trong game hiện được dựng bằng **Three.js primitives**
(capsule, box, cone, cylinder, dodecahedron, plane) — player, enemy, cây, đá,
thùng, tường. Không tải GLB/GLTF/texture từ nguồn ngoài, không hotlink runtime.

Lý do: ở STEP 4 chưa xác minh được một nguồn model có license đủ rõ ràng để
redistribute trong repo. Pipeline để dùng asset thật đã sẵn sàng:

- `AssetLoader.loadModel(url)` (GLTFLoader, có cache) — xem `src/utils/AssetLoader.js`
- `EnemyModel` / `PlayerModel` là "seam": thay children của model bằng GLB mà
  không phải sửa AI, movement, camera hay game loop.

## Khi thêm asset ngoài (mẫu ghi chép)

Khi tải asset về, đặt vào `public/assets/<loại>/` và ghi lại ở đây:

```
- Asset:        <tên>
  Source:       <trang>
  Author:       <tác giả>
  License:      <ví dụ CC0 / CC-BY 4.0 / ...>
  Attribution:  <có/không — nếu có thì ghi dòng attribution bắt buộc>
  Source URL:   <đường dẫn gốc>
  Path:         public/assets/<loại>/<file>
```

Nguyên tắc: không dùng asset không rõ license; không dùng asset trả phí khi
chưa có quyền; không chèn URL giả; chỉ ghi "free/CC0" sau khi đã kiểm tra.
