<?php
define('AB_STORE', true);
require_once __DIR__ . '/../includes/api_bootstrap.php';

api_require_method('POST');

$request_data = api_read_json_input();
api_verify_csrf($request_data);

try {
    $query = trim((string) ($request_data['query'] ?? ''));
    $category = trim((string) ($request_data['category'] ?? 'all'));
    $query = mb_substr($query, 0, 100);

    if ($query === '') {
        api_send_json(['success' => true, 'results' => [], 'count' => 0]);
    }

    $allowed_categories = ['her', 'him', 'unisex', 'niche'];
    $search_value = '%' . $query . '%';

    if ($category !== 'all' && in_array($category, $allowed_categories, true)) {
        $statement = $pdo->prepare(
            'SELECT id, brand, name, category, price, old_price, stars, badge, image_url
             FROM products
             WHERE (brand LIKE :brand OR name LIKE :name) AND category = :category
             ORDER BY created_at DESC
             LIMIT 10'
        );
        $statement->execute([
            ':brand' => $search_value,
            ':name' => $search_value,
            ':category' => $category,
        ]);
    } else {
        $statement = $pdo->prepare(
            'SELECT id, brand, name, category, price, old_price, stars, badge, image_url
             FROM products
             WHERE brand LIKE :brand OR name LIKE :name
             ORDER BY created_at DESC
             LIMIT 10'
        );
        $statement->execute([
            ':brand' => $search_value,
            ':name' => $search_value,
        ]);
    }

    $results = $statement->fetchAll(PDO::FETCH_ASSOC);

    api_send_json([
        'success' => true,
        'results' => $results,
        'count' => count($results),
    ]);
} catch (Throwable $exception) {
    error_log('[api/search.php] ' . $exception->getMessage());
    api_send_error('Server error.', 500);
}
