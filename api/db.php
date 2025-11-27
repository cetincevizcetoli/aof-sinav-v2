<?php
require __DIR__ . '/config.php';
$PDO_ERROR = null;
try {
    if ($DB_DRIVER === 'pgsql') {
        $pdo = new PDO($PG_DSN, $PG_USER, $PG_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    } elseif ($DB_DRIVER === 'mysql') {
        $pdo = new PDO($MY_DSN, $MY_USER, $MY_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    } else {
        $pdo = new PDO('sqlite:' . $DB_PATH);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    }
} catch(Exception $e) {
    $pdo = null;
    $PDO_ERROR = $e->getMessage();
}
if ($pdo) {
    if ($DB_DRIVER === 'pgsql') {
        $pdo->exec('CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email TEXT UNIQUE, password_hash TEXT, name TEXT, created_at BIGINT)');
        $pdo->exec('CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER, created_at BIGINT)');
        $pdo->exec('CREATE TABLE IF NOT EXISTS progress (id TEXT PRIMARY KEY, user_id INTEGER, lesson TEXT, unit INTEGER, level INTEGER, nextReview BIGINT, correct INTEGER, wrong INTEGER, updated_at BIGINT)');
        $pdo->exec('CREATE TABLE IF NOT EXISTS user_stats (user_id INTEGER PRIMARY KEY, xp INTEGER, streak INTEGER, totalQuestions INTEGER, updated_at BIGINT)');
        $pdo->exec('CREATE TABLE IF NOT EXISTS exam_history (id SERIAL PRIMARY KEY, user_id INTEGER, date BIGINT, lesson TEXT, unit INTEGER, isCorrect INTEGER)');
        $pdo->exec('CREATE TABLE IF NOT EXISTS admin_sessions (token TEXT PRIMARY KEY, created_at BIGINT)');
    } elseif ($DB_DRIVER === 'mysql') {
        $pdo->exec('CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(255) UNIQUE, password_hash VARCHAR(255), name VARCHAR(255), created_at BIGINT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
        $pdo->exec('CREATE TABLE IF NOT EXISTS sessions (token VARCHAR(255) PRIMARY KEY, user_id INT, created_at BIGINT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
        $pdo->exec('CREATE TABLE IF NOT EXISTS progress (id VARCHAR(255) PRIMARY KEY, user_id INT, lesson VARCHAR(255), unit INT, level INT, nextReview BIGINT, correct INT, wrong INT, updated_at BIGINT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
        $pdo->exec('CREATE TABLE IF NOT EXISTS user_stats (user_id INT PRIMARY KEY, xp INT, streak INT, totalQuestions INT, updated_at BIGINT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
        $pdo->exec('CREATE TABLE IF NOT EXISTS exam_history (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT, date BIGINT, lesson VARCHAR(255), unit INT, isCorrect TINYINT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
        $pdo->exec('CREATE TABLE IF NOT EXISTS admin_sessions (token VARCHAR(255) PRIMARY KEY, created_at BIGINT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    } else {
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, password_hash TEXT, name TEXT, created_at INTEGER)');
        $pdo->exec('CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER, created_at INTEGER, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)');
        $pdo->exec('CREATE TABLE IF NOT EXISTS progress (id TEXT PRIMARY KEY, user_id INTEGER, lesson TEXT, unit INTEGER, level INTEGER, nextReview INTEGER, correct INTEGER, wrong INTEGER, updated_at INTEGER, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)');
        $pdo->exec('CREATE TABLE IF NOT EXISTS user_stats (user_id INTEGER PRIMARY KEY, xp INTEGER, streak INTEGER, totalQuestions INTEGER, updated_at INTEGER, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)');
        $pdo->exec('CREATE TABLE IF NOT EXISTS exam_history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, date INTEGER, lesson TEXT, unit INTEGER, isCorrect INTEGER, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)');
        $pdo->exec('CREATE TABLE IF NOT EXISTS admin_sessions (token TEXT PRIMARY KEY, created_at INTEGER)');
    }
}
function json(){ return json_decode(file_get_contents('php://input'), true) ?: []; }
function ok($d){ header('Content-Type: application/json'); echo json_encode(['ok'=>true,'data'=>$d]); }
function err($c,$m){ http_response_code($c); header('Content-Type: application/json'); echo json_encode(['ok'=>false,'error'=>$m]); }
function token_user($pdo,$SECRET){ $h = $_SERVER['HTTP_AUTHORIZATION'] ?? ''; if (strpos($h,'Bearer ')!==0) return 0; $t = substr($h,7); $st = $pdo->prepare('SELECT user_id FROM sessions WHERE token=?'); $st->execute([$t]); $r = $st->fetch(PDO::FETCH_ASSOC); return $r ? intval($r['user_id']) : 0; }
if ($pdo && $DB_DRIVER === 'sqlite') {
    $checkCols = $pdo->query("PRAGMA table_info(users)")->fetchAll(PDO::FETCH_ASSOC);
    $hasName = false; foreach ($checkCols as $c) { if (strtolower($c['name']) === 'name') { $hasName = true; break; } }
    if (!$hasName) { try { $pdo->exec('ALTER TABLE users ADD COLUMN name TEXT'); } catch(Exception $e){} }
}
