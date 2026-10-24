require("dotenv").config();
const express = require("express");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");

const app = express();
const port = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === "production";

if (!process.env.DATABASE_URL) throw new Error("Missing DATABASE_URL");
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET must be at least 32 characters");
}
if (isProd) app.set("trust proxy", 1);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProd ? { rejectUnauthorized: false } : false
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));
app.use(express.json({ limit: "20kb" }));
app.use(session({
  store: new PgSession({ pool, tableName: "user_sessions", createTableIfMissing: true }),
  name: "tdaz.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: isProd, maxAge: 8 * 60 * 60 * 1000 }
}));

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL,
      consent BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(owner_id, phone)
    );
    CREATE TABLE IF NOT EXISTS message_jobs (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  if (email && password) {
    if (password.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters");
    const existing = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
    if (!existing.rowCount) {
      const hash = await bcrypt.hash(password, 12);
      await pool.query("INSERT INTO users(email,password_hash,role) VALUES($1,$2,'admin')", [email, hash]);
      console.log("Initial admin account created:", email);
    }
  }
}
const escapeHtml = (s="") => String(s).replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));
const page = (title, body, user=null) => `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Team Dương Auto Zalo</title><style>
:root{color-scheme:dark;--bg:#0b1020;--panel:#131b30;--line:#28334d;--text:#edf2ff;--muted:#a7b3cc;--blue:#6ea8fe;--green:#4ade80}*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at top,#172747,var(--bg) 60%);color:var(--text);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}a{color:#9dc1ff}header{display:flex;justify-content:space-between;align-items:center;padding:18px max(20px,calc((100% - 1100px)/2));border-bottom:1px solid var(--line);background:#0b1020cc;gap:12px;flex-wrap:wrap}.brand{font-weight:800;letter-spacing:.2px}.brand span{color:var(--blue)}main{max-width:1100px;margin:32px auto;padding:0 18px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px}.panel{background:linear-gradient(160deg,#17213a,#11182a);border:1px solid var(--line);border-radius:16px;padding:20px;margin-bottom:16px;box-shadow:0 12px 30px #0002}h1{font-size:clamp(26px,4vw,38px);line-height:1.15;margin:0 0 10px}h2{font-size:19px;margin:0 0 14px}p{color:var(--muted)}label{display:block;font-size:13px;color:var(--muted);margin:12px 0 5px}input,textarea,select{width:100%;background:#0b1222;color:var(--text);border:1px solid #34415f;border-radius:9px;padding:11px;font:inherit}textarea{min-height:110px;resize:vertical}button,.btn{border:0;border-radius:9px;background:var(--blue);color:#091226;font-weight:750;padding:11px 15px;cursor:pointer;text-decoration:none;display:inline-block;margin-top:12px}button.secondary,.btn.secondary{background:#293650;color:var(--text)}button.danger{background:#fca5a5}.muted{color:var(--muted);font-size:13px}.stat{font-size:30px;font-weight:800}.flash{padding:12px;border-radius:9px;background:#342c1d;border:1px solid #6b5528;margin-bottom:16px}.toplinks{display:flex;gap:12px;align-items:center;flex-wrap:wrap}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px;border-bottom:1px solid var(--line);font-size:14px;overflow-wrap:anywhere}.pill{display:inline-block;border:1px solid var(--line);padding:3px 8px;border-radius:99px;color:var(--muted);font-size:12px}.good{color:var(--green)}footer{text-align:center;color:var(--muted);padding:30px;font-size:12px}.inline{display:inline} @media(max-width:600px){main{margin-top:20px}header{padding:15px 18px}.panel{padding:16px}}
</style></head><body><header><div class="brand">TEAM <span>DƯƠNG</span> AUTO ZALO</div><nav class="toplinks">${user?`<span class="muted">${escapeHtml(user.email)} · ${user.role==="admin"?"Admin":"Thành viên"}</span><a href="/dashboard">Bảng điều khiển</a><form class="inline" method="post" action="/logout"><button class="secondary" type="submit">Đăng xuất</button></form>`:`<a href="/login">Đăng nhập</a><a href="/register">Tạo tài khoản</a>`}</nav></header><main>${body}</main><footer>Team Dương Auto Zalo · Bảo vệ tài khoản và chỉ liên hệ người đã đồng ý nhận tin.</footer></body></html>`;
const flash = (s) => `<div class="flash">${escapeHtml(s)}</div>`;
const getUser = async req => {
  if (!req.session.userId) return null;
  const r = await pool.query("SELECT id,email,role,active FROM users WHERE id=$1", [req.session.userId]);
  if (!r.rowCount || !r.rows[0].active) return null;
  return r.rows[0];
};
function requireAuth(req,res,next){ getUser(req).then(u=>{if(!u)return res.redirect("/login");req.user=u;next();}).catch(next); }
function requireAdmin(req,res,next){ if(req.user.role!=="admin")return res.status(403).send(page("Không có quyền",flash("Bạn không có quyền truy cập chức năng Admin."),req.user));next(); }

app.get("/health", (req,res)=>res.json({ok:true,app:"Team Dương Auto Zalo"}));
app.get("/", (req,res)=>res.redirect(req.session.userId?"/dashboard":"/login"));
app.get("/register",(req,res)=>res.send(page("Tạo tài khoản",`<div class="panel" style="max-width:500px;margin:auto"><h1>Tạo tài khoản</h1><p>Tạo tài khoản thành viên. Admin có thể quản lý trạng thái tài khoản.</p><form method="post" action="/register"><label>Email</label><input type="email" name="email" required maxlength="254" autocomplete="email"><label>Mật khẩu (ít nhất 12 ký tự)</label><input type="password" name="password" minlength="12" required autocomplete="new-password"><button type="submit">Tạo tài khoản</button></form><p class="muted">Không dùng lại mật khẩu ở dịch vụ khác.</p></div>`)));
app.post("/register",async(req,res,next)=>{try{
  const email=String(req.body.email||"").trim().toLowerCase(), password=String(req.body.password||"");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||password.length<12)return res.status(400).send(page("Lỗi",flash("Email không hợp lệ hoặc mật khẩu chưa đủ 12 ký tự.")));
  const hash=await bcrypt.hash(password,12);
  await pool.query("INSERT INTO users(email,password_hash) VALUES($1,$2)",[email,hash]);
  res.redirect("/login?created=1");
}catch(e){if(e.code==="23505")return res.status(409).send(page("Lỗi",flash("Email này đã được đăng ký.")));next(e);}});
app.get("/login",(req,res)=>res.send(page("Đăng nhập",`${req.query.created?flash("Đăng ký thành công. Bạn có thể đăng nhập."): ""}<div class="panel" style="max-width:500px;margin:auto"><h1>Đăng nhập</h1><p>Truy cập bảng điều khiển Team Dương Auto Zalo.</p><form method="post" action="/login"><label>Email</label><input type="email" name="email" required autocomplete="username"><label>Mật khẩu</label><input type="password" name="password" required autocomplete="current-password"><button type="submit">Đăng nhập</button></form><p class="muted">Chưa có tài khoản? <a href="/register">Đăng ký</a></p></div>`)));
app.post("/login",async(req,res,next)=>{try{
  const email=String(req.body.email||"").trim().toLowerCase(), password=String(req.body.password||"");
  const r=await pool.query("SELECT id,email,password_hash,role,active FROM users WHERE email=$1",[email]);
  const u=r.rows[0];
  if(!u||!u.active||!(await bcrypt.compare(password,u.password_hash)))return res.status(401).send(page("Đăng nhập",flash("Email hoặc mật khẩu không đúng.")));
  req.session.regenerate(err=>{if(err)return next(err);req.session.userId=u.id;req.session.save(err=>{if(err)return next(err);res.redirect("/dashboard");});});
}catch(e){next(e);}});
app.post("/logout",(req,res)=>req.session.destroy(()=>{res.clearCookie("tdaz.sid");res.redirect("/login");}));

app.get("/dashboard",requireAuth,async(req,res,next)=>{try{
 const [c,j]=await Promise.all([pool.query("SELECT COUNT(*)::int n FROM contacts WHERE owner_id=$1",[req.user.id]),pool.query("SELECT COUNT(*)::int n FROM message_jobs WHERE owner_id=$1",[req.user.id])]);
 const admin=req.user.role==="admin"?`<div class="panel"><h2>🛡️ Quản trị Admin</h2><p>Quản lý tài khoản thành viên và quyền truy cập.</p><a class="btn" href="/admin">Mở trang Admin</a></div>`:"";
 res.send(page("Bảng điều khiển",`<div class="panel"><span class="pill">BẢNG ĐIỀU KHIỂN</span><h1 style="margin-top:14px">Xin chào, ${escapeHtml(req.user.email)}</h1><p>Quản lý liên hệ được phép nhận tin và các bản nháp chiến dịch của bạn.</p></div><div class="grid"><div class="panel"><p>Liên hệ của bạn</p><div class="stat">${c.rows[0].n}</div><a href="/contacts">Quản lý liên hệ →</a></div><div class="panel"><p>Bản nháp tin nhắn</p><div class="stat">${j.rows[0].n}</div><a href="/messages">Soạn tin nhắn →</a></div><div class="panel"><p>Kết nối Zalo</p><div class="stat">Chưa kết nối</div><span class="muted">Cần tích hợp được Zalo cho phép</span><br><a href="/zalo">Xem kết nối →</a></div></div>${admin}<div class="panel"><h2>🔐 An toàn khi sử dụng</h2><p>Chỉ thêm số điện thoại của người đã đồng ý nhận tin. Bản hiện tại lưu chiến dịch ở trạng thái bản nháp và không tự gửi tin qua Zalo.</p></div>`,req.user));
}catch(e){next(e);}});
app.get("/contacts",requireAuth,async(req,res,next)=>{try{
 const r=await pool.query("SELECT id,name,phone,consent,created_at FROM contacts WHERE owner_id=$1 ORDER BY id DESC LIMIT 200",[req.user.id]);
 const rows=r.rows.map(x=>`<tr><td>${escapeHtml(x.name)}</td><td>${escapeHtml(x.phone)}</td><td>${x.consent?'<span class="good">Có đồng ý</span>':'Chưa xác nhận'}</td><td><form method="post" action="/contacts/${x.id}/delete" onsubmit="return confirm('Xóa liên hệ này?')"><button class="secondary" type="submit">Xóa</button></form></td></tr>`).join("");
 res.send(page("Liên hệ",`<div class="panel"><h1>Quản lý liên hệ</h1><p>Chỉ lưu liên hệ đã đồng ý nhận tin. Không dùng danh sách số điện thoại để tìm hoặc nhắn người lạ không có sự đồng ý.</p><form method="post" action="/contacts"><label>Tên liên hệ</label><input name="name" maxlength="100" placeholder="Nguyễn Văn A"><label>Số điện thoại</label><input name="phone" required maxlength="30" placeholder="+84..."><label style="display:flex;gap:9px;align-items:center"><input style="width:auto" type="checkbox" name="consent" value="yes" required> Tôi xác nhận người này đã đồng ý nhận tin.</label><button type="submit">Thêm liên hệ</button></form></div><div class="panel"><h2>Danh sách liên hệ (tối đa 200 mục gần nhất)</h2><table><thead><tr><th>Tên</th><th>Số điện thoại</th><th>Trạng thái đồng ý</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="4">Chưa có liên hệ.</td></tr>'}</tbody></table></div>`,req.user));
}catch(e){next(e);}});
app.post("/contacts",requireAuth,async(req,res,next)=>{try{
 const name=String(req.body.name||"").trim().slice(0,100), phone=String(req.body.phone||"").trim();
 if(req.body.consent!=="yes"||!/^\\+?[0-9 ()-]{7,30}$/.test(phone))return res.status(400).send(page("Lỗi",flash("Số điện thoại không hợp lệ hoặc chưa xác nhận đồng ý nhận tin."),req.user));
 await pool.query("INSERT INTO contacts(owner_id,name,phone,consent) VALUES($1,$2,$3,TRUE)",[req.user.id,name,phone]);
 res.redirect("/contacts");
}catch(e){if(e.code==="23505")return res.status(409).send(page("Lỗi",flash("Số điện thoại này đã có trong danh sách."),req.user));next(e);}});
app.post("/contacts/:id/delete",requireAuth,async(req,res,next)=>{try{await pool.query("DELETE FROM contacts WHERE id=$1 AND owner_id=$2",[req.params.id,req.user.id]);res.redirect("/contacts");}catch(e){next(e);}});
app.get("/messages",requireAuth,async(req,res,next)=>{try{
 const r=await pool.query("SELECT id,body,status,created_at FROM message_jobs WHERE owner_id=$1 ORDER BY id DESC LIMIT 100",[req.user.id]);
 const rows=r.rows.map(x=>`<tr><td>${x.id}</td><td>${escapeHtml(x.body.slice(0,120))}</td><td><span class="pill">${escapeHtml(x.status)}</span></td><td>${new Date(x.created_at).toLocaleString("vi-VN")}</td></tr>`).join("");
 res.send(page("Tin nhắn",`<div class="panel"><h1>Soạn tin nhắn</h1><p>Lưu nội dung thành bản nháp. Chưa có nhà cung cấp Zalo được cấp quyền nên hệ thống không tự gửi tin.</p><form method="post" action="/messages"><label>Nội dung</label><textarea name="body" maxlength="2000" required placeholder="Nhập nội dung phù hợp..."></textarea><button type="submit">Lưu bản nháp</button></form></div><div class="panel"><h2>Lịch sử bản nháp</h2><table><thead><tr><th>#</th><th>Nội dung</th><th>Trạng thái</th><th>Ngày tạo</th></tr></thead><tbody>${rows||'<tr><td colspan="4">Chưa có bản nháp.</td></tr>'}</tbody></table></div>`,req.user));
}catch(e){next(e);}});
app.post("/messages",requireAuth,async(req,res,next)=>{try{const body=String(req.body.body||"").trim();if(!body||body.length>2000)return res.status(400).send(page("Lỗi",flash("Nội dung trống hoặc quá dài."),req.user));await pool.query("INSERT INTO message_jobs(owner_id,body,status) VALUES($1,$2,'draft')",[req.user.id,body]);res.redirect("/messages");}catch(e){next(e);}});
app.get("/zalo",requireAuth,(req,res)=>res.send(page("Kết nối Zalo",`<div class="panel"><h1>Kết nối Zalo</h1><span class="pill">Chưa kết nối</span><p>Để bảo vệ tài khoản, ứng dụng không thu thập mật khẩu, cookie hoặc QR phiên đăng nhập cá nhân. Chưa có phiên Zalo nào được kết nối.</p><h2>Phương thức tích hợp</h2><p>Dùng Zalo Official Account/API hoặc phương thức được Zalo cấp quyền. Khi có thông tin ứng dụng, phạm vi quyền và thông tin xác thực chính thức, có thể bổ sung OAuth/callback phía máy chủ.</p><a class="btn" href="https://oa.zalo.me/" target="_blank" rel="noopener noreferrer">Mở Zalo Official Account</a><a class="btn secondary" href="/dashboard">Quay lại</a></div>`,req.user)));
app.get("/admin",requireAuth,requireAdmin,async(req,res,next)=>{try{
 const r=await pool.query("SELECT id,email,role,active,created_at FROM users ORDER BY id DESC LIMIT 200");
 const rows=r.rows.map(u=>`<tr><td>${u.id}</td><td>${escapeHtml(u.email)}</td><td>${escapeHtml(u.role)}</td><td>${u.active?"Đang hoạt động":"Đã khóa"}</td><td><form method="post" action="/admin/users/${u.id}/toggle"><button class="${u.active?'secondary':'danger'}" type="submit" ${u.id===req.user.id?'disabled title="Không thể tự khóa mình"':''}>${u.active?"Khóa":"Mở khóa"}</button></form></td></tr>`).join("");
 res.send(page("Admin",`<div class="panel"><h1>Quản trị hệ thống</h1><p>Quản lý tài khoản thành viên. Không thể tự khóa tài khoản Admin đang đăng nhập.</p><table><thead><tr><th>ID</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table></div>`,req.user));
}catch(e){next(e);}});
app.post("/admin/users/:id/toggle",requireAuth,requireAdmin,async(req,res,next)=>{try{const id=Number(req.params.id);if(id===req.user.id)return res.status(400).send(page("Lỗi",flash("Không thể tự khóa tài khoản."),req.user));await pool.query("UPDATE users SET active=NOT active WHERE id=$1 AND role<>'admin'",[id]);res.redirect("/admin");}catch(e){next(e);}});

app.use((req,res)=>res.status(404).send(page("Không tìm thấy",`<div class="panel"><h1>404</h1><p>Trang bạn tìm không tồn tại.</p><a href="/">Về trang chính</a></div>`)));
app.use((err,req,res,next)=>{console.error(err);res.status(500).send(page("Lỗi máy chủ",flash("Có lỗi xảy ra. Vui lòng thử lại sau.")));});
initDb().then(()=>app.listen(port,()=>console.log(`Team Dương Auto Zalo listening on ${port}`))).catch(err=>{console.error("Startup failed:",err);process.exit(1);});
