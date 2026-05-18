<?php
/**
 * Public RSS 2.0 feed of the latest products.
 *
 * GET /api/products_rss.php
 * GET /api/products_rss.php?category=her|him|unisex|niche
 * GET /api/products_rss.php?limit=20    (1-50, default 20)
 *
 * Returns application/rss+xml. No auth required.
 */
define('AB_STORE', true);
require_once __DIR__ . '/../config/database.php';

// Build site base URL for absolute links inside the feed.
$scheme = ((string) ($_SERVER['HTTPS'] ?? '') !== '' && (string) ($_SERVER['HTTPS'] ?? '') !== 'off') ? 'https' : 'http';
$host = (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
$script = (string) ($_SERVER['SCRIPT_NAME'] ?? '/api/products_rss.php');
$base_path = rtrim(str_replace('\\', '/', dirname(dirname($script))), '/');
$site_url = $scheme . '://' . $host . ($base_path === '' ? '' : $base_path) . '/';
$feed_url = $scheme . '://' . $host . $script;

try {
    $allowed_categories = ['her', 'him', 'unisex', 'niche'];
    $category = trim((string) ($_GET['category'] ?? ''));
    $use_category = $category !== '' && in_array($category, $allowed_categories, true);

    $limit = (int) ($_GET['limit'] ?? 20);
    if ($limit < 1) { $limit = 1; }
    if ($limit > 50) { $limit = 50; }

    $sql = 'SELECT id, brand, name, category, size, price, old_price, badge, image_url, created_at
            FROM products';
    if ($use_category) {
        $sql .= ' WHERE category = :category';
    }
    $sql .= ' ORDER BY created_at DESC LIMIT ' . $limit;

    $statement = $pdo->prepare($sql);
    if ($use_category) {
        $statement->execute([':category' => $category]);
    } else {
        $statement->execute();
    }
    $products = $statement->fetchAll(PDO::FETCH_ASSOC);

    $channel_title = 'AB Store — Latest Products';
    if ($use_category) {
        $channel_title .= ' (' . ucfirst($category) . ')';
    }
    $channel_description = 'Newest fragrances available at AB Store.';

    header('Content-Type: application/rss+xml; charset=UTF-8');

    $xml = new XMLWriter();
    $xml->openMemory();
    $xml->setIndent(true);
    $xml->startDocument('1.0', 'UTF-8');
    $xml->startElement('rss');
    $xml->writeAttribute('version', '2.0');
    $xml->writeAttributeNs('xmlns', 'atom', null, 'http://www.w3.org/2005/Atom');
    $xml->startElement('channel');
    $xml->writeElement('title', $channel_title);
    $xml->writeElement('link', $site_url);
    $xml->writeElement('description', $channel_description);
    $xml->writeElement('language', 'en');
    $xml->writeElement('lastBuildDate', date(DATE_RSS));

    $xml->startElement('atom:link');
    $xml->writeAttribute('href', $feed_url . ($use_category ? '?category=' . urlencode($category) : ''));
    $xml->writeAttribute('rel', 'self');
    $xml->writeAttribute('type', 'application/rss+xml');
    $xml->endElement();

    foreach ($products as $product) {
        $product_id = (int) ($product['id'] ?? 0);
        $title = trim((string) ($product['brand'] ?? '') . ' — ' . (string) ($product['name'] ?? ''));
        if ($title === '—') { $title = 'Product #' . $product_id; }

        $cat = (string) ($product['category'] ?? '');
        $item_link = $site_url . 'products.html'
            . ($cat !== '' ? '?category=' . urlencode($cat) : '')
            . '#product-' . $product_id;

        $price = (float) ($product['price'] ?? 0);
        $old_price = isset($product['old_price']) ? (float) $product['old_price'] : 0.0;
        $size = (string) ($product['size'] ?? '');
        $badge = (string) ($product['badge'] ?? '');

        $description_parts = [];
        if ($size !== '') { $description_parts[] = 'Size: ' . $size; }
        $description_parts[] = 'Price: $' . number_format($price, 2);
        if ($old_price > 0 && $old_price > $price) {
            $description_parts[] = 'Was: $' . number_format($old_price, 2);
        }
        if ($badge !== '') { $description_parts[] = $badge; }
        $description = implode(' · ', $description_parts);

        $created_at = (string) ($product['created_at'] ?? '');
        $pub_timestamp = $created_at !== '' ? strtotime($created_at) : false;
        if ($pub_timestamp === false) { $pub_timestamp = time(); }

        $image_url = (string) ($product['image_url'] ?? '');
        if ($image_url !== '' && !preg_match('#^https?://#i', $image_url)) {
            $image_url = $site_url . ltrim($image_url, '/');
        }

        $xml->startElement('item');
        $xml->writeElement('title', $title);
        $xml->writeElement('link', $item_link);
        $xml->writeElement('description', $description);
        if ($cat !== '') { $xml->writeElement('category', $cat); }
        $xml->writeElement('pubDate', date(DATE_RSS, $pub_timestamp));

        $xml->startElement('guid');
        $xml->writeAttribute('isPermaLink', 'false');
        $xml->text('ab-store-product-' . $product_id);
        $xml->endElement();

        if ($image_url !== '') {
            $xml->startElement('enclosure');
            $xml->writeAttribute('url', $image_url);
            $xml->writeAttribute('type', 'image/jpeg');
            $xml->endElement();
        }

        $xml->endElement(); // item
    }

    $xml->endElement(); // channel
    $xml->endElement(); // rss
    $xml->endDocument();

    echo $xml->outputMemory();
    exit;
} catch (Throwable $exception) {
    error_log('[api/products_rss.php] ' . $exception->getMessage());
    if (!headers_sent()) {
        header('Content-Type: text/plain; charset=UTF-8');
        http_response_code(500);
    }
    echo 'Failed to build feed.';
    exit;
}
