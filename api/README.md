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

## Nhóm B - Công việc (`/api/tasks`, cần Bearer token)

| Method | Endpoint | Chức năng | Quyền cần có |
|---|---|---|---|
| GET | `/tasks` | Danh sách công việc có quyền truy cập | đăng nhập |
| POST | `/tasks` | Tạo công việc | đăng nhập |
| GET | `/tasks/:id` | Chi tiết | owner, editor, assignee, viewer |
| PUT | `/tasks/:id` | Sửa thông tin | owner, editor |
| PATCH | `/tasks/:id/status` | Đổi trạng thái | owner, editor, assignee |
| DELETE | `/tasks/:id` | Xóa | chỉ owner |

Tham số lọc của `GET /tasks`: `scope=all|created|assigned|shared`, `status=todo|in_progress|completed`,
`priority=low|medium|high`, `q` (tìm theo tên), `assigneeId`, `sortBy=createdAt|dueDate|priority`, `order=asc|desc`.

Body tạo/sửa: `title`, `description`, `startDate`, `dueDate` (ISO, `null` để xóa ngày), `priority`, `status`.

Vai trò trên mỗi công việc: **owner** (người tạo), **editor** / **viewer** (được chia sẻ), **assignee** (được giao).
Không có quyền xem thì trả 404, có quyền xem nhưng thiếu quyền thao tác thì trả 403.

## Nhóm C - Giao việc và chia sẻ (cần Bearer token)

| Method | Endpoint | Chức năng | Quyền cần có |
|---|---|---|---|
| GET | `/users?q=` | Tìm người dùng theo tên/email (tối đa 20, không gồm chính mình) | đăng nhập |
| GET | `/tasks/:id/assignees` | Danh sách người được giao | có quyền xem |
| PUT | `/tasks/:id/assignees` | Thay danh sách người được giao | owner, editor |
| DELETE | `/tasks/:id/assignees/:userId` | Bỏ giao việc cho một người | owner, editor |
| GET | `/tasks/:id/shares` | Danh sách người được chia sẻ | chỉ owner |
| POST | `/tasks/:id/shares` | Chia sẻ (đã có thì cập nhật quyền) | chỉ owner |
| PATCH | `/tasks/:id/shares/:userId` | Đổi quyền viewer/editor | chỉ owner |
| DELETE | `/tasks/:id/shares/:userId` | Thu hồi quyền truy cập | chỉ owner |

- `PUT assignees` body: `{ "assigneeIds": ["id1","id2"], "primaryAssigneeId": "id1" }`. Người phụ trách chính phải nằm trong danh sách; bỏ trống thì giữ người cũ hoặc lấy người đầu tiên.
- `POST shares` body: `{ "userId": "..." }` hoặc `{ "email": "..." }`, kèm `"permission": "viewer" | "editor"` (mặc định viewer). Không chia sẻ cho chính chủ.
- `GET /tasks/:id` trả thêm `shares` khi người gọi là owner.
- Thu hồi chia sẻ / bỏ giao việc có hiệu lực ngay: người đó nhận 404 khi xem công việc.

## Nhóm D - Thông báo và email (cần Bearer token)

| Method | Endpoint | Chức năng | Quyền |
|---|---|---|---|
| GET | `/notifications?unread=true&limit=&skip=` | Danh sách thông báo của tôi (mới nhất trước) + `unreadCount` | đăng nhập |
| GET | `/notifications/unread-count` | Số thông báo chưa đọc | đăng nhập |
| PATCH | `/notifications/:id/read` | Đánh dấu một thông báo đã đọc | chủ thông báo |
| PATCH | `/notifications/read-all` | Đánh dấu tất cả đã đọc | đăng nhập |
| GET | `/tasks/:id/activities` | Lịch sử hoạt động của công việc | có quyền xem |
| GET | `/tasks/:id/email-logs` | Lịch sử gửi email (sent/failed/pending) | chỉ owner |
| POST | `/email-logs/:id/retry` | Gửi lại email thất bại (tối đa 3 lần gửi) | chỉ owner |
| GET | `/users/search?q=` | Tìm người dùng (giống `/users?q=`) | đăng nhập |

**Khi nào có thông báo / email** (không bao giờ gửi cho chính người thực hiện):

| Sự kiện | Trong ứng dụng | Email |
|---|---|---|
| Được giao việc (chỉ người mới thêm) | có | có |
| Được chia sẻ hoặc đổi quyền | có | có |
| Đổi hạn, tên hoặc mức ưu tiên | có (owner, người được giao, người được chia sẻ) | có |
| Đổi trạng thái | có | không |
| Hoàn thành công việc | có | có |
| Sắp đến hạn (mặc định 24 giờ, mỗi việc nhắc 1 lần, đổi hạn thì nhắc lại) | có | có |

Cấu hình SMTP trong `.env` (xem `.env.example`). Email gửi ngầm sau khi API đã trả kết quả; mỗi email có một bản ghi
`email_logs` với `status` pending/sent/failed, `attempts`, `errorMessage`. Chưa cấu hình SMTP thì email ghi `failed`
("SMTP chưa được cấu hình") và gửi lại được sau khi cấu hình. Tác vụ nhắc việc chạy trong tiến trình server (`setInterval`).
Dữ liệu mới: collection `notifications`, `email_logs`, `task_activities`.

## Nhóm E - Thống kê (`/api/statistics`, cần Bearer token)

Tính trên các công việc người dùng có quyền truy cập (tạo, được giao, được chia sẻ).

| Method | Endpoint | Kết quả |
|---|---|---|
| GET | `/statistics/tasks` | `total`, `todo`, `in_progress`, `completed`, `completionRate` (%), `byPriority`, `byRole` |
| GET | `/statistics/assignments` | `assignedToMe`, `primaryForMe`, `assignedByMe` (mỗi mục có số theo trạng thái và `active`), `primaryTasks` |
| GET | `/statistics/deadlines?days=7` | `overdue` / `dueSoon` (tối đa 20 việc, gần hạn nhất trước) kèm `overdueCount`, `dueSoonCount`. `days` từ 1 đến 90 |

Việc đã hoàn thành hoặc không có hạn không tính vào quá hạn / sắp đến hạn.
Lịch sử hoạt động của công việc: `GET /tasks/:id/activities` (nhóm D).
