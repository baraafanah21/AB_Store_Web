<?php
define('AB_STORE', true);
require_once __DIR__ . '/../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /login.html?tab=verify');
    exit;
}

$pending_email = (string) ($_SESSION['pending_email'] ?? '');
$pending_member_id = (string) ($_SESSION['pending_member_id'] ?? '');

if ($pending_email === '' || $pending_member_id === '') {
    $_SESSION['error'] = 'No pending verification was found. Please register first.';
    header('Location: /auth/register.php');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();

    $code = trim((string) ($_POST['code'] ?? ''));
    if ($code === '' || !preg_match('/^\d{6}$/', $code)) {
        $_SESSION['error'] = 'Invalid verification code.';
        header('Location: /auth/verify.php');
        exit;
    }

    try {
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
            $_SESSION['error'] = 'Invalid verification code.';
            header('Location: /auth/verify.php');
            exit;
        }

        if (strtotime((string) $pending_user['expires_at']) < time()) {
            $delete_statement = $pdo->prepare('DELETE FROM pending_users WHERE id = :id');
            $delete_statement->execute([':id' => (int) $pending_user['id']]);

            unset($_SESSION['pending_email'], $_SESSION['pending_member_id']);
            $_SESSION['error'] = 'The verification code expired. Please register again.';
            header('Location: /auth/register.php');
            exit;
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
        $_SESSION['success'] = 'Account verified. You can now log in.';
        header('Location: /auth/login.php');
        exit;
    } catch (PDOException $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        error_log('[auth/verify.php] ' . $exception->getMessage());
        $_SESSION['error'] = 'Something went wrong. Please try again later.';
        header('Location: /auth/verify.php');
        exit;
    }
}

$error = $_SESSION['error'] ?? null;
$success = $_SESSION['success'] ?? null;
unset($_SESSION['error'], $_SESSION['success']);

$page_title = 'Verify Email | AB Store';
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
            <div class="col-12 col-sm-10 col-md-6 col-lg-5">
                <div class="card auth-card shadow-lg p-4">
                    <h1 class="auth-brand h4 mb-2"><i class="bi bi-bag-fill me-1"></i>AB Store</h1>
                    <h2 class="h5 mb-2 text-center">Verify your email</h2>
                    <p class="mb-4 text-center small text-muted">We sent a 6-digit code to <strong><?= e($pending_email) ?></strong>.</p>

                    <?php if ($error !== null): ?>
                        <div class="alert alert-danger"><?= e($error) ?></div>
                    <?php endif; ?>
                    <?php if ($success !== null): ?>
                        <div class="alert alert-success"><?= e($success) ?></div>
                    <?php endif; ?>

                    <form method="POST" action="/auth/verify.php" novalidate>
                        <input type="hidden" name="csrf_token" value="<?= e(generate_csrf()) ?>">

                        <div class="mb-3">
                            <label for="code" class="form-label">Verification code</label>
                            <input type="text" class="form-control fs-4 text-center verification-code-input" id="code" name="code" pattern="\d{6}" minlength="6" maxlength="6" required autocomplete="one-time-code" inputmode="numeric">
                        </div>

                        <div class="d-grid">
                            <button type="submit" class="btn btn-dark"><i class="bi bi-shield-check me-1"></i>Verify</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</main>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
</body>
</html>
