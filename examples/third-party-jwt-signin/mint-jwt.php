<?php
/**
 * Third-party JWT sign-in (Option B — "Shadow Users").
 *
 * For cross-origin embeds where your own backend should provision a QL
 * account for each of your users automatically, without an interactive
 * QL login flow. The QL operator first registers your app in the
 * ql_auth_providers table with an id, a name, and a shared jwt_secret.
 * Your backend then mints an HS256 JWT for the logged-in user and POSTs
 * it to ql_third_party_signin to get back a QL session token.
 *
 * See docs/embedded-analytics.html#auth-option-b for the full JWT
 * payload/header spec and the shadow-user matching rules.
 *
 * Usage: php mint-jwt.php
 * (Requires: composer require firebase/php-jwt)
 */

require __DIR__ . '/vendor/autoload.php';

use Firebase\JWT\JWT;

$provider_id = getenv('QL_PROVIDER_ID') ?: 'acme-corp';   // matches ql_auth_providers.id
$jwt_secret  = getenv('QL_JWT_SECRET')  ?: 'change-me';   // matches ql_auth_providers.jwt_secret

function mint_ql_jwt(string $provider_id, string $jwt_secret, array $user): string
{
    $payload = [
        'sub'        => $user['id'],           // stable unique ID in your system
        'email'      => $user['email'],
        'first_name' => $user['first_name'] ?? null,
        'last_name'  => $user['last_name'] ?? null,
        'exp'        => time() + 3600,         // 1-hour expiry
    ];

    // Fourth argument sets the `kid` header field QL uses to look up the provider.
    return JWT::encode($payload, $jwt_secret, 'HS256', $provider_id);
}

function exchange_for_session_token(string $ql_base, string $jwt): array
{
    $ch = curl_init($ql_base . '/wp-admin/admin-ajax.php');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query(['action' => 'ql_third_party_signin', 'jwt' => $jwt]),
        CURLOPT_RETURNTRANSFER => true,
    ]);
    $body = curl_exec($ch);
    curl_close($ch);

    $json = json_decode($body, true);
    if (empty($json['success'])) {
        throw new RuntimeException('ql_third_party_signin failed: ' . ($json['data']['message'] ?? $body));
    }
    return $json['data']; // includes session_token and user
}

// Example: mint a token for one of your logged-in users and exchange it.
$jwt = mint_ql_jwt($provider_id, $jwt_secret, [
    'id'         => 'user-123',
    'email'      => 'jane@example.com',
    'first_name' => 'Jane',
    'last_name'  => 'Doe',
]);

$result = exchange_for_session_token('https://quantumlayers.com', $jwt);
echo "QL session token: {$result['session_token']}\n";
echo "Signed in as: {$result['user']['email']}\n";
