<?php
/**
 * Shared bootstrap for JSON API endpoints under /api/*.
 *
 * Provides:
 *   - api_send_json($payload, $status)   Canonical JSON response writer.
 *   - api_send_error($message, $status, $extras)
 *                                        Canonical {success:false, error:...} writer.
 *   - api_require_method($methods)       Reject anything not in $methods with 405.
 *   - api_read_json_input()              Parse JSON body, falling back to $_POST.
 *   - api_verify_csrf($payload)          Verify CSRF from a parsed payload.
 *   - api_require_login($message)        401 unless auth_guard_restore_session().
 *   - api_require_roles($roles, $message)
 *                                        401 unless logged in; 403 unless role matches.
 *
 * Response contract used by every endpoint that includes this file:
 *
 *   Success:  { "success": true,  ...endpoint-specific fields... }
 *   Failure:  { "success": false, "error": "<human readable>" }
 *
 * HTTP status mapping for failures:
 *   400  malformed/unknown action
 *   401  not authenticated
 *   403  forbidden (CSRF, role, etc.)
 *   404  target not found
 *   405  method not allowed
 *   409  conflict (duplicate email, etc.)
 *   422  validation
 *   500  server error
 *
 * Including this file ALSO sends `Content-Type: application/json; charset=UTF-8`
 * and pulls in config/database.php (which boots the session and PDO).
 *
 * Endpoints that need authentication MUST also require auth/auth_guard.php
 * and call api_require_login() or api_require_roles() explicitly.
 */

if (!defined('AB_STORE')) {
    http_response_code(403);
    exit;
}

require_once __DIR__ . '/../config/database.php';

if (!defined('AB_API_BOOTSTRAP')) {
    define('AB_API_BOOTSTRAP', true);

    if (!headers_sent()) {
        header('Content-Type: application/json; charset=UTF-8');
    }

    function api_send_json(array $payload, int $status_code = 200): void
    {
        http_response_code($status_code);
        echo json_encode($payload, JSON_UNESCAPED_UNICODE);
        exit;
    }

    function api_send_error(string $message, int $status_code = 400, array $extras = []): void
    {
        $payload = ['success' => false, 'error' => $message];
        if ($extras !== []) {
            $payload = array_merge($payload, $extras);
        }
        api_send_json($payload, $status_code);
    }

    function api_require_method($allowed_methods): void
    {
        $method_list = is_array($allowed_methods) ? $allowed_methods : [$allowed_methods];
        $method_list = array_map('strtoupper', $method_list);
        $current_method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? ''));

        if (!in_array($current_method, $method_list, true)) {
            if (!headers_sent()) {
                header('Allow: ' . implode(', ', $method_list));
            }
            api_send_error('Method not allowed.', 405);
        }
    }

    function api_read_json_input(): array
    {
        $content_type = (string) ($_SERVER['CONTENT_TYPE'] ?? '');
        if (str_contains($content_type, 'application/json')) {
            $decoded = json_decode((string) file_get_contents('php://input'), true);
            return is_array($decoded) ? $decoded : [];
        }

        if (!empty($_POST)) {
            return $_POST;
        }

        $decoded = json_decode((string) file_get_contents('php://input'), true);
        return is_array($decoded) ? $decoded : [];
    }

    function api_verify_csrf(array $payload): void
    {
        $request_token = (string) ($payload['csrf_token'] ?? '');
        $stored_token = (string) ($_SESSION['csrf_token'] ?? '');

        if ($request_token === '' || !hash_equals($stored_token, $request_token)) {
            api_send_error('Invalid CSRF token.', 403);
        }
    }

    function api_require_login(string $message = 'Please sign in to continue.'): void
    {
        if (!function_exists('auth_guard_restore_session')) {
            require_once __DIR__ . '/../auth/auth_guard.php';
        }

        if (!auth_guard_restore_session()) {
            api_send_error($message, 401);
        }
    }

    function api_require_roles(array $allowed_roles, string $unauth_message = 'Please sign in to continue.'): void
    {
        api_require_login($unauth_message);

        $current_role = (string) ($_SESSION['role'] ?? 'user');
        if (!in_array($current_role, $allowed_roles, true)) {
            api_send_error('You are not allowed to perform this action.', 403);
        }
    }
}
