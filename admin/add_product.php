<?php
define('AB_STORE', true);
$allowed_roles = ['admin', 'employee'];
require_once __DIR__ . '/../auth/auth_guard.php';
require_once __DIR__ . '/../includes/upload.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /roles-dash/admin-dash.html');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();

    $brand = trim((string) ($_POST['brand'] ?? ''));
    $name = trim((string) ($_POST['name'] ?? ''));
    $category = trim((string) ($_POST['category'] ?? ''));
    $size = trim((string) ($_POST['size'] ?? ''));
    $price_raw = trim((string) ($_POST['price'] ?? ''));
    $old_price_raw = trim((string) ($_POST['old_price'] ?? ''));
    $stars_raw = trim((string) ($_POST['stars'] ?? ''));
    $badge = trim((string) ($_POST['badge'] ?? ''));
    $badge_class = trim((string) ($_POST['badge_class'] ?? ''));
    $allowed_categories = ['her', 'him', 'unisex', 'niche'];
    $allowed_badge_classes = ['badge-new', 'badge-sale', 'badge-niche'];

    $redirect = '/admin/add_product.php';

    if ($brand === '' || $name === '' || $category === '' || $size === '' || $price_raw === '' || $stars_raw === '') {
        $_SESSION['error'] = 'Please fill in all required fields.';
        header('Location: ' . $redirect);
        exit;
    }

    if (!in_array($category, $allowed_categories, true)) {
        $_SESSION['error'] = 'Invalid category selected.';
        header('Location: ' . $redirect);
        exit;
    }

    if (!is_numeric($price_raw) || (float) $price_raw < 0) {
        $_SESSION['error'] = 'Price must be a non-negative number.';
        header('Location: ' . $redirect);
        exit;
    }

    $price = (float) $price_raw;
    $old_price = null;

    if ($old_price_raw !== '') {
        if (!is_numeric($old_price_raw) || (float) $old_price_raw <= $price) {
            $_SESSION['error'] = 'Old price must be greater than the current price.';
            header('Location: ' . $redirect);
            exit;
        }
        $old_price = (float) $old_price_raw;
    }

    if (!ctype_digit($stars_raw) || (int) $stars_raw < 0 || (int) $stars_raw > 5) {
        $_SESSION['error'] = 'Stars must be a whole number between 0 and 5.';
        header('Location: ' . $redirect);
        exit;
    }

    $stars = (int) $stars_raw;
    $badge = $badge === '' ? null : $badge;
    $badge_class = ($badge_class === '' || !in_array($badge_class, $allowed_badge_classes, true)) ? null : $badge_class;

    try {
        $image_url = handle_image_upload('product_image');
    } catch (RuntimeException $exception) {
        error_log('[admin/add_product.php] ' . $exception->getMessage());
        $_SESSION['error'] = 'The uploaded image could not be processed.';
        header('Location: ' . $redirect);
        exit;
    }

    try {
        $statement = $pdo->prepare(
            'INSERT INTO products (brand, name, category, size, price, old_price, stars, badge, badge_class, image_url, created_by)
             VALUES (:brand, :name, :category, :size, :price, :old_price, :stars, :badge, :badge_class, :image_url, :created_by)'
        );
        $statement->execute([
            ':brand' => $brand,
            ':name' => $name,
            ':category' => $category,
            ':size' => $size,
            ':price' => $price,
            ':old_price' => $old_price,
            ':stars' => $stars,
            ':badge' => $badge,
            ':badge_class' => $badge_class,
            ':image_url' => $image_url,
            ':created_by' => (int) ($_SESSION['user_id'] ?? 0),
        ]);

        $_SESSION['success'] = 'Product added successfully.';
        header('Location: /roles-dash/admin-dash.html');
        exit;
    } catch (PDOException $exception) {
        error_log('[admin/add_product.php] ' . $exception->getMessage());
        $_SESSION['error'] = 'Could not save the product. Please try again.';
        header('Location: ' . $redirect);
        exit;
    }
}

$error = $_SESSION['error'] ?? null;
$success = $_SESSION['success'] ?? null;
unset($_SESSION['error'], $_SESSION['success']);

$page_title = 'Add Product | AB Store Admin';
?>
<!DOCTYPE html>
<html lang="en">
<head>
<?php require_once __DIR__ . '/../includes/head.php'; ?>
</head>
<body>
<?php require_once __DIR__ . '/../includes/navbar.php'; ?>
<main class="container page-main py-4">
    <a href="/admin/products.php" class="mb-3 d-inline-block text-decoration-none"><i class="bi bi-arrow-left me-1"></i>Back to Products</a>
    <h1 class="h3 mb-4">Add New Product</h1>

    <?php if ($error !== null): ?>
        <div class="alert alert-danger"><?= e($error) ?></div>
    <?php endif; ?>
    <?php if ($success !== null): ?>
        <div class="alert alert-success"><?= e($success) ?></div>
    <?php endif; ?>

    <form method="POST" action="/admin/add_product.php" enctype="multipart/form-data" novalidate>
        <input type="hidden" name="csrf_token" value="<?= e(generate_csrf()) ?>">

        <div class="row g-4">
            <div class="col-12 col-lg-8">
                <div class="card shadow-sm">
                    <div class="card-body">
                        <div class="row g-3">
                            <div class="col-md-6">
                                <div class="form-floating">
                                    <input type="text" id="brand" name="brand" class="form-control" maxlength="60" placeholder="Brand" required>
                                    <label for="brand">Brand</label>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="form-floating">
                                    <input type="text" id="name" name="name" class="form-control" maxlength="120" placeholder="Name" required>
                                    <label for="name">Name</label>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="form-floating">
                                    <select id="category" name="category" class="form-select" required>
                                        <option value="">Select</option>
                                        <option value="her">Her</option>
                                        <option value="him">Him</option>
                                        <option value="unisex">Unisex</option>
                                        <option value="niche">Niche</option>
                                    </select>
                                    <label for="category">Category</label>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="form-floating">
                                    <input type="text" id="size" name="size" class="form-control" maxlength="40" placeholder="100ml" required>
                                    <label for="size">Size</label>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="form-floating">
                                    <input type="number" id="price" name="price" class="form-control" min="0" step="0.01" placeholder="0.00" required>
                                    <label for="price">Price</label>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="form-floating">
                                    <input type="number" id="old_price" name="old_price" class="form-control" min="0" step="0.01" placeholder="0.00">
                                    <label for="old_price">Old Price</label>
                                </div>
                                <div class="form-text">Leave empty if the item is not discounted.</div>
                            </div>
                            <div class="col-md-4">
                                <div class="form-floating">
                                    <input type="number" id="stars" name="stars" class="form-control" min="0" max="5" step="1" placeholder="0" required>
                                    <label for="stars">Stars</label>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="form-floating">
                                    <input type="text" id="badge" name="badge" class="form-control" maxlength="24" placeholder="New">
                                    <label for="badge">Badge</label>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="form-floating">
                                    <select id="badge_class" name="badge_class" class="form-select">
                                        <option value="">None</option>
                                        <option value="badge-new">badge-new</option>
                                        <option value="badge-sale">badge-sale</option>
                                        <option value="badge-niche">badge-niche</option>
                                    </select>
                                    <label for="badge_class">Badge Class</label>
                                </div>
                            </div>
                            <div class="col-12">
                                <label for="product_image" class="form-label">Product image</label>
                                <input type="file" id="product_image" name="product_image" class="form-control js-image-preview-input" accept="image/jpeg,image/png,image/webp" data-preview-target="image-preview" data-preview-placeholder="image-preview-placeholder">
                                <div class="form-text">Accepted types: JPG, PNG, and WEBP. Maximum file size: 2MB.</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-12 col-lg-4">
                <div class="card h-100 shadow-sm">
                    <div class="card-body">
                        <h2 class="h6 mb-3 small text-muted text-uppercase">Image Preview</h2>
                        <div class="preview-frame ratio ratio-1x1 rounded">
                            <div id="image-preview-placeholder" class="small text-center text-muted">
                                <i class="bi bi-image d-block mb-2 display-4"></i>
                                No image selected
                            </div>
                            <img id="image-preview" src="" alt="Product preview" class="d-none product-image-cover">
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="mt-4 d-grid gap-2 d-md-flex justify-content-md-end">
            <a href="/admin/products.php" class="btn btn-outline-secondary">Cancel</a>
            <button type="submit" class="btn btn-dark"><i class="bi bi-check-lg me-1"></i>Add Product</button>
        </div>
    </form>
</main>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
</body>
</html>
