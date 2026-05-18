<?php
if (!defined('AB_STORE')) {
    http_response_code(403);
    exit;
}

$is_logged_in = (int) ($_SESSION['user_id'] ?? 0) > 0;
$current_role = (string) ($_SESSION['role'] ?? 'guest');
$display_name = (string) ($_SESSION['name'] ?? '');
$self_path    = (string) ($_SERVER['PHP_SELF'] ?? '');
$is_staff     = $is_logged_in && in_array($current_role, ['admin', 'employee'], true);

$nav_active = static function (array $paths) use ($self_path): string {
    return in_array($self_path, $paths, true) ? 'active' : '';
};

$dash_url   = $current_role === 'admin'
    ? '/roles-dash/admin-dash.html'
    : ($current_role === 'employee' ? '/roles-dash/employee-dash.html' : '');
$dash_label = $current_role === 'admin' ? 'Admin' : ($current_role === 'employee' ? 'Staff' : '');
?>
<nav id="mainNav">
    <a href="/index.html" class="nav-brand">
        <img src="/images/logo.webp" alt="AB Store" class="nav-logo" />
        <span class="nav-store-text">Store</span>
    </a>

    <ul class="nav-links">
        <li><a href="/index.html" class="<?= e($nav_active(['/index.php', '/index.html'])) ?>">Home</a></li>
        <li><a href="/products.html" class="<?= e($nav_active(['/pages/products.php', '/products.html'])) ?>">Products</a></li>
        <li><a href="/about.html" class="<?= e($nav_active(['/about.html'])) ?>">About</a></li>
        <li><a href="/contact.html" class="<?= e($nav_active(['/contact.html'])) ?>">Contact</a></li>
        <li><a href="/loyalty.html" class="<?= e($nav_active(['/loyalty.html'])) ?>">Loyalty</a></li>
    </ul>

    <div class="d-flex align-items-center gap-3">
        <a href="/cart.html" class="cart-wrap" title="View Cart">
            <i class="bi bi-bag"></i>
            <div class="cart-badge" id="cartBadge">0</div>
        </a>

        <?php if ($is_logged_in): ?>
            <div class="nav-user-menu" id="navUserMenu">
                <span class="nav-user-greeting">Hi, <strong id="navUserName"><?= e($display_name) ?></strong></span>
                <?php if ($is_staff): ?>
                    <a href="<?= e($dash_url) ?>" id="navDashLink" class="nav-dash-link"><?= e($dash_label) ?></a>
                <?php endif; ?>
                <a href="/auth/logout.php" class="nav-signout-btn">Sign Out</a>
            </div>
        <?php else: ?>
            <a href="/login.html" class="nav-signin-btn" id="navAuthBtn">
                <i class="bi bi-person"></i> Sign In
            </a>
        <?php endif; ?>

        <button class="nav-hamburger" id="hamburger" aria-label="Toggle menu">
            <span></span><span></span><span></span>
        </button>
    </div>
</nav>

<div class="mobile-nav" id="mobileNav">
    <a href="/index.html">Home</a>
    <a href="/products.html">Products</a>
    <a href="/about.html">About</a>
    <a href="/contact.html">Contact</a>
    <a href="/loyalty.html">Loyalty</a>
    <a href="/cart.html">Cart</a>
    <?php if ($is_logged_in): ?>
        <?php if ($is_staff): ?>
            <a href="<?= e($dash_url) ?>"><?= e($dash_label) ?></a>
        <?php endif; ?>
        <a href="/auth/logout.php">Sign Out</a>
    <?php else: ?>
        <a href="/login.html" id="mobileAuthBtn">Sign In</a>
    <?php endif; ?>
</div>
