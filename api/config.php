<?php
$DB_PATH = getenv('AOF_DB_PATH') ?: dirname(__DIR__) . DIRECTORY_SEPARATOR . 'private' . DIRECTORY_SEPARATOR . 'aof_sinav.sqlite';
$SECRET = getenv('AOF_API_SECRET') ?: 'change_this_secret';
if (!is_dir(dirname($DB_PATH))) { @mkdir(dirname($DB_PATH), 0777, true); }
