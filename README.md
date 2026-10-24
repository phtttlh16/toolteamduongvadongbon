# Team Dương Auto Zalo

Website Node.js + Express + PostgreSQL, có:
- Đăng ký/đăng nhập thành viên, mật khẩu băm bcrypt
- Vai trò Admin, quản lý/khóa tài khoản thành viên
- Lưu liên hệ có xác nhận đồng ý nhận tin
- Soạn và lưu bản nháp tin nhắn
- Khu vực trạng thái/tài liệu kết nối Zalo
- Session lưu trong PostgreSQL, cookie HttpOnly/SameSite, Helmet

**Giới hạn có chủ ý:** Không lấy QR/cookie phiên Zalo cá nhân và không tự gửi tin bằng API không được cấp quyền. Tin nhắn hiện được lưu ở trạng thái `draft`. Muốn gửi thật, tích hợp API/phương thức chính thức mà tài khoản của bạn được phép sử dụng.

## Triển khai nhanh trên GitHub + Render

1. Tạo repository mới trên GitHub, ví dụ `team-duong-auto-zalo`.
2. Tải các tệp trong ZIP này lên repository (không tải `.env` hoặc mật khẩu thật).
3. Trên Render, chọn **New + → Blueprint**, kết nối repository. Render đọc `render.yaml` và tạo web service + PostgreSQL.
4. Khi Render yêu cầu biến môi trường, đặt:
   - `ADMIN_EMAIL`: email quản trị của bạn
   - `ADMIN_PASSWORD`: mật khẩu mạnh tối thiểu 12 ký tự
5. Deploy và mở URL `https://...onrender.com`. Đường dẫn `/health` trả về `{"ok":true,...}`.
6. Đăng nhập bằng email/mật khẩu Admin đã cấu hình. Tài khoản Admin đầu tiên được tạo tự động khi khởi tạo database. Nếu tài khoản đã tồn tại, thay đổi `ADMIN_PASSWORD` không tự đổi mật khẩu đang lưu.
7. Thành viên có thể tạo tài khoản tại `/register`. Admin quản lý thành viên ở **Admin**.

## Lưu ý bảo mật

- Không commit `.env`, mật khẩu, token hoặc thông tin kết nối database.
- Dùng mật khẩu Admin riêng, dài tối thiểu 12 ký tự.
- Bật MFA cho GitHub và Render.
- Dùng HTTPS trên production (Render cung cấp HTTPS cho URL dịch vụ).
- Sao lưu database; gói miễn phí có thể có giới hạn/ngủ dịch vụ hoặc chính sách thay đổi.
- Để tắt đăng ký công khai, cần bổ sung cơ chế mời thành viên hoặc đặt `REGISTRATION_ENABLED=false` trong mã.
- Đây là bộ khởi đầu triển khai được, chưa phải hệ thống gửi tin production đã tích hợp Zalo.

## Chạy local

Yêu cầu Node.js 20+ và PostgreSQL. Tạo database, copy `.env.example` thành `.env`, cập nhật `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

```bash
npm install
npm start
```

Mở http://localhost:3000

Tạo secret ngẫu nhiên bằng lệnh:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
