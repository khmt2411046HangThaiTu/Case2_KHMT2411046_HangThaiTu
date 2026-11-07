# Task Manager API

## Chạy
```bash
npm install
cp .env.example .env     # rồi điền MONGODB_URI và JWT_SECRET
npm start                # hoặc: npm run dev
node --test              # chạy test (không cần MongoDB)
```
Không commit file `.env`.

## Nhóm A - Xác thực (`/api/auth`)

| Method | Endpoint | Auth | Body | Kết quả |
|---|---|---|---|---|
| POST | `/auth/register` | - | `fullName`, `email`, `password` | 201 `{token, user}` |
| POST | `/auth/login` | - | `email`, `password` | 200 `{token, user}` |
| GET | `/auth/me` | Bearer | - | 200 `{user}` |
| PUT | `/auth/me` | Bearer | `fullName`, `avatarUrl` (tùy chọn) | 200 `{user}` |
| PUT | `/auth/change-password` | Bearer | `currentPassword`, `newPassword` | 200 `{message}` |

Đăng xuất: JWT không lưu trạng thái trên server nên client chỉ cần xóa token.

Lỗi trả dạng `{ "message": "...", "errors": { "field": "..." } }` với mã 400/401/409/500.

## Bảo mật đã áp dụng
- Mật khẩu băm bằng bcrypt (`bcryptjs`), không lưu/trả mật khẩu thô, `passwordHash` bị ẩn khỏi JSON.
- Email lưu chữ thường, có unique index.
- Sai email và sai mật khẩu cùng trả một thông báo.
- Chuỗi kết nối MongoDB và JWT secret nằm trong biến môi trường.
- Lỗi không lường trước chỉ log ở server, client chỉ nhận "Lỗi máy chủ".
