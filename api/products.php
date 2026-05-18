<?php
define('AB_STORE', true);
require_once __DIR__ . '/../includes/api_bootstrap.php';

api_require_method('POST');

$request_data = api_read_json_input();
api_verify_csrf($request_data);

try {
    $action = (string) ($request_data['action'] ?? 'filter');
    if ($action !== 'filter') {
        api_send_error('Unknown action.', 400);
    }

    $category = (string) ($request_data['category'] ?? 'all');
    $sort = (string) ($request_data['sort'] ?? 'newest');
    $page = (int) ($request_data['page'] ?? 1);
    $page = $page < 1 ? 1 : $page;

    $products_per_page = 12;
    $offset = ($page - 1) * $products_per_page;
    $allowed_categories = ['her', 'him', 'unisex', 'niche'];
    $sort_map = [
        'newest' => 'created_at DESC',
        'price_asc' => 'price ASC',
        'price_desc' => 'price DESC',
        'stars' => 'stars DESC',
    ];

    $use_category = $category !== 'all' && in_array($category, $allowed_categories, true);
    $order_by = $sort_map[$sort] ?? $sort_map['newest'];

    if ($use_category) {
        $count_statement = $pdo->prepare('SELECT COUNT(*) FROM products WHERE category = :category');
        $count_statement->execute([':category' => $category]);
    } else {
        $count_statement = $pdo->prepare('SELECT COUNT(*) FROM products');
        $count_statement->execute();
    }

    $total_products = (int) $count_statement->fetchColumn();
    $total_pages = $total_products > 0 ? (int) ceil($total_products / $products_per_page) : 0;
    $safe_limit = (int) $products_per_page;
    $safe_offset = (int) $offset;

    $base_query = 'SELECT id, brand, name, category, size, price, old_price, stars, badge, badge_class, image_url
                   FROM products';

    if ($use_category) {
        $statement = $pdo->prepare($base_query . " WHERE category = :category ORDER BY {$order_by} LIMIT {$safe_limit} OFFSET {$safe_offset}");
        $statement->execute([':category' => $category]);
    } else {
        $statement = $pdo->prepare($base_query . " ORDER BY {$order_by} LIMIT {$safe_limit} OFFSET {$safe_offset}");
        $statement->execute();
    }

    $products = $statement->fetchAll(PDO::FETCH_ASSOC);

    api_send_json([
        'success' => true,
        'products' => $products,
        'total' => $total_products,
        'page' => $page,
        'total_pages' => $total_pages,
    ]);
} catch (Throwable $exception) {
    error_log('[api/products.php] ' . $exception->getMessage());
    api_send_error('Server error.', 500);
}
