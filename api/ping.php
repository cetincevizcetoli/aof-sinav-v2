<?php
require_once __DIR__.'/config.php';
header('Content-Type: application/json');
header('Cache-Control: no-store');
$out = [ 'ok'=>true, 'db'=>false, 'users'=>null ];
$mysqli = @new mysqli($DB_HOST,$DB_USER,$DB_PASS,$DB_NAME);
if (!$mysqli || $mysqli->connect_errno) {
  http_response_code(500);
  echo json_encode([ 'ok'=>false, 'error'=>'db_connect_failed', 'code'=>$mysqli ? $mysqli->connect_errno : -1 ]);
  exit;
}
$mysqli->set_charset('utf8mb4');
$out['db'] = true;
$res = $mysqli->query('SELECT COUNT(*) AS c FROM users');
if ($res) { $row = $res->fetch_assoc(); $out['users'] = (int)($row['c']??0); }
echo json_encode($out);
?>

