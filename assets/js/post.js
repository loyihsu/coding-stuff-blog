// Post and page enhancements: table of contents, heading anchors, previews of linked posts,
// image detail view, copy buttons for code.
(function () {
  var prose = document.querySelector('.prose');
  if (!prose) return;
  var root = document.documentElement;

  var headings = [].slice.call(prose.querySelectorAll('h1[id], h2[id], h3[id]'));
  var level = function (h) { return +h.tagName.charAt(1); };

  // Table of contents: a collapsible block above the article, or an expanded rail under
  // "customise" on wide screens (not in focus reading). Shown whenever the post has headings.
  if (headings.length && prose.closest('.reader')) {
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

    // Reading progress: the section being read (the last heading above a line a third of the way down
    // the window, or the last one at the end of the page) is marked, and an accent line down the list's
    // edge fills to it.
    var links = [].slice.call(list.querySelectorAll('a'));
    var mark = function () {
      var line = innerHeight / 3;
      var current = -1;
      headings.forEach(function (h, i) { if (h.getBoundingClientRect().top <= line) current = i; });
      if (innerHeight + scrollY >= root.scrollHeight - 2) current = headings.length - 1;
      links.forEach(function (a, i) {
        if (i === current) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
      var li = current < 0 ? null : links[current].parentNode;
      list.style.setProperty('--toc-read', li ? li.offsetTop + li.offsetHeight + 'px' : '0px');
    };

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
      mark(); // the list's size changes between the two places
    };
    place();
    wide.addEventListener('change', place);
    new MutationObserver(place).observe(root, { attributes: true, attributeFilter: ['data-quiet'] });

    // Sticky is bounded by the whole page grid, so near the bottom of the page the rail would run
    // into the footer. Shrink it there instead (it scrolls on its own), keeping 2rem clear.
    var footer = document.querySelector('.site-footer');
    var fitRail = function () {
      var room = footer.getBoundingClientRect().top - 32 - rail.getBoundingClientRect().top;
      rail.style.maxHeight = Math.max(0, Math.min(innerHeight - 64, room)) + 'px'; // 64px = the CSS 4rem
    };
    fitRail();
    // ponytail: measures every heading on each scroll; fine for a post's few dozen headings.
    addEventListener('scroll', mark, { passive: true });
    addEventListener('resize', mark);
    toc.addEventListener('toggle', mark);
    addEventListener('scroll', fitRail, { passive: true });
    addEventListener('resize', fitRail);
  }

  headings.forEach(function (h) {
    var a = document.createElement('a');
    a.className = 'heading-anchor';
    a.href = '#' + h.id;
    a.setAttribute('aria-label', 'Link to this section');
    a.textContent = '#';
    h.appendChild(a);
  });

  // Preview card when pointing at (or tabbing to) a link to another post. Post data is
  // embedded by _layouts/default.html. aria-hidden: the link text already names the post.
  var previews = document.getElementById('post-previews');
  if (previews) {
    var posts = JSON.parse(previews.textContent);
    var card = document.createElement('div');
    card.className = 'post-preview';
    card.hidden = true;
    card.setAttribute('aria-hidden', 'true');
    document.body.appendChild(card);

    var clean = function (path) { return path.replace(/\.html$/, '').replace(/\/$/, ''); };
    var postFor = function (a) {
      if (a.origin !== location.origin || clean(a.pathname) === clean(location.pathname)) return null;
      return posts[clean(a.pathname)];
    };
    var line = function (tag, className, text) {
      var el = document.createElement(tag);
      el.className = className;
      el.textContent = text;
      return el;
    };
    var timer;
    var hide = function () { clearTimeout(timer); card.hidden = true; };
    var show = function (a, post) {
      card.replaceChildren(line('p', 'post-preview-date', post.date), line('p', 'post-preview-title', post.title));
      if (post.summary) card.appendChild(line('p', 'post-preview-summary', post.summary));
      card.hidden = false;

      // Below the link, or above it when there isn't room; kept 16px inside the window.
      var r = a.getBoundingClientRect();
      var gap = 8;
      var above = r.bottom + gap + card.offsetHeight > innerHeight && r.top - gap - card.offsetHeight > 0;
      var left = Math.min(Math.max(16, r.left), root.clientWidth - card.offsetWidth - 16);
      card.classList.toggle('above', above);
      card.style.left = left + scrollX + 'px';
      card.style.top = (above ? r.top - gap - card.offsetHeight : r.bottom + gap) + scrollY + 'px';
    };
    var schedule = function (a, delay) {
      var post = postFor(a);
      if (!post) return;
      clearTimeout(timer);
      timer = setTimeout(function () { show(a, post); }, delay);
    };

    prose.addEventListener('pointerover', function (e) {
      var a = e.target.closest('a[href]');
      if (a && e.pointerType === 'mouse') schedule(a, 300);
    });
    prose.addEventListener('pointerout', function (e) {
      var a = e.target.closest('a[href]');
      if (a && !a.contains(e.relatedTarget)) hide();
    });
    prose.addEventListener('focusin', function (e) {
      if (e.target.matches('a[href]:focus-visible')) schedule(e.target, 0);
    });
    prose.addEventListener('focusout', hide);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
    addEventListener('resize', hide);
  }

  // Image detail view. Clicking an article image (or pressing Enter on it) zooms it out to fit the
  // window over a dimmed page. Clicking the image again zooms in (to full size, or twice the fitted
  // size for smaller images), to drag or scroll around; clicking once more fits it again. Clicking
  // the dimmed area around the image, or Escape, zooms it back into the article. A native <dialog>
  // handles focus and the backdrop.
  var images = [].filter.call(prose.querySelectorAll('img'), function (img) { return !img.closest('a'); });
  if (images.length) {
    var viewer = document.createElement('dialog');
    viewer.className = 'image-viewer';
    viewer.innerHTML = '<figure><img alt="" draggable="false" /></figure>';
    document.body.appendChild(viewer);
    var large = viewer.querySelector('img');
    var source = null;
    var closing = false;
    var zoomed = false;
    var drag = null;
    var dragged = false;
    var motion = function () { return !matchMedia('(prefers-reduced-motion: reduce)').matches; };
    var timing = { duration: 320, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' };

    // The transform that puts the large image, as laid out now, over another box.
    var over = function (box) {
      var now = large.getBoundingClientRect();
      var dx = box.left + box.width / 2 - (now.left + now.width / 2);
      var dy = box.top + box.height / 2 - (now.top + now.height / 2);
      return 'translate(' + dx + 'px, ' + dy + 'px) scale(' + box.width / now.width + ')';
    };
    var dim = function (out) {
      var frames = [{ opacity: 0 }, { opacity: 1 }];
      viewer.animate(out ? frames.reverse() : frames, Object.assign({ pseudoElement: '::backdrop' }, timing));
    };

    // Fit to the window, or zoom in keeping the clicked point under the pointer.
    var setZoom = function (on, x, y) {
      var before = large.getBoundingClientRect();
      var fx = (x - before.left) / before.width;
      var fy = (y - before.top) / before.height;
      zoomed = on;
      large.style.width = on ? Math.max(large.naturalWidth, before.width * 2) + 'px' : '';
      viewer.classList.toggle('is-zoomed', on);
      if (on) {
        var after = large.getBoundingClientRect();
        viewer.scrollLeft += after.left + fx * after.width - x;
        viewer.scrollTop += after.top + fy * after.height - y;
      } else {
        viewer.scrollTo(0, 0);
      }
      if (motion()) large.animate([{ transform: over(before) }, { transform: 'none' }], timing);
    };

    var open = function (img) {
      source = img;
      large.src = img.currentSrc || img.src;
      large.alt = img.alt;
      zoomed = false;
      large.style.width = '';
      viewer.classList.remove('is-zoomed');
      viewer.showModal();
      viewer.scrollTo(0, 0);
      if (!motion()) return;
      img.style.visibility = 'hidden'; // the image appears to lift out of the article
      dim(false);
      large.animate([{ transform: over(img.getBoundingClientRect()) }, { transform: 'none' }], timing);
    };

    var close = function () {
      if (!viewer.open || closing) return;
      if (zoomed) {
        zoomed = false;
        large.style.width = '';
        viewer.classList.remove('is-zoomed');
        viewer.scrollTo(0, 0);
      }
      if (!motion()) return viewer.close();
      closing = true;
      dim(true);
      large.animate([{ transform: 'none' }, { transform: over(source.getBoundingClientRect()) }], timing)
        .finished.then(function () { closing = false; viewer.close(); });
    };

    viewer.addEventListener('click', function (e) {
      if (e.target !== large) return close(); // the backdrop, or the space around the image
      if (!dragged) setZoom(!zoomed, e.clientX, e.clientY);
    });
    viewer.addEventListener('cancel', function (e) { e.preventDefault(); close(); }); // Escape
    viewer.addEventListener('close', function () { if (source) source.style.visibility = ''; });

    // Dragging a full-size image with the mouse scrolls it; touch screens scroll it natively.
    large.addEventListener('pointerdown', function (e) {
      dragged = false;
      if (!zoomed || e.pointerType !== 'mouse') return;
      drag = { x: e.clientX, y: e.clientY, left: viewer.scrollLeft, top: viewer.scrollTop };
      large.setPointerCapture(e.pointerId);
    });
    large.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      var dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) {
        dragged = true;
        viewer.classList.add('is-dragging');
      }
      viewer.scrollLeft = drag.left - dx;
      viewer.scrollTop = drag.top - dy;
    });
    var endDrag = function () {
      drag = null;
      viewer.classList.remove('is-dragging');
    };
    large.addEventListener('pointerup', endDrag);
    large.addEventListener('pointercancel', endDrag);

    images.forEach(function (img) {
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', img.alt ? 'Enlarge image: ' + img.alt : 'Enlarge image');
      img.addEventListener('click', function () { open(img); });
      img.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(img); }
      });
    });
  }

  // Copy buttons need the async clipboard API (HTTPS or localhost). Program output (```output,
  // ```error, ```warning) has none; a terminal session (```console) copies only its commands, without prompts or output.
  if (!navigator.clipboard) return;
  var commands = function (pre) {
    var code = pre.cloneNode(true);
    code.querySelectorAll('.gp, .go').forEach(function (el) { el.remove(); });
    return code.textContent.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).join('\n');
  };
  [].forEach.call(prose.querySelectorAll('pre'), function (pre) {
    if (pre.closest('.language-output, .language-error, .language-warning')) return;
    // Removed lines of a change (data-removed) aren't part of the code you'd paste.
    var text = pre.closest('.language-console') ? function () { return commands(pre); } : function () {
      var code = pre.cloneNode(true);
      code.querySelectorAll('.hl-removed').forEach(function (el) { el.remove(); });
      return code.textContent.replace(/\n$/, '');
    };
    var block = document.createElement('div');
    block.className = 'code-block';
    pre.parentNode.insertBefore(block, pre);
    block.appendChild(pre);

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-button';
    button.textContent = 'Copy';
    button.addEventListener('click', function () {
      navigator.clipboard.writeText(text()).then(function () {
        button.textContent = 'Copied';
        setTimeout(function () { button.textContent = 'Copy'; }, 1500);
      });
    });
    block.appendChild(button);
  });
})();
