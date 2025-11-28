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
