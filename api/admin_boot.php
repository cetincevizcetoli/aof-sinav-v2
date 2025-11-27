<?php
$ADMIN_USER = 'admin';
$ADMIN_PASS_HASH = password_hash('5211@Admin', PASSWORD_DEFAULT);
$cfgPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'private' . DIRECTORY_SEPARATOR . 'admin.json';
if (file_exists($cfgPath)) {
    $j = json_decode(@file_get_contents($cfgPath), true);
    if (is_array($j) && !empty($j['user']) && !empty($j['pass_hash'])) {
        $ADMIN_USER = $j['user'];
        $ADMIN_PASS_HASH = $j['pass_hash'];
    }
} else {
    @file_put_contents($cfgPath, json_encode(['user'=>$ADMIN_USER, 'pass_hash'=>$ADMIN_PASS_HASH]));
}
