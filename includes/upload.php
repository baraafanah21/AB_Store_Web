<?php
if (!defined('AB_STORE')) {
    http_response_code(403);
    exit;
}

function handle_image_upload(string $input_name, ?string $old_url = null): ?string
{
    if (!isset($_FILES[$input_name]) || (int) ($_FILES[$input_name]['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return null;
    }

    $file = $_FILES[$input_name];
    $upload_error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);

    if ($upload_error !== UPLOAD_ERR_OK) {
        if ($upload_error === UPLOAD_ERR_INI_SIZE || $upload_error === UPLOAD_ERR_FORM_SIZE) {
            throw new RuntimeException('Image must be under 2MB.');
        }

        throw new RuntimeException('Failed to save the uploaded file.');
    }

    $max_bytes = 2 * 1024 * 1024;
    $file_size = (int) ($file['size'] ?? 0);
    if ($file_size > $max_bytes) {
        throw new RuntimeException('Image must be under 2MB.');
    }

    $mime_map = [
        'image/jpeg' => 'jpeg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    $file_info = finfo_open(FILEINFO_MIME_TYPE);
    $mime_type = $file_info === false ? '' : (string) finfo_file($file_info, (string) ($file['tmp_name'] ?? ''));
    if ($file_info !== false) {
        finfo_close($file_info);
    }

    if (!isset($mime_map[$mime_type])) {
        throw new RuntimeException('Only JPG, PNG, and WEBP images are allowed.');
    }

    if (@getimagesize((string) ($file['tmp_name'] ?? '')) === false) {
        throw new RuntimeException('Uploaded file is not a valid image.');
    }

    $extension = $mime_map[$mime_type];
    $file_name = bin2hex(random_bytes(16)) . '.' . $extension;
    $upload_directory = __DIR__ . '/../uploads/products/';
    $file_path = $upload_directory . $file_name;
    $relative_path = 'uploads/products/' . $file_name;

    if (!is_dir($upload_directory) && !mkdir($upload_directory, 0755, true) && !is_dir($upload_directory)) {
        error_log('[includes/upload.php] Failed to create upload directory: ' . $upload_directory);
        throw new RuntimeException('Failed to save the uploaded file.');
    }

    $tmp_name = (string) ($file['tmp_name'] ?? '');
    if (!move_uploaded_file($tmp_name, $file_path)) {
        error_log('[includes/upload.php] Failed to move uploaded file to: ' . $file_path);
        throw new RuntimeException('Failed to save the uploaded file.');
    }

    delete_uploaded_product_image($old_url);

    return $relative_path;
}

function delete_uploaded_product_image(?string $image_url): void
{
    if ($image_url === null || $image_url === '') {
        return;
    }

    $upload_directory = __DIR__ . '/../uploads/products/';
    $old_file_path = __DIR__ . '/../' . ltrim($image_url, '/');
    $resolved_old_file = realpath($old_file_path);
    $resolved_root = realpath($upload_directory);

    if ($resolved_old_file !== false && $resolved_root !== false && str_starts_with($resolved_old_file, $resolved_root) && is_file($resolved_old_file)) {
        @unlink($resolved_old_file);
    }
}
