<?php
require __DIR__ . '/auth.php';
require_login();

$year = isset($_GET['year']) ? (int)$_GET['year'] : 0;
$file = isset($_GET['file']) ? (string)$_GET['file'] : '';

if (!valid_year($year, $config) || $file === '') {
    http_response_code(400);
    exit('잘못된 요청입니다.');
}

// 경로 조작 방지: 파일명에 경로 구분자가 섞여 들어오는 것을 금지
if (strpos($file, '/') !== false || strpos($file, '\\') !== false || $file === '.' || $file === '..') {
    http_response_code(400);
    exit('잘못된 파일명입니다.');
}

$baseDir = realpath($config['upload_dir'] . '/' . $year);
$path = $baseDir !== false ? realpath($baseDir . '/' . $file) : false;

if ($baseDir === false || $path === false || strpos($path, $baseDir . DIRECTORY_SEPARATOR) !== 0 || !is_file($path)) {
    http_response_code(404);
    exit('파일을 찾을 수 없습니다.');
}

header('Content-Description: File Transfer');
header('Content-Type: application/octet-stream');
header('Content-Disposition: attachment; filename="' . basename($path) . '"');
header('Content-Length: ' . filesize($path));
header('Cache-Control: no-store');
readfile($path);
exit;
