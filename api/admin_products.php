<?php
define('AB_STORE', true);
$allowed_roles = ['admin', 'employee'];
require_once __DIR__ . '/admin_common.php';
require_once __DIR__ . '/../includes/upload.php';

function admin_product_payload(array $product_row): array
{
    return [
        'id' => (int) ($product_row['id'] ?? 0),
        'brand' => (string) ($product_row['brand'] ?? ''),
        'name' => (string) ($product_row['name'] ?? ''),
        'category' => (string) ($product_row['category'] ?? ''),
        'size' => (string) ($product_row['size'] ?? ''),
        'price' => $product_row['price'] !== null ? (float) $product_row['price'] : 0.0,
        'old_price' => $product_row['old_price'] !== null ? (float) $product_row['old_price'] : null,
        'stars' => (int) ($product_row['stars'] ?? 0),
        'badge' => $product_row['badge'] !== null ? (string) $product_row['badge'] : null,
        'badge_class' => $product_row['badge_class'] !== null ? (string) $product_row['badge_class'] : null,
        'image_url' => (string) ($product_row['image_url'] ?? ''),
    ];
}

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $product_id = (int) ($_GET['id'] ?? 0);
        if ($product_id > 0) {
            $statement = $pdo->prepare(
                'SELECT id, brand, name, category, size, price, old_price, stars, badge, badge_class, image_url
                 FROM products
                 WHERE id = :id
                 LIMIT 1'
            );
            $statement->execute([':id' => $product_id]);
            $product = $statement->fetch(PDO::FETCH_ASSOC);

            if ($product === false) {
                admin_json_response(['success' => false, 'error' => 'Product not found.'], 404);
            }

            admin_json_response([
                'success' => true,
                'product' => admin_product_payload($product),
            ]);
        }

        $products = $pdo->query(
            'SELECT id, brand, name, category, size, price, old_price, stars, badge, badge_class, image_url
             FROM products
             ORDER BY created_at DESC, id DESC'
        )->fetchAll(PDO::FETCH_ASSOC);

        admin_json_response([
            'success' => true,
            'products' => array_map('admin_product_payload', $products),
        ]);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        admin_json_response(['success' => false, 'error' => 'Method not allowed.'], 405);
    }

    $payload = admin_json_input();
    admin_verify_csrf_from_payload($payload);

    $action = (string) ($payload['action'] ?? '');
    $allowed_categories = ['her', 'him', 'unisex', 'niche'];
    $allowed_badge_classes = ['badge-new', 'badge-sale', 'badge-niche'];

    if ($action === 'create') {
        $brand = trim((string) ($payload['brand'] ?? ''));
        $name = trim((string) ($payload['name'] ?? ''));
        $category = trim((string) ($payload['category'] ?? ''));
        $size = trim((string) ($payload['size'] ?? ''));
        $price = (float) ($payload['price'] ?? 0);
        $old_price = ($payload['old_price'] ?? '') === '' ? null : (float) $payload['old_price'];
        $stars = (int) ($payload['stars'] ?? 0);
        $badge = trim((string) ($payload['badge'] ?? ''));
        $badge_class = trim((string) ($payload['badge_class'] ?? ''));

        if ($brand === '' || $name === '' || $category === '' || $size === '' || $price <= 0) {
            admin_json_response(['success' => false, 'error' => 'Please fill all product fields.'], 422);
        }
        if (!in_array($category, $allowed_categories, true)) {
            admin_json_response(['success' => false, 'error' => 'Invalid category selected.'], 422);
        }
        if ($old_price !== null && $old_price <= $price) {
            admin_json_response(['success' => false, 'error' => 'Old price must be greater than the current price.'], 422);
        }
        if ($stars < 0 || $stars > 5) {
            admin_json_response(['success' => false, 'error' => 'Stars must be between 0 and 5.'], 422);
        }
        if ($badge_class !== '' && !in_array($badge_class, $allowed_badge_classes, true)) {
            admin_json_response(['success' => false, 'error' => 'Invalid badge style selected.'], 422);
        }

        $image_url = null;
        try {
            $image_url = handle_image_upload('image');
        } catch (RuntimeException $exception) {
            admin_json_response(['success' => false, 'error' => $exception->getMessage()], 422);
        }

        $insert_statement = $pdo->prepare(
            'INSERT INTO products (brand, name, category, size, price, old_price, stars, badge, badge_class, image_url, created_by)
             VALUES (:brand, :name, :category, :size, :price, :old_price, :stars, :badge, :badge_class, :image_url, :created_by)'
        );
        $insert_statement->execute([
            ':brand' => $brand,
            ':name' => $name,
            ':category' => $category,
            ':size' => $size,
            ':price' => $price,
            ':old_price' => $old_price,
            ':stars' => $stars,
            ':badge' => $badge !== '' ? $badge : null,
            ':badge_class' => $badge_class !== '' ? $badge_class : null,
            ':image_url' => $image_url,
            ':created_by' => (int) ($_SESSION['user_id'] ?? 0),
        ]);

        admin_json_response([
            'success' => true,
            'id' => (int) $pdo->lastInsertId(),
        ]);
    }

    if ($action === 'update') {
        $product_id = (int) ($payload['id'] ?? 0);
        $brand = trim((string) ($payload['brand'] ?? ''));
        $name = trim((string) ($payload['name'] ?? ''));
        $category = trim((string) ($payload['category'] ?? ''));
        $size = trim((string) ($payload['size'] ?? ''));
        $price = (float) ($payload['price'] ?? 0);
        $old_price = ($payload['old_price'] ?? '') === '' ? null : (float) $payload['old_price'];
        $stars = (int) ($payload['stars'] ?? 0);
        $badge = trim((string) ($payload['badge'] ?? ''));
        $badge_class = trim((string) ($payload['badge_class'] ?? ''));

        if ($product_id <= 0 || $brand === '' || $name === '' || $category === '' || $size === '' || $price <= 0) {
            admin_json_response(['success' => false, 'error' => 'Please fill all product fields.'], 422);
        }
        if (!in_array($category, $allowed_categories, true)) {
            admin_json_response(['success' => false, 'error' => 'Invalid category selected.'], 422);
        }
        if ($old_price !== null && $old_price <= $price) {
            admin_json_response(['success' => false, 'error' => 'Old price must be greater than the current price.'], 422);
        }
        if ($stars < 0 || $stars > 5) {
            admin_json_response(['success' => false, 'error' => 'Stars must be between 0 and 5.'], 422);
        }
        if ($badge_class !== '' && !in_array($badge_class, $allowed_badge_classes, true)) {
            admin_json_response(['success' => false, 'error' => 'Invalid badge style selected.'], 422);
        }

        $lookup_statement = $pdo->prepare('SELECT image_url FROM products WHERE id = :id LIMIT 1');
        $lookup_statement->execute([':id' => $product_id]);
        $existing = $lookup_statement->fetch(PDO::FETCH_ASSOC);
        if ($existing === false) {
            admin_json_response(['success' => false, 'error' => 'Product not found.'], 404);
        }

        $image_url = (string) ($existing['image_url'] ?? '');
        try {
            $uploaded_image = handle_image_upload('image', $image_url);
            if ($uploaded_image !== null) {
                $image_url = $uploaded_image;
            }
        } catch (RuntimeException $exception) {
            admin_json_response(['success' => false, 'error' => $exception->getMessage()], 422);
        }

        $update_statement = $pdo->prepare(
            'UPDATE products
             SET brand = :brand,
                 name = :name,
                 category = :category,
                 size = :size,
                 price = :price,
                 old_price = :old_price,
                 stars = :stars,
                 badge = :badge,
                 badge_class = :badge_class,
                 image_url = :image_url
             WHERE id = :id'
        );
        $update_statement->execute([
            ':brand' => $brand,
            ':name' => $name,
            ':category' => $category,
            ':size' => $size,
            ':price' => $price,
            ':old_price' => $old_price,
            ':stars' => $stars,
            ':badge' => $badge !== '' ? $badge : null,
            ':badge_class' => $badge_class !== '' ? $badge_class : null,
            ':image_url' => $image_url,
            ':id' => $product_id,
        ]);

        admin_json_response(['success' => true]);
    }

    if ($action === 'delete') {
        $product_id = (int) ($payload['id'] ?? 0);
        if ($product_id <= 0) {
            admin_json_response(['success' => false, 'error' => 'Invalid product ID.'], 422);
        }

        $lookup_statement = $pdo->prepare('SELECT image_url FROM products WHERE id = :id LIMIT 1');
        $lookup_statement->execute([':id' => $product_id]);
        $product = $lookup_statement->fetch(PDO::FETCH_ASSOC);
        if ($product === false) {
            admin_json_response(['success' => false, 'error' => 'Product not found.'], 404);
        }

        $delete_statement = $pdo->prepare('DELETE FROM products WHERE id = :id');
        $delete_statement->execute([':id' => $product_id]);
        delete_uploaded_product_image((string) ($product['image_url'] ?? ''));

        admin_json_response(['success' => true]);
    }

    admin_json_response(['success' => false, 'error' => 'Unknown action.'], 400);
} catch (Throwable $exception) {
    error_log('[api/admin_products.php] ' . $exception->getMessage());
    admin_json_response([
        'success' => false,
        'error' => 'Failed to manage products.',
    ], 500);
}
