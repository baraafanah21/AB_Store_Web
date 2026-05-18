<?php
define('AB_STORE', true);
require_once __DIR__ . '/../includes/api_bootstrap.php';

try {
    $stats_statement = $pdo->query(
        'SELECT
            (SELECT COUNT(*) FROM products) AS products_count,
            (SELECT COUNT(DISTINCT brand) FROM products) AS brands_count,
            (SELECT COUNT(*) FROM users WHERE role = "user") AS members_count,
            (SELECT COUNT(*) FROM users WHERE role IN ("admin", "employee")) AS staff_count'
    );
    $stats_row = $stats_statement->fetch(PDO::FETCH_ASSOC);

    $stats = [
        'products_count' => (int) ($stats_row['products_count'] ?? 0),
        'brands_count' => (int) ($stats_row['brands_count'] ?? 0),
        'members_count' => (int) ($stats_row['members_count'] ?? 0),
        'staff_count' => (int) ($stats_row['staff_count'] ?? 0),
    ];

    // Public endpoint: expose only display name and role.
    // Emails, member_ids, and loyalty_points must never leak here.
    $team_statement = $pdo->prepare(
        'SELECT name, role
         FROM users
         WHERE role IN ("admin", "employee")
         ORDER BY FIELD(role, "admin", "employee"), id ASC'
    );
    $team_statement->execute();
    $team_members = $team_statement->fetchAll(PDO::FETCH_ASSOC);

    api_send_json([
        'success' => true,
        'stats' => $stats,
        'support_email' => 'contact@abstore.com',
        'team_members' => $team_members,
        'year' => (int) date('Y'),
    ]);
} catch (Throwable $exception) {
    error_log('[api/store_info.php] ' . $exception->getMessage());
    api_send_error('Failed to load store information.', 500);
}
