<?php
define('AB_STORE', true);
require_once __DIR__ . '/../includes/api_bootstrap.php';
require_once __DIR__ . '/../config/mail.php';
require_once __DIR__ . '/../auth/auth_guard.php';

api_require_method('POST');

$payload = api_read_json_input();
api_verify_csrf($payload);

$action = (string) ($payload['action'] ?? '');

function auth_action_ensure_password_resets_table(PDO $pdo): void
{
    static $ready = false;

    if ($ready) {
        return;
    }

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS password_resets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            email VARCHAR(190) NOT NULL,
            token_hash VARCHAR(255) NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_password_resets_email (email),
            INDEX idx_password_resets_user_id (user_id),
            CONSTRAINT fk_password_resets_user
                FOREIGN KEY (user_id) REFERENCES users(id)
                ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $ready = true;
}

function auth_action_ensure_pending_users_table(PDO $pdo): void
{
    static $ready = false;

    if ($ready) {
        return;
    }

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS pending_users (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(120) NOT NULL,
            email VARCHAR(190) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            verification_code VARCHAR(10) NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_pending_email (email),
            INDEX idx_pending_users_code (verification_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $ready = true;
}

try {
    if ($action === 'login') {
        $email = trim((string) ($payload['email'] ?? ''));
        $password = (string) ($payload['password'] ?? '');

        if ($email === '' || $password === '') {
            api_send_error('Please fill in all fields.', 422);
        }

        $statement = $pdo->prepare(
            'SELECT id, name, email, password_hash, role, member_id, loyalty_points
             FROM users
             WHERE email = :email
             LIMIT 1'
        );
        $statement->execute([':email' => $email]);
        $user_row = $statement->fetch(PDO::FETCH_ASSOC);

        if ($user_row === false || !password_verify($password, (string) $user_row['password_hash'])) {
            api_send_error('Invalid email or password.', 401);
        }

        auth_guard_issue_login_session($user_row);

        $role = (string) ($user_row['role'] ?? 'user');
        $redirect = '/index.html';
        if ($role === 'admin') {
            $redirect = '/roles-dash/admin-dash.html';
        } elseif ($role === 'employee') {
            $redirect = '/roles-dash/employee-dash.html';
        }

        api_send_json([
            'success' => true,
            'redirect' => $redirect,
            'role' => $role,
        ]);
    }

    if ($action === 'register') {
        $name = trim((string) ($payload['name'] ?? ''));
        $email = trim((string) ($payload['email'] ?? ''));
        $password = (string) ($payload['password'] ?? '');
        $confirm_password = (string) ($payload['confirm_password'] ?? '');

        if ($name === '' || $email === '' || $password === '' || $confirm_password === '') {
            api_send_error('All fields are required.', 422);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            api_send_error('Please enter a valid email address.', 422);
        }
        if (strlen($password) < 8) {
            api_send_error('Password must be at least 8 characters long.', 422);
        }
        if (!preg_match('/[A-Z]/', $password) || !preg_match('/[0-9]/', $password)) {
            api_send_error('Password must contain at least one uppercase letter and one number.', 422);
        }
        if ($password !== $confirm_password) {
            api_send_error('Passwords do not match.', 422);
        }

        $existing_user_statement = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $existing_user_statement->execute([':email' => $email]);
        if ($existing_user_statement->fetch(PDO::FETCH_ASSOC) !== false) {
            api_send_error('An account with this email already exists.', 409);
        }

        auth_action_ensure_pending_users_table($pdo);

        $password_hash = password_hash($password, PASSWORD_DEFAULT);
        $member_id = '';
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        $member_lookup_statement = $pdo->prepare('SELECT id FROM users WHERE member_id = :member_id LIMIT 1');

        while ($member_id === '') {
            $suffix = '';
            for ($index = 0; $index < 8; $index++) {
                $suffix .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }

            $candidate_member_id = 'MB' . $suffix;
            $member_lookup_statement->execute([':member_id' => $candidate_member_id]);
            if ($member_lookup_statement->fetch(PDO::FETCH_ASSOC) === false) {
                $member_id = $candidate_member_id;
            }
        }

        $verification_code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $expires_at = (new DateTime('+30 minutes'))->format('Y-m-d H:i:s');

        $pdo->beginTransaction();

        $delete_pending_statement = $pdo->prepare('DELETE FROM pending_users WHERE email = :email OR expires_at < NOW()');
        $delete_pending_statement->execute([':email' => $email]);

        $insert_pending_statement = $pdo->prepare(
            'INSERT INTO pending_users (name, email, password_hash, verification_code, expires_at)
             VALUES (:name, :email, :password_hash, :verification_code, :expires_at)'
        );
        $insert_pending_statement->execute([
            ':name' => $name,
            ':email' => $email,
            ':password_hash' => $password_hash,
            ':verification_code' => $verification_code,
            ':expires_at' => $expires_at,
        ]);

        try {
            mail_send_verification_code($email, $name, $verification_code);
        } catch (RuntimeException $mail_exception) {
            $pdo->rollBack();
            error_log('[api/auth_action.php] verification mail failed: ' . $mail_exception->getMessage());
            api_send_error('Could not send verification email. Please try again later.', 500);
        }

        $pdo->commit();

        $_SESSION['pending_email'] = $email;
        $_SESSION['pending_member_id'] = $member_id;

        api_send_json([
            'success' => true,
            'message' => 'Verification code sent. Please check your email.',
        ]);
    }

    if ($action === 'verify') {
        $pending_email = (string) ($_SESSION['pending_email'] ?? '');
        $pending_member_id = (string) ($_SESSION['pending_member_id'] ?? '');
        $code = trim((string) ($payload['code'] ?? ''));

        if ($pending_email === '' || $pending_member_id === '') {
            api_send_error('No pending verification was found. Please register first.', 422);
        }

        if ($code === '' || !preg_match('/^\d{6}$/', $code)) {
            api_send_error('Invalid verification code.', 422);
        }

        $statement = $pdo->prepare(
            'SELECT id, name, email, password_hash, expires_at
             FROM pending_users
             WHERE email = :email AND verification_code = :verification_code
             LIMIT 1'
        );
        $statement->execute([
            ':email' => $pending_email,
            ':verification_code' => $code,
        ]);
        $pending_user = $statement->fetch(PDO::FETCH_ASSOC);

        if ($pending_user === false) {
            api_send_error('Invalid verification code.', 422);
        }

        if (strtotime((string) $pending_user['expires_at']) < time()) {
            $delete_statement = $pdo->prepare('DELETE FROM pending_users WHERE id = :id');
            $delete_statement->execute([':id' => (int) $pending_user['id']]);
            unset($_SESSION['pending_email'], $_SESSION['pending_member_id']);
            api_send_error('The verification code expired. Please register again.', 422);
        }

        $pdo->beginTransaction();
        $insert_statement = $pdo->prepare(
            'INSERT INTO users (name, email, password_hash, role, member_id, loyalty_points)
             VALUES (:name, :email, :password_hash, :role, :member_id, :loyalty_points)'
        );
        $insert_statement->execute([
            ':name' => (string) $pending_user['name'],
            ':email' => (string) $pending_user['email'],
            ':password_hash' => (string) $pending_user['password_hash'],
            ':role' => 'user',
            ':member_id' => $pending_member_id,
            ':loyalty_points' => 0,
        ]);

        $delete_statement = $pdo->prepare('DELETE FROM pending_users WHERE id = :id');
        $delete_statement->execute([':id' => (int) $pending_user['id']]);
        $pdo->commit();

        unset($_SESSION['pending_email'], $_SESSION['pending_member_id']);

        api_send_json([
            'success' => true,
            'message' => 'Account verified. You can now sign in.',
        ]);
    }

    if ($action === 'forgot_password') {
        $email = trim((string) ($payload['email'] ?? ''));

        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            api_send_error('Please enter a valid email address.', 422);
        }

        auth_action_ensure_password_resets_table($pdo);

        $statement = $pdo->prepare(
            'SELECT id, name, email
             FROM users
             WHERE email = :email
             LIMIT 1'
        );
        $statement->execute([':email' => $email]);
        $user_row = $statement->fetch(PDO::FETCH_ASSOC);

        if ($user_row !== false) {
            $pdo->beginTransaction();

            $delete_statement = $pdo->prepare('DELETE FROM password_resets WHERE user_id = :user_id OR expires_at < NOW()');
            $delete_statement->execute([':user_id' => (int) $user_row['id']]);

            $reset_code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            $insert_statement = $pdo->prepare(
                'INSERT INTO password_resets (user_id, email, token_hash, expires_at)
                 VALUES (:user_id, :email, :token_hash, DATE_ADD(NOW(), INTERVAL 60 MINUTE))'
            );
            $insert_statement->execute([
                ':user_id' => (int) $user_row['id'],
                ':email' => (string) $user_row['email'],
                ':token_hash' => password_hash($reset_code, PASSWORD_DEFAULT),
            ]);

            try {
                mail_send_password_reset_code(
                    (string) $user_row['email'],
                    (string) $user_row['name'],
                    $reset_code
                );
            } catch (RuntimeException $mail_exception) {
                $pdo->rollBack();
                $previous = $mail_exception->getPrevious();
                error_log('[api/auth_action.php] password reset mail failed: ' . $mail_exception->getMessage()
                    . ($previous ? ' | cause: ' . $previous->getMessage() : ''));
                api_send_error('Could not send reset email. Please try again later.', 500);
            }

            $pdo->commit();
        }

        api_send_json([
            'success' => true,
            'message' => 'If that email is registered, a password reset code has been sent.',
        ]);
    }

    if ($action === 'reset_password') {
        $email = trim((string) ($payload['email'] ?? ''));
        $code = trim((string) ($payload['code'] ?? ''));
        $password = (string) ($payload['password'] ?? '');
        $confirm_password = (string) ($payload['confirm_password'] ?? '');

        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            api_send_error('Please enter a valid email address.', 422);
        }
        if ($code === '' || !preg_match('/^\d{6}$/', $code)) {
            api_send_error('Please enter a valid 6-digit reset code.', 422);
        }
        if (strlen($password) < 8) {
            api_send_error('Password must be at least 8 characters long.', 422);
        }
        if (!preg_match('/[A-Z]/', $password) || !preg_match('/[0-9]/', $password)) {
            api_send_error('Password must contain at least one uppercase letter and one number.', 422);
        }
        if ($password !== $confirm_password) {
            api_send_error('Passwords do not match.', 422);
        }

        auth_action_ensure_password_resets_table($pdo);

        $statement = $pdo->prepare(
            'SELECT pr.id, pr.user_id, pr.token_hash, pr.expires_at, u.email
             FROM password_resets AS pr
             INNER JOIN users AS u ON u.id = pr.user_id
             WHERE pr.email = :email AND pr.expires_at > NOW()
             ORDER BY pr.created_at DESC, pr.id DESC'
        );
        $statement->execute([':email' => $email]);
        $reset_rows = $statement->fetchAll(PDO::FETCH_ASSOC);

        $matching_reset = null;
        foreach ($reset_rows as $reset_row) {
            if (password_verify($code, (string) $reset_row['token_hash'])) {
                $matching_reset = $reset_row;
                break;
            }
        }

        if ($matching_reset === null) {
            api_send_error('Invalid or expired reset code.', 422);
        }

        $pdo->beginTransaction();

        $update_statement = $pdo->prepare(
            'UPDATE users
             SET password_hash = :password_hash
             WHERE id = :id'
        );
        $update_statement->execute([
            ':password_hash' => password_hash($password, PASSWORD_DEFAULT),
            ':id' => (int) $matching_reset['user_id'],
        ]);

        $delete_reset_statement = $pdo->prepare('DELETE FROM password_resets WHERE user_id = :user_id');
        $delete_reset_statement->execute([':user_id' => (int) $matching_reset['user_id']]);

        $delete_session_statement = $pdo->prepare('DELETE FROM sessions WHERE user_id = :user_id');
        $delete_session_statement->execute([':user_id' => (int) $matching_reset['user_id']]);

        $pdo->commit();

        api_send_json([
            'success' => true,
            'message' => 'Password updated. You can now sign in with your new password.',
        ]);
    }

    api_send_error('Unknown action.', 400);
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('[api/auth_action.php] ' . $exception->getMessage());
    api_send_error('Something went wrong. Please try again later.', 500);
}
