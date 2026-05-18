<?php
define('AB_STORE', true);
$allowed_roles = ['admin'];
require_once __DIR__ . '/../auth/auth_guard.php';
require_once __DIR__ . '/../includes/upload.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /roles-dash/admin-dash.html');
    exit;
}

verify_csrf();

$product_id = (int) ($_POST['id'] ?? 0);
if ($product_id <= 0) {
    $_SESSION['error'] = 'Invalid product ID.';
    header('Location: /roles-dash/admin-dash.html');
    exit;
}

try {
    $lookup_statement = $pdo->prepare('SELECT id, image_url FROM products WHERE id = :id LIMIT 1');
    $lookup_statement->execute([':id' => $product_id]);
    $product_row = $lookup_statement->fetch(PDO::FETCH_ASSOC);

    if ($product_row === false) {
        $_SESSION['error'] = 'Product not found.';
        header('Location: /roles-dash/admin-dash.html');
        exit;
    }

    $delete_statement = $pdo->prepare('DELETE FROM products WHERE id = :id');
    $delete_statement->execute([':id' => $product_id]);
    delete_uploaded_product_image((string) ($product_row['image_url'] ?? ''));

    $_SESSION['success'] = 'Product deleted successfully.';
    header('Location: /roles-dash/admin-dash.html');
    exit;
} catch (PDOException $exception) {
    error_log('[admin/delete_product.php] ' . $exception->getMessage());
    $_SESSION['error'] = 'Failed to delete the product.';
    header('Location: /roles-dash/admin-dash.html');
    exit;
}
