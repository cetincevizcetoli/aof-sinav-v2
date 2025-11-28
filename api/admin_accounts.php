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
