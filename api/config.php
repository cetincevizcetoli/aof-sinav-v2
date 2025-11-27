<?php
$DB_DRIVER = getenv('AOF_DB_DRIVER') ?: 'mysql';

// PostgreSQL
$PG_HOST = getenv('AOF_PG_HOST') ?: 'localhost';
$PG_PORT = getenv('AOF_PG_PORT') ?: '5432';
$PG_DB   = getenv('AOF_PG_DB')   ?: 'ahmetcetin__aof';
$PG_USER = getenv('AOF_PG_USER') ?: 'ahmetcetin__aof';
$PG_PASS = getenv('AOF_PG_PASS') ?: '5211@Admin';
$PG_DSN  = "pgsql:host=$PG_HOST;port=$PG_PORT;dbname=$PG_DB";

// MariaDB / MySQL
$MY_HOST = getenv('AOF_MY_HOST') ?: 'localhost';
$MY_PORT = getenv('AOF_MY_PORT') ?: '3306';
$MY_DB   = getenv('AOF_MY_DB')   ?: 'ahmetcetin__aof';
$MY_USER = getenv('AOF_MY_USER') ?: 'ahmetcetin__aof';
$MY_PASS = getenv('AOF_MY_PASS') ?: '5211@Admin';
$MY_DSN  = "mysql:host=$MY_HOST;port=$MY_PORT;dbname=$MY_DB;charset=utf8mb4";

$DB_PATH = getenv('AOF_DB_PATH') ?: dirname(__DIR__) . DIRECTORY_SEPARATOR . 'private' . DIRECTORY_SEPARATOR . 'aof_sinav.sqlite';
$SECRET = getenv('AOF_API_SECRET') ?: 'change_this_secret';
if (!is_dir(dirname($DB_PATH))) { @mkdir(dirname($DB_PATH), 0777, true); }
