<?php
define('AB_STORE', true);
$allowed_roles = ['admin'];
require_once __DIR__ . '/../auth/auth_guard.php';

if (!function_exists('export_table_exists')) {
    function export_table_exists(PDO $pdo, string $table_name): bool
    {
        $statement = $pdo->prepare(
            'SELECT 1
             FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name
             LIMIT 1'
        );
        $statement->execute([':table_name' => $table_name]);
        return $statement->fetchColumn() !== false;
    }
}

if (!function_exists('export_html')) {
    function export_html($value): string
    {
        return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
    }
}

if (!function_exists('export_money')) {
    function export_money($value): string
    {
        return number_format((float) $value, 2, '.', ',');
    }
}

$category_labels = [
    'her' => 'For Her',
    'him' => 'For Him',
    'unisex' => 'Unisex',
    'niche' => 'Niche',
];

$status_colors = [
    'placed'    => '#fef3c7',
    'paid'      => '#d1fae5',
    'shipped'   => '#dbeafe',
    'delivered' => '#ede9fe',
];

try {
    $summary_rows = [];
    $detail_rows = [];
    $status_totals = [];
    $kpis = [
        'total_revenue' => 0.0,
        'total_orders' => 0,
        'total_items' => 0,
        'average_order_value' => 0.0,
    ];

    if (export_table_exists($pdo, 'orders') && export_table_exists($pdo, 'order_items')) {
        $summary_query = $pdo->query(
            "SELECT p.category AS category,
                    SUM(
                        CASE
                            WHEN oi.line_total IS NOT NULL AND oi.line_total > 0 THEN oi.line_total
                            ELSE oi.qty * oi.unit_price
                        END
                    ) AS revenue,
                    SUM(oi.qty) AS items_sold,
                    COUNT(DISTINCT o.id) AS orders_count
             FROM order_items oi
             INNER JOIN orders o ON o.id = oi.order_id
             INNER JOIN products p ON p.id = oi.product_id
             WHERE o.status <> 'cancelled'
             GROUP BY p.category
             ORDER BY FIELD(p.category, 'her', 'him', 'unisex', 'niche'), p.category"
        );
        $summary_rows = $summary_query->fetchAll(PDO::FETCH_ASSOC);

        $detail_query = $pdo->query(
            "SELECT o.id AS order_id,
                    o.order_number AS order_number,
                    DATE_FORMAT(o.created_at, '%Y-%m-%d %H:%i') AS order_date,
                    o.status AS order_status,
                    u.name AS customer_name,
                    u.email AS customer_email,
                    p.category AS category,
                    p.brand AS brand,
                    p.name AS product_name,
                    p.size AS size,
                    oi.qty AS qty,
                    oi.unit_price AS unit_price,
                    CASE
                        WHEN oi.line_total IS NOT NULL AND oi.line_total > 0 THEN oi.line_total
                        ELSE oi.qty * oi.unit_price
                    END AS line_total
             FROM order_items oi
             INNER JOIN orders o ON o.id = oi.order_id
             INNER JOIN products p ON p.id = oi.product_id
             LEFT JOIN users u ON u.id = o.user_id
             WHERE o.status <> 'cancelled'
             ORDER BY o.created_at DESC, o.id DESC, line_total DESC"
        );
        $detail_rows = $detail_query->fetchAll(PDO::FETCH_ASSOC);

        $status_query = $pdo->query(
            "SELECT o.status AS order_status,
                    COUNT(DISTINCT o.id) AS orders_count,
                    SUM(
                        CASE
                            WHEN oi.line_total IS NOT NULL AND oi.line_total > 0 THEN oi.line_total
                            ELSE oi.qty * oi.unit_price
                        END
                    ) AS revenue
             FROM order_items oi
             INNER JOIN orders o ON o.id = oi.order_id
             WHERE o.status <> 'cancelled'
             GROUP BY o.status
             ORDER BY orders_count DESC, o.status"
        );
        $status_totals = $status_query->fetchAll(PDO::FETCH_ASSOC);

        $kpi_query = $pdo->query(
            "SELECT
                COALESCE(SUM(revenue_by_order.order_revenue), 0) AS total_revenue,
                COUNT(*) AS total_orders,
                COALESCE(SUM(revenue_by_order.total_items), 0) AS total_items,
                COALESCE(AVG(revenue_by_order.order_revenue), 0) AS average_order_value
             FROM (
                SELECT o.id,
                       SUM(
                           CASE
                               WHEN oi.line_total IS NOT NULL AND oi.line_total > 0 THEN oi.line_total
                               ELSE oi.qty * oi.unit_price
                           END
                       ) AS order_revenue,
                       SUM(oi.qty) AS total_items
                FROM orders o
                INNER JOIN order_items oi ON oi.order_id = o.id
                WHERE o.status <> 'cancelled'
                GROUP BY o.id
             ) AS revenue_by_order"
        );
        $kpi_row = $kpi_query->fetch(PDO::FETCH_ASSOC);
        if (is_array($kpi_row)) {
            $kpis = [
                'total_revenue' => (float) ($kpi_row['total_revenue'] ?? 0),
                'total_orders' => (int) ($kpi_row['total_orders'] ?? 0),
                'total_items' => (int) ($kpi_row['total_items'] ?? 0),
                'average_order_value' => (float) ($kpi_row['average_order_value'] ?? 0),
            ];
        }
    }

    $filename = 'ab_store_revenue_report_' . date('Ymd_His') . '.xls';
    $generated_at = date('Y-m-d H:i:s');
    $grand_total = (float) ($kpis['total_revenue'] ?? 0);
    $average_items_per_order = (int) ($kpis['total_orders'] ?? 0) > 0
        ? ((float) ($kpis['total_items'] ?? 0) / (int) $kpis['total_orders'])
        : 0.0;

    $top_category_label = '—';
    $top_category_revenue = 0.0;
    if ($summary_rows !== []) {
        usort($summary_rows, function ($a, $b) {
            return ((float) ($b['revenue'] ?? 0)) <=> ((float) ($a['revenue'] ?? 0));
        });
        $top_category = $summary_rows[0];
        $top_category_key = (string) ($top_category['category'] ?? '');
        $top_category_label = $category_labels[$top_category_key] ?? $top_category_key;
        $top_category_revenue = (float) ($top_category['revenue'] ?? 0);
    }

    $top_status_label = '—';
    $top_status_orders = 0;
    if ($status_totals !== []) {
        $top_status = $status_totals[0];
        $top_status_label = ucfirst((string) ($top_status['order_status'] ?? '—'));
        $top_status_orders = (int) ($top_status['orders_count'] ?? 0);
    }

    $brand_totals = [];
    foreach ($detail_rows as $row) {
        $brand = trim((string) ($row['brand'] ?? ''));
        if ($brand === '') {
            $brand = 'Unknown';
        }
        $brand_totals[$brand] = ($brand_totals[$brand] ?? 0.0) + (float) ($row['line_total'] ?? 0);
    }
    arsort($brand_totals);
    $top_brand_label = array_key_first($brand_totals) ?? '—';
    $top_brand_revenue = $top_brand_label !== null ? (float) ($brand_totals[$top_brand_label] ?? 0) : 0.0;

    header('Content-Type: application/vnd.ms-excel; charset=UTF-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: max-age=0');

    echo "<html xmlns:o=\"urn:schemas-microsoft-com:office:office\" xmlns:x=\"urn:schemas-microsoft-com:office:excel\" xmlns=\"http://www.w3.org/TR/REC-html40\">";
    echo '<head><meta charset="UTF-8">';
    echo '<!--[if gte mso 9]><xml>
<x:ExcelWorkbook>
 <x:ExcelWorksheets>
  <x:ExcelWorksheet><x:Name>Revenue Report</x:Name>
   <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
  </x:ExcelWorksheet>
 </x:ExcelWorksheets>
</x:ExcelWorkbook>
</xml><![endif]-->';
    echo '<style>
        body { font-family: Calibri, "Segoe UI", Arial, sans-serif; color: #1f2937; background: #ffffff; }
        table { border-collapse: collapse; margin-bottom: 22px; }
        th, td {
            border: 1px solid #e5e7eb;
            padding: 9px 12px;
            vertical-align: middle;
            font-size: 12px;
            line-height: 1.45;
        }
        .report-title {
            background: #0f172a;
            color: #ffffff;
            font-size: 22px;
            font-weight: bold;
            padding: 18px 20px;
            letter-spacing: 0.4px;
            border: 1px solid #0f172a;
        }
        .report-subtitle {
            background: #f1f5f9;
            color: #475569;
            font-size: 12px;
            padding: 10px 20px;
            border: 1px solid #e2e8f0;
        }
        .section-title {
            background: #2563eb;
            color: #ffffff;
            font-weight: bold;
            font-size: 14px;
            padding: 10px 14px;
            letter-spacing: 0.3px;
            border: 1px solid #1d4ed8;
        }
        .col-head {
            background: #1e293b;
            color: #ffffff;
            font-weight: bold;
            font-size: 12px;
            text-align: left;
            padding: 10px 12px;
            border: 1px solid #0f172a;
        }
        .kpi-card  { background: #ffffff; padding: 14px 16px; border: 1px solid #e5e7eb; }
        .kpi-label { color: #6b7280; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
        .kpi-value { color: #0f172a; font-size: 18px; font-weight: bold; padding-top: 6px; }
        .stats-label { background: #f8fafc; color: #334155; font-weight: bold; width: 28%; }
        .stats-value { background: #ffffff; color: #0f172a; font-size: 13px; }
        .money  { text-align: right; mso-number-format:"\#\,\#\#0\.00"; }
        .center { text-align: center; }
        .muted  { color: #9ca3af; }
        .total-row td { background: #fef3c7; font-weight: bold; color: #78350f; border-top: 2px solid #f59e0b; }
        .row-even td { background: #ffffff; }
        .row-odd  td { background: #f9fafb; }
        .customer-name { font-weight: bold; color: #0f172a; }
        .customer-email { color: #6b7280; font-size: 11px; }
        .status-pill { font-weight: bold; text-align: center; }
    </style></head><body>';

    /* ===== Title ===== */
    echo '<table style="width:1400px;">';
    echo '<tr><td class="report-title" colspan="11">AB Store — Revenue Report (ILS)</td></tr>';
    echo '<tr><td class="report-subtitle" colspan="11">Generated: ' . export_html($generated_at) . '  •  Scope: all non-cancelled orders  •  Currency: Israeli Shekel (₪)</td></tr>';
    echo '</table>';

    /* ===== KPIs ===== */
    echo '<table style="width:1000px;">';
    echo '<tr><td class="section-title" colspan="4">Key Metrics</td></tr>';
    echo '<tr>';
    echo '<td class="kpi-card"><div class="kpi-label">Total Revenue</div><div class="kpi-value">₪' . export_html(export_money($kpis['total_revenue'])) . '</div></td>';
    echo '<td class="kpi-card"><div class="kpi-label">Total Orders</div><div class="kpi-value">' . export_html($kpis['total_orders']) . '</div></td>';
    echo '<td class="kpi-card"><div class="kpi-label">Items Sold</div><div class="kpi-value">' . export_html($kpis['total_items']) . '</div></td>';
    echo '<td class="kpi-card"><div class="kpi-label">Avg. Order Value</div><div class="kpi-value">₪' . export_html(export_money($kpis['average_order_value'])) . '</div></td>';
    echo '</tr>';
    echo '</table>';

    /* ===== Highlights ===== */
    echo '<table style="width:1000px;">';
    echo '<tr><td class="section-title" colspan="4">Highlights</td></tr>';
    echo '<tr>';
    echo '<td class="stats-label">Top Category</td><td class="stats-value">' . export_html($top_category_label) . ' &nbsp;(<b>₪' . export_html(export_money($top_category_revenue)) . '</b>)</td>';
    echo '<td class="stats-label">Top Brand</td><td class="stats-value">' . export_html($top_brand_label) . ' &nbsp;(<b>₪' . export_html(export_money($top_brand_revenue)) . '</b>)</td>';
    echo '</tr>';
    echo '<tr>';
    echo '<td class="stats-label">Most Common Status</td><td class="stats-value">' . export_html($top_status_label) . ' (' . export_html($top_status_orders) . ' orders)</td>';
    echo '<td class="stats-label">Avg. Items per Order</td><td class="stats-value">' . export_html(number_format($average_items_per_order, 2, '.', '')) . '</td>';
    echo '</tr>';
    echo '</table>';

    /* ===== Category summary ===== */
    echo '<table style="width:1000px;">';
    echo '<tr><td class="section-title" colspan="5">Revenue by Category</td></tr>';
    echo '<tr>';
    echo '<th class="col-head">Category</th>';
    echo '<th class="col-head" style="text-align:right;">Revenue</th>';
    echo '<th class="col-head" style="text-align:center;">Share</th>';
    echo '<th class="col-head" style="text-align:center;">Items Sold</th>';
    echo '<th class="col-head" style="text-align:center;">Orders</th>';
    echo '</tr>';

    if ($summary_rows === []) {
        echo '<tr><td colspan="5" class="muted center">No revenue data available.</td></tr>';
    } else {
        foreach ($summary_rows as $i => $row) {
            $category = (string) ($row['category'] ?? '');
            $label = $category_labels[$category] ?? $category;
            $revenue = (float) ($row['revenue'] ?? 0);
            $share = $grand_total > 0 ? (($revenue / $grand_total) * 100) : 0;
            $items_sold = (int) ($row['items_sold'] ?? 0);
            $orders_count = (int) ($row['orders_count'] ?? 0);
            $row_class = $i % 2 === 0 ? 'row-even' : 'row-odd';

            echo '<tr class="' . $row_class . '">';
            echo '<td><b>' . export_html($label) . '</b></td>';
            echo '<td class="money">₪' . export_html(export_money($revenue)) . '</td>';
            echo '<td class="center">' . export_html(number_format($share, 1, '.', '')) . '%</td>';
            echo '<td class="center">' . export_html($items_sold) . '</td>';
            echo '<td class="center">' . export_html($orders_count) . '</td>';
            echo '</tr>';
        }

        echo '<tr class="total-row">';
        echo '<td>TOTAL</td>';
        echo '<td class="money">₪' . export_html(export_money($grand_total)) . '</td>';
        echo '<td class="center">100.0%</td>';
        echo '<td class="center">' . export_html($kpis['total_items']) . '</td>';
        echo '<td class="center">' . export_html($kpis['total_orders']) . '</td>';
        echo '</tr>';
    }
    echo '</table>';

    /* ===== Status breakdown ===== */
    echo '<table style="width:700px;">';
    echo '<tr><td class="section-title" colspan="3">Revenue by Order Status</td></tr>';
    echo '<tr>';
    echo '<th class="col-head">Status</th>';
    echo '<th class="col-head" style="text-align:center;">Orders</th>';
    echo '<th class="col-head" style="text-align:right;">Revenue</th>';
    echo '</tr>';
    if ($status_totals === []) {
        echo '<tr><td colspan="3" class="muted center">No status data available.</td></tr>';
    } else {
        foreach ($status_totals as $row) {
            $status = strtolower((string) ($row['order_status'] ?? ''));
            $status_bg = $status_colors[$status] ?? '#f3f4f6';
            echo '<tr>';
            echo '<td class="status-pill" style="background:' . export_html($status_bg) . ';">' . export_html(ucfirst($status)) . '</td>';
            echo '<td class="center">' . export_html((int) ($row['orders_count'] ?? 0)) . '</td>';
            echo '<td class="money">₪' . export_html(export_money($row['revenue'] ?? 0)) . '</td>';
            echo '</tr>';
        }
    }
    echo '</table>';

    /* ===== Purchase detail (includes customer) ===== */
    echo '<table style="width:1600px;">';
    echo '<tr><td class="section-title" colspan="11">Purchases — Detailed Transactions</td></tr>';
    echo '<tr>';
    echo '<th class="col-head">Order #</th>';
    echo '<th class="col-head">Date</th>';
    echo '<th class="col-head">Customer</th>';
    echo '<th class="col-head" style="text-align:center;">Status</th>';
    echo '<th class="col-head">Category</th>';
    echo '<th class="col-head">Brand</th>';
    echo '<th class="col-head">Product</th>';
    echo '<th class="col-head">Size</th>';
    echo '<th class="col-head" style="text-align:center;">Qty</th>';
    echo '<th class="col-head" style="text-align:right;">Unit Price</th>';
    echo '<th class="col-head" style="text-align:right;">Line Total</th>';
    echo '</tr>';

    if ($detail_rows === []) {
        echo '<tr><td colspan="11" class="muted center">No purchases available.</td></tr>';
    } else {
        foreach ($detail_rows as $index => $row) {
            $category = (string) ($row['category'] ?? '');
            $label = $category_labels[$category] ?? $category;
            $status = strtolower((string) ($row['order_status'] ?? ''));
            $status_bg = $status_colors[$status] ?? '#f3f4f6';
            $row_class = $index % 2 === 0 ? 'row-even' : 'row-odd';

            $order_label = $row['order_number'] ?? ('#' . ($row['order_id'] ?? ''));
            $customer_name = trim((string) ($row['customer_name'] ?? ''));
            if ($customer_name === '') {
                $customer_name = '— Deleted user —';
            }
            $customer_email = (string) ($row['customer_email'] ?? '');

            echo '<tr class="' . $row_class . '">';
            echo '<td><b>' . export_html($order_label) . '</b></td>';
            echo '<td>' . export_html($row['order_date'] ?? '') . '</td>';
            echo '<td><div class="customer-name">' . export_html($customer_name) . '</div>';
            if ($customer_email !== '') {
                echo '<div class="customer-email">' . export_html($customer_email) . '</div>';
            }
            echo '</td>';
            echo '<td class="status-pill" style="background:' . export_html($status_bg) . ';">' . export_html(ucfirst($status)) . '</td>';
            echo '<td>' . export_html($label) . '</td>';
            echo '<td>' . export_html($row['brand'] ?? '') . '</td>';
            echo '<td>' . export_html($row['product_name'] ?? '') . '</td>';
            echo '<td>' . export_html($row['size'] ?? '') . '</td>';
            echo '<td class="center">' . export_html($row['qty'] ?? '') . '</td>';
            echo '<td class="money">₪' . export_html(export_money($row['unit_price'] ?? 0)) . '</td>';
            echo '<td class="money">₪' . export_html(export_money($row['line_total'] ?? 0)) . '</td>';
            echo '</tr>';
        }

        echo '<tr class="total-row">';
        echo '<td colspan="8">GRAND TOTAL</td>';
        echo '<td class="center">' . export_html($kpis['total_items']) . '</td>';
        echo '<td class="money">—</td>';
        echo '<td class="money">₪' . export_html(export_money($grand_total)) . '</td>';
        echo '</tr>';
    }

    echo '</table>';
    echo '</body></html>';
    exit;
} catch (Throwable $exception) {
    error_log('[api/admin_revenue_export.php] ' . $exception->getMessage());
    http_response_code(500);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'Failed to export revenue data.';
    exit;
}
