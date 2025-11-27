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
    $pdo->prepare('INSERT OR REPLACE INTO sessions(token,user_id,created_at) VALUES(?,?,?)')->execute([$token,$u['id'],time()]);
    ok(['token'=>$token]);
} else { err(404,'notfound'); }
