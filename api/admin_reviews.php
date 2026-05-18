<?php
define('AB_STORE', true);
require_once __DIR__ . '/admin_common.php';

try {
    if (!admin_table_exists($pdo, 'reviews')) {
        admin_json_response([
            'success' => true,
            'reviews' => [],
            'configured' => false,
        ]);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $reviews = $pdo->query(
            'SELECT r.id,
                    r.author_name,
                    r.product_id,
                    r.rating,
                    r.body,
                    DATE_FORMAT(r.created_at, "%Y-%m-%d %H:%i") AS created_at,
                    p.brand,
                    p.name
             FROM reviews AS r
             LEFT JOIN products AS p ON p.id = r.product_id
             ORDER BY r.created_at DESC, r.id DESC'
        )->fetchAll(PDO::FETCH_ASSOC);

        admin_json_response([
            'success' => true,
            'configured' => true,
            'reviews' => array_map(static function (array $row): array {
                $label = trim(((string) ($row['brand'] ?? '')) . ' ' . ((string) ($row['name'] ?? '')));

                return [
                    'id' => (int) $row['id'],
                    'author_name' => (string) ($row['author_name'] ?? ''),
                    'product_id' => $row['product_id'] !== null ? (int) $row['product_id'] : null,
                    'product_name' => $label !== '' ? $label : 'Unknown product',
                    'rating' => (int) ($row['rating'] ?? 0),
                    'body' => (string) ($row['body'] ?? ''),
                    'created_at' => (string) ($row['created_at'] ?? ''),
                ];
            }, $reviews),
        ]);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        admin_json_response(['success' => false, 'error' => 'Method not allowed.'], 405);
    }

    $payload = admin_json_input();
    admin_verify_csrf_from_payload($payload);

    $action = (string) ($payload['action'] ?? '');

    if ($action === 'clear') {
        $pdo->exec('DELETE FROM reviews');
        admin_json_response(['success' => true]);
    }

    $review_id = (int) ($payload['id'] ?? 0);
    if ($review_id <= 0) {
        admin_json_response(['success' => false, 'error' => 'Invalid review ID.'], 422);
    }

    if ($action === 'delete') {
        $statement = $pdo->prepare('DELETE FROM reviews WHERE id = :id');
        $statement->execute([':id' => $review_id]);
        admin_json_response(['success' => true]);
    }

    admin_json_response(['success' => false, 'error' => 'Unknown action.'], 400);
} catch (Throwable $exception) {
    error_log('[api/admin_reviews.php] ' . $exception->getMessage());
    admin_json_response([
        'success' => false,
        'error' => 'Failed to manage reviews.',
    ], 500);
}
