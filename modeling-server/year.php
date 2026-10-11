<?php
require __DIR__ . '/auth.php';
require_login();

$year = isset($_GET['year']) ? (int)$_GET['year'] : 0;
if (!valid_year($year, $config)) {
    http_response_code(404);
    exit('잘못된 연도입니다.');
}

$yearDir = $config['upload_dir'] . '/' . $year;
if (!is_dir($yearDir)) {
    mkdir($yearDir, 0775, true);
}

$files = array_values(array_diff(scandir($yearDir), ['.', '..']));
// .htaccess 등 숨김 파일은 목록에서 제외
$files = array_values(array_filter($files, static fn($f) => $f[0] !== '.'));
sort($files);

$errorMessages = [
    'csrf'          => '요청이 올바르지 않습니다. 새로고침 후 다시 시도해주세요.',
    'upload_failed' => '파일 업로드에 실패했습니다.',
    'save_failed'   => '파일을 저장하는 중 오류가 발생했습니다.',
    'invalid_year'  => '잘못된 연도입니다.',
];
$errorKey = $_GET['error'] ?? '';
$error = $errorMessages[$errorKey] ?? '';
$ok = isset($_GET['ok']);

$token = csrf_token();
?>
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title><?= (int)$year ?> Modeling 자료 — KMTNet</title>
<link rel="stylesheet" href="style.css" />
</head>
<body>
<div class="wrap">
  <div class="topnav">
    <h1><?= (int)$year ?>년 Modeling 자료</h1>
    <a class="logout" href="logout.php">로그아웃</a>
  </div>
  <p><a href="index.php">← 연도 목록으로</a></p>

  <div class="card">
    <?php if ($error !== ''): ?>
      <p class="error"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></p>
    <?php endif; ?>
    <?php if ($ok): ?>
      <p class="ok">파일이 업로드되었습니다.</p>
    <?php endif; ?>
    <form method="post" action="upload.php" enctype="multipart/form-data">
      <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($token, ENT_QUOTES, 'UTF-8') ?>" />
      <input type="hidden" name="year" value="<?= (int)$year ?>" />
      <label for="modeling_file">파일 선택</label>
      <input type="file" id="modeling_file" name="modeling_file" required />
      <button type="submit">업로드</button>
    </form>
  </div>

  <div class="card">
    <h2 style="font-size:1.05rem;margin-top:0;">업로드된 파일 (<?= count($files) ?>)</h2>
    <?php if (empty($files)): ?>
      <p>아직 업로드된 파일이 없습니다.</p>
    <?php else: ?>
      <table>
        <thead><tr><th>파일명</th><th></th></tr></thead>
        <tbody>
        <?php foreach ($files as $f): ?>
          <tr>
            <td><?= htmlspecialchars($f, ENT_QUOTES, 'UTF-8') ?></td>
            <td><a href="download.php?year=<?= (int)$year ?>&file=<?= urlencode($f) ?>">다운로드</a></td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    <?php endif; ?>
  </div>
</div>
</body>
</html>
