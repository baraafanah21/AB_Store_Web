<?php
define('AB_STORE', true);
require_once __DIR__ . '/../includes/api_bootstrap.php';

api_require_method('POST');

$payload = api_read_json_input();
api_verify_csrf($payload);

try {
    $name = trim((string) ($payload['name'] ?? ''));
    $email = trim((string) ($payload['email'] ?? ''));
    $phone = trim((string) ($payload['phone'] ?? ''));
    $subject = trim((string) ($payload['subject'] ?? ''));
    $message = trim((string) ($payload['message'] ?? ''));

    if ($name === '' || $email === '' || $subject === '' || $message === '') {
        api_send_error('Please complete all required fields.', 422);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        api_send_error('Please enter a valid email address.', 422);
    }

    $name = mb_substr($name, 0, 120);
    $email = mb_substr($email, 0, 120);
    $phone = mb_substr($phone, 0, 40);
    $subject = mb_substr($subject, 0, 60);
    $message = mb_substr($message, 0, 5000);

    $statement = $pdo->prepare(
        'INSERT INTO contact_messages (name, email, phone, subject, message, status)
         VALUES (:name, :email, :phone, :subject, :message, :status)'
    );
    $statement->execute([
        ':name' => $name,
        ':email' => $email,
        ':phone' => $phone !== '' ? $phone : null,
        ':subject' => $subject,
        ':message' => $message,
        ':status' => 'new',
    ]);

    api_send_json([
        'success' => true,
        'message' => 'Your message has been sent successfully.',
    ]);
} catch (Throwable $exception) {
    error_log('[api/contact.php] ' . $exception->getMessage());
    api_send_error('Unable to send your request right now.', 500);
}
