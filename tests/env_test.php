<?php
declare(strict_types=1);

// Run: php tests/env_test.php
if (PHP_SAPI !== 'cli') {
    exit;
}
const SMB = 1;
require __DIR__ . '/../src/layout.php'; // Loads env.php and analytics.php.

$failures = 0;

function check(string $name, bool $ok): void
{
    global $failures;
    echo ($ok ? 'ok   ' : 'FAIL ') . $name . "\n";
    $failures += $ok ? 0 : 1;
}

/* ---- env_parse ---- */

$parsed = env_parse(implode("\r\n", [
    '# A comment',
    '',
    'PLAIN=value',
    'SPACED = value with spaces  ',
    'INLINE=value # a comment',
    'HASH_IN_VALUE=a#b',
    'DOUBLE="quoted # not a comment"',
    "SINGLE='it''s'",
    'EMPTY=',
    'export EXPORTED=1',
    'lower=ignored',
    'NO_EQUALS',
    'EQUALS_IN_VALUE=a=b',
    '  INDENTED=yes',
]));
check('plain value', ($parsed['PLAIN'] ?? null) === 'value');
check('spaces around = and at the end are removed', ($parsed['SPACED'] ?? null) === 'value with spaces');
check('inline comment is removed', ($parsed['INLINE'] ?? null) === 'value');
check('# without a space before it stays', ($parsed['HASH_IN_VALUE'] ?? null) === 'a#b');
check('double quotes are removed and keep the content', ($parsed['DOUBLE'] ?? null) === 'quoted # not a comment');
check('single quotes are removed', ($parsed['SINGLE'] ?? null) === "it''s");
check('empty value is an empty string', ($parsed['EMPTY'] ?? null) === '');
check('export prefix is permitted', ($parsed['EXPORTED'] ?? null) === '1');
check('lower-case keys are ignored', !isset($parsed['lower']));
check('lines without = are ignored', !isset($parsed['NO_EQUALS']));
check('= inside a value stays', ($parsed['EQUALS_IN_VALUE'] ?? null) === 'a=b');
check('indented lines work', ($parsed['INDENTED'] ?? null) === 'yes');
check('empty text gives an empty array', env_parse('') === []);

/* ---- env helpers (real environment variables win) ---- */

putenv('SMB_TEST_INT=42');
putenv('SMB_TEST_BAD_INT=-3');
putenv('SMB_TEST_BOOL_YES=Yes');
putenv('SMB_TEST_BOOL_NO=off');
putenv('SMB_TEST_BOOL_BAD=maybe');
putenv('SMB_TEST_LIST= a.example, b.example ,,');
putenv('SMB_TEST_EMPTY=');

check('env reads a variable', env('SMB_TEST_INT') === '42');
check('env gives the default for a missing key', env('SMB_TEST_MISSING', 'x') === 'x');
check('env gives null for a missing key without default', env('SMB_TEST_MISSING') === null);
check('env treats an empty value as missing', env('SMB_TEST_EMPTY', 'd') === 'd');
check('env_int reads a whole number', env_int('SMB_TEST_INT', 1) === 42);
check('env_int refuses a negative number', env_int('SMB_TEST_BAD_INT', 1) === 1);
check('env_int gives the default for a missing key', env_int('SMB_TEST_MISSING', 7) === 7);
check('env_bool reads yes', env_bool('SMB_TEST_BOOL_YES', false) === true);
check('env_bool reads off', env_bool('SMB_TEST_BOOL_NO', true) === false);
check('env_bool gives the default for an unknown word', env_bool('SMB_TEST_BOOL_BAD', true) === true);
check('env_list splits and trims', env_list('SMB_TEST_LIST', []) === ['a.example', 'b.example']);
check('env_list gives the default for a missing key', env_list('SMB_TEST_MISSING', ['d']) === ['d']);

/* ---- analytics_validate ---- */

$off = analytics_validate(null, null, null, false);
check('no settings: both trackers off', $off['ga'] === null && $off['matomo'] === null && $off['cookies'] === false);

$on = analytics_validate(' g-ab12cd34ef ', 'https://Stats.Example.com/matomo', '7', true);
check('GA id is trimmed and upper-cased', $on['ga'] === 'G-AB12CD34EF');
check('Matomo url gets a trailing slash and a lower-case host', $on['matomo']['url'] === 'https://stats.example.com/matomo/');
check('Matomo origin has no path', $on['matomo']['origin'] === 'https://stats.example.com');
check('Matomo site id is kept', $on['matomo']['site'] === '7');
check('cookies flag is kept', $on['cookies'] === true);

$root = analytics_validate(null, 'https://stats.example.com', '12', false);
check('Matomo at the root of a host', $root['matomo']['url'] === 'https://stats.example.com/');

$port = analytics_validate(null, 'https://stats.example.com:8443/', '1', false);
check('Matomo origin keeps a port', $port['matomo']['origin'] === 'https://stats.example.com:8443');

$badGa = [
    'UA-12345-1' => 'Universal Analytics id', 'G-' => 'no digits', 'G-abc' => 'too short',
    'G-ABC DEF' => 'space', "G-ABC'" => 'quote', 'GTM-ABCDEF' => 'Tag Manager id',
];
foreach ($badGa as $id => $why) {
    check("GA id refused: $why", analytics_validate($id, null, null, false)['ga'] === null);
}

$badMatomo = [
    ['http://stats.example.com/', '1', 'http scheme'],
    ['https://stats.example.com/', 'x', 'site id is not a number'],
    ['https://stats.example.com/', '', 'no site id'],
    ['', '1', 'no url'],
    ['https://user:pw@stats.example.com/', '1', 'credentials'],
    ['https://stats.example.com/?x=1', '1', 'query string'],
    ['https://stats.example.com/#x', '1', 'fragment'],
    ['https://stats.example.com/a b/', '1', 'space in path'],
    ["https://stats.example.com/\"", '1', 'quote in path'],
    ['https://-bad.example.com/', '1', 'hostname form'],
    ['javascript:alert(1)', '1', 'javascript scheme'],
];
foreach ($badMatomo as [$url, $site, $why]) {
    check("Matomo refused: $why", analytics_validate(null, $url, $site, false)['matomo'] === null);
}

/* ---- CSP sources and attributes follow the settings ---- */

$sources = analytics_csp_sources();
$config = analytics_config();
$expectScript = [];
if ($config['ga'] !== null) {
    $expectScript[] = 'https://www.googletagmanager.com';
}
if ($config['matomo'] !== null) {
    $expectScript[] = $config['matomo']['origin'];
}
check('csp script sources match the active trackers', $sources['script-src'] === $expectScript);
check('csp base policy is present', str_starts_with(csp(), "default-src 'none'; script-src 'self'"));
check('csp has no inline sources', !str_contains(csp(), 'unsafe'));
check('html attributes are empty without a tracker', analytics_on() || analytics_attributes() === '');

echo $failures === 0 ? "All checks passed\n" : "$failures check(s) failed\n";
exit($failures === 0 ? 0 : 1);
