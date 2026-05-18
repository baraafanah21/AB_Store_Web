<?php
define('AB_STORE', true);
require_once __DIR__ . '/../includes/api_bootstrap.php';
require_once __DIR__ . '/../auth/auth_guard.php';
require_once __DIR__ . '/../config/mail.php';

const CART_MAX_QTY_PER_LINE = 99;

api_require_method('POST');

$request_data = api_read_json_input();
api_verify_csrf($request_data);
api_require_login('Please log in to manage your cart.');

function cart_distinct_count(PDO $pdo, int $user_id): int
{
    $statement = $pdo->prepare('SELECT COALESCE(SUM(qty), 0) FROM cart_items WHERE user_id = :user_id');
    $statement->execute([':user_id' => $user_id]);
    return (int) $statement->fetchColumn();
}

function cart_table_has_column(PDO $pdo, string $table, string $column): bool
{
    $statement = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column'
    );
    $statement->execute([':table' => $table, ':column' => $column]);
    return (int) $statement->fetchColumn() > 0;
}

function cart_ensure_cart_items_table(PDO $pdo): void
{
    static $ready = false;

    if ($ready) {
        return;
    }

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS cart_items (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id INT UNSIGNED NOT NULL,
            product_id INT UNSIGNED NOT NULL,
            qty INT UNSIGNED NOT NULL DEFAULT 1,
            added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_cart_user_product (user_id, product_id),
            INDEX idx_cart_user_id (user_id),
            INDEX idx_cart_product_id (product_id),
            CONSTRAINT fk_cart_items_user
                FOREIGN KEY (user_id) REFERENCES users(id)
                ON DELETE CASCADE,
            CONSTRAINT fk_cart_items_product
                FOREIGN KEY (product_id) REFERENCES products(id)
                ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $cart_columns = [
        'qty' => 'INT UNSIGNED NOT NULL DEFAULT 1',
        'added_at' => 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
    ];
    foreach ($cart_columns as $column => $definition) {
        if (!cart_table_has_column($pdo, 'cart_items', $column)) {
            $pdo->exec("ALTER TABLE cart_items ADD COLUMN {$column} {$definition}");
        }
    }

    try {
        $pdo->exec('ALTER TABLE cart_items ADD UNIQUE KEY uniq_cart_user_product (user_id, product_id)');
    } catch (PDOException $e) {
        // key already exists — ignore
    }

    $ready = true;
}

function cart_ensure_loyalty_tables(PDO $pdo): void
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

    $orders_columns = [
        'order_number'    => "VARCHAR(32) NOT NULL DEFAULT ''",
        'payment_method'  => "VARCHAR(20) NOT NULL DEFAULT 'card'",
        'status'          => "VARCHAR(20) NOT NULL DEFAULT 'placed'",
        'subtotal'        => 'DECIMAL(10,2) NOT NULL DEFAULT 0.00',
        'shipping_amount' => 'DECIMAL(10,2) NOT NULL DEFAULT 0.00',
        'discount_percent'=> 'DECIMAL(5,2) NOT NULL DEFAULT 0.00',
        'discount_amount' => 'DECIMAL(10,2) NOT NULL DEFAULT 0.00',
        'total_amount'    => 'DECIMAL(10,2) NOT NULL DEFAULT 0.00',
        'points_earned'   => 'INT NOT NULL DEFAULT 0',
        'points_redeemed' => 'INT NOT NULL DEFAULT 0',
        'created_at'      => 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
    ];
    foreach ($orders_columns as $column => $definition) {
        if (!cart_table_has_column($pdo, 'orders', $column)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN {$column} {$definition}");
        }
    }
    if (!cart_table_has_column($pdo, 'orders', 'order_number')) {
        // safety net — should be added above
        $pdo->exec("ALTER TABLE orders ADD COLUMN order_number VARCHAR(32) NOT NULL DEFAULT ''");
    }
    $pdo->exec("UPDATE orders SET order_number = CONCAT('AB-', LPAD(id, 8, '0')) WHERE order_number = '' OR order_number IS NULL");
    try {
        $pdo->exec('ALTER TABLE orders ADD UNIQUE KEY uniq_orders_order_number (order_number)');
    } catch (PDOException $e) {
        // index already exists — ignore
    }

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

    $order_items_columns = [
        'product_brand' => "VARCHAR(120) NOT NULL DEFAULT ''",
        'product_name'  => "VARCHAR(190) NOT NULL DEFAULT ''",
        'product_size'  => "VARCHAR(120) NOT NULL DEFAULT ''",
        'unit_price'    => 'DECIMAL(10,2) NOT NULL DEFAULT 0.00',
        'qty'           => 'INT UNSIGNED NOT NULL DEFAULT 1',
        'line_total'    => 'DECIMAL(10,2) NOT NULL DEFAULT 0.00',
        'created_at'    => 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
    ];
    foreach ($order_items_columns as $column => $definition) {
        if (!cart_table_has_column($pdo, 'order_items', $column)) {
            $pdo->exec("ALTER TABLE order_items ADD COLUMN {$column} {$definition}");
        }
    }

    $loyalty_columns = [
        'order_id'         => 'INT UNSIGNED NULL',
        'transaction_type' => "VARCHAR(20) NOT NULL DEFAULT 'earn'",
        'points_delta'     => 'INT NOT NULL DEFAULT 0',
        'description'      => "VARCHAR(255) NOT NULL DEFAULT ''",
        'created_at'       => 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
    ];
    foreach ($loyalty_columns as $column => $definition) {
        if (!cart_table_has_column($pdo, 'loyalty_transactions', $column)) {
            $pdo->exec("ALTER TABLE loyalty_transactions ADD COLUMN {$column} {$definition}");
        }
    }

    $ready = true;
}

function cart_get_loyalty_reward(int $points): array
{
    if ($points >= 3000) {
        return ['tier' => 'platinum', 'discount_percent' => 20, 'discount_cost_points' => 2000];
    }

    if ($points >= 1000) {
        return ['tier' => 'gold', 'discount_percent' => 10, 'discount_cost_points' => 1000];
    }

    return ['tier' => 'bronze', 'discount_percent' => 5, 'discount_cost_points' => 500];
}

function cart_build_loyalty_summary(array $user_row): array
{
    $points = (int) ($user_row['loyalty_points'] ?? 0);
    $reward = cart_get_loyalty_reward($points);

    return [
        'points' => $points,
        'member_id' => (string) ($user_row['member_id'] ?? ''),
        'tier' => (string) $reward['tier'],
        'available_discount_percent' => $points >= (int) $reward['discount_cost_points']
            ? (int) $reward['discount_percent']
            : 0,
        'discount_cost_points' => (int) $reward['discount_cost_points'],
    ];
}

function cart_generate_order_number(): string
{
    return 'AB-' . strtoupper(bin2hex(random_bytes(4)));
}

try {
    cart_ensure_cart_items_table($pdo);
    cart_ensure_loyalty_tables($pdo);

    $user_id = (int) ($_SESSION['user_id'] ?? 0);
    $action = (string) ($request_data['action'] ?? '');
    $product_id = (int) ($request_data['product_id'] ?? 0);
    $quantity = (int) ($request_data['qty'] ?? 1);

    $user_statement = $pdo->prepare(
        'SELECT id, member_id, loyalty_points
         FROM users
         WHERE id = :id
         LIMIT 1'
    );
    $user_statement->execute([':id' => $user_id]);
    $user_row = $user_statement->fetch(PDO::FETCH_ASSOC);

    if ($user_row === false) {
        api_send_error('User not found.', 401);
    }

    switch ($action) {
        case 'add':
            if ($product_id <= 0 || $quantity < 1) {
                api_send_error('Invalid input.', 422);
            }
            if ($quantity > CART_MAX_QTY_PER_LINE) {
                $quantity = CART_MAX_QTY_PER_LINE;
            }

            $product_statement = $pdo->prepare('SELECT id FROM products WHERE id = :id LIMIT 1');
            $product_statement->execute([':id' => $product_id]);
            if ($product_statement->fetch(PDO::FETCH_ASSOC) === false) {
                api_send_error('Product not found.', 404);
            }

            $insert_statement = $pdo->prepare(
                'INSERT INTO cart_items (user_id, product_id, qty)
                 VALUES (:user_id, :product_id, :qty)
                 ON DUPLICATE KEY UPDATE qty = LEAST(qty + VALUES(qty), :cap)'
            );
            $insert_statement->execute([
                ':user_id' => $user_id,
                ':product_id' => $product_id,
                ':qty' => $quantity,
                ':cap' => CART_MAX_QTY_PER_LINE,
            ]);

            api_send_json(['success' => true, 'cart_count' => cart_distinct_count($pdo, $user_id)]);

        case 'remove':
            if ($product_id <= 0) {
                api_send_error('Invalid input.', 422);
            }

            $delete_statement = $pdo->prepare('DELETE FROM cart_items WHERE user_id = :user_id AND product_id = :product_id');
            $delete_statement->execute([
                ':user_id' => $user_id,
                ':product_id' => $product_id,
            ]);

            api_send_json(['success' => true, 'cart_count' => cart_distinct_count($pdo, $user_id)]);

        case 'update':
            if ($product_id <= 0) {
                api_send_error('Invalid input.', 422);
            }

            if ($quantity <= 0) {
                $delete_statement = $pdo->prepare('DELETE FROM cart_items WHERE user_id = :user_id AND product_id = :product_id');
                $delete_statement->execute([
                    ':user_id' => $user_id,
                    ':product_id' => $product_id,
                ]);
            } else {
                if ($quantity > CART_MAX_QTY_PER_LINE) {
                    $quantity = CART_MAX_QTY_PER_LINE;
                }
                $update_statement = $pdo->prepare('UPDATE cart_items SET qty = :qty WHERE user_id = :user_id AND product_id = :product_id');
                $update_statement->execute([
                    ':qty' => $quantity,
                    ':user_id' => $user_id,
                    ':product_id' => $product_id,
                ]);
            }

            api_send_json(['success' => true, 'cart_count' => cart_distinct_count($pdo, $user_id)]);

        case 'get':
            $statement = $pdo->prepare(
                'SELECT c.product_id, c.qty, p.brand, p.name, p.category, p.size, p.price, p.old_price, p.image_url
                 FROM cart_items AS c
                 INNER JOIN products AS p ON p.id = c.product_id
                 WHERE c.user_id = :user_id
                 ORDER BY c.added_at DESC'
            );
            $statement->execute([':user_id' => $user_id]);
            $cart_rows = $statement->fetchAll(PDO::FETCH_ASSOC);

            $items = [];
            $grand_total = 0.0;

            foreach ($cart_rows as $cart_row) {
                $price = (float) $cart_row['price'];
                $row_quantity = (int) $cart_row['qty'];
                $subtotal = $price * $row_quantity;
                $grand_total += $subtotal;

                $items[] = [
                    'product_id' => (int) $cart_row['product_id'],
                    'brand' => (string) $cart_row['brand'],
                    'name' => (string) $cart_row['name'],
                    'category' => (string) $cart_row['category'],
                    'size' => (string) $cart_row['size'],
                    'price' => $price,
                    'old_price' => $cart_row['old_price'] !== null ? (float) $cart_row['old_price'] : null,
                    'image_url' => (string) ($cart_row['image_url'] ?? ''),
                    'qty' => $row_quantity,
                    'subtotal' => round($subtotal, 2),
                ];
            }

            api_send_json([
                'success' => true,
                'items' => $items,
                'grand_total' => round($grand_total, 2),
                'cart_count' => count($items),
                'loyalty' => cart_build_loyalty_summary($user_row),
            ]);

        case 'checkout':
            $payment_method = (string) ($request_data['payment_method'] ?? 'card');
            $apply_loyalty = (bool) ($request_data['apply_loyalty'] ?? false);
            $allowed_methods = ['card', 'paypal', 'cod'];

            if (!in_array($payment_method, $allowed_methods, true)) {
                api_send_error('Invalid payment method.', 422);
            }

            $pdo->beginTransaction();

            $locked_user_statement = $pdo->prepare(
                'SELECT id, name, email, member_id, loyalty_points
                 FROM users
                 WHERE id = :id
                 LIMIT 1
                 FOR UPDATE'
            );
            $locked_user_statement->execute([':id' => $user_id]);
            $locked_user = $locked_user_statement->fetch(PDO::FETCH_ASSOC);

            $cart_statement = $pdo->prepare(
                'SELECT c.product_id, c.qty, p.brand, p.name, p.size, p.price
                 FROM cart_items AS c
                 INNER JOIN products AS p ON p.id = c.product_id
                 WHERE c.user_id = :user_id
                 ORDER BY c.added_at ASC
                 FOR UPDATE'
            );
            $cart_statement->execute([':user_id' => $user_id]);
            $cart_rows = $cart_statement->fetchAll(PDO::FETCH_ASSOC);

            if ($cart_rows === []) {
                $pdo->rollBack();
                api_send_error('Your cart is empty.', 422);
            }

            $subtotal = 0.0;
            foreach ($cart_rows as $cart_row) {
                $subtotal += (float) $cart_row['price'] * (int) $cart_row['qty'];
            }

            $shipping = $subtotal >= 200 ? 0.0 : 15.0;
            $current_points = (int) ($locked_user['loyalty_points'] ?? 0);
            $reward = cart_get_loyalty_reward($current_points);
            $discount_percent = 0;
            $points_redeemed = 0;

            if ($apply_loyalty) {
                if ($current_points < (int) $reward['discount_cost_points']) {
                    $pdo->rollBack();
                    api_send_error('Not enough loyalty points for the selected reward.', 422);
                }

                $discount_percent = (int) $reward['discount_percent'];
                $points_redeemed = (int) $reward['discount_cost_points'];
            }

            $discount_amount = round($subtotal * ($discount_percent / 100), 2);
            $total = round(($subtotal - $discount_amount) + $shipping, 2);
            $points_earned = (int) floor(max(0, $subtotal - $discount_amount));
            $updated_points = max(0, $current_points - $points_redeemed + $points_earned);

            $order_number = cart_generate_order_number();
            $order_statement = $pdo->prepare(
                'INSERT INTO orders (
                    order_number, user_id, payment_method, status, subtotal, shipping_amount,
                    discount_percent, discount_amount, total_amount, points_earned, points_redeemed
                 ) VALUES (
                    :order_number, :user_id, :payment_method, :status, :subtotal, :shipping_amount,
                    :discount_percent, :discount_amount, :total_amount, :points_earned, :points_redeemed
                 )'
            );
            $order_statement->execute([
                ':order_number' => $order_number,
                ':user_id' => $user_id,
                ':payment_method' => $payment_method,
                ':status' => 'placed',
                ':subtotal' => round($subtotal, 2),
                ':shipping_amount' => round($shipping, 2),
                ':discount_percent' => $discount_percent,
                ':discount_amount' => $discount_amount,
                ':total_amount' => $total,
                ':points_earned' => $points_earned,
                ':points_redeemed' => $points_redeemed,
            ]);
            $order_id = (int) $pdo->lastInsertId();

            $order_item_statement = $pdo->prepare(
                'INSERT INTO order_items (
                    order_id, product_id, product_brand, product_name, product_size, unit_price, qty, line_total
                 ) VALUES (
                    :order_id, :product_id, :product_brand, :product_name, :product_size, :unit_price, :qty, :line_total
                 )'
            );

            foreach ($cart_rows as $cart_row) {
                $unit_price = (float) $cart_row['price'];
                $qty = (int) $cart_row['qty'];
                $order_item_statement->execute([
                    ':order_id' => $order_id,
                    ':product_id' => (int) $cart_row['product_id'],
                    ':product_brand' => (string) $cart_row['brand'],
                    ':product_name' => (string) $cart_row['name'],
                    ':product_size' => (string) ($cart_row['size'] ?? ''),
                    ':unit_price' => round($unit_price, 2),
                    ':qty' => $qty,
                    ':line_total' => round($unit_price * $qty, 2),
                ]);
            }

            $update_user_statement = $pdo->prepare(
                'UPDATE users
                 SET loyalty_points = :loyalty_points
                 WHERE id = :id'
            );
            $update_user_statement->execute([
                ':loyalty_points' => $updated_points,
                ':id' => $user_id,
            ]);

            $loyalty_statement = $pdo->prepare(
                'INSERT INTO loyalty_transactions (user_id, order_id, transaction_type, points_delta, description)
                 VALUES (:user_id, :order_id, :transaction_type, :points_delta, :description)'
            );

            if ($points_redeemed > 0) {
                $loyalty_statement->execute([
                    ':user_id' => $user_id,
                    ':order_id' => $order_id,
                    ':transaction_type' => 'redeem',
                    ':points_delta' => -$points_redeemed,
                    ':description' => sprintf('Used %d%% loyalty discount on order %s', $discount_percent, $order_number),
                ]);
            }

            if ($points_earned > 0) {
                $loyalty_statement->execute([
                    ':user_id' => $user_id,
                    ':order_id' => $order_id,
                    ':transaction_type' => 'earn',
                    ':points_delta' => $points_earned,
                    ':description' => sprintf('Earned points from order %s', $order_number),
                ]);
            }

            $clear_cart_statement = $pdo->prepare('DELETE FROM cart_items WHERE user_id = :user_id');
            $clear_cart_statement->execute([':user_id' => $user_id]);

            $pdo->commit();

            $_SESSION['loyalty_points'] = $updated_points;

            $order_payload = [
                'id' => $order_id,
                'order_number' => $order_number,
                'created_at' => date('Y-m-d H:i:s'),
                'payment_method' => $payment_method,
                'status' => 'placed',
                'subtotal' => round($subtotal, 2),
                'shipping_amount' => round($shipping, 2),
                'discount_percent' => $discount_percent,
                'discount_amount' => $discount_amount,
                'total_amount' => $total,
                'points_earned' => $points_earned,
                'points_redeemed' => $points_redeemed,
                'items' => array_map(static function (array $cart_row): array {
                    $unit_price = round((float) $cart_row['price'], 2);
                    $qty = (int) $cart_row['qty'];
                    return [
                        'product_id' => (int) $cart_row['product_id'],
                        'brand' => (string) $cart_row['brand'],
                        'name' => (string) $cart_row['name'],
                        'size' => (string) ($cart_row['size'] ?? ''),
                        'qty' => $qty,
                        'unit_price' => $unit_price,
                        'line_total' => round($unit_price * $qty, 2),
                    ];
                }, $cart_rows),
                'customer' => [
                    'name' => (string) ($locked_user['name'] ?? ''),
                    'email' => (string) ($locked_user['email'] ?? ''),
                    'member_id' => (string) ($locked_user['member_id'] ?? ''),
                ],
            ];

            $customer_email = (string) ($locked_user['email'] ?? '');
            if ($customer_email !== '') {
                try {
                    mail_send_order_invoice($customer_email, $order_payload);
                } catch (Throwable $mail_exception) {
                    error_log('[api/cart.php] invoice email failed: ' . $mail_exception->getMessage());
                }
            }

            api_send_json([
                'success' => true,
                'order' => $order_payload,
                'loyalty' => [
                    'points' => $updated_points,
                    'member_id' => (string) ($locked_user['member_id'] ?? ''),
                    'tier' => cart_get_loyalty_reward($updated_points)['tier'],
                ],
                'cart_count' => 0,
            ]);

        default:
            api_send_error('Unknown action.', 400);
    }
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('[api/cart.php] ' . $exception->getMessage());
    api_send_error('Server error.', 500);
}
