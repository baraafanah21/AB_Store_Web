<?php
define('AB_STORE', true);
require_once __DIR__ . '/admin_common.php';

try {
    $users = $pdo->query(
        'SELECT id, name, email, role, DATE_FORMAT(created_at, "%Y-%m-%d") AS joined_at
         FROM users
         ORDER BY created_at DESC, id DESC
         LIMIT 6'
    )->fetchAll(PDO::FETCH_ASSOC);

    $user_count = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
    $product_count = (int) $pdo->query('SELECT COUNT(*) FROM products')->fetchColumn();
    $cart_count = admin_table_exists($pdo, 'cart_items')
        ? (int) $pdo->query('SELECT COALESCE(SUM(qty), 0) FROM cart_items')->fetchColumn()
        : 0;

    $message_count = 0;
    if (admin_table_exists($pdo, 'contact_messages')) {
        $message_count = (int) $pdo->query('SELECT COUNT(*) FROM contact_messages')->fetchColumn();
    } elseif (admin_table_exists($pdo, 'messages')) {
        $message_count = (int) $pdo->query('SELECT COUNT(*) FROM messages')->fetchColumn();
    }

    $category_totals = [
        'her' => 0.0,
        'him' => 0.0,
        'unisex' => 0.0,
        'niche' => 0.0,
    ];
    if (admin_table_exists($pdo, 'orders') && admin_table_exists($pdo, 'order_items')) {
        // Real revenue per category: join order_items -> products, summing line_total
        // (fallback to qty * unit_price if line_total is missing/zero) for all
        // non-cancelled orders. Order statuses used in this project: placed,
        // paid, shipped, delivered, cancelled — we exclude only 'cancelled'.
        $category_rows = $pdo->query(
            "SELECT p.category AS category,
                    SUM(
                        CASE
                            WHEN oi.line_total IS NOT NULL AND oi.line_total > 0
                                THEN oi.line_total
                            ELSE oi.qty * oi.unit_price
                        END
                    ) AS revenue
             FROM order_items oi
             INNER JOIN orders o ON o.id = oi.order_id
             INNER JOIN products p ON p.id = oi.product_id
             WHERE o.status <> 'cancelled'
             GROUP BY p.category"
        )->fetchAll(PDO::FETCH_ASSOC);
        foreach ($category_rows as $category_row) {
            $category = (string) ($category_row['category'] ?? '');
            if (isset($category_totals[$category])) {
                $category_totals[$category] = (float) ($category_row['revenue'] ?? 0);
            }
        }
    }

    $role_counts = [
        'user' => 0,
        'employee' => 0,
        'admin' => 0,
    ];
    $role_rows = $pdo->query(
        'SELECT role, COUNT(*) AS total
         FROM users
         GROUP BY role'
    )->fetchAll(PDO::FETCH_ASSOC);
    foreach ($role_rows as $role_row) {
        $role = (string) ($role_row['role'] ?? '');
        $role_counts[$role] = (int) ($role_row['total'] ?? 0);
    }

    admin_json_response([
        'success' => true,
        'stats' => [
            'users' => $user_count,
            'products' => $product_count,
            'messages' => $message_count,
            'cart' => $cart_count,
        ],
        'category_totals' => $category_totals,
        'role_counts' => $role_counts,
        'recent_users' => $users,
    ]);
} catch (Throwable $exception) {
    error_log('[api/admin_overview.php] ' . $exception->getMessage());
    admin_json_response([
        'success' => false,
        'error' => 'Failed to load dashboard overview.',
    ], 500);
}
