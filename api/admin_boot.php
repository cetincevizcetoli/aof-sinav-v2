<?php
$ADMIN_USER = 'admin';
$ADMIN_PASS_HASH = password_hash('5211@Admin', PASSWORD_DEFAULT);
$privateDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'private';
$cfgPath = $privateDir . DIRECTORY_SEPARATOR . 'admin.json';
if (!is_dir($privateDir)) { @mkdir($privateDir, 0775, true); }
if (file_exists($cfgPath)) {
    $raw = @file_get_contents($cfgPath);
    $j = $raw ? json_decode($raw, true) : null;
    if (is_array($j) && !empty($j['user']) && !empty($j['pass_hash'])) {
        $ADMIN_USER = $j['user'];
        $ADMIN_PASS_HASH = $j['pass_hash'];
    }
} else {
    @file_put_contents($cfgPath, json_encode(['user'=>$ADMIN_USER, 'pass_hash'=>$ADMIN_PASS_HASH]));
}
