<?php
define('AB_STORE', true);
require_once __DIR__ . '/../includes/api_bootstrap.php';
require_once __DIR__ . '/../auth/auth_guard.php';

$logged_in = auth_guard_restore_session();
$user = null;

if ($logged_in) {
    $user = [
        'id' => (int) ($_SESSION['user_id'] ?? 0),
        'name' => (string) ($_SESSION['name'] ?? ''),
        'email' => (string) ($_SESSION['email'] ?? ''),
        'role' => (string) ($_SESSION['role'] ?? 'user'),
        'member_id' => (string) ($_SESSION['member_id'] ?? ''),
        'loyalty_points' => (int) ($_SESSION['loyalty_points'] ?? 0),
    ];
}

api_send_json([
    'success' => true,
    'logged_in' => $logged_in,
    'user' => $user,
    'csrf_token' => generate_csrf(),
]);
