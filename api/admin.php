<?php
require __DIR__ . '/db.php';
require __DIR__ . '/admin_boot.php';
// Basit admin auth: Cookie oturumu (tercih), Basic Authorization (opsiyonel) veya body'de username/password (login için)
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
$a = $_GET['action'] ?? '';
header('Content-Type: application/json');
if ($a === 'admin_diag') {
    try {
        $privateDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'private';
        $cfgPath = $privateDir . DIRECTORY_SEPARATOR . 'admin.json';
        $writable = is_writable($privateDir);
        $exists = is_dir($privateDir);
        $dbPath = isset($DB_PATH) ? $DB_PATH : '';
        $pdoOk = false; try { $pdo->query('SELECT 1'); $pdoOk = true; } catch(Exception $e) { $pdoOk = false; }
        $sessTbl = false; try { $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='admin_sessions'"); $sessTbl = true; } catch(Exception $e) { $sessTbl = false; }
        $writeTest = false; $testFile = $privateDir . DIRECTORY_SEPARATOR . 'diag_test.txt';
        try { @file_put_contents($testFile, 'ok'); $writeTest = file_exists($testFile); if ($writeTest) @unlink($testFile); } catch(Exception $e) { $writeTest = false; }
        $adminJsonOk = file_exists($cfgPath);
        ok([
            'private_exists' => $exists,
            'private_writable' => $writable,
            'admin_json_exists' => $adminJsonOk,
            'db_path' => $dbPath,
            'pdo_ok' => $pdoOk,
            'admin_sessions_table' => $sessTbl,
            'write_test' => $writeTest,
        ]);
    } catch(Exception $e) {
        err(500,'server_error');
    }
    exit;
}
if ($a === 'admin_login') {
    $in = json(); $u = $in['username'] ?? ''; $p = $in['password'] ?? '';
    try {
        if ($u === $ADMIN_USER && password_verify($p, $ADMIN_PASS_HASH)) {
            $token = secure_token(24);
            $pdo->prepare('INSERT INTO admin_sessions(token,created_at) VALUES(?,?)')->execute([$token, time()]);
            // Cookie path uygulama köküne ayarlandı
            setcookie('admin_session', $token, time()+86400, '/aof-sinav-v2/', '', true, true);
            ok(['login'=>true]);
        } else { err(401,'unauth'); }
    } catch(Exception $e) {
        @file_put_contents($LOG_FILE, '['.date('c').'] '.$e->getMessage()."\n", FILE_APPEND);
        err(500,'server_error');
    }
    exit;
}
if (!adminAuthorized($pdo, $ADMIN_USER, $ADMIN_PASS_HASH)) { http_response_code(401); header('Content-Type: application/json'); echo json_encode(['ok'=>false,'error'=>'unauth']); exit; }
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
    // Silinen kullanıcının tüm verilerini de temizle
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
    $path = $DB_PATH;
    $exists = file_exists($path);
    $size = $exists ? filesize($path) : 0;
    $mtime = $exists ? filemtime($path) : 0;
    $tables = $pdo->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(PDO::FETCH_COLUMN);
    $counts = [];
    foreach(['users','sessions','progress','user_stats','exam_history'] as $t){
        try { $counts[$t] = (int)$pdo->query("SELECT COUNT(*) FROM $t")->fetchColumn(); } catch(Exception $e){ $counts[$t] = 0; }
    }
    ok(['path'=>$path,'exists'=>$exists,'size'=>$size,'mtime'=>$mtime,'tables'=>$tables,'counts'=>$counts]);
} else { err(404,'notfound'); }
} elseif ($a === 'admin_logout') {
    $tok = $_COOKIE['admin_session'] ?? '';
    if ($tok) { $pdo->prepare('DELETE FROM admin_sessions WHERE token=?')->execute([$tok]); setcookie('admin_session','', time()-3600, '/'); }
    ok(['logout'=>true]);
$LOG_DIR = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'private';
$LOG_FILE = $LOG_DIR . DIRECTORY_SEPARATOR . 'admin_error.log';
if (!is_dir($LOG_DIR)) { @mkdir($LOG_DIR, 0775, true); }
function secure_token($len=24){
    if (function_exists('random_bytes')) { return bin2hex(random_bytes($len)); }
    if (function_exists('openssl_random_pseudo_bytes')) { return bin2hex(openssl_random_pseudo_bytes($len)); }
    return bin2hex(substr(str_shuffle('abcdefghijklmnopqrstuvwxyz0123456789'),0,$len));
}
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
$dirWritable = true;
try {
    $dbDir = dirname($DB_PATH ?? '');
    if (!is_dir($dbDir)) { @mkdir($dbDir, 0775, true); }
    if (!is_writable($dbDir)) { $dirWritable = false; }
} catch(Exception $e) { $dirWritable = false; }
if (!$pdo || ($DB_DRIVER === 'sqlite' && !$dirWritable)) {
    $msg = [];
    if (!$pdo) { $msg['pdo_error'] = isset($PDO_ERROR) ? $PDO_ERROR : 'pdo_init_failed'; }
    if ($DB_DRIVER === 'sqlite' && !$dirWritable) { $msg['dir_writable'] = false; $msg['db_dir'] = $dbDir; }
    err(500, json_encode($msg));
    exit;
}
