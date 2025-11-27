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
