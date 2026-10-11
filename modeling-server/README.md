# KMTNet Modeling 자료실 (서버 배포용)

KMTNet 모델러만 비밀번호로 접속해서 연도별(2016–2026) 모델링 결과 파일을
올리고 내려받을 수 있는 작은 PHP 앱입니다. 홈페이지(GitHub Pages)는 정적
사이트라 로그인/업로드를 직접 처리할 수 없어서, 별도의 서버(Apache +
PHP)에 이 폴더를 올려서 운영합니다.

## 1. 서버에 PHP 설치 (lens03 서버 기준, CentOS/RHEL)

```bash
sudo yum install -y php php-common
php -v
```

## 2. 이 폴더를 서버로 복사

로컬에서 체크아웃한 저장소의 `modeling-server/` 폴더 전체를 서버의 웹 루트
아래로 복사합니다 (예: `/var/www/html/modeling`).

```bash
scp -r modeling-server/ user@lens03:/var/www/html/modeling
```

## 3. 비밀번호 설정

서버에서 비밀번호 해시를 생성합니다:

```bash
php -r "echo password_hash('모델러들에게_알려줄_비밀번호', PASSWORD_DEFAULT), PHP_EOL;"
```

`config.sample.php` 를 `config.php` 로 복사하고, 위에서 나온 해시 값을
`password_hash` 에 붙여넣습니다. **config.php는 절대 git에 커밋하지 마세요**
(이미 `.gitignore`에 등록되어 있습니다 — 공개 저장소에 비밀번호 해시가
올라가지 않도록 하기 위함입니다).

```bash
cd /var/www/html/modeling
cp config.sample.php config.php
vi config.php   # password_hash 값 채우기
```

## 4. 업로드 폴더 권한 설정

Apache(웹서버 프로세스)가 `uploads/` 폴더에 파일을 쓸 수 있어야 합니다.
Apache를 실행하는 사용자(보통 `apache` 또는 `www-data`)에게 쓰기 권한을
줍니다.

```bash
sudo chown -R apache:apache /var/www/html/modeling/uploads
sudo chmod -R 775 /var/www/html/modeling/uploads
```

(사용자 이름이 다르면 `ps aux | grep httpd` 로 Apache 실행 계정을 확인하세요.)

## 5. 대용량 파일 업로드 허용 (선택)

모델링 결과 파일이 큰 경우, PHP 기본 업로드 제한(기본 2MB)을 늘려야 할 수
있습니다. `php.ini` (보통 `/etc/php.ini`)에서:

```ini
upload_max_filesize = 50M
post_max_size = 55M
```

수정 후 Apache를 재시작합니다:

```bash
sudo systemctl restart httpd
```

## 6. 접속 확인

브라우저에서 `http://<서버주소>/modeling/login.php` 로 접속해 비밀번호
로그인 → 연도 목록 → 파일 업로드/다운로드가 정상 동작하는지 확인합니다.

## 7. 홈페이지의 "Modeling" 링크 연결

메인 홈페이지(`index.html`)의 상단 내비게이션에 있는 "Modeling" 링크는
현재 자리만 잡아둔 상태(`href="#"`)입니다. 서버 주소가 확정되면
`index.html`에서 아래 줄을 실제 주소로 바꿔주세요.

```html
<a href="#" ...>Modeling</a>
```

예:

```html
<a href="http://<서버주소>/modeling/login.php" target="_blank" rel="noopener">Modeling</a>
```
