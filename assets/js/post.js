// Post page enhancements: table of contents, heading anchors, copy buttons for code.
(function () {
  var prose = document.querySelector('.prose');
  if (!prose) return;

  var headings = [].slice.call(prose.querySelectorAll('h1[id], h2[id], h3[id]'));
  var level = function (h) { return +h.tagName.charAt(1); };

  // Table of contents: a collapsible block above the article, or an expanded rail under
  // "customise" on wide screens (not in focus reading). Shown whenever the post has headings.
  if (headings.length) {
    var top = Math.min.apply(null, headings.map(level));
    var toc = document.createElement('details');
    toc.className = 'toc';
    toc.innerHTML = '<summary>on this page</summary><ol></ol>';
    var list = toc.querySelector('ol');
    headings.forEach(function (h) {
      var li = document.createElement('li');
      li.className = 'toc-depth-' + (level(h) - top);
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent;
      li.appendChild(a);
      list.appendChild(li);
    });

    var rail = document.createElement('aside');
    rail.className = 'toc-rail';
    document.querySelector('.shell').appendChild(rail);

    var root = document.documentElement;
    var wide = matchMedia('(min-width: 1200px)');
    var place = function () {
      var inRail = wide.matches && !('quiet' in root.dataset);
      if (inRail && toc.parentNode !== rail) {
        rail.appendChild(toc);
        toc.open = true;
      } else if (!inRail && toc.nextSibling !== prose) {
        prose.parentNode.insertBefore(toc, prose);
        toc.open = false;
      }
    };
    place();
    wide.addEventListener('change', place);
    new MutationObserver(place).observe(root, { attributes: true, attributeFilter: ['data-quiet'] });
  }

  headings.forEach(function (h) {
    var a = document.createElement('a');
    a.className = 'heading-anchor';
    a.href = '#' + h.id;
    a.setAttribute('aria-label', 'Link to this section');
    a.textContent = '#';
    h.appendChild(a);
  });

  // Copy buttons need the async clipboard API (HTTPS or localhost).
  if (!navigator.clipboard) return;
  [].forEach.call(prose.querySelectorAll('pre'), function (pre) {
    var block = document.createElement('div');
    block.className = 'code-block';
    pre.parentNode.insertBefore(block, pre);
    block.appendChild(pre);

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-button';
    button.textContent = 'Copy';
    button.addEventListener('click', function () {
      navigator.clipboard.writeText(pre.innerText.replace(/\n$/, '')).then(function () {
        button.textContent = 'Copied';
        setTimeout(function () { button.textContent = 'Copy'; }, 1500);
      });
    });
    block.appendChild(button);
  });
})();
