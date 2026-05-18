<?php
define('AB_STORE', true);
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/auth_guard.php';

$wants_json = str_contains((string) ($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')
    || strtolower((string) ($_SERVER['HTTP_ACCEPT'] ?? '')) === 'application/json'
    || $_SERVER['REQUEST_METHOD'] === 'POST';

$session_token = (string) ($_COOKIE['session_token'] ?? '');

if ($session_token !== '') {
    try {
        $statement = $pdo->prepare('DELETE FROM sessions WHERE token = :token');
        $statement->execute([':token' => $session_token]);
    } catch (PDOException $exception) {
        error_log('[auth/logout.php] ' . $exception->getMessage());
    }
}

auth_guard_clear_state();

if ($wants_json) {
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode([
        'success' => true,
        'redirect' => '/login.html',
    ]);
    exit;
}

header('Location: /login.html');
exit;
