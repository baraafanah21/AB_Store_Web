<?php
/**
 * Shared bootstrap for admin endpoints. Layers role enforcement on top of
 * includes/api_bootstrap.php so admin endpoints can stay terse.
 *
 * Endpoint usage:
 *   <?php
 *   define('AB_STORE', true);
 *   $allowed_roles = ['admin'];      // optional, defaults to ['admin']
 *   require_once __DIR__ . '/admin_common.php';
 *   // ... admin_json_input(), admin_verify_csrf_from_payload(), etc.
 */

if (!defined('AB_STORE')) {
    http_response_code(403);
    exit;
}

require_once __DIR__ . '/../includes/api_bootstrap.php';
require_once __DIR__ . '/../auth/auth_guard.php';

$allowed_roles = isset($allowed_roles) && is_array($allowed_roles) && $allowed_roles !== []
    ? array_values(array_unique($allowed_roles))
    : ['admin'];

// Note: this still uses auth_guard_require_roles() (HTML redirect on failure)
// rather than api_require_roles() (JSON 401/403) to preserve the pre-existing
// admin endpoint behavior — admin pages historically expect a redirect.
auth_guard_require_roles($allowed_roles);

function admin_json_input(): array
{
    return api_read_json_input();
}

function admin_verify_csrf_from_payload(array $payload): void
{
    api_verify_csrf($payload);
}

function admin_json_response(array $payload, int $status_code = 200): void
{
    api_send_json($payload, $status_code);
}

function admin_table_exists(PDO $pdo, string $table_name): bool
{
    $statement = $pdo->prepare(
        'SELECT 1
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name
         LIMIT 1'
    );
    $statement->execute([':table_name' => $table_name]);
    return $statement->fetchColumn() !== false;
}

function admin_generate_member_id(PDO $pdo): string
{
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    $lookup_statement = $pdo->prepare('SELECT id FROM users WHERE member_id = :member_id LIMIT 1');

    while (true) {
        $suffix = '';
        for ($index = 0; $index < 8; $index++) {
            $suffix .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }

        $candidate = 'MB' . $suffix;
        $lookup_statement->execute([':member_id' => $candidate]);
        if ($lookup_statement->fetch(PDO::FETCH_ASSOC) === false) {
            return $candidate;
        }
    }
}
