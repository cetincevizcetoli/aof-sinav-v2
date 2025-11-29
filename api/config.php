<?php
// Simple config loader for MySQL and app secret
function env_load($path){
  if (!is_file($path)) return [];
  $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
  $vars = [];
  foreach($lines as $line){
    if (strpos(trim($line),'#')===0) continue;
    $pos = strpos($line,'=');
    if ($pos===false) continue;
    $k = trim(substr($line,0,$pos));
    $v = trim(substr($line,$pos+1));
    $vars[$k] = $v;
  }
  return $vars;
}

$env = env_load(__DIR__.'/../.env');
$DB_HOST = $env['DB_HOST'] ?? getenv('DB_HOST') ?? '127.0.0.1';
$DB_NAME = $env['DB_NAME'] ?? getenv('DB_NAME') ?? 'aof_sinav_v2';
$DB_USER = $env['DB_USER'] ?? getenv('DB_USER') ?? 'root';
$DB_PASS = $env['DB_PASS'] ?? getenv('DB_PASS') ?? '';
$APP_SECRET = $env['APP_SECRET'] ?? getenv('APP_SECRET') ?? 'aof-secret-please-change';

function db(){
  global $DB_HOST,$DB_NAME,$DB_USER,$DB_PASS;
  $mysqli = @new mysqli($DB_HOST,$DB_USER,$DB_PASS,$DB_NAME);
  if ($mysqli && !$mysqli->connect_errno) {
    $mysqli->set_charset('utf8mb4');
    return $mysqli;
  }
  http_response_code(500);
  echo json_encode([ 'ok'=>false, 'error'=>'db_connect_failed' ]);
  exit;
}

function token_make($email,$password_hash){
  global $APP_SECRET;
  $payload = base64_encode($email);
  $sig = hash('sha256', $email.$password_hash.$APP_SECRET);
  return $payload.'.'.$sig;
}

function token_parse($token){
  $parts = explode('.', $token);
  if (count($parts) !== 2) return null;
  return [ 'email' => base64_decode($parts[0] ?? ''), 'sig' => $parts[1] ?? '' ];
}

function token_verify($token){
  $info = token_parse($token);
  if (!$info || !$info['email']) return false;
  $mysqli = db();
  $stmt = $mysqli->prepare('SELECT password_hash,name FROM users WHERE email=? LIMIT 1');
  $stmt->bind_param('s', $info['email']);
  $stmt->execute();
  $res = $stmt->get_result();
  $row = $res ? $res->fetch_assoc() : null;
  if (!$row) return false;
  global $APP_SECRET;
  $expected = hash('sha256', $info['email'].$row['password_hash'].$APP_SECRET);
  return hash_equals($expected, $info['sig']) ? [ 'email'=>$info['email'], 'name'=>$row['name']??'' ] : false;
}

function json_out($data){ header('Content-Type: application/json'); echo json_encode($data, JSON_UNESCAPED_UNICODE); }
?>

