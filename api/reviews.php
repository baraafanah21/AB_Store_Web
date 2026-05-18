<?php
define('AB_STORE', true);
require_once __DIR__ . '/../includes/api_bootstrap.php';
require_once __DIR__ . '/../auth/auth_guard.php';

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $limit = (int) ($_GET['limit'] ?? 6);
        if ($limit < 1) {
            $limit = 6;
        }
        if ($limit > 20) {
            $limit = 20;
        }

        $statement = $pdo->prepare(
            'SELECT r.id,
                    r.author_name,
                    r.product_id,
                    r.rating,
                    r.body,
                    DATE_FORMAT(r.created_at, "%Y-%m-%d") AS created_at,
                    p.brand,
                    p.name
             FROM reviews AS r
             LEFT JOIN products AS p ON p.id = r.product_id
             ORDER BY r.created_at DESC, r.id DESC
             LIMIT ' . $limit
        );
        $statement->execute();
        $reviews = $statement->fetchAll(PDO::FETCH_ASSOC);

        api_send_json([
            'success' => true,
            'reviews' => array_map(static function (array $review_row): array {
                $product_label = trim(((string) ($review_row['brand'] ?? '')) . ' ' . ((string) ($review_row['name'] ?? '')));

                return [
                    'id' => (int) ($review_row['id'] ?? 0),
                    'author_name' => (string) ($review_row['author_name'] ?? ''),
                    'product_id' => $review_row['product_id'] !== null ? (int) $review_row['product_id'] : null,
                    'product_name' => $product_label !== '' ? $product_label : 'AB Store Fragrance',
                    'rating' => (int) ($review_row['rating'] ?? 0),
                    'body' => (string) ($review_row['body'] ?? ''),
                    'created_at' => (string) ($review_row['created_at'] ?? ''),
                ];
            }, $reviews),
        ]);
    }

    api_require_method(['GET', 'POST']);

    $payload = api_read_json_input();
    api_verify_csrf($payload);
    api_require_login('Please sign in to post a review.');

    $product_id = (int) ($payload['product_id'] ?? 0);
    $rating = (int) ($payload['rating'] ?? 0);
    $body = trim((string) ($payload['body'] ?? ''));

    if ($product_id <= 0 || $rating < 1 || $rating > 5 || $body === '') {
        api_send_error('Please complete all review fields.', 422);
    }

    $user_id = (int) $_SESSION['user_id'];
    $author_name = mb_substr(trim((string) ($_SESSION['name'] ?? '')), 0, 80);
    if ($author_name === '') {
        $author_name = 'Anonymous';
    }
    $body = mb_substr($body, 0, 2000);

    $product_statement = $pdo->prepare('SELECT id FROM products WHERE id = :id LIMIT 1');
    $product_statement->execute([':id' => $product_id]);
    if ($product_statement->fetch(PDO::FETCH_ASSOC) === false) {
        api_send_error('Selected product was not found.', 404);
    }

    $insert_statement = $pdo->prepare(
        'INSERT INTO reviews (user_id, product_id, author_name, rating, body)
         VALUES (:user_id, :product_id, :author_name, :rating, :body)'
    );
    $insert_statement->execute([
        ':user_id' => $user_id,
        ':product_id' => $product_id,
        ':author_name' => $author_name,
        ':rating' => $rating,
        ':body' => $body,
    ]);

    api_send_json(['success' => true]);
} catch (Throwable $exception) {
    error_log('[api/reviews.php] ' . $exception->getMessage());
    api_send_error('Failed to process the review.', 500);
}
