<?php

if (!defined('AB_STORE')) {
    define('AB_STORE', true);
}

if (defined('DB_INCLUDED')) {
    return;
}
define('DB_INCLUDED', true);

ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

require_once __DIR__ . '/headers.php';

if (session_status() === PHP_SESSION_NONE) {
    $session_directory = __DIR__ . '/../tmp/sessions';
    if (!is_dir($session_directory) && !mkdir($session_directory, 0755, true) && !is_dir($session_directory)) {
        error_log('[config/database.php] Failed to create session directory: ' . $session_directory);
        http_response_code(500);
        exit('Service temporarily unavailable.');
    }

    session_save_path($session_directory);
    ini_set('session.use_strict_mode', '1');

    $is_https = (string) ($_SERVER['HTTPS'] ?? '') !== '' && (string) ($_SERVER['HTTPS'] ?? '') !== 'off';
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'domain'   => '',
        'secure'   => $is_https,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function e($value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

function generate_csrf(): string
{
    if ((string) ($_SESSION['csrf_token'] ?? '') === '') {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }

    return (string) $_SESSION['csrf_token'];
}

function verify_csrf(?string $submitted_token = null): void
{
    $request_token = $submitted_token ?? (string) ($_POST['csrf_token'] ?? '');
    $stored_token  = (string) ($_SESSION['csrf_token'] ?? '');

    if ($request_token === '' || !hash_equals($stored_token, $request_token)) {
        http_response_code(403);
        exit('Invalid CSRF token.');
    }
}

$environment_path = __DIR__ . '/../.env';
if (!is_file($environment_path)) {
    error_log('[config/database.php] Missing .env file at ' . $environment_path);
    http_response_code(500);
    exit('Service temporarily unavailable.');
}

$environment_values = [];
$environment_lines  = file($environment_path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

if ($environment_lines !== false) {
    foreach ($environment_lines as $environment_line) {
        $trimmed_line = trim($environment_line);
        if ($trimmed_line === '' || str_starts_with($trimmed_line, '#') || !str_contains($trimmed_line, '=')) {
            continue;
        }
        [$environment_key, $environment_value] = explode('=', $trimmed_line, 2);
        $clean_value = trim($environment_value);
        $environment_values[trim($environment_key)] = trim($clean_value, " \t\n\r\0\x0B\"'");
    }
}

$db_host     = (string) ($environment_values['DB_HOST']     ?? 'localhost');
$db_name     = (string) ($environment_values['DB_NAME']     ?? '');
$db_user     = (string) ($environment_values['DB_USER']     ?? '');
$db_password = (string) ($environment_values['DB_PASSWORD'] ?? '');
$db_port     = (string) ($environment_values['DB_PORT']     ?? '3306');

$dsn     = "mysql:host={$db_host};port={$db_port};dbname={$db_name};charset=utf8mb4";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $db_user, $db_password, $options);
} catch (PDOException $exception) {
    error_log('[config/database.php] ' . $exception->getMessage());
    http_response_code(500);
    exit('Service temporarily unavailable.');
}
