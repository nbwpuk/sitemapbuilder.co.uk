<?php
declare(strict_types=1);

defined('SMB') || exit;

/**
 * Render CHANGELOG.md as HTML. Supported: "## " and "### " headings, "- " list items,
 * paragraphs, `code`, and bare https:// links. All text is escaped first.
 */
function changelog_inline(string $text): string
{
    $html = e($text);
    $html = preg_replace('/`([^`]+)`/', '<code>$1</code>', $html);
    // Links only outside <code>, and only to https addresses.
    return preg_replace_callback(
        '/<code>.*?<\/code>(*SKIP)(*FAIL)|https:\/\/[^\s<]+[^\s<.,;:)]/',
        static fn (array $m): string => '<a href="' . $m[0] . '">' . $m[0] . '</a>',
        $html
    );
}

function changelog_html(string $markdown): string
{
    $out = [];
    $inList = false;
    $closeList = static function () use (&$out, &$inList): void {
        if ($inList) {
            $out[] = '</ul>';
            $inList = false;
        }
    };
    foreach (preg_split('/\R/', $markdown) as $line) {
        $line = rtrim($line);
        if ($line === '' || str_starts_with($line, '# ')) {
            $closeList();
        } elseif (str_starts_with($line, '### ')) {
            $closeList();
            $out[] = '<h3>' . changelog_inline(substr($line, 4)) . '</h3>';
        } elseif (str_starts_with($line, '## ')) {
            $closeList();
            $out[] = '<h2>' . changelog_inline(substr($line, 3)) . '</h2>';
        } elseif (str_starts_with($line, '- ')) {
            if (!$inList) {
                $out[] = '<ul>';
                $inList = true;
            }
            $out[] = '<li>' . changelog_inline(substr($line, 2)) . '</li>';
        } else {
            $closeList();
            $out[] = '<p>' . changelog_inline($line) . '</p>';
        }
    }
    $closeList();
    return implode("\n", $out);
}
