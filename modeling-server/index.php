<?php
require __DIR__ . '/auth.php';
require_login();
?>
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Modeling 자료실 — KMTNet</title>
<link rel="stylesheet" href="style.css" />
</head>
<body>
<div class="wrap">
  <div class="topnav">
    <h1>Modeling 자료실</h1>
    <a class="logout" href="logout.php">로그아웃</a>
  </div>
  <p>연도를 선택하면 해당 연도의 모델링 자료를 올리거나 내려받을 수 있습니다.</p>
  <div class="year-grid">
    <?php for ($y = $config['max_year']; $y >= $config['min_year']; $y--): ?>
      <a href="year.php?year=<?= (int)$y ?>"><?= (int)$y ?></a>
    <?php endfor; ?>
  </div>
</div>
</body>
</html>
