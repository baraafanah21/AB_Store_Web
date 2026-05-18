<?php
if (!defined('AB_STORE')) {
    http_response_code(403);
    exit;
}

$page_css = isset($page_css) && is_array($page_css) ? $page_css : [];
?>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="csrf-token" content="<?= e(generate_csrf()) ?>">
<title><?= e($page_title ?? 'AB Store') ?></title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Jost:wght@300;400;500;600&display=swap">
<link rel="stylesheet" href="/assets/css/style.css">
<?php foreach ($page_css as $css_href): ?>
<link rel="stylesheet" href="<?= e($css_href) ?>">
<?php endforeach; ?>
<link rel="stylesheet" href="/css-files/float-logo.css">
