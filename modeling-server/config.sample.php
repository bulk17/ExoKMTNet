<?php
// 배포 시: 이 파일을 config.php 로 복사한 뒤 아래 값을 실제 값으로 바꾸세요.
// config.php 는 git에 올라가지 않습니다 (.gitignore 처리됨) — 비밀번호 해시가
// 공개 저장소에 들어가지 않도록 반드시 서버에서 직접 config.php 를 만드세요.
//
// 비밀번호 해시 생성 방법 (서버에서 실행):
//   php -r "echo password_hash('원하는비번', PASSWORD_DEFAULT), PHP_EOL;"
// 위 명령으로 나온 문자열을 password_hash 값에 붙여넣으세요.

return [
    'password_hash' => 'REPLACE_WITH_PASSWORD_HASH_OUTPUT',
    'upload_dir'    => __DIR__ . '/uploads',
    'min_year'      => 2016,
    'max_year'      => 2026,
];
