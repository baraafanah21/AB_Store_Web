<?php
define('AB_STORE', true);
require_once __DIR__ . '/../includes/api_bootstrap.php';
require_once __DIR__ . '/../auth/auth_guard.php';

api_require_method('POST');

$request_data = api_read_json_input();
api_verify_csrf($request_data);
api_require_login('Please log in to manage your wishlist.');

try {
    $user_id = (int) ($_SESSION['user_id'] ?? 0);
    $action = (string) ($request_data['action'] ?? '');
    $product_id = (int) ($request_data['product_id'] ?? 0);

    switch ($action) {
        case 'toggle':
            if ($product_id <= 0) {
                api_send_error('Invalid input.', 422);
            }

            $product_statement = $pdo->prepare('SELECT id FROM products WHERE id = :id LIMIT 1');
            $product_statement->execute([':id' => $product_id]);
            if ($product_statement->fetch(PDO::FETCH_ASSOC) === false) {
                api_send_error('Product not found.', 404);
            }

            $existing_statement = $pdo->prepare('SELECT product_id FROM wishlist_items WHERE user_id = :user_id AND product_id = :product_id LIMIT 1');
            $existing_statement->execute([
                ':user_id' => $user_id,
                ':product_id' => $product_id,
            ]);

            if ($existing_statement->fetch(PDO::FETCH_ASSOC) !== false) {
                $delete_statement = $pdo->prepare('DELETE FROM wishlist_items WHERE user_id = :user_id AND product_id = :product_id');
                $delete_statement->execute([
                    ':user_id' => $user_id,
                    ':product_id' => $product_id,
                ]);

                api_send_json(['success' => true, 'wishlisted' => false]);
            }

            $insert_statement = $pdo->prepare('INSERT INTO wishlist_items (user_id, product_id) VALUES (:user_id, :product_id)');
            $insert_statement->execute([
                ':user_id' => $user_id,
                ':product_id' => $product_id,
            ]);

            api_send_json(['success' => true, 'wishlisted' => true]);

        case 'get':
            $statement = $pdo->prepare(
                'SELECT w.product_id, p.brand, p.name, p.category, p.size, p.price, p.old_price, p.stars, p.badge, p.image_url, w.added_at
                 FROM wishlist_items AS w
                 INNER JOIN products AS p ON p.id = w.product_id
                 WHERE w.user_id = :user_id
                 ORDER BY w.added_at DESC'
            );
            $statement->execute([':user_id' => $user_id]);
            $wishlist_items = $statement->fetchAll(PDO::FETCH_ASSOC);

            api_send_json([
                'success' => true,
                'items' => $wishlist_items,
                'count' => count($wishlist_items),
            ]);

        default:
            api_send_error('Unknown action.', 400);
    }
} catch (Throwable $exception) {
    error_log('[api/wishlist.php] ' . $exception->getMessage());
    api_send_error('Server error.', 500);
}
