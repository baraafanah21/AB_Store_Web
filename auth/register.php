<?php
define('AB_STORE', true);
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/mail.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /login.html?tab=register');
    exit;
}

function register_ensure_pending_users_table(PDO $pdo): void
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

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();

    $name = trim((string) ($_POST['name'] ?? ''));
    $email = trim((string) ($_POST['email'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');
    $confirm_password = (string) ($_POST['confirm_password'] ?? '');

    if ($name === '' || $email === '' || $password === '' || $confirm_password === '') {
        $_SESSION['error'] = 'All fields are required.';
        header('Location: /auth/register.php');
        exit;
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $_SESSION['error'] = 'Please enter a valid email address.';
        header('Location: /auth/register.php');
        exit;
    }

    if (strlen($password) < 8) {
        $_SESSION['error'] = 'Password must be at least 8 characters long.';
        header('Location: /auth/register.php');
        exit;
    }

    if (!preg_match('/[A-Z]/', $password) || !preg_match('/[0-9]/', $password)) {
        $_SESSION['error'] = 'Password must contain at least one uppercase letter and one number.';
        header('Location: /auth/register.php');
        exit;
    }

    if ($password !== $confirm_password) {
        $_SESSION['error'] = 'Passwords do not match.';
        header('Location: /auth/register.php');
        exit;
    }

    try {
        $existing_user_statement = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $existing_user_statement->execute([':email' => $email]);
        if ($existing_user_statement->fetch(PDO::FETCH_ASSOC) !== false) {
            $_SESSION['error'] = 'An account with this email already exists.';
            header('Location: /auth/register.php');
            exit;
        }

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

        register_ensure_pending_users_table($pdo);

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
            error_log('[auth/register.php] verification mail failed: ' . $mail_exception->getMessage());
            $_SESSION['error'] = 'Could not send verification email. Please try again later.';
            header('Location: /auth/register.php');
            exit;
        }

        $pdo->commit();

        $_SESSION['pending_email'] = $email;
        $_SESSION['pending_member_id'] = $member_id;
        $_SESSION['success'] = 'Verification code sent to your email.';
        header('Location: /auth/verify.php');
        exit;
    } catch (PDOException $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('[auth/register.php] ' . $exception->getMessage());
        $_SESSION['error'] = 'Something went wrong. Please try again later.';
        header('Location: /auth/register.php');
        exit;
    }
}

$error = $_SESSION['error'] ?? null;
$success = $_SESSION['success'] ?? null;
unset($_SESSION['error'], $_SESSION['success']);

$page_title = 'Register | AB Store';
?>
<!DOCTYPE html>
<html lang="en">
<head>
<?php require_once __DIR__ . '/../includes/head.php'; ?>
</head>
<body>
<?php require_once __DIR__ . '/../includes/navbar.php'; ?>
<main class="auth-shell d-flex align-items-center justify-content-center px-3 py-5">
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-12 col-sm-10 col-md-7 col-lg-5">
                <div class="card auth-card shadow-lg p-4">
                    <h1 class="auth-brand h4 mb-4"><i class="bi bi-bag-fill me-1"></i>AB Store</h1>
                    <h2 class="h5 mb-4 text-center">Create your account</h2>

                    <?php if ($error !== null): ?>
                        <div class="alert alert-danger"><?= e($error) ?></div>
                    <?php endif; ?>
                    <?php if ($success !== null): ?>
                        <div class="alert alert-success"><?= e($success) ?></div>
                    <?php endif; ?>

                    <form method="POST" action="/auth/register.php" novalidate>
                        <input type="hidden" name="csrf_token" value="<?= e(generate_csrf()) ?>">

                        <div class="mb-3">
                            <label for="name" class="form-label">Full name</label>
                            <input type="text" class="form-control" id="name" name="name" maxlength="80" required autocomplete="name">
                        </div>

                        <div class="mb-3">
                            <label for="email" class="form-label">Email</label>
                            <input type="email" class="form-control" id="email" name="email" maxlength="120" required autocomplete="email">
                        </div>

                        <div class="mb-3">
                            <label for="password" class="form-label">Password</label>
                            <input type="password" class="form-control" id="password" name="password" minlength="8" required autocomplete="new-password">
                            <div class="form-text">Use at least 8 characters with one uppercase letter and one number.</div>
                        </div>

                        <div class="mb-3">
                            <label for="confirm_password" class="form-label">Confirm password</label>
                            <input type="password" class="form-control" id="confirm_password" name="confirm_password" minlength="8" required autocomplete="new-password">
                        </div>

                        <div class="d-grid mb-3">
                            <button type="submit" class="btn btn-dark"><i class="bi bi-person-plus me-1"></i>Register</button>
                        </div>

                        <p class="mb-0 text-center small text-muted">
                            Already have an account? <a href="/auth/login.php" class="link-warning fw-semibold">Login</a>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    </div>
</main>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
</body>
</html>
