<?php
require __DIR__ . '/db.php';
// Basit admin auth: Basic Authorization veya body'de username/password
$ADMIN_USER = getenv('ADMIN_USER') ?: 'admin';
$ADMIN_PASS = getenv('ADMIN_PASS') ?: '5211@Admin';
function adminAuthorized($ADMIN_USER, $ADMIN_PASS){
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (stripos($auth, 'Basic ') === 0) {
        $dec = base64_decode(substr($auth, 6));
        if ($dec !== false) {
            [$u, $p] = array_pad(explode(':', $dec, 2), 2, '');
            if ($u === $ADMIN_USER && $p === $ADMIN_PASS) return true;
        }
    }
    $in = json_decode(file_get_contents('php://input'), true) ?: [];
    if (($in['username'] ?? '') === $ADMIN_USER && ($in['password'] ?? '') === $ADMIN_PASS) return true;
    return false;
}
if (!adminAuthorized($ADMIN_USER, $ADMIN_PASS)) { http_response_code(401); header('Content-Type: application/json'); echo json_encode(['ok'=>false,'error'=>'unauth']); exit; }

$a = $_GET['action'] ?? '';
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
