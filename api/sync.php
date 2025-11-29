<?php
require_once __DIR__.'/config.php';
header('Content-Type: application/json');
header('Cache-Control: no-store');

$action = $_GET['action'] ?? '';
$token = $_GET['token'] ?? '';
$v = token_verify($token);
if (!$v) { http_response_code(401); echo json_encode([ 'ok'=>false ]); exit; }
$email = $v['email'];

$storeDir = __DIR__.'/../data/backups';
if (!is_dir($storeDir)) @mkdir($storeDir, 0775, true);
$file = $storeDir.'/'.str_replace(['/','\\'], '_', $email).'.json';

if ($action === 'push') {
  $body = json_decode(file_get_contents('php://input'), true) ?: [];
  $payload = [
    'progress' => $body['progress'] ?? [],
    'stats'    => $body['stats'] ?? [],
    'history'  => $body['history'] ?? [],
    'sessions' => $body['sessions'] ?? [],
    'last_server_update' => time()*1000,
  ];
  file_put_contents($file, json_encode([ 'ok'=>true, 'data'=>$payload ], JSON_UNESCAPED_UNICODE));
  echo json_encode([ 'ok'=>true ]); exit;
}

if ($action === 'pull') {
  if (!is_file($file)) { echo json_encode([ 'ok'=>true, 'data'=>[ 'progress'=>[], 'stats'=>[ 'xp'=>0, 'streak'=>0, 'totalQuestions'=>0, 'updated_at'=>0 ], 'history'=>[], 'sessions'=>[], 'reset_at'=>0, 'last_server_update'=>0 ] ]); exit; }
  $j = json_decode(file_get_contents($file), true);
  if (!$j) { echo json_encode([ 'ok'=>true, 'data'=>[ 'progress'=>[], 'stats'=>[ 'xp'=>0, 'streak'=>0, 'totalQuestions'=>0, 'updated_at'=>0 ], 'history'=>[], 'sessions'=>[], 'reset_at'=>0, 'last_server_update'=>0 ] ]); exit; }
  echo json_encode($j); exit;
}

if ($action === 'wipe') {
  if (is_file($file)) @unlink($file);
  echo json_encode([ 'ok'=>true ]); exit;
}

http_response_code(404);
echo json_encode([ 'ok'=>false, 'error'=>'not_found' ]);
?>

