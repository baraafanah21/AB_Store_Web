<?php
define('AB_STORE', true);
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/auth_guard.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /login.html');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();

    $email = trim((string) ($_POST['email'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');

    if ($email === '' || $password === '') {
        $_SESSION['error'] = 'Invalid email or password.';
        header('Location: /login.html');
        exit;
    }

    try {
        $statement = $pdo->prepare(
            'SELECT id, name, email, password_hash, role, member_id, loyalty_points
             FROM users
             WHERE email = :email
             LIMIT 1'
        );
        $statement->execute([':email' => $email]);
        $user_row = $statement->fetch(PDO::FETCH_ASSOC);

        if ($user_row === false || !password_verify($password, (string) $user_row['password_hash'])) {
            $_SESSION['error'] = 'Invalid email or password.';
            header('Location: /login.html');
            exit;
        }

        auth_guard_issue_login_session($user_row);

        $user_role = (string) ($user_row['role'] ?? 'user');
        if ($user_role === 'admin') {
            header('Location: /roles-dash/admin-dash.html');
            exit;
        }

        if ($user_role === 'employee') {
            header('Location: /roles-dash/employee-dash.html');
            exit;
        }

        header('Location: /index.html');
        exit;
    } catch (PDOException $exception) {
        error_log('[auth/login.php] ' . $exception->getMessage());
        $_SESSION['error'] = 'Something went wrong. Please try again later.';
        header('Location: /login.html');
        exit;
    }
}

$error = $_SESSION['error'] ?? null;
$success = $_SESSION['success'] ?? null;
unset($_SESSION['error'], $_SESSION['success']);

$page_title = 'Login | AB Store';
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
                    <h1 class="auth-brand h4 mb-4"><i class="bi bi-bag-fill me-1"></i>AB Store</h1>
                    <h2 class="h5 mb-4 text-center">Welcome back</h2>

                    <?php if ($error !== null): ?>
                        <div class="alert alert-danger"><?= e($error) ?></div>
                    <?php endif; ?>
                    <?php if ($success !== null): ?>
                        <div class="alert alert-success"><?= e($success) ?></div>
                    <?php endif; ?>

                    <form method="POST" action="/auth/login.php" novalidate>
                        <input type="hidden" name="csrf_token" value="<?= e(generate_csrf()) ?>">

                        <div class="mb-3">
                            <label for="email" class="form-label">Email</label>
                            <input type="email" class="form-control" id="email" name="email" maxlength="120" required autocomplete="email">
                        </div>

                        <div class="mb-3">
                            <label for="password" class="form-label">Password</label>
                            <input type="password" class="form-control" id="password" name="password" required autocomplete="current-password">
                        </div>

                        <div class="d-grid mb-3">
                            <button type="submit" class="btn btn-dark"><i class="bi bi-box-arrow-in-right me-1"></i>Login</button>
                        </div>

                        <p class="mb-0 text-center small text-muted">
                            Do not have an account? <a href="/auth/register.php" class="link-warning fw-semibold">Register</a>
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
