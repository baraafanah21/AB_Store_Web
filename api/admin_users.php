<?php
define('AB_STORE', true);
require_once __DIR__ . '/admin_common.php';

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $users = $pdo->query(
            'SELECT id, name, email, role, member_id, loyalty_points, DATE_FORMAT(created_at, "%Y-%m-%d") AS joined_at
             FROM users
             ORDER BY created_at DESC, id DESC'
        )->fetchAll(PDO::FETCH_ASSOC);

        admin_json_response([
            'success' => true,
            'users' => $users,
        ]);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        admin_json_response(['success' => false, 'error' => 'Method not allowed.'], 405);
    }

    $payload = admin_json_input();
    admin_verify_csrf_from_payload($payload);

    $action = (string) ($payload['action'] ?? '');

    if ($action === 'create') {
        $name = trim((string) ($payload['name'] ?? ''));
        $email = trim((string) ($payload['email'] ?? ''));
        $password = (string) ($payload['password'] ?? '');
        $role = (string) ($payload['role'] ?? 'employee');

        if ($name === '' || $email === '' || $password === '') {
            admin_json_response(['success' => false, 'error' => 'Please fill all fields.'], 422);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            admin_json_response(['success' => false, 'error' => 'Please enter a valid email address.'], 422);
        }
        if (strlen($password) < 6) {
            admin_json_response(['success' => false, 'error' => 'Password must be at least 6 characters.'], 422);
        }
        if (!in_array($role, ['admin', 'employee'], true)) {
            admin_json_response(['success' => false, 'error' => 'Invalid role selected.'], 422);
        }

        $existing_statement = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $existing_statement->execute([':email' => $email]);
        if ($existing_statement->fetch(PDO::FETCH_ASSOC) !== false) {
            admin_json_response(['success' => false, 'error' => 'Email already exists.'], 409);
        }

        $member_id = admin_generate_member_id($pdo);
        $password_hash = password_hash($password, PASSWORD_DEFAULT);

        $insert_statement = $pdo->prepare(
            'INSERT INTO users (name, email, password_hash, role, member_id, loyalty_points)
             VALUES (:name, :email, :password_hash, :role, :member_id, :loyalty_points)'
        );
        $insert_statement->execute([
            ':name' => $name,
            ':email' => $email,
            ':password_hash' => $password_hash,
            ':role' => $role,
            ':member_id' => $member_id,
            ':loyalty_points' => 0,
        ]);

        admin_json_response(['success' => true]);
    }

    if ($action === 'delete') {
        $user_id = (int) ($payload['id'] ?? 0);
        $current_user_id = (int) ($_SESSION['user_id'] ?? 0);

        if ($user_id <= 0) {
            admin_json_response(['success' => false, 'error' => 'Invalid user ID.'], 422);
        }
        if ($user_id === $current_user_id) {
            admin_json_response(['success' => false, 'error' => 'You cannot delete your own account.'], 422);
        }

        $exists_statement = $pdo->prepare('SELECT id FROM users WHERE id = :id LIMIT 1');
        $exists_statement->execute([':id' => $user_id]);
        if ($exists_statement->fetch(PDO::FETCH_ASSOC) === false) {
            admin_json_response(['success' => false, 'error' => 'User not found.'], 404);
        }

        $pdo->beginTransaction();

        try {
            if (admin_table_exists($pdo, 'wishlist_items')) {
                $pdo->prepare('DELETE FROM wishlist_items WHERE user_id = :id')
                    ->execute([':id' => $user_id]);
            }
            if (admin_table_exists($pdo, 'reviews')) {
                $review_columns = $pdo->query("SHOW COLUMNS FROM reviews LIKE 'user_id'")->fetch(PDO::FETCH_ASSOC);
                if ($review_columns !== false) {
                    $pdo->prepare('UPDATE reviews SET user_id = NULL WHERE user_id = :id')
                        ->execute([':id' => $user_id]);
                }
            }
            if (admin_table_exists($pdo, 'contact_messages')) {
                $replied_by = $pdo->query("SHOW COLUMNS FROM contact_messages LIKE 'replied_by'")->fetch(PDO::FETCH_ASSOC);
                if ($replied_by !== false) {
                    $pdo->prepare('UPDATE contact_messages SET replied_by = NULL WHERE replied_by = :id')
                        ->execute([':id' => $user_id]);
                }
            }
            if (admin_table_exists($pdo, 'cart_items')) {
                $pdo->prepare('DELETE FROM cart_items WHERE user_id = :id')
                    ->execute([':id' => $user_id]);
            }
            if (admin_table_exists($pdo, 'loyalty_transactions')) {
                $pdo->prepare('DELETE FROM loyalty_transactions WHERE user_id = :id')
                    ->execute([':id' => $user_id]);
            }
            if (admin_table_exists($pdo, 'order_items') && admin_table_exists($pdo, 'orders')) {
                $pdo->prepare(
                    'DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = :id)'
                )->execute([':id' => $user_id]);
            }
            if (admin_table_exists($pdo, 'orders')) {
                $pdo->prepare('DELETE FROM orders WHERE user_id = :id')
                    ->execute([':id' => $user_id]);
            }
            if (admin_table_exists($pdo, 'password_resets')) {
                $pdo->prepare('DELETE FROM password_resets WHERE user_id = :id')
                    ->execute([':id' => $user_id]);
            }
            if (admin_table_exists($pdo, 'sessions')) {
                $pdo->prepare('DELETE FROM sessions WHERE user_id = :id')
                    ->execute([':id' => $user_id]);
            }

            $delete_statement = $pdo->prepare('DELETE FROM users WHERE id = :id');
            $delete_statement->execute([':id' => $user_id]);

            $pdo->commit();
        } catch (PDOException $delete_exception) {
            $pdo->rollBack();
            error_log('[api/admin_users.php] delete failed: ' . $delete_exception->getMessage());
            admin_json_response([
                'success' => false,
                'error' => 'Could not delete user: ' . $delete_exception->getMessage(),
            ], 500);
        }

        admin_json_response(['success' => true]);
    }

    if ($action === 'update_role') {
        $user_id = (int) ($payload['id'] ?? 0);
        $role = (string) ($payload['role'] ?? '');
        $current_user_id = (int) ($_SESSION['user_id'] ?? 0);

        if ($user_id <= 0) {
            admin_json_response(['success' => false, 'error' => 'Invalid user ID.'], 422);
        }
        if (!in_array($role, ['user', 'employee', 'admin'], true)) {
            admin_json_response(['success' => false, 'error' => 'Invalid role selected.'], 422);
        }
        if ($user_id === $current_user_id && $role !== 'admin') {
            admin_json_response(['success' => false, 'error' => 'You cannot remove your own admin access.'], 422);
        }

        $update_statement = $pdo->prepare('UPDATE users SET role = :role WHERE id = :id');
        $update_statement->execute([
            ':role' => $role,
            ':id' => $user_id,
        ]);

        if ($user_id !== $current_user_id && admin_table_exists($pdo, 'sessions')) {
            $pdo->prepare('DELETE FROM sessions WHERE user_id = :id')
                ->execute([':id' => $user_id]);
        }

        admin_json_response(['success' => true]);
    }

    if ($action === 'update') {
        $user_id = (int) ($payload['id'] ?? 0);
        $current_user_id = (int) ($_SESSION['user_id'] ?? 0);
        $name = trim((string) ($payload['name'] ?? ''));
        $email = trim((string) ($payload['email'] ?? ''));
        $role = (string) ($payload['role'] ?? '');
        $password = (string) ($payload['password'] ?? '');
        $has_points = array_key_exists('loyalty_points', $payload);
        $new_points = $has_points ? (int) $payload['loyalty_points'] : 0;

        if ($user_id <= 0) {
            admin_json_response(['success' => false, 'error' => 'Invalid user ID.'], 422);
        }
        if ($name === '' || $email === '' || $role === '') {
            admin_json_response(['success' => false, 'error' => 'Name, email, and role are required.'], 422);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            admin_json_response(['success' => false, 'error' => 'Please enter a valid email address.'], 422);
        }
        if (!in_array($role, ['user', 'employee', 'admin'], true)) {
            admin_json_response(['success' => false, 'error' => 'Invalid role selected.'], 422);
        }
        if ($user_id === $current_user_id && $role !== 'admin') {
            admin_json_response(['success' => false, 'error' => 'You cannot remove your own admin access.'], 422);
        }
        if ($password !== '' && strlen($password) < 6) {
            admin_json_response(['success' => false, 'error' => 'Password must be at least 6 characters.'], 422);
        }
        if ($has_points && ($new_points < 0 || $new_points > 10000000)) {
            admin_json_response(['success' => false, 'error' => 'Loyalty points must be between 0 and 10,000,000.'], 422);
        }

        $existing_statement = $pdo->prepare('SELECT id FROM users WHERE email = :email AND id <> :id LIMIT 1');
        $existing_statement->execute([
            ':email' => $email,
            ':id' => $user_id,
        ]);
        if ($existing_statement->fetch(PDO::FETCH_ASSOC) !== false) {
            admin_json_response(['success' => false, 'error' => 'Email already exists.'], 409);
        }

        $pdo->beginTransaction();

        $current_statement = $pdo->prepare('SELECT role, loyalty_points FROM users WHERE id = :id FOR UPDATE');
        $current_statement->execute([':id' => $user_id]);
        $current_row = $current_statement->fetch(PDO::FETCH_ASSOC);
        if ($current_row === false) {
            $pdo->rollBack();
            admin_json_response(['success' => false, 'error' => 'User not found.'], 404);
        }
        $current_points = (int) ($current_row['loyalty_points'] ?? 0);
        $previous_role = (string) ($current_row['role'] ?? '');

        if ($password !== '') {
            $update_statement = $pdo->prepare(
                'UPDATE users
                 SET name = :name, email = :email, role = :role, password_hash = :password_hash
                 WHERE id = :id'
            );
            $update_statement->execute([
                ':name' => $name,
                ':email' => $email,
                ':role' => $role,
                ':password_hash' => password_hash($password, PASSWORD_DEFAULT),
                ':id' => $user_id,
            ]);
        } else {
            $update_statement = $pdo->prepare(
                'UPDATE users
                 SET name = :name, email = :email, role = :role
                 WHERE id = :id'
            );
            $update_statement->execute([
                ':name' => $name,
                ':email' => $email,
                ':role' => $role,
                ':id' => $user_id,
            ]);
        }

        $points_to_return = $current_points;
        if ($has_points && $new_points !== $current_points) {
            $pdo->exec(
                'CREATE TABLE IF NOT EXISTS loyalty_transactions (
                    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    user_id INT UNSIGNED NOT NULL,
                    order_id INT UNSIGNED NULL,
                    transaction_type VARCHAR(20) NOT NULL,
                    points_delta INT NOT NULL,
                    description VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_loyalty_transactions_user_id (user_id),
                    INDEX idx_loyalty_transactions_order_id (order_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
            );

            $points_update = $pdo->prepare('UPDATE users SET loyalty_points = :points WHERE id = :id');
            $points_update->execute([
                ':points' => $new_points,
                ':id' => $user_id,
            ]);

            $delta = $new_points - $current_points;
            $log_statement = $pdo->prepare(
                'INSERT INTO loyalty_transactions (user_id, order_id, transaction_type, points_delta, description)
                 VALUES (:user_id, NULL, :transaction_type, :points_delta, :description)'
            );
            $log_statement->execute([
                ':user_id' => $user_id,
                ':transaction_type' => $delta > 0 ? 'admin_credit' : 'admin_debit',
                ':points_delta' => $delta,
                ':description' => 'Admin set balance to ' . $new_points,
            ]);

            $points_to_return = $new_points;
        }

        $pdo->commit();

        $role_changed = $role !== $previous_role;
        $password_changed = $password !== '';
        if ($user_id !== $current_user_id && ($role_changed || $password_changed) && admin_table_exists($pdo, 'sessions')) {
            $pdo->prepare('DELETE FROM sessions WHERE user_id = :id')
                ->execute([':id' => $user_id]);
        }

        if ($user_id === $current_user_id) {
            $_SESSION['name'] = $name;
            $_SESSION['email'] = $email;
            $_SESSION['role'] = $role;
            $_SESSION['loyalty_points'] = $points_to_return;
        }

        admin_json_response([
            'success' => true,
            'user' => [
                'id' => $user_id,
                'name' => $name,
                'email' => $email,
                'role' => $role,
                'loyalty_points' => $points_to_return,
            ],
        ]);
    }

    admin_json_response(['success' => false, 'error' => 'Unknown action.'], 400);
} catch (Throwable $exception) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('[api/admin_users.php] ' . $exception->getMessage());
    admin_json_response([
        'success' => false,
        'error' => 'Failed to manage users.',
    ], 500);
}
