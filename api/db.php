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
