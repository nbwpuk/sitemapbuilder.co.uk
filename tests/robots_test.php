<?php
declare(strict_types=1);

// Run: php tests/robots_test.php
if (PHP_SAPI !== 'cli') {
    exit;
}
const SMB = 1;
require __DIR__ . '/../src/Robots.php';

$failures = 0;

function check(string $name, bool $ok): void
{
    global $failures;
    echo ($ok ? 'ok   ' : 'FAIL ') . $name . "\n";
    $failures += $ok ? 0 : 1;
}

$text = <<<TXT
\xef\xbb\xbf# comment
User-agent: *
Disallow: /private/   # trailing comment
Allow: /private/sitemap.xml
Disallow: /*.gz$
Disallow:
Crawl-delay: 5

Sitemap: https://example.com/sitemap_index.xml
sitemap: https://example.com/news.xml
Sitemap: https://example.com/news.xml
Sitemap: javascript:alert(1)

User-agent: otherbot
User-agent: SitemapBuilder/1.0
Disallow: /
TXT;

$any = Robots::parse(str_replace('SitemapBuilder/1.0', 'thirdbot', $text));
check('sitemap lines: valid, no duplicates', $any['sitemaps'] === ['https://example.com/sitemap_index.xml', 'https://example.com/news.xml']);
check('* group: 3 rules, the empty Disallow adds none', count($any['rules']) === 3);
check('* group: no match permits', Robots::allows($any['rules'], '/sitemap.xml'));
check('* group: disallow', !Robots::allows($any['rules'], '/private/other.xml'));
check('* group: the longer allow rule wins', Robots::allows($any['rules'], '/private/sitemap.xml'));
check('* group: wildcard with end anchor', !Robots::allows($any['rules'], '/maps/posts.xml.gz'));
check('* group: end anchor does not match a longer path', Robots::allows($any['rules'], '/maps/posts.xml.gz?x=1'));

$own = Robots::parse($text);
check('our group replaces the * group', !Robots::allows($own['rules'], '/sitemap.xml') && count($own['rules']) === 1);

$empty = Robots::parse("User-agent: sitemapbuilder\nDisallow:\n\nUser-agent: *\nDisallow: /\n");
check('our group with no rules permits all', Robots::allows($empty['rules'], '/sitemap.xml'));

$tie = [['allow' => false, 'path' => '/a'], ['allow' => true, 'path' => '/a']];
check('equal length: allow wins', Robots::allows($tie, '/a/b'));

check('matches: middle wildcards', Robots::matches('/a*/b*c', '/axx/bxxc/d') && !Robots::matches('/a*/b*c$', '/axx/bxxc/d'));
check('matches: anchored parts do not overlap', !Robots::matches('/ab*b$', '/ab') && Robots::matches('/ab*b$', '/abb'));
check('matches: many wildcards finish fast', !Robots::matches(str_repeat('*a', 400) . '$', '/' . str_repeat('a', 2000) . 'b'));

$big = Robots::parse("User-agent: *\n" . str_repeat("Disallow: /x\n", 5000) . str_repeat("Sitemap: https://e.com/s\n", 3));
check('rule limit', count($big['rules']) === 1000);

echo $failures === 0 ? "\nAll robots tests pass.\n" : "\n$failures FAILED\n";
exit($failures === 0 ? 0 : 1);
