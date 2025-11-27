<?php
require __DIR__ . '/config.php';
$PDO_ERROR = null;
try {
    $pdo = new PDO('sqlite:' . $DB_PATH);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(Exception $e) {
    $pdo = null;
    $PDO_ERROR = $e->getMessage();
}
if ($pdo) {
    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, password_hash TEXT, created_at INTEGER)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER, created_at INTEGER, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS progress (id TEXT PRIMARY KEY, user_id INTEGER, lesson TEXT, unit INTEGER, level INTEGER, nextReview INTEGER, correct INTEGER, wrong INTEGER, updated_at INTEGER, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS user_stats (user_id INTEGER PRIMARY KEY, xp INTEGER, streak INTEGER, totalQuestions INTEGER, updated_at INTEGER, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS exam_history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, date INTEGER, lesson TEXT, unit INTEGER, isCorrect INTEGER, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)');
}
function json(){ return json_decode(file_get_contents('php://input'), true) ?: []; }
function ok($d){ header('Content-Type: application/json'); echo json_encode(['ok'=>true,'data'=>$d]); }
function err($c,$m){ http_response_code($c); header('Content-Type: application/json'); echo json_encode(['ok'=>false,'error'=>$m]); }
function token_user($pdo,$SECRET){ $h = $_SERVER['HTTP_AUTHORIZATION'] ?? ''; if (strpos($h,'Bearer ')!==0) return 0; $t = substr($h,7); $st = $pdo->prepare('SELECT user_id FROM sessions WHERE token=?'); $st->execute([$t]); $r = $st->fetch(PDO::FETCH_ASSOC); return $r ? intval($r['user_id']) : 0; }
$checkCols = $pdo ? $pdo->query("PRAGMA table_info(users)")->fetchAll(PDO::FETCH_ASSOC) : [];
$hasName = false; foreach ($checkCols as $c) { if (strtolower($c['name']) === 'name') { $hasName = true; break; } }
if ($pdo && !$hasName) { try { $pdo->exec('ALTER TABLE users ADD COLUMN name TEXT'); } catch(Exception $e){} }
if ($pdo) { $pdo->exec('CREATE TABLE IF NOT EXISTS admin_sessions (token TEXT PRIMARY KEY, created_at INTEGER)'); }
