<?php
define('AB_STORE', true);
require_once __DIR__ . '/../includes/api_bootstrap.php';

if (!headers_sent()) {
    header('Cache-Control: public, max-age=120');
}

try {
    $statement = $pdo->query(
        'SELECT id, brand, name, category, size, price, old_price, stars, badge, image_url
         FROM products
         ORDER BY stars DESC, created_at DESC'
    );
    $products = $statement->fetchAll(PDO::FETCH_ASSOC);

    foreach ($products as &$product) {
        $product['id'] = (int) $product['id'];
        $product['price'] = (float) $product['price'];
        $product['old_price'] = $product['old_price'] !== null ? (float) $product['old_price'] : null;
        $product['stars'] = (float) $product['stars'];
    }
    unset($product);

    api_send_json([
        'success' => true,
        'total' => count($products),
        'products' => $products,
    ]);
} catch (Throwable $exception) {
    error_log('[api/chatbot_catalog.php] ' . $exception->getMessage());
    api_send_error('Failed to load catalog.', 500);
}
