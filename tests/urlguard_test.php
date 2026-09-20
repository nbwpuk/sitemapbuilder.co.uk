<?php
declare(strict_types=1);

// Run: php tests/urlguard_test.php
if (PHP_SAPI !== 'cli') {
    exit;
}
const SMB = 1;
require __DIR__ . '/../src/UrlGuard.php';
require __DIR__ . '/../src/SafeFetcher.php';

$guard = new UrlGuard(['sitemapbuilder.co.uk'], [80, 443], ['203.0.113.9']);
$failures = 0;

function check(string $name, bool $ok): void
{
    global $failures;
    echo ($ok ? 'ok   ' : 'FAIL ') . $name . "\n";
    $failures += $ok ? 0 : 1;
}

function refused(UrlGuard $guard, string $url): bool
{
    try {
        $guard->parse($url);
        return false;
    } catch (GuardException) {
        return true;
    }
}

$bad = [
    'http://127.0.0.1/', 'http://10.0.0.1/', 'http://172.16.5.4/', 'http://192.168.1.1/',
    'http://169.254.169.254/latest/meta-data/', 'http://100.64.0.1/', 'http://0.0.0.0/',
    'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://[::ffff:7f00:1]/', 'http://[fe80::1]/',
    'http://[fd00::1]/', 'http://[64:ff9b::7f00:1]/', 'http://[2002:7f00:1::]/',
    'http://2130706433/', 'http://0x7f.1/', 'http://0177.0.0.1/', 'http://127.1/', 'http://localhost/',
    'http://intranet/', 'file:///etc/passwd', 'gopher://example.com/', 'ftp://example.com/x',
    'https://example.com:22/', 'https://example.com:8080/', 'https://user:pw@example.com/',
    'https://example.com/a b', "https://example.com/\r\nHost: x", 'https://exa mple.com/',
    'https://sitemapbuilder.co.uk/api/fetch.php', 'https://www.sitemapbuilder.co.uk/', '//example.com/',
    'https://example.com\\@127.0.0.1/', 'https://example.com./sitemap.xml', 'http://[::7f00:1]/', 'http://[::127.0.0.1]/', '', 'https://' . str_repeat('a', 3000) . '.com/',
];
foreach ($bad as $url) {
    check('refuse ' . substr(json_encode($url), 0, 70), refused($guard, $url));
}

$good = ['https://example.com/sitemap.xml', 'http://example.com:80/s.xml?x=1', 'https://sub.example.co.uk/a/b.xml.gz',
    'https://xn--bcher-kva.example/sitemap.xml', 'https://93.184.216.34/sitemap.xml', 'https://[2606:4700::1111]/s.xml'];
foreach ($good as $url) {
    check('accept ' . $url, !refused($guard, $url));
}

foreach (['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'] as $ip) {
    check('public  ' . $ip, UrlGuard::isPublicIp($ip));
}
foreach (['127.0.0.53', '10.1.2.3', '172.31.255.255', '192.168.0.1', '169.254.169.254', '100.127.0.1', '198.18.0.1',
    '224.0.0.1', '255.255.255.255', '::', '::1', '::ffff:10.0.0.1', 'fc00::1', 'fe80::1', 'ff02::1', '2001:db8::1', 'junk'] as $ip) {
    check('private ' . $ip, !UrlGuard::isPublicIp($ip));
}
check('url is rebuilt', $guard->parse('HTTPS://Example.COM/a?b=1#frag')['url'] === 'https://example.com:443/a?b=1');
check('ipv6 url is rebuilt', $guard->parse('http://[2606:4700::1111]/s.xml')['url'] === 'http://[2606:4700::1111]:80/s.xml');
check('own address refused', refused($guard, 'http://203.0.113.9/'));

$xml = '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://e.com/</loc></url></urlset>';
check('sniff urlset', SafeFetcher::looksLikeSitemap($xml));
check('sniff index with BOM', SafeFetcher::looksLikeSitemap("\xef\xbb\xbf \n<sitemapindex>"));
check('sniff gzip sitemap', SafeFetcher::looksLikeSitemap(gzencode($xml)));
check('refuse gzip html', !SafeFetcher::looksLikeSitemap(gzencode('<html><script>alert(1)</script></html>')));
check('refuse html', !SafeFetcher::looksLikeSitemap('<!DOCTYPE html><html><body><urlset>'));
check('refuse svg', !SafeFetcher::looksLikeSitemap('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>'));
check('refuse text', !SafeFetcher::looksLikeSitemap('hello <urlset>'));
check('refuse json', !SafeFetcher::looksLikeSitemap('{"a":"<urlset>"}'));

echo $failures === 0 ? "\nAll checks passed.\n" : "\n$failures check(s) FAILED.\n";
exit($failures === 0 ? 0 : 1);
