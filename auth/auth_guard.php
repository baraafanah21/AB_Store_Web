<?php
if (!defined('AB_STORE')) {
    http_response_code(403);
    exit;
}

require_once __DIR__ . '/../config/database.php';

const AUTH_SESSION_TOKEN_LIFETIME = 60 * 60 * 24 * 30;

function auth_guard_is_https(): bool
{
    $https = (string) ($_SERVER['HTTPS'] ?? '');
    return $https !== '' && $https !== 'off';
}

function auth_guard_set_session_cookie(string $token, ?int $lifetime_seconds = null): void
{
    $lifetime = $lifetime_seconds ?? AUTH_SESSION_TOKEN_LIFETIME;
    setcookie(
        'session_token',
        $token,
        [
            'expires' => time() + $lifetime,
            'path' => '/',
            'secure' => auth_guard_is_https(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]
    );
}

function auth_guard_clear_session_cookie(): void
{
    setcookie(
        'session_token',
        '',
        [
            'expires' => time() - 3600,
            'path' => '/',
            'secure' => auth_guard_is_https(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]
    );
    unset($_COOKIE['session_token']);
}

function auth_guard_clear_state(): void
{
    if (isset($_COOKIE['session_token'])) {
        auth_guard_clear_session_cookie();
    }

    $_SESSION = [];

    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
}

function auth_guard_set_user_session(array $user_row): void
{
    $_SESSION['user_id'] = (int) ($user_row['id'] ?? 0);
    $_SESSION['name'] = (string) ($user_row['name'] ?? '');
    $_SESSION['email'] = (string) ($user_row['email'] ?? '');
    $_SESSION['role'] = (string) ($user_row['role'] ?? 'user');
    $_SESSION['member_id'] = (string) ($user_row['member_id'] ?? '');
    $_SESSION['loyalty_points'] = (int) ($user_row['loyalty_points'] ?? 0);
}

function auth_guard_force_login(): void
{
    auth_guard_clear_state();
    header('Location: /login.html');
    exit;
}

function auth_guard_redirect_by_role(string $role): void
{
    if ($role === 'admin') {
        header('Location: /roles-dash/admin-dash.html');
        exit;
    }

    if ($role === 'employee') {
        header('Location: /roles-dash/employee-dash.html');
        exit;
    }

    header('Location: /index.html');
    exit;
}

function auth_guard_restore_session(): bool
{
    global $pdo;

    $session_user_id = (int) ($_SESSION['user_id'] ?? 0);
    if ($session_user_id > 0) {
        return true;
    }

    $session_token = (string) ($_COOKIE['session_token'] ?? '');
    if ($session_token === '') {
        return false;
    }

    try {
        $statement = $pdo->prepare(
            'SELECT s.expires_at, u.id, u.name, u.email, u.role, u.member_id, u.loyalty_points
             FROM sessions AS s
             INNER JOIN users AS u ON u.id = s.user_id
             WHERE s.token = :token AND s.expires_at > NOW()
             LIMIT 1'
        );
        $statement->execute([':token' => $session_token]);
        $user_row = $statement->fetch(PDO::FETCH_ASSOC);

        if ($user_row === false) {
            $delete_statement = $pdo->prepare('DELETE FROM sessions WHERE token = :token');
            $delete_statement->execute([':token' => $session_token]);
            auth_guard_clear_state();
            return false;
        }

        session_regenerate_id(true);
        auth_guard_set_user_session($user_row);
        auth_guard_set_session_cookie($session_token);

        return true;
    } catch (PDOException $exception) {
        error_log('[auth/auth_guard.php] ' . $exception->getMessage());
        auth_guard_clear_state();
        return false;
    }
}

function auth_guard_require_login(): void
{
    if (!auth_guard_restore_session()) {
        auth_guard_force_login();
    }
}

/**
 * Establish a logged-in session for $user_row: rotates the PHP session ID,
 * inserts a fresh `sessions` row, populates $_SESSION via auth_guard_set_user_session,
 * and writes the session_token cookie. Returns the issued token.
 */
function auth_guard_issue_login_session(array $user_row): string
{
    global $pdo;

    $user_id = (int) ($user_row['id'] ?? 0);

    $cleanup_statement = $pdo->prepare('DELETE FROM sessions WHERE user_id = :user_id AND expires_at < NOW()');
    $cleanup_statement->execute([':user_id' => $user_id]);

    $session_token = bin2hex(random_bytes(32));
    $expires_at = (new DateTime('+30 days'))->format('Y-m-d H:i:s');

    $insert_statement = $pdo->prepare(
        'INSERT INTO sessions (token, user_id, expires_at)
         VALUES (:token, :user_id, :expires_at)'
    );
    $insert_statement->execute([
        ':token' => $session_token,
        ':user_id' => $user_id,
        ':expires_at' => $expires_at,
    ]);

    session_regenerate_id(true);
    auth_guard_set_user_session($user_row);
    auth_guard_set_session_cookie($session_token);

    return $session_token;
}

function auth_guard_require_roles(array $allowed_roles): void
{
    auth_guard_require_login();

    $current_role = (string) ($_SESSION['role'] ?? 'user');
    if (!in_array($current_role, $allowed_roles, true)) {
        auth_guard_redirect_by_role($current_role);
    }
}

if (isset($allowed_roles) && is_array($allowed_roles) && $allowed_roles !== []) {
    auth_guard_require_roles($allowed_roles);
}
