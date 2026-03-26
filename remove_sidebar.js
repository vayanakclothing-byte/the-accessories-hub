const fs = require('fs');
const path = require('path');

const baseDir = 'e:/HUB WEBSITE';

// 1. Update products.html
const htmlPath = path.join(baseDir, 'products.html');
let html = fs.readFileSync(htmlPath, 'utf8');
// remove mobile button
html = html.replace(/<button class="mobile-filter-btn" id="mobileFilterBtn">☰ Filters<\/button>/, '');
// remove sidebar
html = html.replace(/<aside class="filters-sidebar">[\s\S]*?<\/aside>/, '');
// remove active filters div
html = html.replace(/<div class="active-filters" id="activeFilters"><\/div>/, '');
fs.writeFileSync(htmlPath, html);

// 2. Update css/products.css
const cssPath = path.join(baseDir, 'css', 'products.css');
let css = fs.readFileSync(cssPath, 'utf8');
css = css.replace(/grid-template-columns:\s*260px\s*1fr;/, 'grid-template-columns: 1fr;');
fs.writeFileSync(cssPath, css);

// 3. Update js/products.js
const jsPath = path.join(baseDir, 'js', 'products.js');
let js = fs.readFileSync(jsPath, 'utf8');

// remove Set checkbox states
js = js.replace(/\/\/ Set checkbox states from URL[\s\S]*?applyFilters\(products\);/, 'applyFilters(products);');

// remove bindFilterEvents & bindMobileFilter
js = js.replace(/bindFilterEvents\(products\);/, '');
js = js.replace(/bindMobileFilter\(\);/, '');

// remove functions
js = js.replace(/function renderActiveFilters[\s\S]*?function removeFilter[\s\S]*?function clearAllFilters[\s\S]*?function bindFilterEvents[\s\S]*?function bindSortEvent/m, 'function bindSortEvent');
js = js.replace(/function bindMobileFilter\(\) {[\s\S]*?}\n\n/m, '');

// remove renderActiveFilters call from applyFilters
js = js.replace(/renderActiveFilters\(products\);/, '');

// remove button clear filters from no-results
js = js.replace(/<button class="btn btn-outline btn-sm" onclick="clearAllFilters\(\)">Clear All Filters<\/button>/, '');

fs.writeFileSync(jsPath, js);
console.log('Filter system successfully removed.');
