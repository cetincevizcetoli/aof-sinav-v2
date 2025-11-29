<?php
require_once __DIR__.'/config.php';
header('Content-Type: application/json');
header('Cache-Control: no-store');

$action = $_GET['action'] ?? '';
$mysqli = db();

if ($action === 'login') {
  $body = json_decode(file_get_contents('php://input'), true) ?: [];
  $email = trim($body['email'] ?? '');
  $pass = trim($body['password'] ?? '');
  $stmt = $mysqli->prepare('SELECT id,password_hash,name FROM users WHERE email=? LIMIT 1');
  $stmt->bind_param('s', $email);
  $stmt->execute();
  $res = $stmt->get_result();
  $row = $res ? $res->fetch_assoc() : null;
  if (!$row) { http_response_code(404); json_out([ 'ok'=>false, 'error'=>'user_not_found' ]); exit; }
  if (!password_verify($pass, $row['password_hash'])) { http_response_code(401); json_out([ 'ok'=>false, 'error'=>'bad_password' ]); exit; }
  $token = token_make($email, $row['password_hash']);
  json_out([ 'ok'=>true, 'data'=>[ 'token'=>$token, 'email'=>$email, 'name'=>$row['name']??'' ] ]); exit;
}

if ($action === 'me') {
  $token = $_GET['token'] ?? '';
  $v = token_verify($token);
  if (!$v) { http_response_code(401); json_out([ 'ok'=>false ]); exit; }
  json_out([ 'ok'=>true, 'data'=>[ 'email'=>$v['email'], 'name'=>$v['name'] ] ]); exit;
}

if ($action === 'profile') {
  $token = $_GET['token'] ?? '';
  $v = token_verify($token);
  if (!$v) { http_response_code(401); json_out([ 'ok'=>false ]); exit; }
  $body = json_decode(file_get_contents('php://input'), true) ?: [];
  $name = trim($body['name'] ?? '');
  if ($name !== '') {
    $stmt = $mysqli->prepare('UPDATE users SET name=? WHERE email=?');
    $stmt->bind_param('ss', $name, $v['email']);
    $stmt->execute();
  }
  json_out([ 'ok'=>true ]); exit;
}

if ($action === 'exists') {
  $body = json_decode(file_get_contents('php://input'), true) ?: [];
  $email = trim($body['email'] ?? '');
  $stmt = $mysqli->prepare('SELECT 1 FROM users WHERE email=? LIMIT 1');
  $stmt->bind_param('s', $email);
  $stmt->execute();
  $res = $stmt->get_result();
  $exists = $res && $res->num_rows > 0;
  json_out([ 'ok'=>true, 'data'=>[ 'exists'=>$exists ] ]); exit;
}

http_response_code(404);
json_out([ 'ok'=>false, 'error'=>'not_found' ]);
?>

