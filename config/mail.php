<?php

if (!defined('AB_STORE')) {
    http_response_code(403);
    exit;
}

require_once __DIR__ . '/../vendor/PHPMailer/src/Exception.php';
require_once __DIR__ . '/../vendor/PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/../vendor/PHPMailer/src/SMTP.php';

use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\PHPMailer;

function mail_config_values(): array
{
    static $cached_values = null;

    if (is_array($cached_values)) {
        return $cached_values;
    }

    $environment_path = __DIR__ . '/../.env';
    $values = [];

    if (is_file($environment_path)) {
        $lines = file($environment_path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines !== false) {
            foreach ($lines as $line) {
                $trimmed_line = trim($line);
                if ($trimmed_line === '' || str_starts_with($trimmed_line, '#') || !str_contains($trimmed_line, '=')) {
                    continue;
                }

                [$key, $value] = explode('=', $trimmed_line, 2);
                $values[trim($key)] = trim(trim($value), " \t\n\r\0\x0B\"'");
            }
        }
    }

    $cached_values = $values;
    return $cached_values;
}

function mail_build_transport(): PHPMailer
{
    $config = mail_config_values();

    $required_keys = [
        'MAIL_HOST',
        'MAIL_PORT',
        'MAIL_USERNAME',
        'MAIL_PASSWORD',
        'MAIL_FROM_ADDRESS',
    ];

    foreach ($required_keys as $required_key) {
        if (trim((string) ($config[$required_key] ?? '')) === '') {
            throw new RuntimeException('Mail transport is not configured.');
        }
    }

    $mailer = new PHPMailer(true);
    $mailer->isSMTP();
    $mailer->Host = (string) $config['MAIL_HOST'];
    $mailer->Port = (int) $config['MAIL_PORT'];
    $mailer->SMTPAuth = true;
    $mailer->Username = (string) $config['MAIL_USERNAME'];
    $mailer->Password = (string) $config['MAIL_PASSWORD'];

    $encryption = strtolower((string) ($config['MAIL_ENCRYPTION'] ?? 'tls'));
    if ($encryption === 'ssl') {
        $mailer->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    } else {
        $mailer->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    }

    $mailer->CharSet = 'UTF-8';
    $mailer->setFrom(
        (string) $config['MAIL_FROM_ADDRESS'],
        (string) ($config['MAIL_FROM_NAME'] ?? 'AB Store')
    );

    return $mailer;
}

function mail_attach_logo(PHPMailer $mailer): string
{
    $logo_cid = 'ab-store-logo';
    $candidates = [
        __DIR__ . '/../images/logo.png'  => 'image/png',
        __DIR__ . '/../images/logo.jpg'  => 'image/jpeg',
        __DIR__ . '/../images/logo.jpeg' => 'image/jpeg',
        __DIR__ . '/../images/logo.webp' => 'image/webp',
    ];

    foreach ($candidates as $logo_path => $mime_type) {
        if (is_file($logo_path)) {
            $extension = strtolower(pathinfo($logo_path, PATHINFO_EXTENSION)) ?: 'png';
            $mailer->addEmbeddedImage($logo_path, $logo_cid, 'logo.' . $extension, 'base64', $mime_type);
            break;
        }
    }

    return $logo_cid;
}

function mail_render_otp_email(string $recipient_name, string $heading, string $intro, string $code, string $expiry_note, string $logo_cid): string
{
    $safe_name = htmlspecialchars($recipient_name, ENT_QUOTES, 'UTF-8');
    $safe_heading = htmlspecialchars($heading, ENT_QUOTES, 'UTF-8');
    $safe_intro = htmlspecialchars($intro, ENT_QUOTES, 'UTF-8');
    $safe_code = htmlspecialchars($code, ENT_QUOTES, 'UTF-8');
    $safe_expiry = htmlspecialchars($expiry_note, ENT_QUOTES, 'UTF-8');
    $year = date('Y');

    return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{$safe_heading}</title>
</head>
<body style="margin:0;padding:0;background:#0e0e0f;font-family:'Segoe UI',Arial,sans-serif;color:#f4ede0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0e0e0f;padding:32px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#17171a;border-radius:14px;overflow:hidden;border:1px solid rgba(200,169,110,0.25);box-shadow:0 12px 40px rgba(0,0,0,0.45);">
        <tr>
          <td align="center" style="padding:32px 24px 12px;background:linear-gradient(135deg,#1c1a16 0%,#17171a 100%);border-bottom:1px solid rgba(200,169,110,0.18);">
            <img src="cid:{$logo_cid}" alt="AB Store" width="84" style="display:block;width:84px;height:auto;margin:0 auto 14px;">
            <div style="font-size:22px;font-weight:700;letter-spacing:3px;color:#c8a96e;text-transform:uppercase;">AB Store</div>
            <div style="font-size:12px;letter-spacing:2px;color:rgba(244,237,224,0.55);margin-top:4px;">Luxury Fragrance House</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 36px 8px;">
            <h1 style="margin:0 0 18px;font-size:22px;font-weight:600;color:#f4ede0;">{$safe_heading}</h1>
            <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:rgba(244,237,224,0.85);">
              Hello <strong style="color:#c8a96e;">{$safe_name}</strong>,
            </p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:rgba(244,237,224,0.78);">
              {$safe_intro}
            </p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 36px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
              <tr>
                <td align="center" style="padding:22px 36px;background:linear-gradient(135deg,rgba(200,169,110,0.18) 0%,rgba(138,106,46,0.12) 100%);border:1px solid rgba(200,169,110,0.4);border-radius:12px;">
                  <div style="font-size:11px;letter-spacing:3px;color:rgba(200,169,110,0.75);text-transform:uppercase;margin-bottom:8px;">Your verification code</div>
                  <div style="font-size:36px;font-weight:700;letter-spacing:10px;color:#c8a96e;font-family:'Courier New',monospace;">{$safe_code}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 36px 28px;">
            <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:rgba(244,237,224,0.65);">
              ⏱ {$safe_expiry}
            </p>
            <p style="margin:0;font-size:13px;line-height:1.6;color:rgba(244,237,224,0.55);">
              If you did not request this, you can safely ignore this email — your account remains secure.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 36px 28px;border-top:1px solid rgba(200,169,110,0.15);">
            <p style="margin:0;font-size:11px;line-height:1.6;color:rgba(244,237,224,0.45);text-align:center;letter-spacing:1px;">
              © {$year} AB STORE · Crafted with care<br>
              This is an automated message, please do not reply.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
HTML;
}

function mail_send_password_reset_code(string $recipient_email, string $recipient_name, string $reset_code): void
{
    try {
        $mailer = mail_build_transport();
        $mailer->addAddress($recipient_email, $recipient_name);
        $mailer->isHTML(true);
        $mailer->Subject = 'Your AB Store Password Reset Code';

        $logo_cid = mail_attach_logo($mailer);
        $mailer->Body = mail_render_otp_email(
            $recipient_name,
            'Reset your password',
            'We received a request to reset the password on your AB Store account. Use the code below to choose a new password.',
            $reset_code,
            'This code expires in 60 minutes.',
            $logo_cid
        );
        $mailer->AltBody = "Hello {$recipient_name},\n\nUse this 6-digit code to reset your AB Store password: {$reset_code}\n\nThis code expires in 60 minutes.\n\nIf you did not request this reset, you can ignore this email.";

        $mailer->send();
    } catch (Exception $exception) {
        throw new RuntimeException('Unable to send reset email.', 0, $exception);
    }
}

function mail_format_currency(float $amount): string
{
    return '₪' . number_format($amount, 2);
}

function mail_render_invoice_email(array $order, string $logo_cid): string
{
    $customer = (array) ($order['customer'] ?? []);
    $items = (array) ($order['items'] ?? []);

    $safe_name = htmlspecialchars((string) ($customer['name'] ?? 'Valued Customer'), ENT_QUOTES, 'UTF-8');
    $safe_order_number = htmlspecialchars((string) ($order['order_number'] ?? ''), ENT_QUOTES, 'UTF-8');
    $safe_created_at = htmlspecialchars((string) ($order['created_at'] ?? date('Y-m-d H:i:s')), ENT_QUOTES, 'UTF-8');
    $payment_label_map = ['card' => 'Credit / Debit Card', 'paypal' => 'PayPal', 'cod' => 'Cash on Delivery'];
    $payment_method_key = (string) ($order['payment_method'] ?? 'card');
    $safe_payment = htmlspecialchars($payment_label_map[$payment_method_key] ?? ucfirst($payment_method_key), ENT_QUOTES, 'UTF-8');
    $safe_member_id = htmlspecialchars((string) ($customer['member_id'] ?? ''), ENT_QUOTES, 'UTF-8');

    $subtotal = (float) ($order['subtotal'] ?? 0);
    $shipping = (float) ($order['shipping_amount'] ?? 0);
    $discount_percent = (float) ($order['discount_percent'] ?? 0);
    $discount_amount = (float) ($order['discount_amount'] ?? 0);
    $total = (float) ($order['total_amount'] ?? 0);
    $points_earned = (int) ($order['points_earned'] ?? 0);
    $points_redeemed = (int) ($order['points_redeemed'] ?? 0);

    $rows_html = '';
    foreach ($items as $item) {
        $brand = htmlspecialchars((string) ($item['brand'] ?? ''), ENT_QUOTES, 'UTF-8');
        $name = htmlspecialchars((string) ($item['name'] ?? ''), ENT_QUOTES, 'UTF-8');
        $size = htmlspecialchars((string) ($item['size'] ?? ''), ENT_QUOTES, 'UTF-8');
        $qty = (int) ($item['qty'] ?? 0);
        $unit_price = (float) ($item['unit_price'] ?? 0);
        $line_total = (float) ($item['line_total'] ?? ($unit_price * $qty));

        $size_line = $size !== '' ? '<div style="font-size:11px;color:rgba(244,237,224,0.5);margin-top:2px;">' . $size . '</div>' : '';

        $rows_html .= '
        <tr>
          <td style="padding:14px 12px;border-bottom:1px solid rgba(200,169,110,0.12);font-size:13px;color:#f4ede0;">
            <div style="font-size:11px;letter-spacing:2px;color:#c8a96e;text-transform:uppercase;">' . $brand . '</div>
            <div style="font-weight:600;margin-top:2px;">' . $name . '</div>
            ' . $size_line . '
          </td>
          <td align="center" style="padding:14px 12px;border-bottom:1px solid rgba(200,169,110,0.12);font-size:13px;color:rgba(244,237,224,0.85);">' . $qty . '</td>
          <td align="right" style="padding:14px 12px;border-bottom:1px solid rgba(200,169,110,0.12);font-size:13px;color:rgba(244,237,224,0.85);">' . mail_format_currency($unit_price) . '</td>
          <td align="right" style="padding:14px 12px;border-bottom:1px solid rgba(200,169,110,0.12);font-size:13px;color:#f4ede0;font-weight:600;">' . mail_format_currency($line_total) . '</td>
        </tr>';
    }

    $discount_row = '';
    if ($discount_amount > 0) {
        $discount_row = '
              <tr>
                <td style="padding:6px 0;font-size:13px;color:rgba(244,237,224,0.75);">Loyalty Discount (' . htmlspecialchars((string) (int) $discount_percent, ENT_QUOTES, 'UTF-8') . '%)</td>
                <td align="right" style="padding:6px 0;font-size:13px;color:#7bbf7b;">-' . mail_format_currency($discount_amount) . '</td>
              </tr>';
    }

    $subtotal_display = mail_format_currency($subtotal);
    $shipping_display = $shipping > 0 ? mail_format_currency($shipping) : 'Free';
    $total_display = mail_format_currency($total);

    $loyalty_block = '';
    if ($points_earned > 0 || $points_redeemed > 0) {
        $earned_line = $points_earned > 0 ? '<div style="font-size:13px;color:#c8a96e;margin-top:4px;">+ ' . $points_earned . ' points earned</div>' : '';
        $redeemed_line = $points_redeemed > 0 ? '<div style="font-size:13px;color:rgba(244,237,224,0.7);margin-top:4px;">− ' . $points_redeemed . ' points redeemed</div>' : '';
        $loyalty_block = '
        <tr>
          <td style="padding:0 36px 24px;">
            <div style="background:rgba(200,169,110,0.08);border:1px solid rgba(200,169,110,0.25);border-radius:10px;padding:16px 18px;">
              <div style="font-size:11px;letter-spacing:2px;color:rgba(200,169,110,0.8);text-transform:uppercase;">Loyalty Activity</div>
              ' . $earned_line . '
              ' . $redeemed_line . '
            </div>
          </td>
        </tr>';
    }

    $member_block = $safe_member_id !== ''
        ? '<div style="font-size:12px;color:rgba(244,237,224,0.55);margin-top:4px;">Member ID: ' . $safe_member_id . '</div>'
        : '';

    $year = date('Y');

    return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AB Store Invoice {$safe_order_number}</title>
</head>
<body style="margin:0;padding:0;background:#0e0e0f;font-family:'Segoe UI',Arial,sans-serif;color:#f4ede0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0e0e0f;padding:32px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background:#17171a;border-radius:14px;overflow:hidden;border:1px solid rgba(200,169,110,0.25);box-shadow:0 12px 40px rgba(0,0,0,0.45);">
        <tr>
          <td align="center" style="padding:32px 24px 14px;background:linear-gradient(135deg,#1c1a16 0%,#17171a 100%);border-bottom:1px solid rgba(200,169,110,0.18);">
            <img src="cid:{$logo_cid}" alt="AB Store" width="84" style="display:block;width:84px;height:auto;margin:0 auto 12px;">
            <div style="font-size:22px;font-weight:700;letter-spacing:3px;color:#c8a96e;text-transform:uppercase;">AB Store</div>
            <div style="font-size:12px;letter-spacing:2px;color:rgba(244,237,224,0.55);margin-top:4px;">Order Confirmation &amp; Invoice</div>
          </td>
        </tr>
        <tr>
          <td style="padding:30px 36px 8px;">
            <h1 style="margin:0 0 6px;font-size:22px;font-weight:600;color:#f4ede0;">Thank you, {$safe_name}.</h1>
            <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:rgba(244,237,224,0.75);">
              Your order has been placed. A copy of this invoice has been kept for your records.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 36px 18px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(200,169,110,0.06);border:1px solid rgba(200,169,110,0.2);border-radius:10px;">
              <tr>
                <td style="padding:14px 18px;font-size:12px;color:rgba(244,237,224,0.6);width:50%;">
                  <div style="letter-spacing:2px;text-transform:uppercase;font-size:10px;color:rgba(200,169,110,0.8);">Order Number</div>
                  <div style="font-size:14px;color:#f4ede0;font-weight:600;margin-top:4px;">{$safe_order_number}</div>
                  {$member_block}
                </td>
                <td style="padding:14px 18px;font-size:12px;color:rgba(244,237,224,0.6);text-align:right;">
                  <div style="letter-spacing:2px;text-transform:uppercase;font-size:10px;color:rgba(200,169,110,0.8);">Date</div>
                  <div style="font-size:14px;color:#f4ede0;font-weight:600;margin-top:4px;">{$safe_created_at}</div>
                  <div style="font-size:12px;color:rgba(244,237,224,0.55);margin-top:4px;">{$safe_payment}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 36px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <thead>
                <tr>
                  <th align="left" style="padding:10px 12px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgba(200,169,110,0.8);border-bottom:1px solid rgba(200,169,110,0.3);">Item</th>
                  <th align="center" style="padding:10px 12px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgba(200,169,110,0.8);border-bottom:1px solid rgba(200,169,110,0.3);">Qty</th>
                  <th align="right" style="padding:10px 12px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgba(200,169,110,0.8);border-bottom:1px solid rgba(200,169,110,0.3);">Price</th>
                  <th align="right" style="padding:10px 12px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgba(200,169,110,0.8);border-bottom:1px solid rgba(200,169,110,0.3);">Total</th>
                </tr>
              </thead>
              <tbody>
                {$rows_html}
              </tbody>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 36px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td></td>
                <td width="260">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding:6px 0;font-size:13px;color:rgba(244,237,224,0.75);">Subtotal</td>
                      <td align="right" style="padding:6px 0;font-size:13px;color:#f4ede0;">{$subtotal_display}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:13px;color:rgba(244,237,224,0.75);">Shipping</td>
                      <td align="right" style="padding:6px 0;font-size:13px;color:#f4ede0;">{$shipping_display}</td>
                    </tr>
                    {$discount_row}
                    <tr>
                      <td style="padding:14px 0 6px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#c8a96e;border-top:1px solid rgba(200,169,110,0.3);">Total</td>
                      <td align="right" style="padding:14px 0 6px;font-size:18px;font-weight:700;color:#c8a96e;border-top:1px solid rgba(200,169,110,0.3);">{$total_display}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        {$loyalty_block}
        <tr>
          <td style="padding:8px 36px 28px;">
            <p style="margin:0;font-size:12px;line-height:1.6;color:rgba(244,237,224,0.55);">
              If you have any questions about your order, simply reply to this email and our concierge team will be in touch.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 36px 28px;border-top:1px solid rgba(200,169,110,0.15);">
            <p style="margin:0;font-size:11px;line-height:1.6;color:rgba(244,237,224,0.45);text-align:center;letter-spacing:1px;">
              © {$year} AB STORE · Crafted with care<br>
              This is an automated message — your invoice is also available in your account.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
HTML;
}

function mail_send_order_invoice(string $recipient_email, array $order): void
{
    if (trim($recipient_email) === '') {
        return;
    }

    try {
        $mailer = mail_build_transport();
        $recipient_name = (string) (($order['customer']['name'] ?? '') ?: 'Valued Customer');
        $mailer->addAddress($recipient_email, $recipient_name);
        $mailer->isHTML(true);
        $order_number = (string) ($order['order_number'] ?? '');
        $mailer->Subject = $order_number !== ''
            ? "Your AB Store Invoice — {$order_number}"
            : 'Your AB Store Invoice';

        $logo_cid = mail_attach_logo($mailer);
        $mailer->Body = mail_render_invoice_email($order, $logo_cid);

        $alt_lines = ["Hello {$recipient_name},", '', "Thank you for your order at AB Store."];
        if ($order_number !== '') {
            $alt_lines[] = "Order: {$order_number}";
        }
        foreach ((array) ($order['items'] ?? []) as $item) {
            $alt_lines[] = sprintf(
                '  - %s %s x%d — %s',
                (string) ($item['brand'] ?? ''),
                (string) ($item['name'] ?? ''),
                (int) ($item['qty'] ?? 0),
                mail_format_currency((float) ($item['line_total'] ?? 0))
            );
        }
        $alt_lines[] = '';
        $alt_lines[] = 'Subtotal: ' . mail_format_currency((float) ($order['subtotal'] ?? 0));
        if (((float) ($order['discount_amount'] ?? 0)) > 0) {
            $alt_lines[] = 'Discount: -' . mail_format_currency((float) $order['discount_amount']);
        }
        $alt_lines[] = 'Shipping: ' . (((float) ($order['shipping_amount'] ?? 0)) > 0
            ? mail_format_currency((float) $order['shipping_amount'])
            : 'Free');
        $alt_lines[] = 'Total: ' . mail_format_currency((float) ($order['total_amount'] ?? 0));
        $mailer->AltBody = implode("\n", $alt_lines);

        $mailer->send();
    } catch (Exception $exception) {
        throw new RuntimeException('Unable to send invoice email.', 0, $exception);
    }
}

function mail_send_verification_code(string $recipient_email, string $recipient_name, string $verification_code): void
{
    try {
        $mailer = mail_build_transport();
        $mailer->addAddress($recipient_email, $recipient_name);
        $mailer->isHTML(true);
        $mailer->Subject = 'Verify your AB Store account';

        $logo_cid = mail_attach_logo($mailer);
        $mailer->Body = mail_render_otp_email(
            $recipient_name,
            'Verify your email',
            'Welcome to AB Store. Use the code below to verify your email address and activate your account.',
            $verification_code,
            'This code expires in 30 minutes.',
            $logo_cid
        );
        $mailer->AltBody = "Hello {$recipient_name},\n\nUse this 6-digit code to verify your AB Store account: {$verification_code}\n\nThis code expires in 30 minutes.\n\nIf you did not create an account, you can ignore this email.";

        $mailer->send();
    } catch (Exception $exception) {
        throw new RuntimeException('Unable to send verification email.', 0, $exception);
    }
}
