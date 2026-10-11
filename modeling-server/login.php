<?php
require __DIR__ . '/auth.php';

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!check_csrf($_POST['csrf_token'] ?? '')) {
        $error = '요청이 올바르지 않습니다. 새로고침 후 다시 시도해주세요.';
    } elseif (password_verify((string)($_POST['password'] ?? ''), $config['password_hash'])) {
        session_regenerate_id(true);
        $_SESSION['modeler_authenticated'] = true;
        header('Location: index.php');
        exit;
    } else {
        $error = '비밀번호가 올바르지 않습니다.';
    }
}

$token = csrf_token();
?>
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Modeling Login — KMTNet</title>
<link rel="stylesheet" href="style.css" />
</head>
<body>
<div class="wrap">
  <h1>KMTNet Modeling 자료실</h1>
  <div class="card">
    <?php if ($error !== ''): ?>
      <p class="error"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></p>
    <?php endif; ?>
    <form method="post" action="login.php">
      <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($token, ENT_QUOTES, 'UTF-8') ?>" />
      <label for="password">비밀번호</label>
      <input type="password" id="password" name="password" autofocus required />
      <button type="submit">입장</button>
    </form>
  </div>
</div>
</body>
</html>
