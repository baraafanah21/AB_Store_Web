<?php
define('AB_STORE', true);
$allowed_roles = ['admin', 'employee'];
require_once __DIR__ . '/admin_common.php';

function admin_messages_table_name(PDO $pdo): ?string
{
    foreach (['contact_messages', 'messages'] as $candidate) {
        if (admin_table_exists($pdo, $candidate)) {
            return $candidate;
        }
    }

    return null;
}

try {
    $table_name = admin_messages_table_name($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if ($table_name === null) {
            admin_json_response([
                'success' => true,
                'messages' => [],
                'configured' => false,
            ]);
        }

        if ($table_name === 'contact_messages') {
            $messages = $pdo->query(
                'SELECT id, name, email, subject, message, status, reply, DATE_FORMAT(created_at, "%Y-%m-%d") AS sent_at
                 FROM contact_messages
                 ORDER BY created_at DESC, id DESC'
            )->fetchAll(PDO::FETCH_ASSOC);
        } else {
            $messages = $pdo->query(
                'SELECT id, name, email, subject, message, status, reply, DATE_FORMAT(created_at, "%Y-%m-%d") AS sent_at
                 FROM messages
                 ORDER BY created_at DESC, id DESC'
            )->fetchAll(PDO::FETCH_ASSOC);
        }

        admin_json_response([
            'success' => true,
            'messages' => $messages,
            'configured' => true,
        ]);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        admin_json_response(['success' => false, 'error' => 'Method not allowed.'], 405);
    }

    $payload = admin_json_input();
    admin_verify_csrf_from_payload($payload);

    if ($table_name === null) {
        admin_json_response(['success' => false, 'error' => 'Messages storage is not configured.'], 422);
    }

    $action = (string) ($payload['action'] ?? '');
    $message_id = (int) ($payload['id'] ?? 0);

    if ($action === 'clear') {
        $pdo->exec(sprintf('DELETE FROM %s', $table_name));
        admin_json_response(['success' => true]);
    }

    if ($message_id <= 0) {
        admin_json_response(['success' => false, 'error' => 'Invalid message ID.'], 422);
    }

    if ($action === 'delete') {
        $statement = $pdo->prepare(sprintf('DELETE FROM %s WHERE id = :id', $table_name));
        $statement->execute([':id' => $message_id]);
        admin_json_response(['success' => true]);
    }

    if ($action === 'reply') {
        $reply = trim((string) ($payload['reply'] ?? ''));
        if ($reply === '') {
            admin_json_response(['success' => false, 'error' => 'Reply cannot be empty.'], 422);
        }

        if ($table_name === 'contact_messages') {
            $statement = $pdo->prepare(
                'UPDATE contact_messages
                 SET reply = :reply,
                     status = :status,
                     replied_by = :replied_by,
                     replied_at = NOW()
                 WHERE id = :id'
            );
            $statement->execute([
                ':reply' => $reply,
                ':status' => 'replied',
                ':replied_by' => (int) ($_SESSION['user_id'] ?? 0),
                ':id' => $message_id,
            ]);
        } else {
            $statement = $pdo->prepare(
                sprintf('UPDATE %s SET reply = :reply, status = :status WHERE id = :id', $table_name)
            );
            $statement->execute([
                ':reply' => $reply,
                ':status' => 'replied',
                ':id' => $message_id,
            ]);
        }

        admin_json_response(['success' => true]);
    }

    if ($action === 'archive') {
        $statement = $pdo->prepare(sprintf('UPDATE %s SET status = :status WHERE id = :id', $table_name));
        $statement->execute([
            ':status' => 'archived',
            ':id' => $message_id,
        ]);

        admin_json_response(['success' => true]);
    }

    admin_json_response(['success' => false, 'error' => 'Unknown action.'], 400);
} catch (Throwable $exception) {
    error_log('[api/admin_messages.php] ' . $exception->getMessage());
    admin_json_response([
        'success' => false,
        'error' => 'Failed to manage messages.',
    ], 500);
}
