<?php
require __DIR__ . '/auth.php';
require_login();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: index.php');
    exit;
}

$year = isset($_POST['year']) ? (int)$_POST['year'] : 0;
if (!valid_year($year, $config)) {
    header('Location: index.php?error=invalid_year');
    exit;
}

if (!check_csrf((string)($_POST['csrf_token'] ?? ''))) {
    header('Location: year.php?year=' . $year . '&error=csrf');
    exit;
}

if (!isset($_FILES['modeling_file']) || $_FILES['modeling_file']['error'] !== UPLOAD_ERR_OK) {
    header('Location: year.php?year=' . $year . '&error=upload_failed');
    exit;
}

$tmpPath = $_FILES['modeling_file']['tmp_name'];
if (!is_uploaded_file($tmpPath)) {
    header('Location: year.php?year=' . $year . '&error=upload_failed');
    exit;
}

$originalName = basename($_FILES['modeling_file']['name']);
// 파일명에는 영문/숫자/한글/점/하이픈/언더스코어만 허용 (경로 조작 방지)
$safeName = preg_replace('/[^A-Za-z0-9._\-\x{AC00}-\x{D7A3}]/u', '_', $originalName);
$safeName = trim($safeName, '.');
if ($safeName === '') {
    $safeName = 'file_' . time();
}

$yearDir = $config['upload_dir'] . '/' . $year;
if (!is_dir($yearDir)) {
    mkdir($yearDir, 0775, true);
}

$destPath = $yearDir . '/' . $safeName;
if (file_exists($destPath)) {
    $pathInfo = pathinfo($safeName);
    $ext = isset($pathInfo['extension']) && $pathInfo['extension'] !== '' ? '.' . $pathInfo['extension'] : '';
    $base = $pathInfo['filename'];
    $destPath = $yearDir . '/' . $base . '_' . date('Ymd_His') . $ext;
}

if (!move_uploaded_file($tmpPath, $destPath)) {
    header('Location: year.php?year=' . $year . '&error=save_failed');
    exit;
}

header('Location: year.php?year=' . $year . '&ok=1');
exit;
