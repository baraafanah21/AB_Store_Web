<?php
define('AB_STORE', true);
require_once __DIR__ . '/../includes/api_bootstrap.php';
require_once __DIR__ . '/../auth/auth_guard.php';

api_require_login('Please sign in to view loyalty details.');

function loyalty_ensure_tables(PDO $pdo): void
{
    static $ready = false;

    if ($ready) {
        return;
    }

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS orders (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            order_number VARCHAR(32) NOT NULL,
            user_id INT UNSIGNED NOT NULL,
            payment_method VARCHAR(20) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT "placed",
            subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            shipping_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
            discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            points_earned INT NOT NULL DEFAULT 0,
            points_redeemed INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_orders_order_number (order_number),
            INDEX idx_orders_user_id (user_id),
            CONSTRAINT fk_orders_user
                FOREIGN KEY (user_id) REFERENCES users(id)
                ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS order_items (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            order_id INT UNSIGNED NOT NULL,
            product_id INT UNSIGNED NOT NULL,
            product_brand VARCHAR(120) NOT NULL,
            product_name VARCHAR(190) NOT NULL,
            product_size VARCHAR(120) NOT NULL DEFAULT "",
            unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            qty INT UNSIGNED NOT NULL DEFAULT 1,
            line_total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_order_items_order_id (order_id),
            CONSTRAINT fk_order_items_order
                FOREIGN KEY (order_id) REFERENCES orders(id)
                ON DELETE CASCADE,
            CONSTRAINT fk_order_items_product
                FOREIGN KEY (product_id) REFERENCES products(id)
                ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

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
            INDEX idx_loyalty_transactions_order_id (order_id),
            CONSTRAINT fk_loyalty_transactions_user
                FOREIGN KEY (user_id) REFERENCES users(id)
                ON DELETE CASCADE,
            CONSTRAINT fk_loyalty_transactions_order
                FOREIGN KEY (order_id) REFERENCES orders(id)
                ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $ready = true;
}

function loyalty_get_tier(int $points): array
{
    if ($points >= 3000) {
        return [
            'key' => 'platinum',
            'label' => 'Platinum Member',
            'watermark' => 'Platinum',
            'icon' => '💎',
            'discount_percent' => 20,
            'discount_cost_points' => 2000,
            'next_name' => null,
            'next_at' => null,
        ];
    }

    if ($points >= 1000) {
        return [
            'key' => 'gold',
            'label' => 'Gold Member',
            'watermark' => 'Gold',
            'icon' => '⭐',
            'discount_percent' => 10,
            'discount_cost_points' => 1000,
            'next_name' => 'Platinum',
            'next_at' => 3000,
        ];
    }

    return [
        'key' => 'bronze',
        'label' => 'Bronze Member',
        'watermark' => 'Bronze',
        'icon' => '🥉',
        'discount_percent' => 5,
        'discount_cost_points' => 500,
        'next_name' => 'Gold',
        'next_at' => 1000,
    ];
}

try {
    loyalty_ensure_tables($pdo);

    $user_id = (int) ($_SESSION['user_id'] ?? 0);
    $statement = $pdo->prepare(
        'SELECT id, name, email, member_id, loyalty_points
         FROM users
         WHERE id = :id
         LIMIT 1'
    );
    $statement->execute([':id' => $user_id]);
    $user = $statement->fetch(PDO::FETCH_ASSOC);

    if ($user === false) {
        auth_guard_clear_state();
        api_send_error('User not found.', 401);
    }

    $points = (int) ($user['loyalty_points'] ?? 0);
    $_SESSION['loyalty_points'] = $points;
    $_SESSION['member_id'] = (string) ($user['member_id'] ?? '');

    $tier = loyalty_get_tier($points);
    $available_reward = $points >= $tier['discount_cost_points']
        ? [
            'discount_percent' => $tier['discount_percent'],
            'discount_cost_points' => $tier['discount_cost_points'],
          ]
        : null;

    $history_statement = $pdo->prepare(
        'SELECT transaction_type, points_delta, description, created_at
         FROM loyalty_transactions
         WHERE user_id = :user_id
         ORDER BY created_at DESC, id DESC
         LIMIT 20'
    );
    $history_statement->execute([':user_id' => $user_id]);
    $history_rows = $history_statement->fetchAll(PDO::FETCH_ASSOC);

    $history = array_map(static function (array $row): array {
        return [
            'transaction_type' => (string) ($row['transaction_type'] ?? ''),
            'points_delta' => (int) ($row['points_delta'] ?? 0),
            'description' => (string) ($row['description'] ?? ''),
            'created_at' => (string) ($row['created_at'] ?? ''),
        ];
    }, $history_rows);

    api_send_json([
        'success' => true,
        'user' => [
            'name' => (string) ($user['name'] ?? ''),
            'email' => (string) ($user['email'] ?? ''),
            'member_id' => (string) ($user['member_id'] ?? ''),
            'loyalty_points' => $points,
        ],
        'tier' => $tier,
        'available_reward' => $available_reward,
        'history' => $history,
    ]);
} catch (Throwable $exception) {
    error_log('[api/loyalty.php] ' . $exception->getMessage());
    api_send_error('Failed to load loyalty details.', 500);
}
