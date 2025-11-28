<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache');
$file = __DIR__ . '/../data/tooltips.json';
if (!file_exists($file)) { echo json_encode([]); exit; }
$json = file_get_contents($file);
echo $json !== false ? $json : json_encode([]);
