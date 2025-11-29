# Gemini Toplantı Paketi
## Problem Özeti (Yeni)
- UI Dead-End: Sonuç ekranında “Yanlışları İncele” açıldığında listenin en altında kapatma/ana ekran butonu yok. Eklendi: alt aksiyon barı (gizle + ana ekran).
- 20/21 Tamamlanamama: Çalışma modunda sıralama rastgele olduğundan level==0 bir soru arkada kalabiliyor. Düzelti: level==0 önceliği, sonra isDue, sonra karışık.
Tarih: 2025-11-29T20:05:54

## Dizin Yapısı
- .
  - .env
  - .env.example
  - .gitignore
  - README.md
  - bump_version.py
  - gemini_toplanti_1.md
  - gemini_toplanti_2.md
  - gemini_toplanti_3.md
  - gemini_toplanti_senkronizayon_oneri.txt
  - gen_gemini_dump.py
  - index.html
  - manifest.json
  - pwa_update.md
  - service-worker.js
  - toplanti_4_senkron.md
  - toplanti_4_senkron_fix.md
  - toplanti_4_senkron_fix_rev1.md
  - toplanti_gemini.txt
  - toplanti_senkron_fix_v3.md
  - toplanti_senkron_v3.md
  - toplantı.md
  - ux_revizyon.md
  - version.json
- .githooks
  - pre-commit
- admin
  - index.html
  - panel.html
  - panel.js
- analiz
  - analiz.txt
- api
  - admin.php
  - admin_accounts.php
  - admin_boot.php
  - auth.php
  - config.php
  - db.php
  - sync.php
  - tooltips.php
- assets
  - logo.png
- assets\icons
  - icon-192.png
  - icon-512.png
- css
  - main.css
  - modal.css
- data
  - UNIX-SISTEM-YONETIMI-BIL211U.json
  - ahmetcetin_aof_2025-11-29_17-26-49.sql
  - changelog.json
  - config.json
  - mobil-uygulama-gelistirme-BIL209U.json
  - programlama-2-BIL203U.json
  - tooltips.json
  - veri-yapilari-BIL207U.json
  - web-arayuz-programlama-BIL205U.json
- js
  - app.js
- js\core
  - authManager.js
  - dataLoader.js
  - db.js
  - examManager.js
  - gamification.js
  - srs.js
  - sync.js
  - updateManager.js
- js\ui
  - dashboard.js
  - quizUI.js
- private

## Kaynak Kodlar (PHP & JS)
### service-worker.js

```javascript
const STATIC_CACHE = 'aof-asistan-v2-static-v1.1.33';
const DATA_CACHE = 'aof-asistan-v2-data-v1.1.33';
const TTL_MS = 300000;
const STATIC_ASSETS = [
    './',
    './index.html',
    './css/main.css',
    './css/modal.css',
    './js/app.js',
    './js/core/db.js',
    './js/core/dataLoader.js',
    './js/core/srs.js',
    './js/core/gamification.js',
    './js/core/examManager.js',
    './js/core/updateManager.js',
    './js/ui/dashboard.js',
    './js/ui/quizUI.js',
    './assets/logo.png'
];

// Kurulum (Install)
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
});

// Aktifleştirme ve Eski Cache Temizliği
self.addEventListener('activate', (event) => {
    event.waitUntil((async () => { try { await self.clients.claim(); } catch(e){} })());
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== STATIC_CACHE && key !== DATA_CACHE) {
                    return caches.delete(key);
                }
            }));
        })
    );
});

// İstekleri Yakalama (Fetch)
self.addEventListener('fetch', (event) => {
    if (!event.request.url.startsWith('http')) return;

    // Admin arayüzü ve API taleplerini cache dışı bırak (her zaman ağdan al)
    if (event.request.url.includes('/admin/') || event.request.url.includes('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    if (event.request.url.includes('/data/') || event.request.url.endsWith('.json')) {
        event.respondWith(
            caches.open(DATA_CACHE).then(async (cache) => {
                const cachedResponse = await cache.match(event.request);
                const networkFetch = fetch(event.request).then(async (response) => {
                    if (response.ok) {
                        await cache.put(event.request, response.clone());
                    }
                    return response;
                }).catch(() => {});

                if (cachedResponse) {
                    const dateHeader = cachedResponse.headers.get('Date');
                    let fresh = true;
                    if (dateHeader) {
                        const age = Date.now() - new Date(dateHeader).getTime();
                        fresh = age < TTL_MS;
                    }
                    if (fresh) return cachedResponse;
                    return networkFetch.then(r => r).catch(() => cachedResponse);
                }
                return networkFetch;
            })
        );
        return;
    }

    event.respondWith(
        caches.open(STATIC_CACHE).then(async (cache) => {
            const cached = await cache.match(event.request);
            if (cached) return cached;
            return fetch(event.request).then(async (resp) => {
                if (resp && resp.ok) {
                    await cache.put(event.request, resp.clone());
                }
                return resp;
            }).catch(() => {
                if (event.request.mode === 'navigate') {
                    return cache.match('./index.html');
                }
            });
        })
    );
});

```

### admin\panel.js

```javascript
const base = '../api/admin.php'
let state = { q:'', limit:50, offset:0, total:0 }
function creds(){ return { user: localStorage.getItem('admin_user') || '' } }
function ensureAuth(){ const c = creds(); if (!c.user) { location.href = './' } }
function logout(){ localStorage.removeItem('admin_user'); location.href = './' }
async function api(action, method='GET', body=null, params={}){
  const headers = { 'Content-Type': 'application/json' }
  const usp = new URLSearchParams(params)
  const res = await fetch(`${base}?action=${action}&${usp.toString()}`, {
    method,
    headers,
    body: body?JSON.stringify(body):undefined,
    credentials:'include',
    cache:'no-store'
  })
  if(!res.ok){ const txt = await res.text().catch(()=> ''); throw new Error(`API error ${res.status}: ${txt}`) }
  const j = await res.json().catch(()=>({}))
  return j.data
}
async function loadUsers(){
  try{
    const data = await api('list_users','GET',null,{ q: state.q, limit: state.limit, offset: state.offset })
    const list = data.items || []
    state.total = data.total || list.length
    const tbody = document.getElementById('users-tbody')
    if (list.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="muted">Kayıt bulunamadı</td></tr>`; }
    else {
      tbody.innerHTML = list.map(u => `
        <tr>
          <td>${u.id}</td>
          <td><input value="${u.email}" onchange="updateUser(${u.id}, this.value, null, null)"/></td>
          <td><input value="${u.name||''}" onchange="updateUser(${u.id}, null, this.value, null)"/></td>
          <td class="muted">${new Date((u.created_at||0)*1000).toLocaleString()}</td>
          <td>
            <input type="password" placeholder="Yeni Şifre" onchange="updateUser(${u.id}, null, null, this.value)"/>
            <button onclick="deleteUser(${u.id})">Sil</button>
          </td>
        </tr>
      `).join('')
    }
    document.getElementById('meta').textContent = `Toplam: ${state.total}`
    const page = Math.floor(state.offset / state.limit) + 1
    const pages = Math.max(1, Math.ceil(state.total / state.limit))
    document.getElementById('page-info').textContent = `Sayfa ${page} / ${pages}`
  }catch(e){ alert(e.message) }
}
async function createUser(){
  const name = document.getElementById('new-name').value
  const email = document.getElementById('new-email').value
  const pass = document.getElementById('new-pass').value
  try{ await api('create_user','POST',{ name, email, password: pass }); refresh(); }
  catch(e){ if (e.message.includes('409')) alert('E-posta zaten kayıtlı'); else alert(e.message) }
}
async function updateUser(id, email, name, password){
  const payload = { id }
  if (email !== null) payload.email = email
  if (name !== null) payload.name = name
  if (password !== null) payload.password = password
  try{ await api('update_user','POST',payload); refresh() }catch(e){ alert(e.message) }
}
async function deleteUser(id){
  if(!confirm('Bu kullanıcı ve tüm verileri silinecek. Emin misiniz?')) return
  try{ await api('delete_user','POST',{ id }); refresh(); }catch(e){ alert(e.message) }
}
function refresh(){ state.offset = 0; loadUsers() }
function prevPage(){ state.offset = Math.max(0, state.offset - state.limit); loadUsers() }
function nextPage(){ const maxOffset = Math.max(0, (Math.ceil(state.total/state.limit)-1)*state.limit); state.offset = Math.min(maxOffset, state.offset + state.limit); loadUsers() }
function debounce(fn, ms){ let h; return (...args)=>{ clearTimeout(h); h = setTimeout(()=>fn(...args), ms) } }
const onSearch = debounce(v => { state.q = v; refresh() }, 300)
window.addEventListener('DOMContentLoaded', () => {
  ensureAuth()
  const c = creds(); const ud = document.getElementById('admin-user-display'); if (ud) ud.textContent = c.user || ''
  const lb = document.getElementById('logout-btn'); if (lb) lb.onclick = logout
  const sizeSel = document.getElementById('page-size'); state.limit = parseInt(sizeSel.value); sizeSel.onchange = ()=>{ state.limit = parseInt(sizeSel.value); refresh() }
  const search = document.getElementById('search'); search.oninput = ()=> onSearch(search.value)
  loadUsers(); loadDbInfo()
})
async function loadDbInfo(){
  try{
    const info = await api('db_info')
    const tbody = document.getElementById('db-info')
    const sizeKB = ((info.size||0)/1024).toFixed(1)
    const mtime = info.mtime ? new Date(info.mtime*1000).toLocaleString() : '-'
    tbody.innerHTML = `
      <tr><td class="muted">Yol</td><td>${info.path}</td></tr>
      <tr><td class="muted">Var mı?</td><td>${info.exists ? 'Evet' : 'Hayır'}</td></tr>
      <tr><td class="muted">Boyut</td><td>${sizeKB} KB</td></tr>
      <tr><td class="muted">Değiştirme</td><td>${mtime}</td></tr>
      <tr><td class="muted">Tablolar</td><td>${(info.tables||[]).join(', ')}</td></tr>
      <tr><td class="muted">Kayıt Sayıları</td><td>
        users=${info.counts?.users||0}, sessions=${info.counts?.sessions||0}, progress=${info.counts?.progress||0}, user_stats=${info.counts?.user_stats||0}, exam_history=${info.counts?.exam_history||0}
      </td></tr>
    `
  }catch(e){ document.getElementById('db-info').innerHTML = `<tr><td colspan="2" class="muted">${e.message}</td></tr>` }
}

```

### api\admin.php

```php
<?php
require __DIR__ . '/db.php';
require __DIR__ . '/admin_boot.php';

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

$LOG_FILE = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'aof_admin_error';

function secure_token($len=24){
    if (function_exists('random_bytes')) { return bin2hex(random_bytes($len)); }
    if (function_exists('openssl_random_pseudo_bytes')) { return bin2hex(openssl_random_pseudo_bytes($len)); }
    return bin2hex(substr(str_shuffle('abcdefghijklmnopqrstuvwxyz0123456789'),0,$len));
}

function adminAuthorized($pdo, $ADMIN_USER, $ADMIN_PASS_HASH){
    if (!empty($_COOKIE['admin_session'])) {
        $tok = $_COOKIE['admin_session'];
        $st = $pdo->prepare('SELECT token FROM admin_sessions WHERE token=?');
        $st->execute([$tok]);
        if ($st->fetch(PDO::FETCH_ASSOC)) return true;
    }
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (stripos($auth, 'Basic ') === 0) {
        $dec = base64_decode(substr($auth, 6));
        if ($dec !== false) {
            [$u, $p] = array_pad(explode(':', $dec, 2), 2, '');
            if ($u === $ADMIN_USER && password_verify($p, $ADMIN_PASS_HASH)) return true;
        }
    }
    return false;
}

header('Content-Type: application/json');
$a = $_GET['action'] ?? '';

if ($a === 'admin_diag') {
    try {
        $privateDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'private';
        $cfgPath = $privateDir . DIRECTORY_SEPARATOR . 'admin.json';
        $exists = is_dir($privateDir);
        $writable = $exists ? is_writable($privateDir) : false;
        $pdoOk = false; try { $pdo->query('SELECT 1'); $pdoOk = true; } catch(Exception $e) { $pdoOk = false; }
        $sessTbl = false; try { $st = $pdo->query("SHOW TABLES LIKE 'admin_sessions'"); $sessTbl = !!($st && $st->fetchColumn()); } catch(Exception $e) { $sessTbl = false; }
        $writeTest = false; $testFile = $privateDir . DIRECTORY_SEPARATOR . 'diag_test.txt';
        try { @file_put_contents($testFile, 'ok'); $writeTest = file_exists($testFile); if ($writeTest) @unlink($testFile); } catch(Exception $e) { $writeTest = false; }
        $adminJsonOk = file_exists($cfgPath);
        ok([
            'private_exists' => $exists,
            'private_writable' => $writable,
            'admin_json_exists' => $adminJsonOk,
            'pdo_ok' => $pdoOk,
            'admin_sessions_table' => $sessTbl,
            'write_test' => $writeTest,
        ]);
    } catch(Exception $e) { err(500,'server_error'); }
    exit;
}

if ($a === 'admin_login') {
    $in = json(); $u = $in['username'] ?? ''; $p = $in['password'] ?? '';
    try {
        if ($u === $ADMIN_USER && password_verify($p, $ADMIN_PASS_HASH)) {
            $token = secure_token(24);
            $pdo->prepare('INSERT INTO admin_sessions(token,created_at) VALUES(?,?)')->execute([$token, time()]);
            setcookie('admin_session', $token, [
                'expires' => time()+86400,
                'path' => '/aof-sinav-v2/',
                'secure' => true,
                'httponly' => true,
                'samesite' => 'Lax',
            ]);
            ok(['login'=>true]);
        } else { err(401,'unauth'); }
    } catch(Exception $e) {
        @file_put_contents($LOG_FILE, '['.date('c').'] '.$e->getMessage()."\n", FILE_APPEND);
        err(500,'server_error');
    }
    exit;
}

if ($a === 'admin_logout') {
    $tok = $_COOKIE['admin_session'] ?? '';
    if ($tok) {
        $pdo->prepare('DELETE FROM admin_sessions WHERE token=?')->execute([$tok]);
        setcookie('admin_session','', [
            'expires' => time()-3600,
            'path' => '/aof-sinav-v2/',
            'secure' => true,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }
    ok(['logout'=>true]);
    exit;
}

if (!adminAuthorized($pdo, $ADMIN_USER, $ADMIN_PASS_HASH)) { http_response_code(401); echo json_encode(['ok'=>false,'error'=>'unauth']); exit; }

if ($a === 'list_users') {
    $q = trim($_GET['q'] ?? '');
    $limit = max(1, min(200, intval($_GET['limit'] ?? 50)));
    $offset = max(0, intval($_GET['offset'] ?? 0));
    if ($q !== '') {
        $like = '%'.$q.'%';
        $st = $pdo->prepare('SELECT id,email,name,created_at FROM users WHERE email LIKE ? OR name LIKE ? ORDER BY id DESC LIMIT ? OFFSET ?');
        $st->execute([$like,$like,$limit,$offset]);
    } else {
        $st = $pdo->prepare('SELECT id,email,name,created_at FROM users ORDER BY id DESC LIMIT ? OFFSET ?');
        $st->execute([$limit,$offset]);
    }
    $rows = $st->fetchAll(PDO::FETCH_ASSOC);
    $count = $pdo->query('SELECT COUNT(*) AS c FROM users')->fetch(PDO::FETCH_ASSOC)['c'] ?? 0;
    ok(['items'=>$rows,'total'=>intval($count)]);
} elseif ($a === 'create_user') {
    $in = json(); $email = trim(strtolower($in['email'] ?? '')); $pass = $in['password'] ?? ''; $name = trim($in['name'] ?? '');
    if (!$email || !$pass) return err(400,'missing');
    $hash = password_hash($pass, PASSWORD_DEFAULT);
    try { $pdo->prepare('INSERT INTO users(email,password_hash,name,created_at) VALUES(?,?,?,?)')->execute([$email,$hash,$name,time()]); ok(['created'=>true]); }
    catch(Exception $e){ return err(409,'exists'); }
} elseif ($a === 'update_user') {
    $in = json(); $id = intval($in['id'] ?? 0); if (!$id) return err(400,'missing');
    $email = isset($in['email']) ? trim(strtolower($in['email'])) : null;
    $name = isset($in['name']) ? trim($in['name']) : null;
    $pass = $in['password'] ?? null;
    $set = []; $args = [];
    if ($email !== null) { $set[] = 'email=?'; $args[] = $email; }
    if ($name !== null) { $set[] = 'name=?'; $args[] = $name; }
    if ($pass !== null && $pass !== '') { $set[] = 'password_hash=?'; $args[] = password_hash($pass,PASSWORD_DEFAULT); }
    if (!$set) return ok(['updated'=>false]);
    $args[] = $id;
    $sql = 'UPDATE users SET '.implode(',', $set).' WHERE id=?';
    $pdo->prepare($sql)->execute($args); ok(['updated'=>true]);
} elseif ($a === 'delete_user') {
    $in = json(); $id = intval($in['id'] ?? 0); if (!$id) return err(400,'missing');
    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM sessions WHERE user_id=?')->execute([$id]);
        $pdo->prepare('DELETE FROM progress WHERE user_id=?')->execute([$id]);
        $pdo->prepare('DELETE FROM user_stats WHERE user_id=?')->execute([$id]);
        $pdo->prepare('DELETE FROM exam_history WHERE user_id=?')->execute([$id]);
        $pdo->prepare('DELETE FROM users WHERE id=?')->execute([$id]);
        $pdo->commit(); ok(['deleted'=>true]);
    } catch(Exception $e){ $pdo->rollBack(); return err(500,'server_error'); }
} elseif ($a === 'db_info') {
    try {
        $tables = [];
        try { $rs = $pdo->query('SHOW TABLES'); if ($rs) { foreach ($rs->fetchAll(PDO::FETCH_NUM) as $row) { $tables[] = $row[0]; } } } catch(Exception $e){}
        $counts = [];
        foreach(['users','sessions','progress','user_stats','exam_history'] as $t){
            try { $counts[$t] = (int)$pdo->query("SELECT COUNT(*) FROM `$t`")->fetchColumn(); } catch(Exception $e){ $counts[$t] = 0; }
        }
        ok([
            'path' => 'mysql',
            'exists' => true,
            'size' => 0,
            'mtime' => 0,
            'tables' => $tables,
            'counts' => $counts,
        ]);
    } catch(Exception $e) { err(500,'server_error'); }
} else { err(404,'notfound'); }

```

### api\admin_accounts.php

```php
<?php
require __DIR__ . '/db.php';
$action = $_GET['action'] ?? '';
$secretParam = $_GET['secret'] ?? ($_POST['secret'] ?? '');
if (!$secretParam || $secretParam !== ($SECRET ?? '')) { http_response_code(401); echo json_encode(['ok'=>false,'error'=>'unauth']); exit; }
if ($action === 'list') {
    $rows = $pdo->query('SELECT id,email,name,created_at FROM users ORDER BY id DESC')->fetchAll(PDO::FETCH_ASSOC);
    ok($rows ?: []);
} elseif ($action === 'delete') {
    $email = trim(strtolower(($_POST['email'] ?? $_GET['email'] ?? '')));
    if (!$email) return err(400,'missing');
    $st = $pdo->prepare('SELECT id FROM users WHERE email=?');
    $st->execute([$email]);
    $u = $st->fetch(PDO::FETCH_ASSOC);
    if (!$u) return ok(['deleted'=>false]);
    $uid = intval($u['id']);
    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM sessions WHERE user_id=?')->execute([$uid]);
        $pdo->prepare('DELETE FROM progress WHERE user_id=?')->execute([$uid]);
        $pdo->prepare('DELETE FROM user_stats WHERE user_id=?')->execute([$uid]);
        $pdo->prepare('DELETE FROM exam_history WHERE user_id=?')->execute([$uid]);
        $pdo->prepare('DELETE FROM users WHERE id=?')->execute([$uid]);
        $pdo->commit();
        ok(['deleted'=>true]);
    } catch(Exception $e){ $pdo->rollBack(); err(500,'server_error'); }
} elseif ($action === 'bulk_delete') {
    $in = json();
    $emails = is_array($in['emails'] ?? null) ? $in['emails'] : [];
    $deleted = [];
    foreach ($emails as $email) {
        $email2 = trim(strtolower($email));
        if (!$email2) continue;
        $st = $pdo->prepare('SELECT id FROM users WHERE email=?');
        $st->execute([$email2]);
        $u = $st->fetch(PDO::FETCH_ASSOC);
        if (!$u) continue;
        $uid = intval($u['id']);
        try {
            $pdo->prepare('DELETE FROM sessions WHERE user_id=?')->execute([$uid]);
            $pdo->prepare('DELETE FROM progress WHERE user_id=?')->execute([$uid]);
            $pdo->prepare('DELETE FROM user_stats WHERE user_id=?')->execute([$uid]);
            $pdo->prepare('DELETE FROM exam_history WHERE user_id=?')->execute([$uid]);
            $pdo->prepare('DELETE FROM users WHERE id=?')->execute([$uid]);
            $deleted[] = $email2;
        } catch(Exception $e){ }
    }
    ok(['deleted'=>$deleted]);
} else { err(404,'notfound'); }

```

### api\admin_boot.php

```php
<?php
$ADMIN_USER = 'admin';
$ADMIN_PASS_HASH = password_hash('5211@Admin', PASSWORD_DEFAULT);
$privateDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'private';
$cfgPath = $privateDir . DIRECTORY_SEPARATOR . 'admin.json';
if (!is_dir($privateDir)) { @mkdir($privateDir, 0775, true); }
if (file_exists($cfgPath)) {
    $raw = @file_get_contents($cfgPath);
    $j = $raw ? json_decode($raw, true) : null;
    if (is_array($j) && !empty($j['user']) && !empty($j['pass_hash'])) {
        $ADMIN_USER = $j['user'];
        $ADMIN_PASS_HASH = $j['pass_hash'];
    }
} else {
    @file_put_contents($cfgPath, json_encode(['user'=>$ADMIN_USER, 'pass_hash'=>$ADMIN_PASS_HASH]));
}

```

### api\auth.php

```php
<?php
require __DIR__ . '/db.php';
$a = $_GET['action'] ?? '';
if ($a === 'register') {
    $in = json();
    $email = trim(strtolower($in['email'] ?? ''));
    $pass = $in['password'] ?? '';
    if (!$email || !$pass) return err(400,'missing');
    $hash = password_hash($pass, PASSWORD_DEFAULT);
    try {
        $st = $pdo->prepare('INSERT INTO users(email,password_hash,created_at) VALUES(?,?,?)');
        $st->execute([$email,$hash,time()]);
    } catch(Exception $e){ return err(409,'exists'); }
    ok(['registered'=>true]);
} elseif ($a === 'login') {
    $in = json();
    $email = trim(strtolower($in['email'] ?? ''));
    $pass = $in['password'] ?? '';
    if (!$email || !$pass) return err(400,'missing');
    $st = $pdo->prepare('SELECT id,password_hash FROM users WHERE email=?');
    $st->execute([$email]);
    $u = $st->fetch(PDO::FETCH_ASSOC);
    if (!$u || !password_verify($pass, $u['password_hash'])) return err(401,'invalid');
    $token = bin2hex(random_bytes(32));
    $pdo->prepare('INSERT INTO sessions(token,user_id,created_at) VALUES(?,?,?)')->execute([$token,$u['id'],time()]);
    ok(['token'=>$token]);
} elseif ($a === 'delete') {
    $uid = token_user($pdo,$SECRET);
    if (!$uid) return err(401,'unauth');
    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM sessions WHERE user_id=?')->execute([$uid]);
        $pdo->prepare('DELETE FROM progress WHERE user_id=?')->execute([$uid]);
        $pdo->prepare('DELETE FROM user_stats WHERE user_id=?')->execute([$uid]);
        $pdo->prepare('DELETE FROM exam_history WHERE user_id=?')->execute([$uid]);
        $pdo->prepare('DELETE FROM users WHERE id=?')->execute([$uid]);
        $pdo->commit();
        ok(['deleted'=>true]);
    } catch(Exception $e){ $pdo->rollBack(); return err(500,'server_error'); }
} elseif ($a === 'me') {
    $uid = token_user($pdo,$SECRET);
    if (!$uid) return err(401,'unauth');
    $st = $pdo->prepare('SELECT email,name,created_at FROM users WHERE id=?');
    $st->execute([$uid]);
    $u = $st->fetch(PDO::FETCH_ASSOC);
    if (!$u) return err(404,'notfound');
    ok($u);
} elseif ($a === 'profile') {
    $uid = token_user($pdo,$SECRET);
    if (!$uid) return err(401,'unauth');
    $in = json();
    $name = isset($in['name']) ? trim($in['name']) : null;
    if ($name !== null) {
        try { $st = $pdo->prepare('UPDATE users SET name=? WHERE id=?'); $st->execute([$name,$uid]); }
        catch(Exception $e){ return err(500,'server_error'); }
    }
    $st2 = $pdo->prepare('SELECT email,name,created_at FROM users WHERE id=?');
    $st2->execute([$uid]);
    $u2 = $st2->fetch(PDO::FETCH_ASSOC);
    ok($u2?:[]);
} elseif ($a === 'update') {
    $uid = token_user($pdo,$SECRET);
    if (!$uid) return err(401,'unauth');
    $in = json();
    $newEmail = isset($in['new_email']) ? trim(strtolower($in['new_email'])) : '';
    $newPass = isset($in['new_password']) ? (string)$in['new_password'] : '';
    $newName = isset($in['new_name']) ? trim($in['new_name']) : '';
    if ($newEmail) {
        $st = $pdo->prepare('SELECT id FROM users WHERE email=?');
        $st->execute([$newEmail]);
        $ex = $st->fetch(PDO::FETCH_ASSOC);
        if ($ex) return err(409,'exists');
        $pdo->prepare('UPDATE users SET email=? WHERE id=?')->execute([$newEmail,$uid]);
    }
    if ($newPass) {
        $hash = password_hash($newPass, PASSWORD_DEFAULT);
        $pdo->prepare('UPDATE users SET password_hash=? WHERE id=?')->execute([$hash,$uid]);
    }
    if ($newName) {
        $pdo->prepare('UPDATE users SET name=? WHERE id=?')->execute([$newName,$uid]);
    }
    $st2 = $pdo->prepare('SELECT email,name,created_at FROM users WHERE id=?');
    $st2->execute([$uid]);
    $u2 = $st2->fetch(PDO::FETCH_ASSOC);
    ok($u2?:[]);
} elseif ($a === 'exists') {
    $in = json();
    $email = trim(strtolower($in['email'] ?? ''));
    if (!$email) return ok(['exists'=>false]);
    $st = $pdo->prepare('SELECT id FROM users WHERE email=?');
    $st->execute([$email]);
    $ex = $st->fetch(PDO::FETCH_ASSOC);
    ok(['exists'=>!!$ex]);
} else { err(404,'notfound'); }

```

### api\config.php

```php
<?php
// Simple .env loader (root/.env). Each line key=value
$envPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env';
if (file_exists($envPath)) {
    $lines = @file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines) {
        foreach ($lines as $line) {
            if (strlen($line) === 0 || $line[0] === '#') continue;
            $parts = explode('=', $line, 2);
            if (count($parts) === 2) { $k = trim($parts[0]); $v = trim($parts[1]); @putenv("$k=$v"); $_ENV[$k] = $v; }
        }
    }
}

$DB_DRIVER = getenv('AOF_DB_DRIVER') ?: 'mysql';

// PostgreSQL
$PG_HOST = getenv('AOF_PG_HOST') ?: 'localhost';
$PG_PORT = getenv('AOF_PG_PORT') ?: '5432';
$PG_DB   = getenv('AOF_PG_DB')   ?: 'ahmetcetin__aof';
$PG_USER = getenv('AOF_PG_USER') ?: 'ahmetcetin__aof';
$PG_PASS = getenv('AOF_PG_PASS') ?: '5211@Admin';
$PG_DSN  = "pgsql:host=$PG_HOST;port=$PG_PORT;dbname=$PG_DB";

// MariaDB / MySQL
$MY_HOST = getenv('AOF_MY_HOST') ?: 'localhost';
$MY_PORT = getenv('AOF_MY_PORT') ?: '3306';
$MY_DB   = getenv('AOF_MY_DB')   ?: 'ahmetcetin__aof';
$MY_USER = getenv('AOF_MY_USER') ?: 'ahmetcetin__aof';
$MY_PASS = getenv('AOF_MY_PASS') ?: '5211@Admin';
$MY_DSN  = "mysql:host=$MY_HOST;port=$MY_PORT;dbname=$MY_DB;charset=utf8mb4";

$DB_PATH = getenv('AOF_DB_PATH') ?: dirname(__DIR__) . DIRECTORY_SEPARATOR . 'private' . DIRECTORY_SEPARATOR . 'aof_sinav.sqlite';
$SECRET = getenv('AOF_API_SECRET') ?: 'change_this_secret';
if (!is_dir(dirname($DB_PATH))) { @mkdir(dirname($DB_PATH), 0777, true); }

```

### api\db.php

```php
<?php
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(0);
header('Content-Type: application/json');

$root = dirname(__DIR__);
$ROOT_LOG = null;
$env = [];
if (false) {}
if (empty($env)) {
    $envPath = $root.'/.env';
    if (file_exists($envPath)) {
        $parsed = parse_ini_file($envPath, false, INI_SCANNER_RAW);
        if (is_array($parsed)) { $env = $parsed; }
    }
}

$host = $env['AOF_MY_HOST'] ?? 'localhost';
$port = $env['AOF_MY_PORT'] ?? '3306';
$db   = $env['AOF_MY_DB']   ?? 'ahmetcetin_aof';
$user = $env['AOF_MY_USER'] ?? 'ahmetcetin_aof';
$pass = $env['AOF_MY_PASS'] ?? '5211@Admin';
$dsn  = "mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4";
$SECRET = $env['AOF_API_SECRET'] ?? 'change_this_secret';

try {
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok'=>false,'error'=>'DB Error','detail'=>$e->getMessage(),'debug_host'=>$host,'debug_user'=>$user]);
    exit;
}

$pdo->exec('CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(255) UNIQUE, password_hash VARCHAR(255) NOT NULL, name VARCHAR(255), created_at BIGINT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
$pdo->exec('CREATE TABLE IF NOT EXISTS sessions (token VARCHAR(255) PRIMARY KEY, user_id INT NOT NULL, created_at BIGINT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
$pdo->exec('CREATE TABLE IF NOT EXISTS progress (id VARCHAR(255) PRIMARY KEY, user_id INT NOT NULL, lesson VARCHAR(255), unit INT, level INT, nextReview BIGINT, correct INT, wrong INT, updated_at BIGINT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
$pdo->exec('CREATE TABLE IF NOT EXISTS user_stats (user_id INT PRIMARY KEY, xp INT, streak INT, totalQuestions INT, updated_at BIGINT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
$pdo->exec('CREATE TABLE IF NOT EXISTS exam_history (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, date BIGINT NOT NULL, lesson VARCHAR(255), unit INT, isCorrect TINYINT(1)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
$pdo->exec('CREATE TABLE IF NOT EXISTS admin_sessions (token VARCHAR(255) PRIMARY KEY, created_at BIGINT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
$pdo->exec('CREATE TABLE IF NOT EXISTS study_sessions (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, lesson VARCHAR(255), unit INT, mode VARCHAR(32), started_at BIGINT NOT NULL, ended_at BIGINT, uuid VARCHAR(36) UNIQUE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
try { $pdo->exec('CREATE INDEX idx_ss_user_lesson ON study_sessions(user_id, lesson)'); } catch (Throwable $e) {}
try { $pdo->exec('CREATE INDEX idx_ss_user_lesson_unit ON study_sessions(user_id, lesson, unit)'); } catch (Throwable $e) {}
try { $pdo->exec('CREATE INDEX idx_hist_user ON exam_history(user_id)'); } catch (Throwable $e) {}
try { $pdo->exec('CREATE INDEX idx_hist_date ON exam_history(date)'); } catch (Throwable $e) {}
try { $pdo->exec('CREATE INDEX idx_prog_user ON progress(user_id)'); } catch (Throwable $e) {}

try {
    $st = $pdo->query("SHOW COLUMNS FROM exam_history LIKE 'uuid'");
    $has = ($st && $st->fetch(PDO::FETCH_ASSOC)) ? true : false;
    if (!$has) {
        try { $pdo->exec('ALTER TABLE exam_history ADD COLUMN uuid VARCHAR(36) NOT NULL'); } catch (Throwable $e) {}
        try { $pdo->exec('ALTER TABLE exam_history ADD UNIQUE INDEX idx_uuid (uuid)'); } catch (Throwable $e) {}
    }
} catch (Throwable $e) {}

// Ensure exam_history has question id (qid) for detailed review
try {
    $st2 = $pdo->query("SHOW COLUMNS FROM exam_history LIKE 'qid'");
    $has2 = ($st2 && $st2->fetch(PDO::FETCH_ASSOC)) ? true : false;
    if (!$has2) {
        try { $pdo->exec('ALTER TABLE exam_history ADD COLUMN qid VARCHAR(255)'); } catch (Throwable $e) {}
        try { $pdo->exec('ALTER TABLE exam_history ADD INDEX idx_qid (qid)'); } catch (Throwable $e) {}
    }
} catch (Throwable $e) {}

// Ensure exam_history has given_option (user's answer)
try {
    $st3 = $pdo->query("SHOW COLUMNS FROM exam_history LIKE 'given_option'");
    $has3 = ($st3 && $st3->fetch(PDO::FETCH_ASSOC)) ? true : false;
    if (!$has3) {
        try { $pdo->exec('ALTER TABLE exam_history ADD COLUMN given_option TEXT'); } catch (Throwable $e) {}
    }
} catch (Throwable $e) {}

function json(){ return json_decode(file_get_contents('php://input'), true) ?: []; }
function ok($d){ echo json_encode(['ok'=>true,'data'=>$d]); }
function err($c,$m){ http_response_code($c); echo json_encode(['ok'=>false,'error'=>$m]); }
function auth_header(){
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!$h) $h = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!$h && function_exists('getallheaders')) {
        $headers = getallheaders();
        foreach($headers as $k=>$v){ if (strcasecmp($k,'Authorization')===0) { $h = $v; break; } }
    }
    return $h;
}
function token_user($pdo,$SECRET){
    $h = auth_header();
    $t = '';
    if ($h && stripos($h,'Bearer ')===0) { $t = substr($h,7); }
    if (!$t) { $t = $_GET['token'] ?? $_POST['token'] ?? ''; }
    if (!$t && ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
        $raw = file_get_contents('php://input');
        if ($raw) {
            $j = json_decode($raw, true);
            if (is_array($j) && !empty($j['token'])) { $t = $j['token']; }
        }
    }
    if (!$t) return 0;
    try {
        $st = $pdo->prepare('SELECT user_id FROM sessions WHERE token=?');
        $st->execute([$t]);
        $r = $st->fetch(PDO::FETCH_ASSOC);
        return $r ? intval($r['user_id']) : 0;
    } catch (Throwable $e) { return 0; }
}

```

### api\sync.php

```php
<?php
require __DIR__ . '/db.php';
$user = token_user($pdo,$SECRET);
if (!$user) return err(401,'unauth');
$a = $_GET['action'] ?? '';
if ($a === 'check_version') {
    $m1 = 0; $m2 = 0; $m3 = 0;
    try { $st = $pdo->prepare('SELECT MAX(updated_at) AS m FROM progress WHERE user_id=?'); $st->execute([$user]); $r = $st->fetch(PDO::FETCH_ASSOC); $m1 = intval($r['m'] ?? 0); } catch (Throwable $e) {}
    try { $st = $pdo->prepare('SELECT MAX(updated_at) AS m FROM user_stats WHERE user_id=?'); $st->execute([$user]); $r = $st->fetch(PDO::FETCH_ASSOC); $m2 = intval($r['m'] ?? 0); } catch (Throwable $e) {}
    try { $st = $pdo->prepare('SELECT MAX(date) AS m FROM exam_history WHERE user_id=?'); $st->execute([$user]); $r = $st->fetch(PDO::FETCH_ASSOC); $m3 = intval($r['m'] ?? 0); } catch (Throwable $e) {}
    $last = max($m1,$m2,$m3);
    ok(['last_server_update'=>$last]);
    exit;
}
if ($a === 'push') {
    $in = json();
    $progress = $in['progress'] ?? [];
    $selP = $pdo->prepare('SELECT updated_at FROM progress WHERE id=? AND user_id=?');
    $insP = $pdo->prepare('INSERT INTO progress(id,user_id,lesson,unit,level,nextReview,correct,wrong,updated_at) VALUES(?,?,?,?,?,?,?,?,?)');
    $updP = $pdo->prepare('UPDATE progress SET user_id=?, lesson=?, unit=?, level=?, nextReview=?, correct=?, wrong=?, updated_at=? WHERE id=? AND user_id=?');
    foreach ($progress as $p) {
        $pid = $p['id']??''; if(!$pid) continue;
        $inc = intval($p['updated_at']??0); if(!$inc) $inc = time();
        $selP->execute([$pid, $user]);
        $row = $selP->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            $insP->execute([$pid, $user, $p['lesson']??'', intval($p['unit']??0), intval($p['level']??0), intval($p['nextReview']??0), intval($p['correct']??0), intval($p['wrong']??0), $inc]);
        } else {
            $cur = intval($row['updated_at']??0);
            if ($inc > $cur) {
                $updP->execute([$user, $p['lesson']??'', intval($p['unit']??0), intval($p['level']??0), intval($p['nextReview']??0), intval($p['correct']??0), intval($p['wrong']??0), $inc, $pid, $user]);
            }
        }
    }
    if (isset($in['stats'])) {
        $s = $in['stats'];
        $incS = intval($s['updated_at']??0); if(!$incS) $incS = time();
        $selS = $pdo->prepare('SELECT updated_at FROM user_stats WHERE user_id=?');
        $selS->execute([$user]);
        $rowS = $selS->fetch(PDO::FETCH_ASSOC);
        if (!$rowS) {
            $pdo->prepare('INSERT INTO user_stats(user_id,xp,streak,totalQuestions,updated_at) VALUES(?,?,?,?,?)')->execute([$user, intval($s['xp']??0), intval($s['streak']??0), intval($s['totalQuestions']??0), $incS]);
        } else {
            $curS = intval($rowS['updated_at']??0);
            if ($incS > $curS) {
                $pdo->prepare('UPDATE user_stats SET xp=?, streak=?, totalQuestions=?, updated_at=? WHERE user_id=?')->execute([intval($s['xp']??0), intval($s['streak']??0), intval($s['totalQuestions']??0), $incS, $user]);
            }
        }
    }
    if (isset($in['history']) && is_array($in['history'])) {
        $ins = $pdo->prepare('INSERT IGNORE INTO exam_history(user_id,date,lesson,unit,isCorrect,uuid,qid,given_option) VALUES(?,?,?,?,?,?,?,?)');
        foreach ($in['history'] as $h) { $ins->execute([$user, intval($h['date']??time()), $h['lesson']??'', intval($h['unit']??0), intval(($h['isCorrect']??0)?1:0), (string)($h['uuid']??''), (string)($h['qid']??''), (string)($h['given_option']??'')]); }
    }
    if (isset($in['sessions']) && is_array($in['sessions'])) {
        $insS = $pdo->prepare('INSERT IGNORE INTO study_sessions(user_id,lesson,unit,mode,started_at,ended_at,uuid) VALUES(?,?,?,?,?,?,?)');
        foreach ($in['sessions'] as $s) { $insS->execute([$user, $s['lesson']??'', intval($s['unit']??0), $s['mode']??'study', intval($s['started_at']??time()), intval($s['ended_at']??0), (string)($s['uuid']??'')]); }
    }
    ok(['pushed'=>true]);
} elseif ($a === 'pull') {
    $progress = $pdo->prepare('SELECT id,lesson,unit,level,nextReview,correct,wrong,updated_at FROM progress WHERE user_id=?');
    $progress->execute([$user]);
    $stats = $pdo->prepare('SELECT xp,streak,totalQuestions,updated_at FROM user_stats WHERE user_id=?');
    $stats->execute([$user]);
    $hist = $pdo->prepare('SELECT date,lesson,unit,isCorrect,uuid,qid,given_option FROM exam_history WHERE user_id=? ORDER BY date DESC LIMIT 500');
    $hist->execute([$user]);
    $sess = $pdo->prepare('SELECT lesson,unit,mode,started_at,ended_at,uuid FROM study_sessions WHERE user_id=? ORDER BY started_at DESC LIMIT 1000');
    $sess->execute([$user]);
    ok(['progress'=>$progress->fetchAll(PDO::FETCH_ASSOC),'stats'=>$stats->fetch(PDO::FETCH_ASSOC)?:['xp'=>0,'streak'=>0,'totalQuestions'=>0,'updated_at'=>0],'history'=>$hist->fetchAll(PDO::FETCH_ASSOC),'sessions'=>$sess->fetchAll(PDO::FETCH_ASSOC)]);
} elseif ($a === 'wipe') {
    try {
        $pdo->beginTransaction();
        $pdo->prepare('DELETE FROM progress WHERE user_id=?')->execute([$user]);
        $pdo->prepare('DELETE FROM user_stats WHERE user_id=?')->execute([$user]);
        $pdo->prepare('DELETE FROM exam_history WHERE user_id=?')->execute([$user]);
        try { $pdo->prepare('DELETE FROM study_sessions WHERE user_id=?')->execute([$user]); } catch (Throwable $e) {}
        $pdo->commit();
        ok(['wiped'=>true]);
    } catch(Exception $e){ $pdo->rollBack(); return err(500,'server_error'); }
} else { err(404,'notfound'); }

```

### api\tooltips.php

```php
<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache');
$file = __DIR__ . '/../data/tooltips.json';
if (!file_exists($file)) { echo json_encode([]); exit; }
$json = file_get_contents($file);
echo $json !== false ? $json : json_encode([]);

```

### js\app.js

```javascript
import { ExamDatabase } from './core/db.js';
import { DataLoader } from './core/dataLoader.js';
import { Dashboard } from './ui/dashboard.js';
import { UpdateManager } from './core/updateManager.js';
import { SyncManager } from './core/sync.js';

let db, loader, dashboard, quizUI;

async function initApp() {
    console.log("🚀 Uygulama Başlatılıyor (v3.2 Stable)...");

    // 1. Otomatik Güncelleme Kontrolü
    const updater = new UpdateManager();
    updater.checkUpdates(true);

    // 2. Veritabanı Başlatma
    db = new ExamDatabase();
    try {
        await db.open();
    } catch (e) {
        console.error("Veritabanı hatası, otomatik onarım devreye girmeliydi.", e);
        document.getElementById('app-container').innerHTML = 
            `<div class="loading-state"><p style="color:red;">Sistem Hatası! Lütfen sayfayı yenileyin.</p></div>`;
        return;
    }

    // 3. Modülleri Yükle
    loader = new DataLoader(db);
    const sync = new SyncManager(db);
    window.db = db;
    
    // Dashboard'u başlat
    dashboard = new Dashboard(loader, db);
    window.dashboard = dashboard;
    
    

    // 4. Global Başlatıcı Fonksiyonu (Dashboard'dan çağrılır)
    window.startSession = async (lessonCode, config) => {
        const safeConfig = config || { mode: 'study' };
        window.__inSession = true;
        const sessUUID = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){ const r = Math.random()*16|0, v = c=='x'?r:(r&0x3|0x8); return v.toString(16)});
        const unitNo = (safeConfig && safeConfig.specificUnit) ? safeConfig.specificUnit : 0;
        if (db && typeof db.startSessionRecord === 'function') {
            const assigned = await db.startSessionRecord(lessonCode, unitNo, safeConfig.mode || 'study', sessUUID);
            window.__sessionUUID = assigned || sessUUID;
        } else {
            window.__sessionUUID = sessUUID;
        }
        if (loader && typeof loader.resetCache === 'function') { loader.resetCache(); }
        if (!quizUI) {
            const module = await import('./ui/quizUI.js');
            const QuizUI = module.QuizUI;
            quizUI = new QuizUI(loader, db, () => { window.__inSession = false; if (dashboard.refreshAndRender) { dashboard.refreshAndRender(); } else { dashboard.render(); } });
        }
        await quizUI.start(lessonCode, safeConfig);
    };

    // 5. Ayarlar Butonunu Bağla (Header'daki çark ikonu)
    const settingsBtn = document.getElementById('btn-settings');
    if(settingsBtn) {
        settingsBtn.onclick = () => dashboard.openSettings();
    }

    // 6. İlk Ekranı Çiz
    dashboard.render();

    let __refreshLock = false;
    document.addEventListener('app:data-updated', async () => {
        try {
            if (window.__inSession) return;
            if (__refreshLock) return;
            __refreshLock = true;
            console.log('♻️ Veri değişti algılandı. UI tam tazeleme...');
            if (dashboard && typeof dashboard.refreshAndRender === 'function') {
                await dashboard.refreshAndRender();
            } else {
                if (loader && typeof loader.resetCache === 'function') { loader.resetCache(); }
                await dashboard.render();
            }
            setTimeout(() => { __refreshLock = false; }, 1500);
        } catch(e) { __refreshLock = false; }
    });

    const drain = async () => {
        if (!sync.getToken()) return;
        await db.drainSyncQueue(async (payload) => {
            if (!payload) return;
            if (payload.type === 'push') { await sync.autoSync(); }
            else if (payload.type === 'pull') { await sync.autoSync(); }
        });
        await sync.autoSync();
    };
    if (navigator.onLine) { await drain(); }
    window.addEventListener('online', drain);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { updater.checkUpdates(true); if (navigator.onLine) drain(); } });
    setInterval(() => { if (navigator.onLine) drain(); }, 60000);
    const shortPoll = async () => {
        const token = sync.getToken(); if(!token) return;
        const r = await fetch(`./api/sync.php?action=check_version&token=${encodeURIComponent(token)}`,{ headers:{ 'Authorization': `Bearer ${token}` }, cache:'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        const lastServer = (j && j.data && j.data.last_server_update) ? parseInt(j.data.last_server_update) : 0;
        const lastLocal = await db.getProfile('last_sync') || 0;
        if (lastServer > lastLocal) { await drain(); }
    };
    setInterval(() => { if (navigator.onLine) shortPoll(); }, 10000);
}

// Sayfa tamamen yüklendiğinde başlat
document.addEventListener('DOMContentLoaded', initApp);

```

### js\core\authManager.js

```javascript
import { SyncManager } from './sync.js'

export class AuthManager {
    constructor(db){ this.db = db; this.sync = new SyncManager(db) }
    hasToken(){ return !!localStorage.getItem('auth_token') }
    async hasLocalData(){ const p = await this.db.getAllProgress(); const h = await this.db.getHistory(); const s = await this.db.getUserStats(); const sHas = ((s.xp||0) > 0) || ((s.streak||0) > 0) || ((s.totalQuestions||0) > 0); return (Array.isArray(p) && p.length>0) || (Array.isArray(h) && h.length>0) || sHas }
    async login(email,password){ const ok = await this.sync.login(email,password); if(ok){ const hasLocal = await this.hasLocalData(); if(hasLocal){ const pushed = await this.sync.pushAll(); if(!pushed){ await this.db.enqueueSync({ type:'push' }); } } else { await this.sync.pullAll(); } const info = await this.sync.me(); if (info) { await this.db.setProfile('account_email', info.email||''); await this.db.setProfile('account_name', info.name||''); } await this.saveCurrentAccount(); } return ok }
    async register(email,password,name){ const res = await this.sync.register(email,password); if(res.exists){ return { ok:false, exists:true } } if(res.ok){ const logged = await this.sync.login(email,password); if(logged){ const hasLocal = await this.hasLocalData(); if(hasLocal){ const pushed = await this.sync.pushAll(); if(!pushed){ await this.db.enqueueSync({ type:'push' }); } } else { await this.sync.pullAll(); } if(name){ await this.db.setUserName(name) } const info = await this.sync.me(); if (info) { await this.db.setProfile('account_email', info.email||''); await this.db.setProfile('account_name', info.name||''); } } return { ok:logged } } return { ok:false }
    }

    async saveCurrentAccount(){
        const email = await this.db.getProfile('account_email');
        const token = localStorage.getItem('auth_token') || '';
        if (!email || !token) return;
        const list = (await this.db.getProfile('accounts')) || [];
        const idx = Array.isArray(list) ? list.findIndex(a => a && a.email === email) : -1;
        const entry = { email, token, lastSync: await this.db.getProfile('last_sync') || 0 };
        if (idx >= 0) { list[idx] = entry; } else { (Array.isArray(list) ? list : []).push(entry); }
        await this.db.setProfile('accounts', list);
    }
    async deleteAccount(){ return await this.sync.deleteAccount() }
    async wipeRemote(){ return await this.sync.wipeRemote() }
}

```

### js\core\dataLoader.js

```javascript
import { SRS } from './srs.js';

/**
 * DataLoader
 * JSON dosyalarını okur, ID atar ve veritabanı bilgisiyle birleştirir.
 */
export class DataLoader {
    constructor(dbInstance) {
        this.db = dbInstance;
        this.cachedLessons = {}; // Bellekte tutulan dersler
    }

    resetCache(){
        this.cachedLessons = {};
        try { console.log('🧹 RAM Önbelleği temizlendi.'); } catch(e){}
    }

    // Config dosyasını çekip ders listesini döndürür
    async getLessonList() {
        try {
            const response = await fetch('data/config.json');
            if (!response.ok) throw new Error("Config okunamadı");
            const data = await response.json();
            return data.lessons;
        } catch (error) {
            console.error("Ders listesi yüklenemedi:", error);
            return [];
        }
    }

    // Belirli bir dersi yükler ve işler
    async loadLessonData(lessonCode, fileName) {
        // 1. JSON dosyasını çek
        let rawData = [];
        try {
            const response = await fetch(`data/${fileName}`);
            if (!response.ok) throw new Error("Ders dosyası bulunamadı: " + fileName);
            rawData = await response.json();
        } catch (error) {
            console.error(error);
            return [];
        }

        // 2. Veritabanındaki tüm ilerlemeyi çek (Bu ders için olanları filtreleyeceğiz)
        const allProgress = await this.db.getAllProgress();
        // Performans için ilerleme dizisini bir Map'e çevirelim: { "ID": {data} }
        const progressMap = new Map(allProgress.map(item => [item.id, item]));

        // 3. JSON verisini işle ve ID ata
        const processedCards = rawData.map((item, index) => {
            // Benzersiz ID Üretimi: DERS_UNITE_INDEX
            // Örn: BIL203U_U1_Q5
            const uniqueId = `${lessonCode}_U${item.unit}_Q${index}`;
            
            // DB'den bu sorunun durumunu bul
            const userState = progressMap.get(uniqueId);

            return {
                ...item,           // Orijinal soru verisi (question, options, answer...)
                id: uniqueId,      // Bizim ürettiğimiz ID
                
                // Kullanıcı Durumu (DB'de varsa onu kullan, yoksa varsayılan)
                level: userState ? userState.level : 0,
                nextReview: userState ? userState.nextReview : 0,
                isDue: userState ? (userState.nextReview <= Date.now()) : true // Süresi gelmiş mi?
            };
        });

        console.log(`${lessonCode} yüklendi. Toplam Soru: ${processedCards.length}`);
        return processedCards;
    }
}

```

### js\core\db.js

```javascript
export class ExamDatabase {
    constructor() {
        this.dbName = 'AofSinavDB_v2';
        this.dbVersion = 7;
        this.db = null;
    }

    async open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const tx = event.target.transaction;
                let progressStore;
                if (!db.objectStoreNames.contains('progress')) {
                    progressStore = db.createObjectStore('progress', { keyPath: 'id' });
                } else {
                    progressStore = tx.objectStore('progress');
                }
                if (progressStore.indexNames && !progressStore.indexNames.contains('by_lesson')) {
                    progressStore.createIndex('by_lesson', 'lesson', { unique: false });
                }
                if (progressStore.indexNames && !progressStore.indexNames.contains('by_lesson_unit')) {
                    progressStore.createIndex('by_lesson_unit', ['lesson', 'unit'], { unique: false });
                }

                let userStatsStore;
                if (!db.objectStoreNames.contains('user_stats')) {
                    userStatsStore = db.createObjectStore('user_stats', { keyPath: 'key' });
                }

                let profileStore;
                if (!db.objectStoreNames.contains('profile')) {
                    profileStore = db.createObjectStore('profile', { keyPath: 'key' });
                }

                let historyStore;
                if (!db.objectStoreNames.contains('exam_history')) {
                    historyStore = db.createObjectStore('exam_history', { keyPath: 'id', autoIncrement: true });
                } else {
                    historyStore = tx.objectStore('exam_history');
                }
                if (historyStore.indexNames && !historyStore.indexNames.contains('by_date')) {
                    historyStore.createIndex('by_date', 'date', { unique: false });
                }
                if (historyStore.indexNames && !historyStore.indexNames.contains('by_lesson')) {
                    historyStore.createIndex('by_lesson', 'lesson', { unique: false });
                }
                if (historyStore.indexNames && !historyStore.indexNames.contains('by_unit')) {
                    historyStore.createIndex('by_unit', 'unit', { unique: false });
                }
                if (!db.objectStoreNames.contains('sync_queue')) db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });

                if (!db.objectStoreNames.contains('sessions')) {
                    const sess = db.createObjectStore('sessions', { keyPath: 'uuid' });
                    sess.createIndex('by_lesson', 'lesson', { unique: false });
                    sess.createIndex('by_lesson_unit', ['lesson','unit'], { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;

                // --- OTO-KONTROL (SİGORTA) ---
                // Veritabanı açıldı ama tablolar eksik mi? Kontrol et.
                // Eğer 'exam_history' tablosu yoksa, veritabanı bozuktur.
                if (!this.db.objectStoreNames.contains('exam_history') || 
                    !this.db.objectStoreNames.contains('progress')) {
                    
                    console.warn("🚨 Kritik: Tablolar eksik! Veritabanı otomatik onarılıyor...");
                    this.db.close(); // Bağlantıyı kes
                    
                    // Veritabanını sil ve sayfayı yenile (Tertemiz kurulum yapsın)
                    const deleteReq = indexedDB.deleteDatabase(this.dbName);
                    deleteReq.onsuccess = () => {
                        window.location.reload();
                    };
                    return; // İşlemi durdur
                }

                console.log("✅ Veritabanı ve Tablolar Sağlam.");
                resolve(this);
            };

            // Versiyon çakışması olursa (Auto-Heal)
            request.onerror = (event) => {
                console.error("DB Hatası:", event.target.error);
                // Hata ne olursa olsun, veritabanını silip sıfırdan başlat
                // Bu sayede kullanıcı asla takılı kalmaz.
                const deleteReq = indexedDB.deleteDatabase(this.dbName);
                deleteReq.onsuccess = () => window.location.reload();
            };
        });
    }

    // --- DİĞER METOTLAR (AYNEN KALIYOR) ---

    async saveProgress(cardId, data) {
        return new Promise((resolve) => {
            if (!this.db) return resolve(false);
            const tx = this.db.transaction(['progress'], 'readwrite');
            const parts = (cardId || data.id || '').split('_');
            const lesson = parts[0] || '';
            let unit = 0;
            if (parts.length > 1) {
                const u = parts[1];
                const m = /U(\d+)/.exec(u);
                unit = m ? parseInt(m[1]) : 0;
            }
            tx.objectStore('progress').put({
                ...data,
                id: cardId || data.id,
                lesson,
                unit,
                updated_at: Date.now()
            });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    }

    async getAllProgress() {
        return new Promise((resolve) => {
            if (!this.db) return resolve([]);
            const tx = this.db.transaction(['progress'], 'readonly');
            const req = tx.objectStore('progress').getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    }

    async getProgressByLesson(lessonCode) {
        return new Promise((resolve) => {
            if (!this.db) return resolve([]);
            const tx = this.db.transaction(['progress'], 'readonly');
            const store = tx.objectStore('progress');
            const idx = store.index('by_lesson');
            const range = IDBKeyRange.only(lessonCode);
            const results = [];
            const req = idx.openCursor(range);
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) { results.push(cursor.value); cursor.continue(); } else { resolve(results); }
            };
            req.onerror = () => resolve([]);
        });
    }

    async getUserStats() {
        return new Promise((resolve) => {
            if (!this.db) return resolve({ xp: 0, streak: 0, totalQuestions: 0 });
            const tx = this.db.transaction(['user_stats'], 'readonly');
            const req = tx.objectStore('user_stats').get('main_stats');
            req.onsuccess = () => resolve(req.result || { xp: 0, streak: 0, totalQuestions: 0 });
            req.onerror = () => resolve({ xp: 0, streak: 0, totalQuestions: 0 });
        });
    }

    async updateUserStats(stats) {
        return new Promise((resolve) => {
            if (!this.db) return resolve(false);
            const tx = this.db.transaction(['user_stats'], 'readwrite');
            tx.objectStore('user_stats').put({ key: 'main_stats', ...stats, updated_at: Date.now() });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    }

    async getUserName() {
        return new Promise(resolve => {
            if (!this.db) return resolve(null);
            const tx = this.db.transaction(['profile'], 'readonly');
            const req = tx.objectStore('profile').get('username');
            req.onsuccess = () => resolve(req.result ? req.result.val : null);
            req.onerror = () => resolve(null);
        });
    }

    async setUserName(name) {
        if (!this.db) return;
        const tx = this.db.transaction(['profile'], 'readwrite');
        tx.objectStore('profile').put({ key: 'username', val: name });
        tx.onerror = () => {};
    }

    async getProfile(key) {
        return new Promise(resolve => {
            if (!this.db) return resolve(null);
            const tx = this.db.transaction(['profile'], 'readonly');
            const req = tx.objectStore('profile').get(key);
            req.onsuccess = () => resolve(req.result ? req.result.val : null);
            req.onerror = () => resolve(null);
        });
    }

    async setProfile(key, val) {
        if (!this.db) return false;
        return new Promise(resolve => {
            const tx = this.db.transaction(['profile'], 'readwrite');
            tx.objectStore('profile').put({ key, val });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    }

    async logActivity(lessonCode, unit, isCorrect, qid, givenOption) {
        return new Promise((resolve) => {
            if (!this.db) return resolve(false);
            const tx = this.db.transaction(['exam_history'], 'readwrite');
            const store = tx.objectStore('exam_history');
            const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){ const r = Math.random()*16|0, v = c=='x'?r:(r&0x3|0x8); return v.toString(16)});
            store.add({
                date: Date.now(),
                lesson: lessonCode,
                unit: parseInt(unit) || 0,
                isCorrect: isCorrect,
                qid: qid || '',
                given_option: givenOption || '',
                uuid
            });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    }

    async startSessionRecord(lesson, unit, mode, uuid){
        if (!this.db) return null;
        // Reuse active session if exists
        const active = await this.hasActiveSessionForUnit(lesson, unit);
        if (active) {
            const list = await this.getSessionsByUnit(lesson, unit);
            const current = list.find(r => !r.ended_at || r.ended_at === 0);
            return current ? current.uuid : uuid;
        }
        return new Promise((resolve) => {
            const tx = this.db.transaction(['sessions'], 'readwrite');
            tx.objectStore('sessions').put({ uuid, lesson, unit: parseInt(unit)||0, mode: mode||'study', started_at: Date.now(), ended_at: 0 });
            tx.oncomplete = () => resolve(uuid);
            tx.onerror = () => resolve(null);
        });
    }

    async endSessionRecord(uuid){
        return new Promise(async (resolve) => {
            if (!this.db) return resolve(false);
            const tx = this.db.transaction(['sessions'], 'readwrite');
            const store = tx.objectStore('sessions');
            const req = store.get(uuid);
            req.onsuccess = (e) => {
                const row = e.target.result;
                if (!row) { resolve(false); return; }
                row.ended_at = Date.now();
                store.put(row);
            };
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    }

    async getAllSessions(){
        return new Promise((resolve)=>{
            if (!this.db) return resolve([]);
            const tx = this.db.transaction(['sessions'],'readonly');
            const req = tx.objectStore('sessions').getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    }

    async upsertSession(row){
        return new Promise((resolve)=>{
            if (!this.db) return resolve(false);
            const tx = this.db.transaction(['sessions'],'readwrite');
            tx.objectStore('sessions').put({ uuid: row.uuid, lesson: row.lesson, unit: parseInt(row.unit)||0, mode: row.mode||'study', started_at: parseInt(row.started_at)||Date.now(), ended_at: parseInt(row.ended_at)||0 });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    }

    async importSessions(rows){
        if (!Array.isArray(rows) || rows.length===0) return true;
        for (const r of rows) { await this.upsertSession(r); }
        return true;
    }

    async countLessonRepeats(lesson){
        return new Promise((resolve)=>{
            if (!this.db) return resolve(0);
            const tx = this.db.transaction(['sessions'],'readonly');
            const idx = tx.objectStore('sessions').index('by_lesson');
            const range = IDBKeyRange.only(lesson);
            let cnt = 0;
            const req = idx.openCursor(range);
            req.onsuccess = (e)=>{ const c = e.target.result; if (c){ cnt++; c.continue(); } else resolve(cnt); };
            req.onerror = ()=>resolve(0);
        });
    }

    async countUnitRepeats(lesson, unit){
        return new Promise((resolve)=>{
            if (!this.db) return resolve(0);
            const tx = this.db.transaction(['sessions'],'readonly');
            const idx = tx.objectStore('sessions').index('by_lesson_unit');
            const range = IDBKeyRange.only([lesson, parseInt(unit)||0]);
            let completed = 0;
            const req = idx.openCursor(range);
            req.onsuccess = (e)=>{ const c = e.target.result; if (c){ const v = c.value; if (v && v.ended_at && v.ended_at > 0) completed++; c.continue(); } else { const repeats = Math.max(0, completed - 1); resolve(repeats); } };
            req.onerror = ()=>resolve(0);
        });
    }

    async getSessionsByUnit(lesson, unit){
        return new Promise((resolve)=>{
            if (!this.db) return resolve([]);
            const tx = this.db.transaction(['sessions'],'readonly');
            const idx = tx.objectStore('sessions').index('by_lesson_unit');
            const range = IDBKeyRange.only([lesson, parseInt(unit)||0]);
            const rows = [];
            const req = idx.openCursor(range);
            req.onsuccess = (e)=>{ const c = e.target.result; if (c){ rows.push(c.value); c.continue(); } else resolve(rows.sort((a,b)=> (b.started_at||0)-(a.started_at||0))); };
            req.onerror = ()=>resolve([]);
        });
    }

    async hasActiveSessionForUnit(lesson, unit){
        const list = await this.getSessionsByUnit(lesson, unit);
        return list.some(r => !r.ended_at || r.ended_at === 0);
    }

    async getHistoryRange(lesson, unit, startTs, endTs){
        return new Promise((resolve)=>{
            if (!this.db) return resolve([]);
            const tx = this.db.transaction(['exam_history'],'readonly');
            const store = tx.objectStore('exam_history');
            const rows = [];
            const req = store.getAll();
            req.onsuccess = () => {
                const all = req.result || [];
                const filtered = all.filter(v => v.lesson === lesson && (parseInt(v.unit)||0) === (parseInt(unit)||0) && (v.date||0) >= (startTs||0) && (!endTs || (v.date||0) <= endTs));
                resolve(filtered.sort((a,b)=> (a.date||0)-(b.date||0)));
            };
            req.onerror = ()=>resolve([]);
        });
    }

    async getLastCompletedEnd(lesson, unit){
        return new Promise((resolve)=>{
            if (!this.db) return resolve(0);
            const tx = this.db.transaction(['sessions'],'readonly');
            const idx = tx.objectStore('sessions').index('by_lesson_unit');
            const range = IDBKeyRange.only([lesson, parseInt(unit)||0]);
            let lastEnd = 0;
            const req = idx.openCursor(range);
            req.onsuccess = (e)=>{ const c = e.target.result; if (c){ const v = c.value; if (v && v.ended_at && v.ended_at>lastEnd) lastEnd = v.ended_at; c.continue(); } else resolve(lastEnd); };
            req.onerror = ()=>resolve(0);
        });
    }

    async getHistory() {
        return new Promise((resolve) => {
            if (!this.db) return resolve([]);
            const tx = this.db.transaction(['exam_history'], 'readonly');
            const req = tx.objectStore('exam_history').getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    }

    async getHistorySince(timestamp) {
        return new Promise((resolve) => {
            if (!this.db) return resolve([]);
            const tx = this.db.transaction(['exam_history'], 'readonly');
            const store = tx.objectStore('exam_history');
            const idx = store.index('by_date');
            const range = IDBKeyRange.lowerBound(timestamp);
            const results = [];
            const req = idx.openCursor(range);
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) { results.push(cursor.value); cursor.continue(); } else { resolve(results); }
            };
            req.onerror = () => resolve([]);
        });
    }

    async resetAllData() {
        return new Promise((resolve) => {
            if (!this.db) return resolve(false);
            const tx = this.db.transaction(['progress', 'user_stats', 'profile', 'exam_history'], 'readwrite');
            tx.objectStore('progress').clear();
            tx.objectStore('user_stats').clear();
            tx.objectStore('profile').clear();
            tx.objectStore('exam_history').clear();
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    }

    async resetProgressOnly(){
        return new Promise((resolve)=>{
            if (!this.db) return resolve(false);
            const stores = ['progress','user_stats','exam_history'];
            // sessions store eklenmişse onu da temizle
            const hasSessions = this.db.objectStoreNames && this.db.objectStoreNames.contains('sessions');
            const tx = this.db.transaction(hasSessions ? [...stores,'sessions'] : stores, 'readwrite');
            tx.objectStore('progress').clear();
            tx.objectStore('user_stats').clear();
            tx.objectStore('exam_history').clear();
            if (hasSessions) { tx.objectStore('sessions').clear(); }
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    }

    async enqueueSync(payload) {
        return new Promise((resolve) => {
            if (!this.db) return resolve(false);
            const tx = this.db.transaction(['sync_queue'], 'readwrite');
            tx.objectStore('sync_queue').add({ payload, ts: Date.now() });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    }

    async drainSyncQueue(handler) {
        if (!this.db) return false;
        const items = await new Promise((resolve) => {
            const tx = this.db.transaction(['sync_queue'], 'readonly');
            const store = tx.objectStore('sync_queue');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
        for (const it of items) { try { await handler(it.payload); } catch {} }
        await new Promise((resolve) => {
            const tx = this.db.transaction(['sync_queue'], 'readwrite');
            tx.objectStore('sync_queue').clear();
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
        return true;
    }
}

```

### js\core\examManager.js

```javascript
export class ExamManager {
    /**
     * Sınav sorularını oluşturur
     * @param {Array} allQuestions - Dersin tüm soruları
     * @param {string} type - 'midterm' (Ara) veya 'final'
     * @param {number} count - Soru sayısı (5, 10, 20)
     */
    createExam(allQuestions, type, count) {
        let selectedQuestions = [];

        // 1. Havuzları Oluştur
        // Ara Sınav Havuzu: Ünite 1, 2, 3, 4
        const poolMidterm = allQuestions.filter(q => q.unit <= 4);
        
        // Final İkinci Yarı Havuzu: Ünite 5, 6, 7, 8
        const poolFinalSecondHalf = allQuestions.filter(q => q.unit > 4);

        // Tüm Dönem Havuzu (Final için genel veya yedek)
        const poolAll = allQuestions;

        // 2. Seçim Mantığı
        if (type === 'midterm') {
            // ARA SINAV: Sadece ilk 4 üniteden rastgele seç
            selectedQuestions = this.shuffleAndPick(poolMidterm, count);
        } 
        else if (type === 'final') {
            // FINAL SINAVI
            
            if (count === 20) {
                // --- ÖZEL KURAL (20 Soru) ---
                // %30 (6 Soru) -> Ünite 1-4
                // %70 (14 Soru) -> Ünite 5-8
                
                const countFromFirstHalf = 6;   // 20 * 0.30
                const countFromSecondHalf = 14; // 20 * 0.70

                const part1 = this.shuffleAndPick(poolMidterm, countFromFirstHalf);
                const part2 = this.shuffleAndPick(poolFinalSecondHalf, countFromSecondHalf);

                // İki parçayı birleştir
                selectedQuestions = [...part1, ...part2];
            } 
            else {
                // --- DİĞER DURUMLAR (5 veya 10 Soru) ---
                // Standart Final: Tüm konulardan (1-8) rastgele seçilir.
                selectedQuestions = this.shuffleAndPick(poolAll, count);
            }
        }
        else {
            // Hata durumu veya genel çalışma modu: Hepsinden rastgele
            selectedQuestions = this.shuffleAndPick(poolAll, count);
        }

        // 3. Son Karıştırma
        // Soruların ünite sırasına göre (1-1-1... 8-8-8) gelmesini engellemek için son listeyi tekrar karıştırıyoruz.
        return this.shuffleAndPick(selectedQuestions, count);
    }

    // Yardımcı: Bir diziyi karıştır ve içinden N tane al
    shuffleAndPick(array, n) {
        // Dizi boşsa boş dön (Hata önleyici)
        if (!array || array.length === 0) return [];
        
        // Fisher-Yates Karıştırma Algoritması (Daha adil dağılım için)
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        return shuffled.slice(0, n);
    }
}
```

### js\core\gamification.js

```javascript
export class Gamification {
    constructor(db) {
        this.db = db;
    }

    getRank(xp) {
        if (xp < 200) return { title: "Stajyer", icon: "🌱", next: 200 };
        if (xp < 1000) return { title: "Junior Dev", icon: "💻", next: 1000 };
        if (xp < 3000) return { title: "Senior Dev", icon: "🚀", next: 3000 };
        if (xp < 6000) return { title: "Tech Lead", icon: "🔥", next: 6000 };
        return { title: "CTO", icon: "👑", next: 100000 };
    }

    async addXP(amount) {
        const stats = await this.db.getUserStats();
        stats.xp = (stats.xp || 0) + amount;
        
        // Günlük seri (Streak) kontrolü
        const today = new Date().toDateString();
        if (stats.lastStudyDate !== today) {
             const yesterday = new Date();
             yesterday.setDate(yesterday.getDate() - 1);
             if (stats.lastStudyDate === yesterday.toDateString()) {
                 stats.streak = (stats.streak || 0) + 1;
             } else {
                 stats.streak = 1;
             }
             stats.lastStudyDate = today;
        }

        await this.db.updateUserStats(stats);

        return {
            currentXP: stats.xp,
            rank: this.getRank(stats.xp)
        };
    }
}
```

### js\core\srs.js

```javascript
/**
 * SRS (Spaced Repetition System) Mantığı
 * Leitner Sisteminin basitleştirilmiş bir varyasyonu.
 */
export const SRS = {
    // Seviyeye göre bekleme süreleri (Gün cinsinden)
    // Seviye 0: Yeni / Bilinmiyor (Aynı gün)
    // Seviye 1: 1 gün sonra
    // Seviye 2: 3 gün sonra
    // Seviye 3: 1 hafta sonra
    // Seviye 4: 2 hafta sonra
    // Seviye 5: 1 ay sonra (Ezberlendi kabul edilir)
    INTERVALS: [0, 1, 3, 7, 14, 30],

    /**
     * Bir kartın cevabına göre yeni durumunu hesaplar.
     * @param {number} currentLevel - Mevcut seviye (0-5 arası)
     * @param {boolean} isCorrect - Doğru bilindi mi?
     * @returns {object} { level, nextReview } - Yeni seviye ve milisaniye cinsinden tarih
     */
    calculate(currentLevel, isCorrect) {
        let newLevel = currentLevel;

        if (isCorrect) {
            // Doğruysa seviye artır (Maksimum 5)
            if (newLevel < this.INTERVALS.length - 1) {
                newLevel++;
            }
        } else {
            // Yanlışsa cezalandır: Seviyeyi 1'e düşür (0 yapmıyoruz ki hemen "yeni" muamelesi görmesin, ama sık sorulsun)
            newLevel = 1; 
        }

        // Bir sonraki tekrar zamanını hesapla
        const daysToAdd = this.INTERVALS[newLevel];
        const now = new Date();
        
        // Şu anki zamana 'daysToAdd' gün ekle
        // Eğer seviye 0 ise (veya yanlışsa) süre ekleme, hemen tekrar sorulabilir olsun.
        let nextReviewTime = now.getTime(); 
        
        if (daysToAdd > 0) {
            // Gelecek bir tarihe ayarla
            const futureDate = new Date();
            futureDate.setDate(now.getDate() + daysToAdd);
            futureDate.setHours(4, 0, 0, 0); // Sabah 04:00'e ayarla (Gece çalışanlar için gün karışmasın)
            nextReviewTime = futureDate.getTime();
        }

        return {
            level: newLevel,
            nextReview: nextReviewTime
        };
    }
};
```

### js\core\sync.js

```javascript
export class SyncManager {
    constructor(db){ this.db = db; this.base = './api'; }
    getToken(){ return localStorage.getItem('auth_token') || ''; }
    setToken(t){ localStorage.setItem('auth_token', t); }
    async me(){ const token = this.getToken(); if(!token) return null; const r = await fetch(`${this.base}/auth.php?action=me&token=${encodeURIComponent(token)}`,{ headers:{ 'Authorization': `Bearer ${token}` } }); if(!r.ok) return null; const j = await r.json(); return j && j.data ? j.data : null }
    async updateProfileName(name){ const token = this.getToken(); if(!token) return false; const r = await fetch(`${this.base}/auth.php?action=profile&token=${encodeURIComponent(token)}`,{ method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ name }) }); if(!r.ok) return false; const j = await r.json(); return !!(j && j.ok !== false); }
    async updateCredentials(newEmail,newPassword,newName){ const token = this.getToken(); if(!token) return { ok:false, code:401 }; const r = await fetch(`${this.base}/auth.php?action=update&token=${encodeURIComponent(token)}`,{ method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ new_email:newEmail||'', new_password:newPassword||'', new_name:newName||'' }) }); if(!r.ok){ return { ok:false, code:r.status }; } const j = await r.json(); return { ok:true, data:j.data } }
    async emailExists(email){ const r = await fetch(`${this.base}/auth.php?action=exists`,{ method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ email }) }); if(!r.ok) return false; const j = await r.json(); return !!(j && j.data && j.data.exists); }
    async register(email,password){ const r = await fetch(`${this.base}/auth.php?action=register`,{ method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ email, password }) }); if (r.status === 409) return { ok:false, exists:true }; return { ok:r.ok } }
    async login(email,password){ const r = await fetch(`${this.base}/auth.php?action=login`,{ method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ email, password }) }); if(!r.ok) return false; const j = await r.json(); if(j && j.data && j.data.token){ this.setToken(j.data.token); return true; } return false; }
    async pushAll(){ const token = this.getToken(); if(!token) return false; const progress = await this.db.getAllProgress(); const stats = await this.db.getUserStats(); const history = await this.db.getHistory(); const sessions = await (this.db.getAllSessions ? this.db.getAllSessions() : Promise.resolve([])); const payload = { progress: progress.map(p=>({ ...p, updated_at: p.updated_at||Date.now() })), stats: { ...stats, updated_at: stats.updated_at||Date.now() }, history, sessions }; const r = await fetch(`${this.base}/sync.php?action=push&token=${encodeURIComponent(token)}`,{ method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) }); if(r.ok){ const ts = Date.now(); await this.db.setProfile('last_sync', ts); const email = await this.db.getProfile('account_email'); const accounts = (await this.db.getProfile('accounts')) || []; const i = Array.isArray(accounts) ? accounts.findIndex(a => a && a.email === email) : -1; if (i >= 0) { accounts[i].lastSync = ts; await this.db.setProfile('accounts', accounts); } } return r.ok; }
    async pullAll(){ const token = this.getToken(); if(!token) return false; const r = await fetch(`${this.base}/sync.php?action=pull&token=${encodeURIComponent(token)}`,{ headers:{ 'Authorization': `Bearer ${token}` } }); if(!r.ok) return false; const j = await r.json(); const p = (j.data && j.data.progress) || []; const s = (j.data && j.data.stats) || { xp:0, streak:0, totalQuestions:0, updated_at:0 }; const h = (j.data && j.data.history) || []; const ss = (j.data && j.data.sessions) || []; for(const item of p){ await this.db.saveProgress(item.id,{ id:item.id, level:item.level, nextReview:item.nextReview, correct:item.correct, wrong:item.wrong, updated_at:item.updated_at||Date.now() }); } await this.db.updateUserStats(s); for(const hi of h){ await this.db.logActivity(hi.lesson, hi.unit, !!hi.isCorrect, hi.qid, hi.given_option); } let sessionsImported = false; if (ss && ss.length>0 && this.db.importSessions) { await this.db.importSessions(ss); sessionsImported = true; } const ts = Date.now(); await this.db.setProfile('last_sync', ts); const email = await this.db.getProfile('account_email'); const accounts = (await this.db.getProfile('accounts')) || []; const i = Array.isArray(accounts) ? accounts.findIndex(a => a && a.email === email) : -1; if (i >= 0) { accounts[i].lastSync = ts; await this.db.setProfile('accounts', accounts); } if (sessionsImported) { try { document.dispatchEvent(new CustomEvent('app:data-updated')); } catch(e){} } return true; }
    async wipeRemote(){ const token = this.getToken(); if(!token) return false; const r = await fetch(`${this.base}/sync.php?action=wipe&token=${encodeURIComponent(token)}`,{ method:'POST', headers:{ 'Authorization': `Bearer ${token}` } }); return r.ok; }
    async deleteAccount(){ const token = this.getToken(); if(!token) return false; const r = await fetch(`${this.base}/auth.php?action=delete&token=${encodeURIComponent(token)}`,{ method:'POST', headers:{ 'Authorization': `Bearer ${token}` } }); if (r.ok){ localStorage.removeItem('auth_token'); } return r.ok; }

    async autoSync(){
        const token = this.getToken(); if(!token) return false;
        const lastTs = await this.db.getProfile('last_sync') || 0;
        const r = await fetch(`${this.base}/sync.php?action=pull&token=${encodeURIComponent(token)}`,{ headers:{ 'Authorization': `Bearer ${token}` } });
        if(!r.ok) return false;
        const j = await r.json();
        const remoteP = (j.data && j.data.progress) || [];
        const remoteS = (j.data && j.data.stats) || { xp:0, streak:0, totalQuestions:0, updated_at:0 };
        const remoteH = (j.data && j.data.history) || [];
        const localP = await this.db.getAllProgress();
        const localS = await this.db.getUserStats();
        const merged = []; const pushQueue = []; let remoteApplied = false; let historyAdded = false; let statsChanged = false;
        const mapLocal = new Map(localP.map(x=>[x.id,x]));
        const mapRemote = new Map(remoteP.map(x=>[x.id,x]));
        const ids = new Set([...mapLocal.keys(), ...mapRemote.keys()]);
        for(const id of ids){ const l = mapLocal.get(id)||{}; const r = mapRemote.get(id)||{}; const lu = parseInt(l.updated_at||0); const ru = parseInt(r.updated_at||0); if (ru > lu) { merged.push({ id: r.id, level: r.level||0, nextReview: r.nextReview||0, correct: r.correct||0, wrong: r.wrong||0, updated_at: ru }); remoteApplied = true; } else if (lu > ru) { merged.push({ id: l.id, level: l.level||0, nextReview: l.nextReview||0, correct: l.correct||0, wrong: l.wrong||0, updated_at: lu }); pushQueue.push({ id: l.id, level: l.level||0, nextReview: l.nextReview||0, correct: l.correct||0, wrong: l.wrong||0, updated_at: lu, lesson: l.lesson||'', unit: l.unit||0 }); } }
        for(const item of merged){ await this.db.saveProgress(item.id, item); }
        const lsU = parseInt(localS.updated_at||0); const rsU = parseInt(remoteS.updated_at||0);
        const finalStats = rsU > lsU ? remoteS : localS; statsChanged = rsU > lsU;
        await this.db.updateUserStats(finalStats);
        for(const hi of remoteH){ if (!lastTs || (hi.date||0) > lastTs) { await this.db.logActivity(hi.lesson, hi.unit, !!hi.isCorrect, hi.qid, hi.given_option); historyAdded = true; } }
        const sessions = await (this.db.getAllSessions ? this.db.getAllSessions() : Promise.resolve([]));
        const pushRes = pushQueue.length>0 || (sessions && sessions.length>0) ? await fetch(`${this.base}/sync.php?action=push&token=${encodeURIComponent(token)}`,{ method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ progress: pushQueue, stats: finalStats, history: [], sessions }) }) : { ok:true };
        const ts = Date.now(); await this.db.setProfile('last_sync', ts);
        const email = await this.db.getProfile('account_email'); const accounts = (await this.db.getProfile('accounts')) || [];
        const i = Array.isArray(accounts) ? accounts.findIndex(a => a && a.email === email) : -1; if (i >= 0) { accounts[i].lastSync = ts; await this.db.setProfile('accounts', accounts); }
        if (remoteApplied || pushQueue.length>0 || statsChanged || historyAdded) {
            try { document.dispatchEvent(new CustomEvent('app:data-updated')); } catch(e){}
        }
        return pushRes.ok;
    }
}

```

### js\core\updateManager.js

```javascript
export class UpdateManager {
    constructor() {
        this.localVersionKey = 'app_version';
        this.versionUrl = 'version.json';
    }

    async checkUpdates(silent = true) {
        try {
            const response = await fetch(`${this.versionUrl}?t=${Date.now()}`);
            if (!response.ok) return;
            const remote = await response.json();
            const serverVersion = remote.version;
            const localVersion = localStorage.getItem(this.localVersionKey);
            const swVer = await this.getServiceWorkerVersion().catch(()=>null);
            if (!localVersion) { localStorage.setItem(this.localVersionKey, serverVersion); return; }
            const cmp = this.compareVersions(serverVersion, localVersion);
            if (cmp > 0 || (swVer && this.compareVersions(serverVersion, swVer) !== 0)) {
                this.showUpdateNotification(serverVersion);
            } else {
                if (!silent) alert(`Sürümünüz güncel: ${localVersion}`);
            }
        } catch (error) {
            console.log('İnternet yok veya versiyon kontrolü yapılamadı.', error);
        }
    }

    async performCleanup() {
        // Service Worker'ı durdur ve sil
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
            }
        }

        // Cache (Önbellek) dosyalarını tamamen sil
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
        }
        
        console.log('🧹 Temizlik tamamlandı.');
    }

    compareVersions(v1, v2) {
        if (!v1 || !v2) return 0;
        const p1 = String(v1).replace(/^v/, '').split('.').map(Number);
        const p2 = String(v2).replace(/^v/, '').split('.').map(Number);
        for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
            const n1 = p1[i] || 0; const n2 = p2[i] || 0;
            if (n1 > n2) return 1; if (n2 > n1) return -1;
        }
        return 0;
    }

    showUpdateNotification(newVersion) {
        if (document.getElementById('update-toast')) return;
        const toast = document.createElement('div');
        toast.id = 'update-toast';
        toast.className = 'update-toast';
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fa-solid fa-cloud-arrow-down"></i>
                <span>Yeni sürüm mevcut (${newVersion})</span>
            </div>
            <button id="btn-reload-update" class="btn-update-action">YÜKLE</button>
        `;
        document.body.appendChild(toast);
        const btn = document.getElementById('btn-reload-update');
        if (btn) {
            btn.onclick = async () => {
                localStorage.setItem(this.localVersionKey, newVersion);
                await this.performCleanup();
                window.location.reload();
            };
        }
    }

    async getServiceWorkerVersion(){
        try {
            const r = await fetch(`service-worker.js?t=${Date.now()}`, { cache:'no-store' });
            if (!r.ok) return null;
            const txt = await r.text();
            const m = txt.match(/static-v(\d+\.\d+\.\d+)/);
            if (m && m[1]) return m[1];
            const m2 = txt.match(/data-v(\d+\.\d+\.\d+)/);
            return m2 && m2[1] ? m2[1] : null;
        } catch(e){ return null; }
    }
}

```

### js\ui\dashboard.js

```javascript
import { Gamification } from '../core/gamification.js';
import { ExamManager } from '../core/examManager.js';
import { UpdateManager } from '../core/updateManager.js';
import { AuthManager } from '../core/authManager.js';
import { SyncManager } from '../core/sync.js';

export class Dashboard {
    constructor(dataLoader, db) {
        this.loader = dataLoader;
        this.db = db;
        this.container = document.getElementById('app-container');
    }

    escapeHTML(str){ return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }

    async ensureActiveAccountToken(){
        const hasToken = !!localStorage.getItem('auth_token');
        if (hasToken) return;
        const list = (await this.db.getProfile('accounts')) || [];
        const items = Array.isArray(list) ? list : [];
        const activeEmail = await this.db.getProfile('account_email');
        let acc = items.find(a => a && a.email === activeEmail && a.token);
        if (!acc) acc = items.find(a => a && a.token);
        if (acc && acc.token) {
            localStorage.setItem('auth_token', acc.token);
            if (acc.email && !activeEmail) { await this.db.setProfile('account_email', acc.email); }
        }
    }

    async refreshAndRender(){
        const wrap = document.getElementById('dashboard-container');
        if (!wrap || !wrap.children || wrap.children.length === 0) {
            if (this.loader && typeof this.loader.resetCache === 'function') { this.loader.resetCache(); }
            await this.render();
            return;
        }
        await this.updateUIValues();
    }

    async updateUIValues(){
        const lessons = await this.loader.getLessonList();
        const stats = await this.db.getUserStats();
        const rank = new Gamification(this.db).getRank(stats.xp);
        const lessonStats = await this.calculateLessonStats(lessons);
        lessons.forEach(lesson => {
            const st = lessonStats[lesson.code] || { total:0, learned:0 };
            const percent = st.total>0 ? Math.round((st.learned/st.total)*100) : 0;
            const bar = document.getElementById(`prog-bar-${lesson.code}`);
            const txt = document.getElementById(`prog-text-${lesson.code}`);
            if (bar) bar.style.width = `${percent}%`;
            if (txt) txt.textContent = `%${percent}`;
        });
        const xpEl = document.getElementById('dash-xp-value');
        const xpFill = document.querySelector('.xp-fill');
        if (xpEl) xpEl.textContent = String(stats.xp||0);
        if (xpFill) xpFill.style.width = `${Math.min(100, (stats.xp / (rank.next||1)) * 100)}%`;
        await this.refreshAccountStatus();
    }

    // Ana Ekranı Çiz
    async render() {
        this.container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Veriler Yükleniyor...</p></div>';

        await this.ensureActiveAccountToken();
        const authGate = new AuthManager(this.db);
        const inSession = !!window.__inSession;
        if (!authGate.hasToken() && !localStorage.getItem('guest_mode') && !inSession) {
            this.showWelcomeOverlay();
            return;
        }

        const userName = await this.db.getUserName();
        // Artık kullanıcı adı zorunlu değil; onboarding ile yönlendirilecek

        const lessons = await this.loader.getLessonList();
        
        const game = new Gamification(this.db);
        const stats = await this.db.getUserStats();
        const rank = game.getRank(stats.xp);

        const history = await this.db.getHistory();
        const activityStats = await this.calculateActivityStats(history);
        const lessonStats = await this.calculateLessonStats(lessons);

        const versionInfo = await fetch('version.json?t=' + Date.now()).then(r => r.json()).catch(() => ({ version: 'unknown' }));

        const hasToken = !!localStorage.getItem('auth_token');
        const accEmail = await this.db.getProfile('account_email');
        const lastSync = await this.db.getProfile('last_sync');
        const statusText = hasToken ? `Üye${accEmail?` • ${accEmail}`:''}${lastSync?` • Son Senkron: ${new Date(lastSync).toLocaleString()}`:''}` : 'Misafir (Veriler sadece bu cihazda)';
        let html = `<div id="dashboard-container">
            <div class="dashboard-header" style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
                <div>
                    <h2>Derslerim</h2>
                    <p class="subtitle">Çalışmak veya Test olmak için bir ders seçin.</p>
                </div>
                <div class="account-pill" title="Hesap durumu" style="white-space:nowrap; background:#eef2ff; color:#3730a3; padding:8px 12px; border-radius:999px; font-size:0.85rem; border:1px solid #e2e8f0;">${statusText}</div>
            </div>
            
            <div class="lesson-grid" style="margin-bottom: 30px;">
        `;

        lessons.forEach(lesson => {
            const stat = lessonStats[lesson.code] || { total: 0, learned: 0, repeats: 0 };
            const percent = stat.total > 0 ? Math.round((stat.learned / stat.total) * 100) : 0;

            html += `
                <div class="lesson-card" onclick="window.openLessonDetail('${lesson.code}', '${lesson.file}')">
                    <div class="card-header">
                        <span class="course-code">${lesson.code}</span>
                    </div>
                    <h3>${lesson.name}</h3>
                    <div class="progress-container">
                        <div class="progress-info"><span>İlerleme</span><span id="prog-text-${lesson.code}">%${percent}</span></div>
                        <div class="progress-bar"><div class="fill" id="prog-bar-${lesson.code}" style="width: ${percent}%"></div></div>
                    </div>
                </div>
            `;
        });

        html += `</div>`; // Grid kapanış

        // 2. BÖLÜM: PROFİL VE ANALİZ (ACCORDION)
        html += `
            <div class="analysis-accordion" style="margin-bottom: 40px;">
                <button class="accordion-btn" onclick="window.toggleAnalysis()">
                    <span><i class="fa-solid fa-chart-pie"></i> Profil ve Analiz Raporu</span>
                    <i class="fa-solid fa-chevron-down" id="accordion-icon"></i>
                </button>
                
                <div id="analysis-content" class="accordion-content" style="display:none; margin-top: 15px;">
                    <div class="user-profile-card">
                        <div class="profile-icon">${rank.icon}</div>
                        <div class="profile-info">
                            <div class="rank-title">${rank.title}</div>
                            <div class="user-name-display">${userName}</div>
                            <div class="xp-bar-container">
                                <div class="xp-info"><span id="dash-xp-value">${stats.xp}</span> XP<small>Sonraki: ${rank.next} XP</small></div>
                                <div class="xp-bar"><div class="xp-fill" style="width: ${(stats.xp / rank.next) * 100}%"></div></div>
                            </div>
                        </div>
                        <div class="streak-badge">🔥 ${stats.streak || 0} Gün</div>
                    </div>

                    <div class="activity-panel">
                        <div class="stats-grid">
                            <div class="stat-mini-card"><div class="stat-icon bg-blue"><i class="fa-solid fa-calendar-day"></i></div><div class="stat-data"><span class="stat-num">${activityStats.today}</span><span class="stat-desc">Bugün</span></div></div>
                            <div class="stat-mini-card"><div class="stat-icon bg-green"><i class="fa-solid fa-calendar-week"></i></div><div class="stat-data"><span class="stat-num">${activityStats.week}</span><span class="stat-desc">Bu Hafta</span></div></div>
                            <div class="stat-mini-card"><div class="stat-icon bg-orange"><i class="fa-solid fa-layer-group"></i></div><div class="stat-data"><span class="stat-num">${activityStats.total}</span><span class="stat-desc">Toplam</span></div></div>
                        </div>
                        
                        <div class="unit-breakdown" style="margin-top:20px; background:white; padding:15px; border-radius:12px; border:1px solid #e2e8f0;">
                            <h4 style="margin:0 0 15px 0; color:#1e293b; font-size:0.95rem;">Ders Bazlı İlerleme Detayı</h4>
                            <div style="display:flex; flex-direction:column; gap:12px;">
                                ${lessons.map(lesson => {
                                    const stat = lessonStats[lesson.code];
                                    const percent = stat.percent;
                                    const weakUnit = stat.weakestUnit ? `⚠️ Ünite ${stat.weakestUnit} zayıf` : '✅ Başlangıç seviyesi';
                                    const progressColor = percent > 50 ? '#10b981' : (percent > 20 ? '#3b82f6' : '#cbd5e1');
                                    return `
                                    <div style="display:flex; align-items:center; gap:10px;">
                                        <div style="flex:1;">
                                            <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:3px;">
                                                <span style="font-weight:600; color:#334155;">${lesson.code}</span>
                                                <span style="font-size:0.75rem; color:#64748b;">${weakUnit}</span>
                                            </div>
                                            <div style="height:6px; background:#f1f5f9; border-radius:3px; overflow:hidden;">
                                                <div style="height:100%; width:${percent}%; background:${progressColor};"></div>
                                            </div>
                                        </div>
                                        <span style="font-size:0.85rem; font-weight:bold; color:#334155; width:35px; text-align:right;">%${percent}</span>
                                    </div>`;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        html += `<div class="app-footer">Sürüm: v${versionInfo.version}</div>`;
        html += `</div>`;
        this.container.innerHTML = html;
        await this.refreshAccountStatus();
        window.loadTooltips = async () => {
            const tips = await fetch('api/tooltips.php?t=' + Date.now()).then(r => r.json()).catch(() => ({}));
            const nodes = document.querySelectorAll('[data-tip]');
            nodes.forEach(el => { const key = el.getAttribute('data-tip'); if (key && tips[key]) el.title = tips[key]; });
        };
        window.loadTooltips();
        
        // Global Eventler
        window.openLessonDetail = (code, file) => this.showLessonDetailModal(code, file);
        
        window.toggleAnalysis = () => {
            const content = document.getElementById('analysis-content');
            const icon = document.getElementById('accordion-icon');
            if (content.style.display === 'none') {
                content.style.display = 'block';
                icon.classList.replace('fa-chevron-down', 'fa-chevron-up');
            } else {
                content.style.display = 'none';
                icon.classList.replace('fa-chevron-up', 'fa-chevron-down');
            }
        };
        const auth = new AuthManager(this.db);
        const inSession2 = !!window.__inSession;
        if (!auth.hasToken() && !localStorage.getItem('guest_mode') && !inSession2) {
            this.showWelcomeOverlay();
        }
    }

    // --- DETAYLI DERS KARNESİ (MODAL) ---
    async showLessonDetailModal(code, file) {
        this.currentLessonFile = file;
        const modalHtml = `
            <div class="modal-overlay" id="detail-modal">
                <div class="modal-box large">
                    <div class="modal-header">
                        <h2 class="modal-title" id="modal-lesson-title">${code} Analizi</h2>
                        <button class="icon-btn" onclick="document.getElementById('detail-modal').remove()"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div id="modal-content" style="max-height: 60vh; overflow-y: auto;">
                        <div class="spinner" style="margin: 20px auto;"></div>
                    </div>
                    <div class="modal-footer-actions">
                        <button class="primary-btn full-width" onclick="window.openExamConfig('${code}')">Genel Sınav / Tekrar Oluştur</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const allCards = await this.loader.loadLessonData(code, file);
        
        const units = {};
        for(let i=1; i<=8; i++) units[i] = { total: 0, learned: 0 };

        allCards.forEach(card => {
            const u = card.unit || 0;
            if(!units[u]) units[u] = { total: 0, learned: 0 };
            units[u].total++;
            if(card.level > 0) units[u].learned++;
        });

        let listHtml = `<div class="unit-list">`;
        
        for(let i=1; i<=8; i++) {
            const u = units[i];
            if(u.total === 0) continue;

            const percent = Math.round((u.learned / u.total) * 100);
            const rCount = (this.db.countUnitRepeats ? await this.db.countUnitRepeats(code, i) : 0);
            const activeRep = (this.db.hasActiveSessionForUnit ? await this.db.hasActiveSessionForUnit(code, i) : false);
            let repLabel = '';
            if (activeRep) {
                // yalnızca bir tamamlanma sonrası başlayan aktif oturumda göster
                const sessions = (this.db.getSessionsByUnit ? await this.db.getSessionsByUnit(code, i) : []);
                const active = sessions.find(s => !s.ended_at || s.ended_at === 0);
                const lastEnd = (this.db.getLastCompletedEnd ? await this.db.getLastCompletedEnd(code, i) : 0);
                if (active && active.started_at && active.started_at > lastEnd) {
                    repLabel = `${(rCount||0)+1}. tekrar • devam ediyor`;
                }
            }
            
            let statusBadge = '';
            let statusClass = '';
            
            if (percent === 0) {
                statusBadge = '<i class="fa-regular fa-circle"></i> Hiç Bakılmadı';
                statusClass = 'status-gray';
            } else if (percent === 100) {
                statusBadge = '<i class="fa-solid fa-circle-check"></i> Tamamlandı';
                statusClass = 'status-green';
            } else {
                statusBadge = '<i class="fa-solid fa-spinner"></i> Çalışılıyor';
                statusClass = 'status-blue';
            }

            listHtml += `
                <div class="unit-item">
                    <div class="unit-info">
                        <div style="display:flex; justify-content:space-between;">
                            <span class="unit-name">Ünite ${i}</span>
                            <span class="unit-status-badge ${statusClass}">${statusBadge}</span>
                        </div>
                        <div class="unit-progress-bg" style="width:100%; margin-top:5px;">
                            <div class="unit-progress-fill" style="width: ${percent}%; background-color: ${percent===0 ? '#e2e8f0' : 'var(--primary)'}"></div>
                        </div>
                        <small style="color:#64748b; font-size:0.75rem; margin-top:2px;">${u.learned} / ${u.total} Soru Öğrenildi</small>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button class="ghost-btn" onclick="window.startUnitStudy('${code}', ${i})" aria-label="Ünite ${i} çalış">
                            <i class="fa-solid fa-play"></i> Çalış
                        </button>
                        ${repLabel ? `<span style="font-size:0.85rem; color:#334155;">${repLabel}</span>` : ''}
                        <button class="sm-btn" onclick="window.openUnitHistory('${code}', ${i})">Geçmiş</button>
                    </div>
                </div>
            `;
        }
        listHtml += `</div>`;

        document.getElementById('modal-content').innerHTML = listHtml;

        // Global Modal Fonksiyonları
        window.startUnitStudy = (lessonCode, unitNo) => {
            document.getElementById('detail-modal').remove();
            window.startSession(lessonCode, { mode: 'study', specificUnit: unitNo });
        };

        window.openExamConfig = (lessonCode) => {
            document.getElementById('detail-modal').remove();
            this.showExamConfigModal(lessonCode); 
        };
        window.openUnitHistory = async (lessonCode, unitNo) => {
            // Cycle grouping based on touching all questions once in a period
            const data = await this.loader.loadLessonData(lessonCode, this.currentLessonFile);
            const cards = data.filter(c => parseInt(c.unit)||0 === parseInt(unitNo)||0);
            const qids = cards.map(c=>c.id);
            const events = await this.db.getHistoryRange(lessonCode, unitNo, 0, Date.now());
            let filtered = events.filter(e => qids.includes(e.qid||''))
                                   .sort((a,b)=> (a.date||0)-(b.date||0));
            if (filtered.length === 0) { filtered = events.slice().sort((a,b)=> (a.date||0)-(b.date||0)); }
            const cycles = [];
            if (filtered.length > 0){
                let start = filtered[0].date || 0;
                let seen = new Set();
                let lastTouch = start;
                for (const ev of filtered) {
                    if (ev.date < start) continue;
                    const q = ev.qid||'';
                    if (!seen.has(q)) {
                        seen.add(q);
                        lastTouch = ev.date || lastTouch;
                        if (seen.size === qids.length) {
                            cycles.push({ start, end: lastTouch });
                            start = lastTouch + 1;
                            seen.clear();
                        }
                    }
                }
                if (seen.size > 0) cycles.push({ start, end: Date.now() });
            }
            const rows = [];
            for (let idx=0; idx<cycles.length; idx++){
                const cinfo = cycles[idx];
                const list = (this.db.getHistoryRange ? await this.db.getHistoryRange(lessonCode, unitNo, cinfo.start, cinfo.end) : []);
                let c=0,w=0; list.forEach(x=>{ if (x.isCorrect) c++; else w++; });
                rows.push({ started_at: cinfo.start, ended_at: cinfo.end, mode: 'study', correct:c, wrong:w, cycle: idx });
            }
            const id = 'unit-history-modal';
            const html = `
            <div class="modal-overlay" id="${id}">
                <div class="modal-box large">
                    <div class="modal-header"><h2 class="modal-title">Ünite ${unitNo} Geçmişi</h2><button class="icon-btn" onclick="document.getElementById('${id}').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                    <div style="max-height:60vh; overflow:auto;">
                        ${rows.length===0 ? '<div style="color:#64748b; padding:12px;">Kayıt yok</div>' : rows.map((r,idx)=>`
                            <div class="lesson-card" style="display:flex; align-items:center; justify-content:space-between;">
                                <div>
                                    <div style="font-weight:600; color:#334155;">${idx+1}. ${new Date(r.started_at||Date.now()).toLocaleString()}${r.ended_at?` - ${new Date(r.ended_at).toLocaleString()}`:''}</div>
                                    <small style="color:#64748b;">${r.cycle===0?'İlk çalışma':`${r.cycle}. tekrar`} • Doğru: ${r.correct} • Yanlış: ${r.wrong}</small>
                                </div>
                                <button class="sm-btn" onclick="window.viewSessionMistakes('${lessonCode}', ${unitNo}, ${r.started_at||0}, ${r.ended_at||0})">Yanlışları Gör</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
        };
        window.viewSessionMistakes = async (lessonCode, unitNo, startTs, endTs) => {
            const list = (this.db.getHistoryRange ? await this.db.getHistoryRange(lessonCode, unitNo, startTs, endTs) : []);
            const fileName = this.currentLessonFile;
            const data = (this.loader && this.loader.loadLessonData) ? await this.loader.loadLessonData(lessonCode, fileName) : [];
            const cards = data.filter(c => parseInt(c.unit)||0 === parseInt(unitNo)||0);
            const map = new Map(cards.map(c => [c.id, c]));
            const wrongs = list.filter(x=>!x.isCorrect).map(w => ({ date: w.date, qid: w.qid||'', given: w.given_option||'', card: map.get(w.qid||'') }));
            const id = 'session-mistakes-modal';
            const html = `
            <div class="modal-overlay" id="${id}">
                <div class="modal-box">
                    <div class="modal-header"><h2 class="modal-title">Yanlışlar</h2><button class="icon-btn" onclick="document.getElementById('${id}').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                    <div style="max-height:50vh; overflow:auto;">
                        ${wrongs.length===0?'<div style="color:#64748b; padding:12px;">Yanlış yok</div>':wrongs.map((w,idx)=>{
                            const q = w.card;
                            const expl = q && q.code_example ? `<div style=\"margin-top:6px; font-size:0.85rem; background:#f1f5f9; padding:6px; border-radius:4px; color:#475569;\"><strong>📝 Açıklama:</strong> ${this.escapeHTML(q.code_example)}</div>` : '';
                            const opts = Array.isArray(q && q.options) ? q.options.map(o => {
                                const isGiven = w.given && String(w.given) === String(o);
                                const isCorrect = q && String(q.correct_option) === String(o);
                                const color = isCorrect ? '#10b981' : (isGiven ? '#ef4444' : '#334155');
                                const icon = isCorrect ? 'fa-check' : (isGiven ? 'fa-xmark' : 'fa-circle');
                                return `<div style=\"font-size:0.9rem; color:${color}; display:flex; align-items:center; gap:6px;\"><i class=\"fa-solid ${icon}\"></i> ${this.escapeHTML(o)}</div>`;
                            }).join('') : '';
                            return `<div class=\"lesson-card\" style=\"padding:12px; border-left:4px solid #ef4444;\">
                                <div style=\"font-weight:600; color:#334155; margin-bottom:6px;\">${idx+1}. ${q ? this.escapeHTML(q.question) : 'Soru bulunamadı'}</div>
                                <div style=\"display:flex; flex-direction:column; gap:4px;\">${opts}</div>
                                <div style=\"font-size:0.9rem; color:#ef4444;\"><strong>Senin Cevabın:</strong> ${w.given ? this.escapeHTML(w.given) : '-'}</div>
                                <div style=\"font-size:0.9rem; color:#10b981;\"><strong>Doğru Cevap:</strong> ${q ? this.escapeHTML(q.correct_option) : '-'}</div>
                                ${expl}
                                <small style=\"color:#64748b;\">Tarih: ${new Date(w.date).toLocaleString()}</small>
                            </div>`;
                        }).join('')}
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
        };
    }

    // --- HESAPLAMALAR ---
    async calculateLessonStats(lessons) {
        const stats = {};
        for (const lesson of lessons) {
            const lessonProgress = await this.db.getProgressByLesson(lesson.code);
            const estimatedTotal = 150;
            const learnedCount = lessonProgress.filter(p => p.level > 0).length;
            const repeatCount = (this.db.countLessonRepeats ? await this.db.countLessonRepeats(lesson.code) : 0);
            const unitCounts = {};
            lessonProgress.forEach(p => {
                const u = `U${p.unit || 0}`;
                if (!unitCounts[u]) unitCounts[u] = { total: 0, learned: 0 };
                unitCounts[u].total++;
                if (p.level > 0) unitCounts[u].learned++;
            });
            let weakest = null;
            Object.keys(unitCounts).forEach(u => {
                const info = unitCounts[u];
                if (info.total > 0 && (info.learned / info.total) < 0.5) weakest = u.replace('U', '');
            });
            stats[lesson.code] = {
                total: estimatedTotal,
                learned: learnedCount,
                repeats: repeatCount,
                percent: Math.min(100, Math.round((learnedCount / estimatedTotal) * 100)),
                weakestUnit: weakest
            };
        }
        return stats;
    }

    async calculateActivityStats(history) {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfWeek = startOfDay - (7 * 24 * 60 * 60 * 1000);
        const todayList = await this.db.getHistorySince(startOfDay);
        const weekList = await this.db.getHistorySince(startOfWeek);
        return { today: todayList.length, week: weekList.length, total: history.length, topUnits: [] };
    }

    // --- DİĞER MODALLAR ---
    showNameModal() {
        const html = `<div class="modal-overlay"><div class="modal-box"><h2 class="modal-title">👋 Merhaba!</h2><input type="text" id="inp-username" class="form-select" placeholder="Adınız..." autofocus><div class="modal-actions"><button class="primary-btn" onclick="window.saveName()">Başla</button></div></div></div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        window.saveName = async () => {
            const name = document.getElementById('inp-username').value;
            if(name.trim().length > 0) { await this.db.setUserName(name); document.querySelector('.modal-overlay').remove(); this.render(); }
        };
    }

    showExamConfigModal(lessonCode) {
        const html = `<div class="modal-overlay" id="exam-modal"><div class="modal-box"><h2 class="modal-title">Genel Sınav / Tekrar</h2><div class="form-group"><label class="form-label">Mod Seçimi</label><select id="select-mode" class="form-select" onchange="window.toggleExamOptions()"><option value="study">📚 Akıllı Çalışma (Tüm Üniteler)</option><option value="exam">📝 Deneme Sınavı</option></select></div><div id="exam-options" style="display:none;"><div class="form-group"><label class="form-label">Sınav Türü</label><select id="select-type" class="form-select"><option value="midterm">Ara Sınav (Ünite 1-4)</option><option value="final">Final (Tümü - %30/%70)</option></select></div><div class="form-group"><label class="form-label">Soru Sayısı</label><select id="select-count" class="form-select"><option value="5">5 Soru</option><option value="10">10 Soru</option><option value="20" selected>20 Soru</option></select></div></div><div class="modal-actions"><button class="nav-btn secondary" onclick="document.getElementById('exam-modal').remove()">İptal</button><button class="primary-btn" onclick="window.startExam('${lessonCode}')">Başlat</button></div></div></div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        window.toggleExamOptions = () => {
            const mode = document.getElementById('select-mode').value;
            document.getElementById('exam-options').style.display = (mode === 'exam') ? 'block' : 'none';
        };
        window.startExam = (code) => {
            const mode = document.getElementById('select-mode').value;
            const config = {
                mode: mode,
                type: document.getElementById('select-type').value,
                count: parseInt(document.getElementById('select-count').value)
            };
            document.getElementById('exam-modal').remove();
            window.startSession(code, config); 
        };
    }

    async openAccountInfo() {
        const sm = new SyncManager(this.db);
        const hasTok = !!localStorage.getItem('auth_token');
        const serverInfo = await sm.me().catch(()=>null) || {};
        const email = serverInfo.email || await this.db.getProfile('account_email') || '';
        const nameLocal = serverInfo.name || await this.db.getUserName() || '';
        const badgeText = hasTok ? 'Üye Hesabı' : 'Misafir (Yerel)';

        const html = `
        <div class="modal-overlay" id="account-info-modal">
          <div class="modal-box">
            <div class="modal-header"><h2 class="modal-title">Profil</h2><button class="icon-btn" onclick="document.getElementById('account-info-modal').remove()"><i class="fa-solid fa-xmark"></i></button></div>
            <div class="profile-edit-container">
              <div class="modal-header-center">
                <div class="profile-avatar-large"><i class="fa-solid fa-user"></i></div>
                <h3 id="profile-email-display">${email || '-'}</h3>
                <span class="badge badge-member">${badgeText}</span>
              </div>
              <form id="form-profile-update" class="modern-form">
                <div class="form-group">
                  <label for="edit-name">Ad Soyad</label>
                  <div class="input-wrapper">
                    <i class="fa-solid fa-id-card"></i>
                    <input type="text" id="edit-name" placeholder="Adınız" required>
                  </div>
                </div>
                <div class="form-group">
                  <label for="edit-email">E-posta (Değiştirmek için)</label>
                  <div class="input-wrapper">
                    <i class="fa-solid fa-envelope"></i>
                    <input type="email" id="edit-email" placeholder="yeni@mail.com">
                  </div>
                </div>
                <div class="form-group">
                  <label for="edit-pass">Yeni Şifre (Opsiyonel)</label>
                  <div class="input-wrapper">
                    <i class="fa-solid fa-lock"></i>
                    <input type="password" id="edit-pass" placeholder="••••••">
                  </div>
                </div>
                <button type="submit" class="btn-primary-block" id="btn-save-profile">
                  <i class="fa-solid fa-floppy-disk"></i> Değişiklikleri Kaydet
                </button>
              </form>
              <div class="form-footer-note">
                <i class="fa-solid fa-circle-info"></i> Değişiklikler anında sunucu ile senkronize edilir.
              </div>
            </div>
          </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        document.getElementById('edit-name').value = nameLocal || '';
        const overlay = document.getElementById('account-info-modal');
        if (overlay) {
          const escHandler = (e) => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); } };
          document.addEventListener('keydown', escHandler);
          overlay.addEventListener('click', (e) => { if (e.target && e.target.id === 'account-info-modal') overlay.remove(); });
        }
        const form = document.getElementById('form-profile-update');
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const newName = (document.getElementById('edit-name').value||'').trim();
          const newEmail = (document.getElementById('edit-email').value||'').trim();
          const newPass = (document.getElementById('edit-pass').value||'');
          const res = await sm.updateCredentials(newEmail, newPass, newName);
          if (res && res.ok) {
            if (newName) await this.db.setUserName(newName);
            if (res.data && res.data.email) await this.db.setProfile('account_email', res.data.email);
            document.dispatchEvent(new CustomEvent('app:data-updated'));
            document.getElementById('account-info-modal').remove();
          } else {
            alert(res && res.code===409 ? 'Bu e‑posta kullanımda' : 'Güncelleme başarısız');
          }
        });
      }

    async openAccounts() {
        let list = (await this.db.getProfile('accounts')) || [];
        let items = Array.isArray(list) ? list : [];
        if ((!items || items.length===0) && !!localStorage.getItem('auth_token')) {
            const sm = new SyncManager(this.db);
            const info = await sm.me().catch(()=>null);
            if (info && info.email) {
                await this.db.setProfile('account_email', info.email);
                const am = new AuthManager(this.db);
                await am.saveCurrentAccount();
                list = (await this.db.getProfile('accounts')) || [];
                items = Array.isArray(list) ? list : [];
            }
        }
        const activeEmail = await this.db.getProfile('account_email');
        const html = `
        <div class="modal-overlay" id="accounts-modal">
            <div class="modal-box large">
                <div class="modal-header"><h2 class="modal-title">Kayıtlı Hesaplar</h2><button class="icon-btn" onclick="document.getElementById('accounts-modal').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                <div style="display:flex; justify-content:flex-end; gap:8px; padding:8px 0;"><button class="nav-btn" onclick="document.getElementById('accounts-modal').remove(); window.openAuthSync()">Hesap Ekle</button></div>
                <div id="accounts-content" style="max-height:60vh; overflow:auto;">
                    ${items.length === 0 ? '<div style="padding:12px; color:#64748b;">Kayıtlı hesap bulunmuyor.</div>' : items.map(acc => {
                        const ts = acc.lastSync ? new Date(acc.lastSync).toLocaleString() : '-';
                        const active = (acc.email === activeEmail);
                        return `<div class=\"lesson-card\" style=\"display:flex; align-items:center; justify-content:space-between;\">
                            <div>
                                <div style=\"font-weight:600; display:flex; align-items:center; gap:8px;\">${acc.email} ${active ? '<span style=\\"background:#dcfce7; color:#166534; padding:2px 8px; border-radius:999px; font-size:0.75rem;\\">Aktif</span>' : ''}</div>
                                <small style=\"color:#64748b;\">Son Senkron: ${ts}</small>
                            </div>
                            <div style=\"display:flex; gap:8px;\">
                                <button class=\"nav-btn\" data-tip=\"accounts.use\" onclick=\"window.useAccount('${acc.email}')\">Kullan</button>
                                <button class=\"nav-btn warning\" data-tip=\"accounts.remove\" onclick=\"window.removeAccount('${acc.email}')\">Kaldır</button>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        window.useAccount = async (email) => {
            const list2 = (await this.db.getProfile('accounts')) || [];
            const found = (Array.isArray(list2) ? list2 : []).find(a => a && a.email === email);
            if (!found) return;
            localStorage.setItem('auth_token', found.token || '');
            await this.db.setProfile('account_email', email);
            await this.refreshAccountStatus();
            document.getElementById('accounts-modal').remove();
            this.render();
        };
        window.removeAccount = async (email) => {
            const list2 = (await this.db.getProfile('accounts')) || [];
            const filtered = (Array.isArray(list2) ? list2 : []).filter(a => !a || a.email !== email);
            await this.db.setProfile('accounts', filtered);
            document.getElementById('accounts-modal').remove();
            this.openAccounts();
        };
    }

    async openAdminAccounts() {
        const html = `
        <div class="modal-overlay" id="admin-accounts-modal">
            <div class="modal-box large">
                <div class="modal-header"><h2 class="modal-title">Hesap Temizleme (Admin)</h2><button class="icon-btn" onclick="document.getElementById('admin-accounts-modal').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                <div class="form-group"><input type="password" id="admin-secret" class="form-select" placeholder="Admin Secret"></div>
                <div class="modal-actions" style="margin-top:8px;"><button class="nav-btn" onclick="window.loadAdminAccounts()">Listele</button></div>
                <div id="admin-accounts-list" style="max-height:60vh; overflow:auto; margin-top:8px;"></div>
                <div class="modal-actions" style="margin-top:8px; display:flex; gap:8px;">
                    <button class="nav-btn warning" onclick="window.bulkDeleteSelected()">Seçili Hesapları Sil</button>
                    <button class="nav-btn secondary" onclick="document.getElementById('admin-accounts-modal').remove()">Kapat</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        window.loadAdminAccounts = async () => {
            const sec = (document.getElementById('admin-secret')||{}).value || '';
            const res = await fetch(`api/admin_accounts.php?action=list&secret=${encodeURIComponent(sec)}`).then(r=>r.json()).catch(()=>({ data:[] }));
            const list = Array.isArray(res.data) ? res.data : [];
            const rows = list.map(u => `<div class=\"lesson-card\" style=\"display:flex; align-items:center; justify-content:space-between;\"><div><div style=\"font-weight:600;\">${u.email}</div><small style=\"color:#64748b;\">Ad: ${u.name||'-'} • ID: ${u.id}</small></div><div style=\"display:flex; gap:8px;\"><input type=\"checkbox\" class=\"admin-del\" value=\"${u.email}\"><button class=\"nav-btn warning\" onclick=\"window.deleteOne('${u.email}')\">Sil</button></div></div>`).join('');
            const el = document.getElementById('admin-accounts-list');
            if (el) el.innerHTML = rows || '<div style="padding:12px; color:#64748b;">Kayıt yok</div>';
        };
        window.deleteOne = async (email) => {
            const sec = (document.getElementById('admin-secret')||{}).value || '';
            await fetch('api/admin_accounts.php?action=delete', { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' }, body: `secret=${encodeURIComponent(sec)}&email=${encodeURIComponent(email)}` });
            window.loadAdminAccounts();
        };
        window.bulkDeleteSelected = async () => {
            const sec = (document.getElementById('admin-secret')||{}).value || '';
            const els = Array.from(document.querySelectorAll('.admin-del'));
            const emails = els.filter(e=>e.checked).map(e=>e.value);
            await fetch(`api/admin_accounts.php?action=bulk_delete&secret=${encodeURIComponent(sec)}`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ emails }) });
            window.loadAdminAccounts();
        };
    }

    openSettings() {
        const existing = document.getElementById('settings-menu-overlay');
        if (existing) existing.remove();
        const html = `
            <div id="settings-menu-overlay" style="position:fixed; inset:0; background:transparent;">
                <div id="settings-menu" class="settings-panel" style="position:fixed; right:16px; top:60px; background:white; border:1px solid #e2e8f0; box-shadow:0 10px 25px rgba(0,0,0,0.08); border-radius:12px; min-width:320px; overflow:hidden;">
                    <div class="settings-profile-card" style="display:flex; align-items:center; justify-content:space-between; padding:12px; background:#f8fafc; border-bottom:1px solid #f1f5f9;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div class="profile-avatar" style="width:40px; height:40px; border-radius:999px; background:#eef2ff; display:flex; align-items:center; justify-content:center; color:#3730a3;"><i class="fa-solid fa-user-circle"></i></div>
                            <div class="profile-info">
                                <h3 id="menu-user-name" style="margin:0; font-size:1rem; color:#0f172a;">-</h3>
                                <span class="badge badge-member" id="menu-user-badge" style="font-size:0.75rem; color:#334155;">-</span>
                            </div>
                        </div>
                        <button class="btn-icon-logout" title="Çıkış Yap" onclick="window.logoutNow()" style="border:none; background:transparent; color:#ef4444; font-size:1rem;"><i class="fa-solid fa-right-from-bracket"></i></button>
                    </div>

                    <div class="settings-group" style="padding:8px 0;">
                        <h4 class="group-title" style="margin:8px 12px; font-size:0.9rem; color:#334155;">Uygulama & Veri</h4>
                        <button class="menu-item" id="btn-sync-now" style="width:100%; display:flex; align-items:center; gap:10px; padding:10px 12px; border:none; background:transparent;">
                            <div class="icon-box blue" style="width:32px; height:32px; border-radius:8px; background:#dbeafe; color:#2563eb; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-rotate"></i></div>
                            <div class="text-box" style="display:flex; flex-direction:column; align-items:flex-start;">
                                <span class="menu-label" style="font-weight:600; color:#0f172a;">Senkronize Et</span>
                                <span class="menu-sub" style="font-size:0.8rem; color:#64748b;">Verileri sunucuyla eşitle</span>
                            </div>
                        </button>

                        <button class="menu-item" id="btn-check-update" style="width:100%; display:flex; align-items:center; gap:10px; padding:10px 12px; border:none; background:transparent;">
                            <div class="icon-box green" style="width:32px; height:32px; border-radius:8px; background:#dcfce7; color:#16a34a; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-cloud-arrow-down"></i></div>
                            <div class="text-box" style="display:flex; flex-direction:column; align-items:flex-start;">
                                <span class="menu-label" style="font-weight:600; color:#0f172a;">Güncelleme Kontrol</span>
                                <span class="menu-sub" id="version-text" style="font-size:0.8rem; color:#64748b;">-</span>
                            </div>
                        </button>
                    </div>

                    <div class="settings-group" style="padding:8px 0; border-top:1px solid #f1f5f9;">
                        <h4 class="group-title" style="margin:8px 12px; font-size:0.9rem; color:#334155;">Hesap İşlemleri</h4>
                        <button class="menu-item" id="btn-update-cred" style="width:100%; display:none; align-items:center; gap:10px; padding:10px 12px; border:none; background:transparent;">
                            <div class="icon-box" style="width:32px; height:32px; border-radius:8px; background:#eef2ff; color:#3730a3; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-user-pen"></i></div>
                            <div class="text-box" style="display:flex; flex-direction:column; align-items:flex-start;">
                                <span class="menu-label" style="font-weight:600; color:#0f172a;">Bilgileri Güncelle</span>
                                <span class="menu-sub" style="font-size:0.8rem; color:#64748b;">Ad / E‑posta / Şifre</span>
                            </div>
                        </button>
                        <button class="menu-item" id="btn-reset-data" style="width:100%; display:flex; align-items:center; gap:10px; padding:10px 12px; border:none; background:transparent;">
                            <div class="icon-box orange" style="width:32px; height:32px; border-radius:8px; background:#ffedd5; color:#f97316; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-eraser"></i></div>
                            <div class="text-box" style="display:flex; flex-direction:column; align-items:flex-start;">
                                <span class="menu-label" style="font-weight:600; color:#0f172a;">İlerlemeyi Sıfırla</span>
                            </div>
                        </button>
                        <button class="menu-item admin-only" id="btn-admin-panel" style="width:100%; display:none; align-items:center; gap:10px; padding:10px 12px; border:none; background:transparent;">
                            <div class="icon-box purple" style="width:32px; height:32px; border-radius:8px; background:#ede9fe; color:#7c3aed; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-user-shield"></i></div>
                            <div class="text-box" style="display:flex; flex-direction:column; align-items:flex-start;">
                                <span class="menu-label" style="font-weight:600; color:#0f172a;">Yönetici Paneli</span>
                            </div>
                        </button>
                        <button class="menu-item" id="btn-logout" style="width:100%; display:none; align-items:center; gap:10px; padding:10px 12px; border:none; background:transparent;">
                            <div class="icon-box" style="width:32px; height:32px; border-radius:8px; background:#fee2e2; color:#ef4444; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-right-from-bracket"></i></div>
                            <div class="text-box" style="display:flex; flex-direction:column; align-items:flex-start;">
                                <span class="menu-label" style="font-weight:600; color:#0f172a;">Çıkış Yap</span>
                            </div>
                        </button>
                    </div>

                    <div class="settings-danger-zone" style="padding:12px; border-top:1px solid #f1f5f9;">
                        <button class="btn-text-danger" id="btn-delete-account" style="border:none; background:transparent; color:#ef4444; font-weight:600;"><i class="fa-solid fa-trash"></i> Hesabımı Kalıcı Olarak Sil</button>
                        <div class="app-footer-info" style="margin-top:10px; color:#64748b; font-size:0.8rem;">
                            <span id="footer-version">AÖF Asistanı</span><br>
                            <a href="#" id="btn-changelog">Sürüm Notları</a>
                        </div>
                        <div style="display:flex; justify-content:flex-end; margin-top:8px;"><button class="nav-btn secondary" onclick="document.getElementById('settings-menu-overlay').remove()">Kapat</button></div>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        const overlay = document.getElementById('settings-menu-overlay');
        overlay.addEventListener('click', (e) => { if (e.target.id === 'settings-menu-overlay') overlay.remove(); });
        const escHandler = (e) => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); } };
        document.addEventListener('keydown', escHandler);

        // Etkileşimler
        (async () => {
            await this.ensureActiveAccountToken();
            const hasToken = !!localStorage.getItem('auth_token');
            const nameLocal = await this.db.getUserName();
            const badgeEl = document.getElementById('menu-user-badge');
            const nameEl = document.getElementById('menu-user-name');
            const verEl = document.getElementById('version-text');
            const footVer = document.getElementById('footer-version');
            const versionInfo = await fetch('version.json?t=' + Date.now()).then(r => r.json()).catch(() => ({ version: 'unknown' }));
            if (verEl) verEl.textContent = `v${versionInfo.version}`;
            if (footVer) footVer.textContent = `AÖF Asistanı v${versionInfo.version}`;
            if (nameEl) nameEl.textContent = nameLocal || '-';
            if (badgeEl) { badgeEl.textContent = hasToken ? 'Üye' : 'Misafir'; badgeEl.style.color = hasToken ? '#166534' : '#334155'; }
        })();
        (async () => {
            await this.ensureActiveAccountToken();
            const hasToken = !!localStorage.getItem('auth_token');
            const btnUpd = document.getElementById('btn-update-cred'); if (btnUpd) btnUpd.style.display = hasToken ? 'flex' : 'none';
            const btnLogout = document.getElementById('btn-logout'); if (btnLogout) btnLogout.style.display = hasToken ? 'flex' : 'none';
        })();

        document.getElementById('btn-sync-now').onclick = async () => { const sm = new SyncManager(this.db); await sm.autoSync(); document.getElementById('settings-menu-overlay').remove(); };
        document.getElementById('btn-check-update').onclick = () => { window.checkUpdatesNow(); };
        const updBtn = document.getElementById('btn-update-cred'); if (updBtn) updBtn.onclick = async () => { window.openAccountInfo(); setTimeout(() => { const el = document.getElementById('acc-new-name'); if (el) el.focus(); }, 300); };
        document.getElementById('btn-reset-data').onclick = () => { window.confirmReset(); };
        const adminBtn = document.getElementById('btn-admin-panel'); if (adminBtn) adminBtn.onclick = () => { window.openAdminAccounts(); };
        const delBtn = document.getElementById('btn-delete-account'); if (delBtn) delBtn.onclick = () => { window.confirmDeleteAccount(); };
        const clBtn = document.getElementById('btn-changelog'); if (clBtn) clBtn.onclick = () => { window.openChangelog(); };
        const logoutBtn = document.getElementById('btn-logout'); if (logoutBtn) logoutBtn.onclick = () => { window.confirmLogout(); };

        window.confirmReset = () => {
            const html = `
            <div class="modal-overlay" id="confirm-reset-modal">
                <div class="modal-box">
                    <div class="modal-header"><h2 class="modal-title">Onay</h2><button class="icon-btn" onclick="document.getElementById('confirm-reset-modal').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                    <p style="color:#64748b;">Tüm ilerlemeni silmek istediğine emin misin?</p>
                    <div class="modal-actions">
                        <button class="nav-btn secondary" onclick="document.getElementById('confirm-reset-modal').remove()">İptal</button>
                        <button class="primary-btn" style="background-color:#ef4444;" onclick="window.resetApp()">Evet, Sıfırla</button>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
        };

        window.confirmDeleteAccount = () => {
            const html = `
            <div class="modal-overlay" id="confirm-del-modal">
                <div class="modal-box">
                    <div class="modal-header"><h2 class="modal-title">Hesabı Sil</h2><button class="icon-btn" onclick="document.getElementById('confirm-del-modal').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                    <p style="color:#64748b;">Hesabın ve tüm verilerin kalıcı olarak silinecek. Emin misin?</p>
                    <div class="modal-actions">
                        <button class="nav-btn secondary" onclick="document.getElementById('confirm-del-modal').remove()">İptal</button>
                        <button class="primary-btn" style="background-color:#ef4444;" onclick="window.deleteAccountNow()">Evet, Sil</button>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
        };

        window.deleteAccountNow = async () => {
            const auth = new AuthManager(this.db);
            const ok = await auth.deleteAccount();
            if (ok) { await this.db.resetAllData(); localStorage.removeItem('guest_mode'); location.reload(); }
            else alert('Silme işlemi başarısız');
        };

        window.confirmLogout = () => {
            const html = `
            <div class="modal-overlay" id="confirm-logout-modal">
                <div class="modal-box">
                    <div class="modal-header"><h2 class="modal-title">Çıkış Yap</h2><button class="icon-btn" onclick="document.getElementById('confirm-logout-modal').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                    <p style="color:#64748b;">Çıkış yapmak istiyor musun? İlerlemelerin kaydedilecektir.</p>
                    <div class="modal-actions">
                        <button class="nav-btn secondary" onclick="document.getElementById('confirm-logout-modal').remove()">İptal</button>
                        <button class="primary-btn" onclick="window.doLogoutConfirmed()">Evet, Çıkış Yap</button>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
        };

        window.doLogoutConfirmed = async () => {
            const sm = new SyncManager(this.db);
            try { await sm.autoSync(); } catch {}
            await (async () => { localStorage.removeItem('auth_token'); await this.db.setProfile('account_email',''); await this.refreshAccountStatus(); })();
            const settings = document.getElementById('settings-menu-overlay'); if (settings) settings.remove();
            const cm = document.getElementById('confirm-logout-modal'); if (cm) cm.remove();
            const html = `
            <div class="modal-overlay" id="farewell-modal">
                <div class="modal-box">
                    <div class="modal-header"><h2 class="modal-title">Güle Güle 👋</h2><button class="icon-btn" onclick="document.getElementById('farewell-modal').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                    <p style="color:#64748b;">İlerlemeleriniz kaydedildi. Uygulamayı kullandığınız için teşekkür ederiz. Tekrar bekleriz!</p>
                    <div class="modal-actions"><button class="nav-btn secondary" onclick="document.getElementById('farewell-modal').remove()">Kapat</button></div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
            this.render();
        };

        window.resetApp = async () => {
            const auth = new AuthManager(this.db);
            if (auth.hasToken()) { await auth.wipeRemote().catch(()=>{}); }
            if (this.db.resetProgressOnly) { await this.db.resetProgressOnly(); } else { await this.db.resetAllData(); }
            await this.refreshAccountStatus();
            document.dispatchEvent(new CustomEvent('app:data-updated'));
            const overlay = document.getElementById('settings-menu-overlay'); if (overlay) overlay.remove();
        };

        window.openChangelog = async () => {
            const res = await fetch('data/changelog.json?t=' + Date.now()).then(r => r.json()).catch(() => []);
            const list = Array.isArray(res) ? res : [];
            const sorted = list.sort((a,b) => b.version.localeCompare(a.version));
            const modalHtml = `
            <div class="modal-overlay" id="changelog-modal">
                <div class="modal-box large">
                    <div class="modal-header"><h2 class="modal-title">Sürüm Notları</h2><button class="icon-btn" onclick="document.getElementById('changelog-modal').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                    <div id="changelog-content" style="max-height:60vh; overflow-y:auto;">
                        ${sorted.map(item => `
                            <div class="lesson-card" style="cursor:pointer;" onclick="window.showReleaseNotes('${item.version}')">
                                <h3>v${item.version}</h3>
                                <small>${item.date || ''}</small>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            window.showReleaseNotes = async (v) => {
                const res2 = await fetch('data/changelog.json?t=' + Date.now()).then(r => r.json()).catch(() => []);
                const list2 = Array.isArray(res2) ? res2 : [];
                const found = list2.find(x => x.version === v) || { items: [] };
                const notes = Array.isArray(found.items) ? found.items : [];
                const html2 = `
                <div class="modal-overlay" id="release-modal">
                    <div class="modal-box">
                        <div class="modal-header"><h2 class="modal-title">v${v} Sürüm Notları</h2><button class="icon-btn" onclick="document.getElementById('release-modal').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                        <div style="max-height:50vh; overflow-y:auto;">
                            <ul style="padding-left:18px;">${notes.map(n => `<li>${n}</li>`).join('')}</ul>
                        </div>
                    </div>
                </div>`;
                document.body.insertAdjacentHTML('beforeend', html2);
            };
        };

        window.checkUpdatesNow = async () => {
            const updater = new UpdateManager();
            const overlayId = 'update-check-overlay';
            const overlayHtml = `<div class="modal-overlay" id="${overlayId}"><div class="modal-box"><div class="modal-header"><h2 class="modal-title">Güncelleme Kontrolü</h2><button class="icon-btn" onclick="document.getElementById('${overlayId}').remove()"><i class="fa-solid fa-xmark"></i></button></div><div id="update-check-content" class="loading-state"><div class="spinner"></div><p>Sunucu sürümü kontrol ediliyor...</p></div></div></div>`;
            document.body.insertAdjacentHTML('beforeend', overlayHtml);
            try {
                await updater.checkUpdates();
                const cont = document.getElementById('update-check-content');
                if (cont) cont.innerHTML = `<div style="padding:10px 0; color:#10b981; font-weight:600;">Güncel sürüm kullanılıyor.</div><div class="modal-actions"><button class="nav-btn secondary" onclick="document.getElementById('${overlayId}').remove()">Kapat</button></div>`;
            } catch {
                const cont = document.getElementById('update-check-content');
                if (cont) cont.innerHTML = `<div style="padding:10px 0; color:#ef4444; font-weight:600;">Kontrol sırasında hata oluştu.</div><div class="modal-actions"><button class="nav-btn secondary" onclick="document.getElementById('${overlayId}').remove()">Kapat</button></div>`;
            }
        };

        window.manualUpdateNow = async () => {
            const updater = new UpdateManager();
            const id = 'manual-update-overlay';
            const html = `<div class="modal-overlay" id="${id}"><div class="modal-box"><div class="modal-header"><h2 class="modal-title">Manuel Güncelle</h2><button class="icon-btn" onclick="document.getElementById('${id}').remove()"><i class="fa-solid fa-xmark"></i></button></div><div class="loading-state"><div class="spinner"></div><p>Önbellek temizleniyor ve sayfa yenileniyor...</p></div></div></div>`;
            document.body.insertAdjacentHTML('beforeend', html);
            await updater.performCleanup();
            location.reload();
        };

        window.forceSyncNow = async () => { const sm = new SyncManager(this.db); await sm.autoSync(); const pill = document.querySelector('.account-pill'); if (pill) { const lastSync = await this.db.getProfile('last_sync'); pill.textContent = await this.getAccountStatusText(); } document.getElementById('settings-menu-overlay').remove(); };

        window.openAccountInfo = () => this.openAccountInfo();
        window.openAccounts = () => this.openAccounts();
        window.openAdminAccounts = () => this.openAdminAccounts();

        window.openAuthSync = async () => {
            const hasTokenNow = !!localStorage.getItem('auth_token');
            const accEmailNow = await this.db.getProfile('account_email');
            const lastSyncNow = await this.db.getProfile('last_sync');
            const statusNow = hasTokenNow ? `Üye${accEmailNow?` • ${accEmailNow}`:''}${lastSyncNow?` • Son Senkron: ${new Date(lastSyncNow).toLocaleString()}`:''}` : 'Misafir';
            const formHtml = hasTokenNow ? `<div style="padding:8px 12px; color:#334155; font-size:0.9rem;">Giriş yapmışsınız. Aşağıdan yedekleme işlemlerini kullanabilirsiniz.</div>` : `
                        <div class="form-group">
                        <input type="email" id="auth-email" class="form-select" placeholder="E-posta" autocomplete="off" autocapitalize="none">
                        <input type="password" id="auth-pass" class="form-select" placeholder="Şifre" style="margin-top:8px;" autocomplete="new-password">
                            <div class="modal-actions" style="margin-top:10px; display:flex; gap:8px;">
                                <button class="nav-btn" data-tip="register.push" onclick="window.doRegister()">Kayıt Ol</button>
                                <button class="primary-btn" data-tip="login.push" onclick="window.doLogin()">Giriş Yap</button>
                            </div>
                        </div>`;
            const html = `
            <div class="modal-overlay" id="auth-sync-modal">
                <div class="modal-box">
                    <div class="modal-header"><h2 class="modal-title">Giriş / Senkronizasyon</h2><button class="icon-btn" onclick="document.getElementById('auth-sync-modal').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                    <div style="background:#f1f5f9; color:#334155; padding:8px 12px; border-radius:8px; font-size:0.85rem; margin-bottom:10px;">Durum: ${statusNow}</div>
                    ${formHtml}
                    <div class="modal-actions" style="margin-top:16px; display:flex; gap:8px;">
                        <button class="nav-btn" onclick="window.doPushSync()">Sunucuya Yedekle</button>
                        <button class="nav-btn" onclick="window.doPullSync()">Sunucudan Yükle</button>
                        ${hasTokenNow ? '<button class="nav-btn warning" onclick="window.logoutNow()">Çıkış Yap</button>' : ''}
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
            const sm = new SyncManager(this.db);
            const auth = new AuthManager(this.db);
            window.doRegister = async () => { const e = document.getElementById('auth-email').value; const p = document.getElementById('auth-pass').value; const res = await auth.register(e,p); if (res && res.exists) { alert('Bu e-posta ile kayıt zaten mevcut. Lütfen giriş yapın.'); return; } await auth.saveCurrentAccount(); alert(res && res.ok ? 'Kayıt başarılı' : 'Kayıt başarısız'); };
            window.doLogin = async () => { const e = document.getElementById('auth-email').value; const p = document.getElementById('auth-pass').value; const ok = await auth.login(e,p); if (ok) { await auth.saveCurrentAccount(); await this.refreshAccountStatus(); } alert(ok ? 'Giriş başarılı' : 'Giriş başarısız'); };
            window.doPushSync = async () => { const ok = await sm.pushAll().catch(async () => { const payload = { type:'push' }; await this.db.enqueueSync(payload); return false; }); alert(ok ? 'Yedekleme tamam' : 'Yedekleme başarısız'); };
            window.doPullSync = async () => { const ok = await sm.pullAll(); alert(ok ? 'Yükleme tamam' : 'Yükleme başarısız'); };
            window.logoutNow = async () => { localStorage.removeItem('auth_token'); await this.db.setProfile('account_email',''); await this.refreshAccountStatus(); document.getElementById('auth-sync-modal').remove(); this.render(); };
        };

        window.logoutNow = async () => { localStorage.removeItem('auth_token'); await this.db.setProfile('account_email',''); await this.refreshAccountStatus(); document.getElementById('settings-menu-overlay').remove(); this.render(); };
    }

    showWelcomeOverlay(){
        const existing = document.getElementById('welcome-overlay');
        if (existing) return;
        const html = `
        <div id="welcome-overlay" style="position:fixed; inset:0; background:rgba(17,24,39,0.6); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; z-index:9999;">
            <div class="modal-box" style="max-width:560px; width:90%;">
                <div class="modal-header" style="border:none;">
                    <h2 class="modal-title" style="display:flex; align-items:center; gap:10px;">
                        <img src="assets/logo.png" alt="logo" style="width:32px; height:32px;"> AÖF Sınav Asistanı
                    </h2>
                </div>
                <p style="color:#64748b; margin-top:-6px;">Sınavlara her yerden hazırlan, ilerlemeni asla kaybetme.</p>
                <div id="local-data-banner" style="display:none; margin-top:8px; background:#ecfeff; color:#0e7490; padding:10px 12px; border-radius:10px; font-size:0.85rem;">Bu cihazda kayıtlı ilerleme bulundu. Üye olursan otomatik buluta taşınacak.</div>
                <div style="margin-top:12px; display:flex; gap:8px;">
                    <button class="nav-btn" onclick="window.switchAuthTab('login')" id="tab-login">Giriş Yap</button>
                    <button class="nav-btn" onclick="window.switchAuthTab('register')" id="tab-register">Kayıt Ol</button>
                </div>
                <div id="auth-forms" style="margin-top:12px;">
                    <div id="form-login">
                        <input type="email" id="welcome-email" class="form-select" placeholder="E-posta" autocomplete="off" autocapitalize="none">
                        <input type="password" id="welcome-pass" class="form-select" placeholder="Şifre" style="margin-top:8px;" autocomplete="new-password">
                        <input type="text" id="welcome-name-login" class="form-select" placeholder="Ad (Cihaz)" style="margin-top:8px;" autocomplete="off">
                        <div class="modal-actions" style="margin-top:10px;">
                            <button class="primary-btn" onclick="window.handleLogin()">Giriş Yap</button>
                        </div>
                    </div>
                    <div id="form-register" style="display:none;">
                        <input type="text" id="welcome-name" class="form-select" placeholder="Ad Soyad" autocomplete="off">
                        <input type="email" id="welcome-email-r" class="form-select" placeholder="E-posta" style="margin-top:8px;" autocomplete="off" autocapitalize="none">
                        <input type="password" id="welcome-pass-r" class="form-select" placeholder="Şifre" style="margin-top:8px;" autocomplete="new-password">
                        <div class="modal-actions" style="margin-top:10px;">
                            <button class="primary-btn" onclick="window.handleRegister()">Kayıt Ol</button>
                        </div>
                    </div>
                </div>
                <div style="margin-top:12px; text-align:center;">
                    <button class="nav-btn secondary" style="opacity:0.8;" onclick="window.continueGuest()">Üye olmadan cihazımda devam et (Veriler sadece bu cihazda kalır)</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        const auth = new AuthManager(this.db);
        (async () => { const p = await this.db.getAllProgress(); const h = await this.db.getHistory(); const s = await this.db.getUserStats(); const has = (Array.isArray(p)&&p.length>0)||(Array.isArray(h)&&h.length>0)||((s.xp||0)>0||(s.streak||0)>0||(s.totalQuestions||0)>0); const banner = document.getElementById('local-data-banner'); if (banner && has) banner.style.display='block'; document.getElementById('welcome-email').value=''; document.getElementById('welcome-pass').value=''; document.getElementById('welcome-name-login').value=''; document.getElementById('welcome-email-r').value=''; document.getElementById('welcome-pass-r').value=''; document.getElementById('welcome-name').value=''; })();
        window.switchAuthTab = (tab) => {
            document.getElementById('form-login').style.display = (tab==='login') ? 'block':'none';
            document.getElementById('form-register').style.display = (tab==='register') ? 'block':'none';
            document.getElementById('tab-login').classList.toggle('primary', tab==='login');
            document.getElementById('tab-register').classList.toggle('primary', tab==='register');
        };
        window.handleLogin = async () => {
            const e = document.getElementById('welcome-email').value;
            const p = document.getElementById('welcome-pass').value;
            const nm = document.getElementById('welcome-name-login').value || '';
            const ok = await auth.login(e,p);
            if (ok) {
                if (nm && nm.trim().length>0) { await this.db.setUserName(nm.trim()); const sm = new SyncManager(this.db); await sm.updateProfileName(nm.trim()); }
                { const sm = new SyncManager(this.db); await sm.autoSync(); }
                document.getElementById('welcome-overlay').remove(); this.render();
            } else { alert('Giriş başarısız'); }
        };
        window.handleRegister = async () => {
            const n = document.getElementById('welcome-name').value;
            const e = document.getElementById('welcome-email-r').value;
            const p = document.getElementById('welcome-pass-r').value;
            const res = await auth.register(e,p,n);
            if (res && res.exists) { alert('Bu e-posta ile kayıt zaten mevcut. Lütfen giriş yapın.'); return; }
            if (res && res.ok) { const sm = new SyncManager(this.db); await sm.autoSync(); document.getElementById('welcome-overlay').remove(); this.render(); }
            else { alert('Kayıt başarısız'); }
        };
        window.continueGuest = () => { localStorage.setItem('guest_mode','1'); const name = prompt('Adınızı girin (isteğe bağlı)'); if (name && name.trim().length>0) { this.db.setUserName(name.trim()); } document.getElementById('welcome-overlay').remove(); };
        window.switchAuthTab('login');
    }
    
    async getAccountStatusText(){
        const hasToken = !!localStorage.getItem('auth_token');
        const accEmail = await this.db.getProfile('account_email');
        const lastSync = await this.db.getProfile('last_sync');
        return hasToken ? `Üye${accEmail?` • ${accEmail}`:''}${lastSync?` • Son Senkron: ${new Date(lastSync).toLocaleString()}`:''}` : 'Misafir (Veriler sadece bu cihazda)';
    }

    async refreshAccountStatus(){
        await this.ensureActiveAccountToken();
        const txt = await this.getAccountStatusText();
        const pill = document.querySelector('.account-pill');
        if (pill) { pill.textContent = txt; }
        const ua = document.querySelector('.user-actions');
        if (ua) {
            let mini = document.getElementById('account-mini');
            if (!mini) {
                mini = document.createElement('span');
                mini.id = 'account-mini';
                mini.style.marginRight = '8px';
                mini.style.fontSize = '0.85rem';
                mini.style.color = '#334155';
                mini.style.cursor = 'pointer';
                ua.insertBefore(mini, ua.firstChild);
            }
            const hasToken = !!localStorage.getItem('auth_token');
            const accEmail = await this.db.getProfile('account_email');
            mini.textContent = hasToken ? (accEmail || 'Üye') : 'Misafir';
            mini.title = 'Kayıtlı Hesaplar';
            mini.onclick = () => this.openAccounts();
        }
    }
}

```

### js\ui\quizUI.js

```javascript
import { SRS } from '../core/srs.js';
import { Gamification } from '../core/gamification.js';
import { ExamManager } from '../core/examManager.js';

function escapeHTML(str) {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export class QuizUI {
    constructor(dataLoader, db, onBack) {
        this.loader = dataLoader;
        this.db = db;
        this.onBack = onBack;
        this.container = document.getElementById('app-container');
        this.currentCards = [];
        this.currentIndex = 0;
        this.sessionHistory = {}; 
        this.isExamMode = false;
    }

    async start(lessonCode, config = { mode: 'study' }) {
        this.container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Sorular Hazırlanıyor...</p></div>';
        this.sessionHistory = {}; 

        const lessons = await this.loader.getLessonList();
        const targetLesson = lessons.find(l => l.code === lessonCode);
        
        if (!targetLesson) { alert("Ders bulunamadı!"); this.onBack(); return; }

        let allCards = await this.loader.loadLessonData(targetLesson.code, targetLesson.file);

        // --- ÜNİTE FİLTRESİ ---
        if (config.specificUnit) {
            allCards = allCards.filter(card => card.unit === config.specificUnit);
        }

        // --- SORU SEÇİM ALGORİTMASI ---
        if (config.mode === 'exam') {
            const manager = new ExamManager();
            this.currentCards = manager.createExam(allCards, config.type, config.count);
            this.isExamMode = true;
        } else {
            this.currentCards = allCards.sort((a, b) => {
                if (config.specificUnit) {
                    if (a.level === 0 && b.level !== 0) return -1;
                    if (a.level !== 0 && b.level === 0) return 1;
                    if (a.isDue && !b.isDue) return -1;
                    if (!a.isDue && b.isDue) return 1;
                    return 0.5 - Math.random();
                }
                if (a.level === 0 && b.level !== 0) return -1;
                if (a.level !== 0 && b.level === 0) return 1;
                if (a.isDue && !b.isDue) return -1;
                if (!a.isDue && b.isDue) return 1;
                return 0;
            });
            this.isExamMode = false;
        }

        if (this.currentCards.length === 0) { alert("Bu ünitede soru bulunamadı."); this.onBack(); return; }

        this.currentIndex = 0;
        this.renderCard();
    }

    renderCard() {
        const card = this.currentCards[this.currentIndex];
        const progress = `${this.currentIndex + 1} / ${this.currentCards.length}`;
        const givenAnswer = this.sessionHistory[this.currentIndex];
        const isAnswered = givenAnswer !== undefined;

        let stats = { correct: 0, wrong: 0, skipped: 0 };
        Object.keys(this.sessionHistory).forEach(key => {
            const ans = this.sessionHistory[key];
            const q = this.currentCards[key];
            if (ans === 'SKIPPED') stats.skipped++;
            else if (ans === q.correct_option) stats.correct++;
            else stats.wrong++;
        });

        if (!card.shuffledOptions) {
            card.shuffledOptions = [...card.options].sort(() => Math.random() - 0.5);
        }

        const detailsDisplay = isAnswered ? 'block' : 'none';
        
        const codeBlock = card.code_example ? `
            <div class="code-snippet" style="display: ${detailsDisplay}; margin-top: 15px;">
                <div style="color: #94a3b8; font-size: 0.8rem; margin-bottom: 5px; font-weight:bold;">📝 Açıklama:</div>
                <pre><code>${escapeHTML(card.code_example)}</code></pre>
            </div>
        ` : '';

        const sourceBlock = card.source_type ? `
            <div class="source-box" style="display: ${detailsDisplay};">
                <i class="fa-solid fa-book-open"></i> 
                <span>${escapeHTML(card.source_type)}</span>
            </div>
        ` : '';

        let html = `
            <div class="quiz-header">
                <button id="btn-exit" class="icon-btn"><i class="fa-solid fa-arrow-left"></i> Çıkış</button>
                <div class="live-stats">
                    <span class="stat-tag correct"><i class="fa-solid fa-check"></i> ${stats.correct}</span>
                    <span class="stat-tag wrong"><i class="fa-solid fa-xmark"></i> ${stats.wrong}</span>
                    <span class="stat-tag skip"><i class="fa-solid fa-forward"></i> ${stats.skipped}</span>
                </div>
                <span class="quiz-progress">${progress}</span>
            </div>

            <div class="question-card-container">
                <div class="question-card">
                    <div class="card-meta-top">
                        <span class="topic-badge">${escapeHTML(card.topic || 'Genel')}</span>
                        <span class="unit-badge">Ünite ${card.unit}</span>
                    </div>
                    <div class="question-text">
                        <p>${escapeHTML(card.question)}</p>
                    </div>
                    
                    <div class="options-list">
                        ${card.shuffledOptions.map(opt => {
                            let btnClass = 'option-btn';
                            let isDisabled = isAnswered ? 'disabled' : '';
                            if (isAnswered && givenAnswer !== 'SKIPPED') {
                                if (opt === card.correct_option) btnClass += ' correct';
                                else if (opt === givenAnswer) btnClass += ' incorrect';
                            }
                            if (givenAnswer === 'SKIPPED' && opt === card.correct_option) {
                                btnClass += ' skipped-reveal'; 
                            }
                            const safeOpt = opt.replace(/'/g, "\\'");
                            const safeLabel = escapeHTML(opt);
                            return `<button class="${btnClass}" ${isDisabled} onclick="window.handleAnswer(this, '${safeOpt}')">${safeLabel}</button>`;
                        }).join('')}
                    </div>

                    ${codeBlock}
                    ${sourceBlock}

                    <div class="quiz-actions" style="margin-top: 20px; display: flex; gap:10px; flex-wrap: wrap;">
                        <button id="btn-prev" class="nav-btn secondary" style="flex:1;" ${this.currentIndex === 0 ? 'disabled' : ''}>
                            <i class="fa-solid fa-chevron-left"></i> Önceki
                        </button>
                        ${!isAnswered ? `<button id="btn-skip" class="nav-btn warning" style="flex:1;" onclick="window.skipQuestion()">Atla / Boş Bırak</button>` : ''}
                        <button id="btn-next" class="nav-btn primary" style="flex:1; ${!isAnswered ? 'display:none' : ''}">
                            Sonraki <i class="fa-solid fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        this.container.innerHTML = html;

        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
        }
        this._keyHandler = (e) => {
            const key = e.key.toLowerCase();
            const options = card.shuffledOptions || card.options;
            if (!options) return;
            if (key >= '1' && key <= '4') {
                const idx = parseInt(key) - 1;
                const opt = options[idx];
                if (opt && !givenAnswer) {
                    window.handleAnswer(null, opt);
                }
            } else if (key === 's') {
                if (!givenAnswer) window.skipQuestion();
            } else if (key === 'enter') {
                const nextBtn = document.getElementById('btn-next');
                if (nextBtn && nextBtn.style.display !== 'none') this.nextQuestion();
            } else if (key === 'escape') {
                window.confirmExit();
            }
        };
        document.addEventListener('keydown', this._keyHandler);
        document.getElementById('btn-exit').onclick = () => window.confirmExit();
        document.getElementById('btn-prev').onclick = () => { if(this.currentIndex > 0) { this.currentIndex--; this.renderCard(); } };
        if(document.getElementById('btn-next')) document.getElementById('btn-next').onclick = () => this.nextQuestion();

        window.handleAnswer = (btn, opt) => this.checkAnswer(opt, card);
        window.skipQuestion = () => this.skipCurrentQuestion(card);

        window.confirmExit = () => {
            const wrongs = [];
            for (let i = 0; i < this.currentCards.length; i++) {
                const ans = this.sessionHistory[i];
                const c = this.currentCards[i];
                if ((ans && ans !== c.correct_option) || ans === 'SKIPPED') {
                    wrongs.push({ q: c.question, given: ans === 'SKIPPED' ? 'Boş/Atlandı' : ans, correct: c.correct_option, exp: c.code_example });
                }
            }
            const id = 'confirm-exit-modal';
            const listHtml = wrongs.length > 0 ? `
                <div style="margin-top:12px; max-height:40vh; overflow:auto; text-align:left;">
                    ${wrongs.map((it,idx)=>`
                        <div class="mistake-card" style="background:white; padding:12px; border-radius:8px; border:1px solid #fecaca; margin-bottom:10px;">
                            <div style="font-weight:600; color:#1e293b; margin-bottom:6px;">${idx+1}. ${escapeHTML(it.q)}</div>
                            <div style="font-size:0.9rem; margin-bottom:4px; color:#ef4444;"><strong>Senin Cevabın:</strong> ${escapeHTML(it.given)}</div>
                            <div style="font-size:0.9rem; color:#10b981;"><strong>Doğru Cevap:</strong> ${escapeHTML(it.correct)}</div>
                            ${it.exp ? `<div style=\"margin-top:6px; font-size:0.85rem; background:#f1f5f9; padding:6px; border-radius:4px; color:#475569;\"><strong>📝 Açıklama:</strong> ${escapeHTML(it.exp)}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            ` : '<div style="margin-top:8px; color:#64748b;">Bu oturumda yanlış veya boş cevap yok.</div>';
            const html = `
            <div class="modal-overlay" id="${id}">
                <div class="modal-box">
                    <div class="modal-header"><h2 class="modal-title">Oturumu Kapat</h2><button class="icon-btn" onclick="document.getElementById('${id}').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                    <p style="color:#64748b;">Aşağıda bu oturumdaki yanlış/boş sorularını görebilirsin.</p>
                    ${listHtml}
                    <div class="modal-actions" style="margin-top:12px; display:flex; gap:8px;">
                        <button class="nav-btn secondary" onclick="document.getElementById('${id}').remove()">Devam Et</button>
                        <button id="btn-exit-home" class="nav-btn warning">${escapeHTML('Ana Ekrana Dön')}</button>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
            const btn = document.getElementById('btn-exit-home');
            if (btn) btn.onclick = async () => { document.getElementById(id).remove(); const u = window.__sessionUUID; if (u && this.db && typeof this.db.endSessionRecord==='function'){ await this.db.endSessionRecord(u); } window.__inSession=false; if (this.onBack) this.onBack(); else if (window.dashboard && window.dashboard.render) window.dashboard.render(); };
        };
    }

    async skipCurrentQuestion(card) {
        this.sessionHistory[this.currentIndex] = 'SKIPPED';
        this.renderCard();
    }

    async checkAnswer(selectedOption, card) {
        this.sessionHistory[this.currentIndex] = selectedOption;
        const isCorrect = selectedOption === card.correct_option;

        if (!this.isExamMode) {
            const newStatus = SRS.calculate(card.level, isCorrect);
            await this.db.saveProgress(card.id, {
                id: card.id,
                level: newStatus.level,
                nextReview: newStatus.nextReview,
                correct: (card.correct || 0) + (isCorrect ? 1 : 0),
                wrong: (card.wrong || 0) + (isCorrect ? 0 : 1)
            });
        }

        if (isCorrect) {
            const game = new Gamification(this.db);
            await game.addXP(10);
        }

        const parts = card.id.split('_');
        const lessonCode = parts[0];
        await this.db.logActivity(lessonCode, card.unit, isCorrect, card.id, selectedOption);

        this.renderCard();
    }

    nextQuestion() {
        if (this.currentIndex < this.currentCards.length - 1) {
            this.currentIndex++;
            this.renderCard();
        } else {
            this.showFinishScreen();
        }
    }

    showFinishScreen() {
        const total = this.currentCards.length;
        let correct = 0, wrong = 0, skipped = 0;
        for (let i = 0; i < total; i++) {
            const ans = this.sessionHistory[i];
            const card = this.currentCards[i];
            if (ans === 'SKIPPED') skipped++;
            else if (ans === card.correct_option) correct++;
            else if (ans) wrong++;
        }
        const score = total > 0 ? Math.round((correct / total) * 100) : 0;
        const earnedXP = correct * 10;

        const wrongAnswers = [];
        for (let i = 0; i < this.currentCards.length; i++) {
            const ans = this.sessionHistory[i];
            const card = this.currentCards[i];
            if ((ans && ans !== card.correct_option) || ans === 'SKIPPED') {
                wrongAnswers.push({ question: card.question, given: ans === 'SKIPPED' ? 'Boş/Atlandı' : ans, correct: card.correct_option, explanation: card.code_example });
            }
        }

        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        const reviewHtml = wrongAnswers.length > 0 ? `
            <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                <button class="nav-btn warning full-width" onclick="window.toggleMistakes()">
                    <i class="fa-solid fa-eye"></i> Yanlış Cevapları İncele (${wrongAnswers.length})
                </button>
                <div id="mistakes-container" style="display:none; margin-top: 15px; text-align: left;">
                    ${wrongAnswers.map((item, idx) => `
                        <div class="mistake-card" style="background:white; padding:15px; border-radius:8px; border:1px solid #fecaca; margin-bottom:10px;">
                            <div style="font-weight:600; color:#1e293b; margin-bottom:8px;">${idx + 1}. ${escapeHTML(item.question)}</div>
                            <div style="font-size:0.9rem; margin-bottom:4px;">
                                <span style="color:#ef4444; font-weight:bold;"><i class="fa-solid fa-xmark"></i> Senin Cevabın:</span>
                                <span style="color:#ef4444;">${escapeHTML(item.given)}</span>
                            </div>
                            <div style="font-size:0.9rem;">
                                <span style="color:#10b981; font-weight:bold;"><i class="fa-solid fa-check"></i> Doğru Cevap:</span>
                                <span style="color:#10b981;">${escapeHTML(item.correct)}</span>
                            </div>
                            ${item.explanation ? `
                                <div style="margin-top:8px; font-size:0.85rem; background:#f1f5f9; padding:8px; border-radius:4px; color:#475569;">
                                    <strong>📝 Açıklama:</strong> ${escapeHTML(item.explanation)}
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                    <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: center; border-top: 1px dashed #cbd5e1; padding-top: 15px;">
                        <button class="nav-btn secondary" onclick="window.toggleMistakes()"><i class="fa-solid fa-chevron-up"></i> Listeyi Gizle</button>
                        <button class="primary-btn" onclick="(function(){ const b=document.getElementById('btn-finish-home'); if(b) b.click(); })()"><i class="fa-solid fa-house"></i> Ana Ekran</button>
                    </div>
                </div>
            </div>
        ` : '';

        this.container.innerHTML = `
            <div class="loading-state">
                <i class="fa-solid fa-flag-checkered" style="font-size: 3rem; color: #2563eb; margin-bottom: 20px;"></i>
                <h2>Oturum Tamamlandı!</h2>
                <div style="background: #fffbeb; color: #b45309; padding: 10px 20px; border-radius: 20px; font-weight: bold; margin-bottom: 20px;">
                    +${earnedXP} XP Kazandın!
                </div>
                <div class="result-stats" style="display:flex; gap:15px; flex-wrap:wrap; justify-content:center;">
                    <div class="stat-box correct"><span class="stat-value">${correct}</span><span class="stat-label">Doğru</span></div>
                    <div class="stat-box incorrect"><span class="stat-value">${wrong}</span><span class="stat-label">Yanlış</span></div>
                    <div class="stat-box skipped"><span class="stat-value">${skipped}</span><span class="stat-label">Boş</span></div>
                    <div class="stat-box score"><span class="stat-value">%${score}</span><span class="stat-label">Başarı</span></div>
                </div>
                <div style="display:flex; gap:10px; justify-content:center; margin-top:20px;">
                    <button id="btn-finish-home" class="primary-btn">Ana Ekrana Dön</button>
                    <button class="nav-btn" onclick="window.startSession('${this.currentCards[0].id.split('_')[0]}', {mode:'study'})">Tekrar Başla</button>
                </div>
                ${reviewHtml}
            </div>
        `;

        if (!localStorage.getItem('auth_token')) {
            const html = `
            <div class="modal-overlay" id="nudge-modal">
                <div class="modal-box">
                    <div class="modal-header"><h2 class="modal-title">Tebrikler!</h2><button class="icon-btn" onclick="document.getElementById('nudge-modal').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                    <p>Bu skorunu kaybetmek istemezsin. Üye ol ve buluta yedekle.</p>
                    <div class="modal-actions"><button class="primary-btn" onclick="document.getElementById('nudge-modal').remove(); if(window && window.dashboard && window.dashboard.openSettings){ window.dashboard.openSettings(); }">Üye Ol</button></div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
        }
        window.toggleMistakes = () => { const div = document.getElementById('mistakes-container'); if (!div) return; div.style.display = (div.style.display === 'none' || !div.style.display) ? 'block' : 'none'; if (div.style.display === 'block') { div.scrollIntoView({ behavior: 'smooth' }); } };
        const endUUID = window.__sessionUUID; if (endUUID && this.db && typeof this.db.endSessionRecord === 'function') { this.db.endSessionRecord(endUUID); }
        const btnHome = document.getElementById('btn-finish-home');
        if (btnHome) btnHome.onclick = async () => { const u = window.__sessionUUID; if (u && this.db && typeof this.db.endSessionRecord==='function') { await this.db.endSessionRecord(u); } window.__inSession=false; if (this.onBack) this.onBack(); else if (window.dashboard && window.dashboard.render) window.dashboard.render(); };
    }
}

```


## JSON Dosyaları
### Ders JSON İsimleri
- UNIX-SISTEM-YONETIMI-BIL211U.json
- mobil-uygulama-gelistirme-BIL209U.json
- programlama-2-BIL203U.json
- veri-yapilari-BIL207U.json
- web-arayuz-programlama-BIL205U.json

### Kritik JSON İçerikleri
### version.json

```json
{
  "version": "1.1.47",
  "force_update": true
}
```

### manifest.json

```json
{
    "name": "AÖF Sınav Asistanı",
    "short_name": "SınavAsistanı",
    "description": "Akıllı tekrar sistemi ile AÖF sınavlarına hazırlanın.",
    "start_url": "./",
    "display": "standalone",
    "background_color": "#f8fafc",
    "theme_color": "#2563eb",
    "orientation": "portrait-primary",
    "icons": [
        {
            "src": "assets/icons/icon-192.png",
            "sizes": "192x192",
            "type": "image/png"
        },
        {
            "src": "assets/icons/icon-512.png",
            "sizes": "512x512",
            "type": "image/png"
        }
    ]
}
```

### data/changelog.json

```json
[
  {
    "version": "1.1.33",
    "date": "2025-11-29",
    "items": [
      "Genel iyileştirmeler ve hata düzeltmeleri."
    ]
  },
  {
    "version": "1.1.32",
    "date": "2025-11-28",
    "items": [
      "PWA: In‑App Update Toast eklendi; görünür olduğunda sessiz sürüm kontrolü",
      "UpdateManager semver karşılaştırma ve unregister+cache temizliği ile güncelle"
    ]
  },
  {
    "version": "1.1.31",
    "date": "2025-11-28",
    "items": [
      "Welcome login formuna Ad (Cihaz) alanı eklendi",
      "Login sonrası ad yerelde/sunucuda güncellenir ve push yapılır",
      "Sürüm v1.1.31 ve SW cache adları güncellendi"
    ]
  },
  {
    "version": "1.1.30",
    "date": "2025-11-28",
    "items": [
      "Welcome overlay giriş/kayıt alanları boş ve autocomplete kapalı",
      "Account Info formunda e‑posta/şifre/ad alanları temiz başlar (autocomplete kapalı)",
      "Sürüm v1.1.30 ve SW cache adları güncellendi"
    ]
  },
  {
    "version": "1.1.29",
    "date": "2025-11-28",
    "items": [
      "Kayıt Ol ve Aktar akışında Ad (Cihaz) kullanımı ve sunucuya aktarımı",
      "Verileri Sıfırla: auth_token ve kayıtlı hesaplar temizlenir (gerçek misafir modu)",
      "Sürüm v1.1.29 ve SW cache adları güncellendi"
    ]
  },
  {
    "version": "1.1.28",
    "date": "2025-11-28",
    "items": [
      "Mevcut Hesaba Giriş ve Aktarım formuna Ad (Cihaz) alanı eklendi",
      "Login sonrası ad yerelde ve sunucuda senkronize edilir",
      "Sürüm v1.1.28 ve SW cache adları güncellendi"
    ]
  },
  {
    "version": "1.1.27",
    "date": "2025-11-28",
    "items": [
      "Admin: Hesap Temizleme servisi (listele/sil/toplu sil)",
      "Dashboard: Admin Hesap Temizleme modali",
      "Sürüm v1.1.27 ve SW cache adları güncellendi"
    ]
  },
  {
    "version": "1.1.26",
    "date": "2025-11-28",
    "items": [
      "Auth fallback genişletildi: JSON body içindeki token okunur",
      "Eski istemciler için push/pull me/profile çağrılarında 401 azaltıldı",
      "Sürüm v1.1.26 ve SW cache adları güncellendi"
    ]
  },
  {
    "version": "1.1.25",
    "date": "2025-11-28",
    "items": [
      "Auth fallback: token query param desteği (server+client)",
      "me/profile/push/pull/delete/wipe çağrılarında token hem header hem query ile gönderilir",
      "Sürüm v1.1.25 ve SW cache adları güncellendi"
    ]
  },
  {
    "version": "1.1.24",
    "date": "2025-11-28",
    "items": [
      "Hesap Bilgilerini Güncelle bölümüne Ad (Sunucu) alanı eklendi",
      "Kayıt/Giriş formu başlıkları ile akış ayrımı daha net",
      "Sürüm v1.1.24 ve SW cache adları güncellendi"
    ]
  },
  {
    "version": "1.1.23",
    "date": "2025-11-28",
    "items": [
      "Kayıt mı Giriş mi? Dinamik e‑posta kontrolü ve rehber metin",
      "API: /auth.php?action=exists ile e‑posta var/yok kontrolü",
      "Sürüm v1.1.23 ve SW cache adları güncellendi"
    ]
  },
  {
    "version": "1.1.22",
    "date": "2025-11-28",
    "items": [
      "Hesap Bilgilerini Güncelle: e‑posta/şifre sunucuda değiştir ve lokali senkronize et",
      "API: /auth.php?action=update (email uniq, 409 çakışma)",
      "Sürüm v1.1.22 ve SW cache adları güncellendi"
    ]
  },
  {
    "version": "1.1.21",
    "date": "2025-11-28",
    "items": [
      "Açılışta me() çağrısı kaldırıldı; gereksiz 401 logları temizlendi",
      "Sürüm v1.1.21 ve SW cache adları güncellendi"
    ]
  },
  {
    "version": "1.1.20",
    "date": "2025-11-28",
    "items": [
      "Sunucuya Aktar: token yoksa formdaki e‑posta/şifre ile otomatik giriş",
      "Yetkisiz durumda uyarı ve aktarımı durdurma",
      "Sürüm v1.1.20 ve SW cache adları güncellendi"
    ]
  },
  {
    "version": "1.1.19",
    "date": "2025-11-28",
    "items": [
      "Sync kuyruğu TransactionInactiveError düzeltildi (await-safe işlem)",
      "Oturum yoksa drainSyncQueue çalışmaz (401 logları kesildi)",
      "Sürüm v1.1.19 ve SW cache adları güncellendi"
    ]
  },
  {
    "version": "1.1.18",
    "date": "2025-11-28",
    "items": [
      "Auth header düzeltmesi: REDIRECT_HTTP_AUTHORIZATION ve getallheaders() desteği",
      "401 Unauthorized sorunları giderildi (me/profile/push)",
      "Sürüm v1.1.18 ve SW cache adları güncellendi"
    ]
  },
  {
    "version": "1.1.17",
    "date": "2025-11-28",
    "items": [
      "Merkezi tooltip kontrolü: api/tooltips.php + data/tooltips.json",
      "UI: data-tip anahtarları ile tooltıp uygulaması",
      "Sürüm v1.1.17 ve SW cache adları güncellendi"
    ]
  },
  {
    "version": "1.1.16",
    "date": "2025-11-28",
    "items": [
      "Eksik bilgiler kontrolü: Ad (Cihaz) için alan ve aktarımda güncelleme",
      "Aktarımda sunucudan e‑posta alınır ve hesap listeye eklenir",
      "Sürüm v1.1.16 ve SW cache adları güncellendi"
    ]
  },
  {
    "version": "1.1.15",
    "date": "2025-11-28",
    "items": [
      "Oturum açıkken e‑posta otomatik alınır ve hesap listeye eklenir",
      "Kayıtlı Hesaplar boşsa token ile me() çağrısı ile tohumlama",
      "Sürüm v1.1.15 ve SW cache adları güncellendi"
    ]
  },
  {
    "version": "1.1.14",
    "date": "2025-11-28",
    "items": [
      "Kullanıcı Bilgileri içinde Kayıt Ol/Giriş Yap ve Aktar formu",
      "Aktarım öncesi oturum yoksa form ile oturum açma/oluşturma",
      "Sürüm v1.1.14 ve SW cache adları güncellendi"
    ]
  },
  {
    "version": "1.1.13",
    "date": "2025-11-28",
    "items": [
      "Kullanıcı Bilgileri: Sunucudan Çek butonu eklendi",
      "Push/Pull sonrası modalde yeşil/kırmızı bilgilendirme bandı",
      "Başlıktaki mini hesap etiketi tıklanabilir (Hesaplar açılır)",
      "Sürüm v1.1.13 ve SW cache adları güncellendi"
    ]
  },
  {
    "version": "1.1.12",
    "date": "2025-11-28",
    "items": [
      "Kullanıcı Bilgileri: Sunucuya Aktar butonu ve avantajlar kutusu",
      "API: /auth.php?action=profile ile ad güncelleme",
      "Sürüm v1.1.12 ve SW cache adları güncellendi"
    ]
  },
  {
    "version": "1.1.11",
    "date": "2025-11-28",
    "items": [
      "Başlıkta mini hesap etiketi (Üye/Misafir • e‑posta)",
      "Hesap geçişinde durum pili ve başlık etiketi anında tazelenir",
      "Sürüm v1.1.11 ve SW cache adları güncellendi"
    ]
  },
  {
    "version": "1.1.10",
    "date": "2025-11-28",
    "items": [
      "Girişliyken login/register gizlendi; bilgilendirme metni eklendi",
      "Kayıtlı Hesaplar: Aktif rozet ve Hesap Ekle kısa yolu",
      "Sürüm v1.1.10 ve SW cache adları güncellendi"
    ]
  },
  {
    "version": "1.1.9",
    "date": "2025-11-28",
    "items": [
      "Kayıtlı Hesaplar listesi ve hesaplar arası geçiş",
      "Ayarlar menüsü daha açıklayıcı gruplarla sadeleşti",
      "Manuel Güncelle butonu menü altına taşındı ve yeniden adlandırıldı",
      "Kullanıcı Bilgileri modali; hasToken runtime hesaplaması"
    ]
  },
  {
    "version": "1.1.8",
    "date": "2025-11-28",
    "items": [
      "Ayarlar menüsü sadeleştirildi: Hesap/Veri/Sistem grupları",
      "Kullanıcı Bilgileri modali: Durum, e‑posta, cihaz adı, son senkron",
      "Giriş/Senkron penceresinde durum hesabı runtime hesaplanıyor",
      "Sürüm v1.1.8 ve SW cache adları güncellendi"
    ]
  },
  {
    "version": "1.1.7",
    "date": "2025-11-28",
    "items": [
      "ES module hatası düzeltildi (authManager import satırı temizlendi)",
      "PWA meta etiketi eklendi: mobile-web-app-capable",
      "Sürüm v1.1.7 ve SW cache adları güncellendi"
    ]
  },
  {
    "version": "1.1.6",
    "date": "2025-11-28",
    "items": [
      "Hesap durumu göstergesi: Üye/Misafir • e‑posta • Son Senkron",
      "Auth Sync modali: durum şeridi ve Çıkış Yap butonu",
      "API: /auth.php?action=me ile kullanıcı bilgisi",
      "Profil mağazasında last_sync ve hesap bilgisi saklama"
    ]
  },
  {
    "version": "1.1.5",
    "date": "2025-11-28",
    "items": [
      "Login/Register sonrası otomatik senkron: yerelde veri varsa push, yoksa pull",
      "Ayarlar > Giriş/Senkron penceresi AuthManager üzerinden çalışır (auto push/pull devrede)",
      "Push hatalarında görev otomatik kuyruğa alınır ve çevrimiçi olduğunda gönderilir",
      "Service Worker cache adları ve version.json v1.1.5 ile senkron"
    ]
  },
  {
    "version": "1.1.1",
    "date": "2025-11-26",
    "items": [
      "Onboarding: Token yoksa full-screen karşılama (Login/Register/Local)",
      "Kayıtlı e-posta için 409 uyarısı ve hesap silme",
      "Verileri Sıfırla: Sunucu ve Lokal birlikte temizleniyor"
    ]
  },
  {
    "version": "1.0.4",
    "date": "2025-11-26",
    "items": [
      "Sürüm notları bileşeni eklendi (Ayarlar > Sürüm Notları)",
      "Sürüm ve Service Worker cache adlarının senkron güncellenmesi"
    ]
  },
  {
    "version": "1.0.3",
    "date": "2025-11-26",
    "items": [
      "Sürüm v1.0.3 ve footer sürüm göstergesi",
      "Service Worker cache bölümlendirmesi ve TTL",
      "Dağıtım webhook testi için sürüm artışı"
    ]
  },
  {
    "version": "1.0.2",
    "date": "2025-11-26",
    "items": [
      "QuizUI lazy-loading",
      "IndexedDB indeksleri ve yeni sorgular",
      "Güvenli render (escape) ile XSS azaltımı",
      "UpdateManager ile sürüm kontrol ve temizlik",
      "JSON isteklerinde Stale-While-Revalidate"
    ]
  }
]
```

### data/tooltips.json

```json
{
  "account.info": "Durum, e‑posta ve cihaz adını görüntüler",
  "accounts.manage": "Bu cihazda kayıtlı hesapları yönet",
  "auth.sync": "Giriş/Kayıt ve senkron işlemlerini aç",
  "logout": "Oturumu kapat ve misafir moda dön",
  "delete.account": "Hesabı ve tüm verileri kalıcı sil",
  "reset.all": "Sunucu ve lokal verileri sıfırlar",
  "changelog": "Sürüm notlarını görüntüle",
  "check.update": "Sunucu sürümünü kontrol et",
  "manual.update": "Önbelleği temizleyip uygulamayı yenile",
  "accounts.use": "Bu hesabı aktif yap",
  "accounts.remove": "Hesabı listeden kaldır",
  "push.sync": "Verileri buluta yedekle",
  "pull.sync": "Buluttaki verileri cihaza al",
  "register.push": "Yeni hesap oluştur ve verileri aktar",
  "login.push": "Mevcut hesaba giriş yap ve verileri aktar"
}

```

### data/config.json

```json
{
  "lessons": [
    {
      "name": "Mobil Uygulama Geliştirme",
      "code": "BIL209U",
      "file": "mobil-uygulama-gelistirme-BIL209U.json"
    },
    {
      "name": "Programlama II",
      "code": "BIL203U",
      "file": "programlama-2-BIL203U.json"
    },
    {
      "name": "UNIX Sistem Yönetimi",
      "code": "BIL211U",
      "file": "UNIX-SISTEM-YONETIMI-BIL211U.json"
    },
    {
      "name": "Veri Yapıları",
      "code": "BIL207U",
      "file": "veri-yapilari-BIL207U.json"
    },
    {
      "name": "Web Arayüz Programlama",
      "code": "BIL205U",
      "file": "web-arayuz-programlama-BIL205U.json"
    }
  ]
}
```
