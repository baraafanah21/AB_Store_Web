<?php
define('AB_STORE', true);
$allowed_roles = ['admin', 'employee'];
require_once __DIR__ . '/../includes/api_bootstrap.php';
require_once __DIR__ . '/../auth/auth_guard.php';
auth_guard_require_roles($allowed_roles);

try {
    $category = trim((string) ($_GET['category'] ?? ''));
    $allowed_categories = ['her', 'him', 'unisex', 'niche'];

    if ($category !== '' && in_array($category, $allowed_categories, true)) {
        $statement = $pdo->prepare(
            'SELECT id, brand, name, category, size, price, old_price, stars, badge, image_url
             FROM products
             WHERE category = :category
             ORDER BY created_at DESC'
        );
        $statement->execute([':category' => $category]);
    } else {
        $statement = $pdo->prepare(
            'SELECT id, brand, name, category, size, price, old_price, stars, badge, image_url
             FROM products
             ORDER BY created_at DESC'
        );
        $statement->execute();
    }

    $products = $statement->fetchAll(PDO::FETCH_ASSOC);

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'exported_at' => date('c'),
        'exported_by' => (string) ($_SESSION['name'] ?? 'unknown'),
        'total' => count($products),
        'products' => $products,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
} catch (Throwable $exception) {
    error_log('[api/products_json.php] ' . $exception->getMessage());
    api_send_error('Failed to load products.', 500);
}
