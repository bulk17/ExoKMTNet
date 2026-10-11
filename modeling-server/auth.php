<?php
declare(strict_types=1);

session_start();

$config = require __DIR__ . '/config.php';

function require_login(): void
{
    if (empty($_SESSION['modeler_authenticated'])) {
        header('Location: login.php');
        exit;
    }
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function check_csrf(string $token): bool
{
    return !empty($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token);
}

function valid_year(int $year, array $config): bool
{
    return $year >= $config['min_year'] && $year <= $config['max_year'];
}
